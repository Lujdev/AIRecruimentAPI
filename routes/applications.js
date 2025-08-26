const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { query, transaction } = require('../utils/database');
const { supabase } = require('../config/supabase');
const { evaluateCV } = require('../config/groq');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Configuración de multer para subida de archivos
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB por defecto
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  }
});

// Esquemas de validación
const createApplicationSchema = Joi.object({
  jobRoleId: Joi.string().uuid().required().messages({
    'string.uuid': 'ID de rol inválido',
    'any.required': 'El ID del rol es requerido'
  }),
  candidateName: Joi.string().min(2).max(255).required().messages({
    'string.min': 'El nombre debe tener al menos 2 caracteres',
    'string.max': 'El nombre no puede exceder 255 caracteres',
    'any.required': 'El nombre del candidato es requerido'
  }),
  candidateEmail: Joi.string().email().required().messages({
    'string.email': 'Debe ser un email válido',
    'any.required': 'El email del candidato es requerido'
  }),
  candidatePhone: Joi.string().max(50).optional()
});

const updateApplicationSchema = Joi.object({
  status: Joi.string().valid('pending', 'reviewing', 'interviewed', 'hired', 'rejected').optional(),
  candidateName: Joi.string().min(2).max(255).optional(),
  candidateEmail: Joi.string().email().optional(),
  candidatePhone: Joi.string().max(50).optional()
});

/**
 * Función para subir archivo a Supabase Storage
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} fileName - Nombre del archivo
 * @param {string} contentType - Tipo de contenido
 * @returns {Promise<string>} - URL del archivo subido
 */
async function uploadToSupabaseStorage(fileBuffer, fileName, contentType) {
  try {
    const { data, error } = await supabase.storage
      .from('cvs')
      .upload(fileName, fileBuffer, {
        contentType,
        upsert: false
      });

    if (error) {
      throw new Error(`Error subiendo archivo: ${error.message}`);
    }

    // Obtener URL pública del archivo
    const { data: urlData } = supabase.storage
      .from('cvs')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error en uploadToSupabaseStorage:', error);
    throw error;
  }
}

/**
 * Función para extraer texto de PDF
 * @param {Buffer} pdfBuffer - Buffer del PDF
 * @returns {Promise<string>} - Texto extraído
 */
async function extractTextFromPDF(pdfBuffer) {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extrayendo texto del PDF:', error);
    throw new Error('No se pudo extraer texto del PDF');
  }
}

/**
 * POST /api/applications
 * Crear una nueva aplicación con CV
 */
router.post('/', upload.single('cv'), async (req, res) => {
  try {
    // Validar que se subió un archivo
    if (!req.file) {
      return res.status(400).json({
        error: {
          message: 'Archivo CV requerido',
          status: 400
        }
      });
    }

    // Validar datos del formulario
    const { error: validationError, value } = createApplicationSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        error: {
          message: validationError.details[0].message,
          status: 400
        }
      });
    }

    const { jobRoleId, candidateName, candidateEmail, candidatePhone } = value;

    // Verificar que el rol existe y está activo
    const roleCheck = await query(
      'SELECT id, title, description FROM public.job_roles WHERE id = $1 AND status = $2',
      [jobRoleId, 'active']
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Rol no encontrado o no está activo',
          status: 404
        }
      });
    }

    const jobRole = roleCheck.rows[0];

    // Verificar si ya existe una aplicación del mismo email para este rol
    const existingApplication = await query(
      'SELECT id FROM public.applications WHERE job_role_id = $1 AND candidate_email = $2',
      [jobRoleId, candidateEmail]
    );

    if (existingApplication.rows.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Ya existe una aplicación de este candidato para este rol',
          status: 409
        }
      });
    }

    // Generar nombre único para el archivo
    const fileExtension = '.pdf';
    const uniqueFileName = `${uuidv4()}_${candidateName.replace(/[^a-zA-Z0-9]/g, '_')}${fileExtension}`;

    let cvFilePath = '';
    let cvText = '';
    let applicationId = '';

    await transaction(async (client) => {
      try {
        // Subir archivo a Supabase Storage
        cvFilePath = await uploadToSupabaseStorage(
          req.file.buffer,
          uniqueFileName,
          req.file.mimetype
        );

        // Extraer texto del PDF
        cvText = await extractTextFromPDF(req.file.buffer);

        // Crear aplicación en la base de datos
        const applicationResult = await client.query(
          `INSERT INTO public.applications (
            job_role_id, candidate_name, candidate_email, candidate_phone, 
            cv_file_path, cv_text
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *`,
          [jobRoleId, candidateName, candidateEmail, candidatePhone, cvFilePath, cvText]
        );

        applicationId = applicationResult.rows[0].id;

        // Evaluar CV con IA en segundo plano (no bloquear la respuesta)
        setImmediate(async () => {
          try {
            console.log(`🤖 Iniciando evaluación de CV para aplicación ${applicationId}`);
            
            const evaluation = await evaluateCV(cvText, jobRole.description);
            
            await query(
              `INSERT INTO public.evaluations (
                application_id, score, strengths, weaknesses, summary, model_used
              ) VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                applicationId,
                evaluation.score,
                JSON.stringify(evaluation.strengths),
                JSON.stringify(evaluation.weaknesses),
                evaluation.summary,
                'llama-3.1-8b-instant'
              ]
            );
            
            console.log(`✅ Evaluación completada para aplicación ${applicationId}`);
          } catch (evalError) {
            console.error(`❌ Error evaluando CV para aplicación ${applicationId}:`, evalError);
          }
        });

        return applicationResult.rows[0];
      } catch (error) {
        // Si hay error, intentar limpiar el archivo subido
        if (cvFilePath) {
          try {
            await supabase.storage
              .from('cvs')
              .remove([uniqueFileName]);
          } catch (cleanupError) {
            console.error('Error limpiando archivo:', cleanupError);
          }
        }
        throw error;
      }
    });

    res.status(201).json({
      message: 'Aplicación creada exitosamente. La evaluación se procesará en breve.',
      application: {
        id: applicationId,
        jobRoleId,
        candidateName,
        candidateEmail,
        candidatePhone,
        status: 'pending',
        cvFilePath
      }
    });
  } catch (error) {
    console.error('Error creando aplicación:', error);
    
    if (error.message.includes('Solo se permiten archivos PDF')) {
      return res.status(400).json({
        error: {
          message: 'Solo se permiten archivos PDF',
          status: 400
        }
      });
    }
    
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * GET /api/applications
 * Obtener aplicaciones (solo para usuarios autenticados)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      jobRoleId,
      search
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;

    // Solo mostrar aplicaciones de roles creados por el usuario (a menos que sea admin)
    if (req.user.profile?.role !== 'admin') {
      whereConditions.push(`jr.created_by = $${paramCount}`);
      queryParams.push(req.user.id);
      paramCount++;
    }

    // Filtros adicionales
    if (status) {
      whereConditions.push(`a.status = $${paramCount}`);
      queryParams.push(status);
      paramCount++;
    }

    if (jobRoleId) {
      whereConditions.push(`a.job_role_id = $${paramCount}`);
      queryParams.push(jobRoleId);
      paramCount++;
    }

    if (search) {
      whereConditions.push(`(a.candidate_name ILIKE $${paramCount} OR a.candidate_email ILIKE $${paramCount + 1})`);
      queryParams.push(`%${search}%`, `%${search}%`);
      paramCount += 2;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const applicationsQuery = `
      SELECT 
        a.*,
        jr.title as job_title,
        jr.department,
        e.score,
        e.strengths,
        e.weaknesses,
        e.summary as evaluation_summary
      FROM public.applications a
      JOIN public.job_roles jr ON a.job_role_id = jr.id
      LEFT JOIN public.evaluations e ON a.id = e.application_id
      ${whereClause}
      ORDER BY a.applied_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    queryParams.push(limitNum, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM public.applications a
      JOIN public.job_roles jr ON a.job_role_id = jr.id
      ${whereClause}
    `;

    const countParams = queryParams.slice(0, -2);

    const [applicationsResult, countResult] = await Promise.all([
      query(applicationsQuery, queryParams),
      query(countQuery, countParams)
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      applications: applicationsResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Error obteniendo aplicaciones:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * GET /api/applications/:id
 * Obtener una aplicación específica
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const applicationQuery = `
      SELECT 
        a.*,
        jr.title as job_title,
        jr.description as job_description,
        jr.requirements as job_requirements,
        jr.department,
        jr.created_by as job_creator_id,
        e.score,
        e.strengths,
        e.weaknesses,
        e.summary as evaluation_summary,
        e.evaluation_date
      FROM public.applications a
      JOIN public.job_roles jr ON a.job_role_id = jr.id
      LEFT JOIN public.evaluations e ON a.id = e.application_id
      WHERE a.id = $1
    `;

    const result = await query(applicationQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Aplicación no encontrada',
          status: 404
        }
      });
    }

    const application = result.rows[0];

    // Verificar permisos
    if (req.user.profile?.role !== 'admin' && application.job_creator_id !== req.user.id) {
      return res.status(403).json({
        error: {
          message: 'No tienes permisos para ver esta aplicación',
          status: 403
        }
      });
    }

    res.json({
      application
    });
  } catch (error) {
    console.error('Error obteniendo aplicación:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * PUT /api/applications/:id
 * Actualizar una aplicación
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Validar datos de entrada
    const { error: validationError, value } = updateApplicationSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        error: {
          message: validationError.details[0].message,
          status: 400
        }
      });
    }

    // Verificar que la aplicación existe y el usuario tiene permisos
    const applicationCheck = await query(
      `SELECT a.*, jr.created_by as job_creator_id
       FROM public.applications a
       JOIN public.job_roles jr ON a.job_role_id = jr.id
       WHERE a.id = $1`,
      [id]
    );

    if (applicationCheck.rows.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Aplicación no encontrada',
          status: 404
        }
      });
    }

    const application = applicationCheck.rows[0];

    // Verificar permisos
    if (req.user.profile?.role !== 'admin' && application.job_creator_id !== req.user.id) {
      return res.status(403).json({
        error: {
          message: 'No tienes permisos para editar esta aplicación',
          status: 403
        }
      });
    }

    // Construir consulta de actualización dinámica
    const updates = [];
    const values = [];
    let paramCount = 1;

    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined) {
        const dbField = key === 'candidateName' ? 'candidate_name' :
                       key === 'candidateEmail' ? 'candidate_email' :
                       key === 'candidatePhone' ? 'candidate_phone' : key;
        updates.push(`${dbField} = $${paramCount}`);
        values.push(val);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        error: {
          message: 'No hay campos para actualizar',
          status: 400
        }
      });
    }

    values.push(id);
    const updateQuery = `
      UPDATE public.applications 
      SET ${updates.join(', ')}, updated_at = NOW() 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, values);

    res.json({
      message: 'Aplicación actualizada exitosamente',
      application: result.rows[0]
    });
  } catch (error) {
    console.error('Error actualizando aplicación:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * DELETE /api/applications/:id
 * Eliminar una aplicación
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la aplicación existe y el usuario tiene permisos
    const applicationCheck = await query(
      `SELECT a.*, jr.created_by as job_creator_id
       FROM public.applications a
       JOIN public.job_roles jr ON a.job_role_id = jr.id
       WHERE a.id = $1`,
      [id]
    );

    if (applicationCheck.rows.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Aplicación no encontrada',
          status: 404
        }
      });
    }

    const application = applicationCheck.rows[0];

    // Verificar permisos
    if (req.user.profile?.role !== 'admin' && application.job_creator_id !== req.user.id) {
      return res.status(403).json({
        error: {
          message: 'No tienes permisos para eliminar esta aplicación',
          status: 403
        }
      });
    }

    await transaction(async (client) => {
      // Eliminar evaluaciones asociadas
      await client.query('DELETE FROM public.evaluations WHERE application_id = $1', [id]);
      
      // Eliminar aplicación
      await client.query('DELETE FROM public.applications WHERE id = $1', [id]);
      
      // Intentar eliminar archivo del storage
      if (application.cv_file_path) {
        try {
          const fileName = application.cv_file_path.split('/').pop();
          await supabase.storage
            .from('cvs')
            .remove([fileName]);
        } catch (storageError) {
          console.error('Error eliminando archivo del storage:', storageError);
          // No fallar la operación si hay error eliminando el archivo
        }
      }
    });

    res.json({
      message: 'Aplicación eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando aplicación:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

module.exports = router;