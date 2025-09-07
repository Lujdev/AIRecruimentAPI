const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../utils/database');
const { evaluateCVWithText, MODEL_TEXT } = require('../config/gemini');
const Joi = require('joi');
const router = express.Router();

// Esquemas de validación
const reevaluateSchema = Joi.object({
  applicationId: Joi.string().uuid().required().messages({
    'string.uuid': 'ID de aplicación inválido',
    'any.required': 'El ID de la aplicación es requerido'
  })
});

/**
 * GET /api/evaluations
 * Obtener evaluaciones (solo para usuarios autenticados)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      jobRoleId,
      minScore,
      maxScore,
      sortBy = 'evaluation_date',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;

    // Solo mostrar evaluaciones de roles creados por el usuario (a menos que sea admin)
    if (req.user.profile?.role !== 'admin') {
      whereConditions.push(`jr.created_by = ${paramCount}`);
      queryParams.push(req.user.id);
      paramCount++;
    }

    // Filtros adicionales
    if (jobRoleId) {
      whereConditions.push(`a.job_role_id = ${paramCount}`);
      queryParams.push(jobRoleId);
      paramCount++;
    }

    if (minScore !== undefined) {
      const score = parseFloat(minScore);
      if (!isNaN(score)) {
        whereConditions.push(`e.score >= ${paramCount}`);
        queryParams.push(score);
        paramCount++;
      }
    }

    if (maxScore !== undefined) {
      const score = parseFloat(maxScore);
      if (!isNaN(score)) {
        whereConditions.push(`e.score <= ${paramCount}`);
        queryParams.push(score);
        paramCount++;
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Validar campos de ordenamiento
    const validSortFields = ['evaluation_date', 'score', 'candidate_name', 'job_title'];
    const validSortOrders = ['asc', 'desc'];
    
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'evaluation_date';
    const sortDirection = validSortOrders.includes(sortOrder.toLowerCase()) ? sortOrder.toUpperCase() : 'DESC';

    const evaluationsQuery = `
      SELECT 
        e.*,
        a.candidate_name,
        a.candidate_email,
        a.status as application_status,
        a.applied_at,
        jr.title as job_title,
        jr.department,
        jr.id as job_role_id
      FROM public.evaluations e
      JOIN public.applications a ON e.application_id = a.id
      JOIN public.job_roles jr ON a.job_role_id = jr.id
      ${whereClause}
      ORDER BY ${sortField === 'candidate_name' ? 'a.candidate_name' : 
                sortField === 'job_title' ? 'jr.title' : 
                'e.' + sortField} ${sortDirection}
      LIMIT ${paramCount} OFFSET ${paramCount + 1}
    `;

    queryParams.push(limitNum, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM public.evaluations e
      JOIN public.applications a ON e.application_id = a.id
      JOIN public.job_roles jr ON a.job_role_id = jr.id
      ${whereClause}
    `;

    const countParams = queryParams.slice(0, -2);

    const [evaluationsResult, countResult] = await Promise.all([
      query(evaluationsQuery, queryParams),
      query(countQuery, countParams)
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      evaluations: evaluationsResult.rows,
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
    console.error('Error obteniendo evaluaciones:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * GET /api/evaluations/:id
 * Obtener una evaluación específica
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const evaluationQuery = `
      SELECT 
        e.*,
        a.candidate_name,
        a.candidate_email,
        a.candidate_phone,
        a.status as application_status,
        a.applied_at,
        a.cv_file_path,
        jr.title as job_title,
        jr.description as job_description,
        jr.requirements as job_requirements,
        jr.department,
        jr.created_by as job_creator_id
      FROM public.evaluations e
      JOIN public.applications a ON e.application_id = a.id
      JOIN public.job_roles jr ON a.job_role_id = jr.id
      WHERE e.id = $1
    `;

    const result = await query(evaluationQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Evaluación no encontrada',
          status: 404
        }
      });
    }

    const evaluation = result.rows[0];

    // Verificar permisos
    if (req.user.profile?.role !== 'admin' && evaluation.job_creator_id !== req.user.id) {
      return res.status(403).json({
        error: {
          message: 'No tienes permisos para ver esta evaluación',
          status: 403
        }
      });
    }

    res.json({
      evaluation
    });
  } catch (error) {
    console.error('Error obteniendo evaluación:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * GET /api/evaluations/application/:applicationId
 * Obtener evaluación por ID de aplicación
 */
router.get('/application/:applicationId', authenticateToken, async (req, res) => {
  try {
    const { applicationId } = req.params;

    const evaluationQuery = `
      SELECT 
        e.*,
        a.candidate_name,
        a.candidate_email,
        a.candidate_phone,
        a.status as application_status,
        a.applied_at,
        a.cv_file_path,
        jr.title as job_title,
        jr.description as job_description,
        jr.requirements as job_requirements,
        jr.department,
        jr.created_by as job_creator_id
      FROM public.evaluations e
      JOIN public.applications a ON e.application_id = a.id
      JOIN public.job_roles jr ON a.job_role_id = jr.id
      WHERE a.id = $1
    `;

    const result = await query(evaluationQuery, [applicationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Evaluación no encontrada para esta aplicación',
          status: 404
        }
      });
    }

    const evaluation = result.rows[0];

    // Verificar permisos
    if (req.user.profile?.role !== 'admin' && evaluation.job_creator_id !== req.user.id) {
      return res.status(403).json({
        error: {
          message: 'No tienes permisos para ver esta evaluación',
          status: 403
        }
      });
    }

    res.json({
      evaluation
    });
  } catch (error) {
    console.error('Error obteniendo evaluación por aplicación:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * POST /api/evaluations/reevaluate
 * Re-evaluar un CV
 */
router.post('/reevaluate', authenticateToken, async (req, res) => {
  try {
    // Validar datos de entrada
    const { error: validationError, value } = reevaluateSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        error: {
          message: validationError.details[0].message,
          status: 400
        }
      });
    }

    const { applicationId } = value;

    // Verificar que la aplicación existe y el usuario tiene permisos
    const applicationCheck = await query(
      `SELECT 
        a.id,
        a.cv_text,
        jr.description as job_description,
        jr.created_by as job_creator_id
       FROM public.applications a
       JOIN public.job_roles jr ON a.job_role_id = jr.id
       WHERE a.id = $1`,
      [applicationId]
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
          message: 'No tienes permisos para re-evaluar esta aplicación',
          status: 403
        }
      });
    }

    // Verificar que hay texto del CV
    if (!application.cv_text) {
      return res.status(400).json({
        error: {
          message: 'No hay texto del CV disponible para evaluar',
          status: 400
        }
      });
    }

    try {
      // Realizar nueva evaluación
      console.log(`🔄 Re-evaluando CV para aplicación ${applicationId} con Gemini`);
      
      const evaluation = await evaluateCVWithText(application.cv_text, application.job_description);
      
      // Verificar si ya existe una evaluación
      const existingEvaluation = await query(
        'SELECT id FROM public.evaluations WHERE application_id = $1',
        [applicationId]
      );

      let result;
      if (existingEvaluation.rows.length > 0) {
        // Actualizar evaluación existente
        result = await query(
          `UPDATE public.evaluations 
           SET score = $1, strengths = $2, weaknesses = $3, summary = $4, 
               model_used = $5, evaluation_date = NOW()
           WHERE application_id = $6
           RETURNING *`,
          [
            evaluation.score,
            JSON.stringify(evaluation.strengths),
            JSON.stringify(evaluation.weaknesses),
            evaluation.summary,
            MODEL_TEXT,
            applicationId
          ]
        );
      } else {
        // Crear nueva evaluación
        result = await query(
          `INSERT INTO public.evaluations (
            application_id, score, strengths, weaknesses, summary, model_used
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *`,
          [
            applicationId,
            evaluation.score,
            JSON.stringify(evaluation.strengths),
            JSON.stringify(evaluation.weaknesses),
            evaluation.summary,
            MODEL_TEXT,
          ]
        );
      }
      
      console.log(`✅ Re-evaluación completada para aplicación ${applicationId}`);
      
      res.json({
        message: 'CV re-evaluado exitosamente',
        evaluation: result.rows[0]
      });
    } catch (evalError) {
      console.error(`❌ Error re-evaluando CV para aplicación ${applicationId}:`, evalError);
      res.status(500).json({
        error: {
          message: 'Error procesando la evaluación del CV',
          status: 500
        }
      });
    }
  } catch (error) {
    console.error('Error en re-evaluación:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * GET /api/evaluations/stats
 * Obtener estadísticas de evaluaciones
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { jobRoleId } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;

    // Solo mostrar estadísticas de roles creados por el usuario (a menos que sea admin)
    if (req.user.profile?.role !== 'admin') {
      whereConditions.push(`jr.created_by = ${paramCount}`);
      queryParams.push(req.user.id);
      paramCount++;
    }

    if (jobRoleId) {
      whereConditions.push(`a.job_role_id = ${paramCount}`);
      queryParams.push(jobRoleId);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const statsQuery = `
      SELECT 
        COUNT(*) as total_evaluations,
        AVG(e.score) as average_score,
        MIN(e.score) as min_score,
        MAX(e.score) as max_score,
        COUNT(CASE WHEN e.score >= 80 THEN 1 END) as high_score_count,
        COUNT(CASE WHEN e.score >= 60 AND e.score < 80 THEN 1 END) as medium_score_count,
        COUNT(CASE WHEN e.score < 60 THEN 1 END) as low_score_count
      FROM public.evaluations e
      JOIN public.applications a ON e.application_id = a.id
      JOIN public.job_roles jr ON a.job_role_id = jr.id
      ${whereClause}
    `;

    const result = await query(statsQuery, queryParams);
    const stats = result.rows[0];

    // Convertir a números y formatear
    const formattedStats = {
      totalEvaluations: parseInt(stats.total_evaluations) || 0,
      averageScore: stats.average_score ? parseFloat(stats.average_score).toFixed(2) : 0,
      minScore: stats.min_score || 0,
      maxScore: stats.max_score || 0,
      scoreDistribution: {
        high: parseInt(stats.high_score_count) || 0, // >= 80
        medium: parseInt(stats.medium_score_count) || 0, // 60-79
        low: parseInt(stats.low_score_count) || 0 // < 60
      }
    };

    res.json({
      stats: formattedStats
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * DELETE /api/evaluations/:id
 * Eliminar una evaluación
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la evaluación existe y el usuario tiene permisos
    const evaluationCheck = await query(
      `SELECT e.*, jr.created_by as job_creator_id
       FROM public.evaluations e
       JOIN public.applications a ON e.application_id = a.id
       JOIN public.job_roles jr ON a.job_role_id = jr.id
       WHERE e.id = $1`,
      [id]
    );

    if (evaluationCheck.rows.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Evaluación no encontrada',
          status: 404
        }
      });
    }

    const evaluation = evaluationCheck.rows[0];

    // Verificar permisos
    if (req.user.profile?.role !== 'admin' && evaluation.job_creator_id !== req.user.id) {
      return res.status(403).json({
        error: {
          message: 'No tienes permisos para eliminar esta evaluación',
          status: 403
        }
      });
    }

    await query('DELETE FROM public.evaluations WHERE id = $1', [id]);

    res.json({
      message: 'Evaluación eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando evaluación:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

module.exports = router;