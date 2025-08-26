const express = require('express');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const { query, transaction } = require('../utils/database');
const Joi = require('joi');
const router = express.Router();

// Esquemas de validación
const createRoleSchema = Joi.object({
  title: Joi.string().min(3).max(255).required().messages({
    'string.min': 'El título debe tener al menos 3 caracteres',
    'string.max': 'El título no puede exceder 255 caracteres',
    'any.required': 'El título es requerido'
  }),
  description: Joi.string().min(10).required().messages({
    'string.min': 'La descripción debe tener al menos 10 caracteres',
    'any.required': 'La descripción es requerida'
  }),
  requirements: Joi.string().optional(),
  department: Joi.string().max(100).optional(),
  location: Joi.string().max(255).optional(),
  employmentType: Joi.string().valid('full-time', 'part-time', 'contract', 'internship').default('full-time'),
  salaryRange: Joi.string().max(100).optional()
});

const updateRoleSchema = Joi.object({
  title: Joi.string().min(3).max(255).optional(),
  description: Joi.string().min(10).optional(),
  requirements: Joi.string().optional(),
  department: Joi.string().max(100).optional(),
  location: Joi.string().max(255).optional(),
  employmentType: Joi.string().valid('full-time', 'part-time', 'contract', 'internship').optional(),
  salaryRange: Joi.string().max(100).optional(),
  status: Joi.string().valid('active', 'inactive', 'closed').optional()
});

/**
 * GET /api/roles
 * Obtener todos los roles (con filtros opcionales)
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = 'active',
      department,
      employmentType,
      search,
      createdBy
    } = req.query;

    // Validar parámetros
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    // Construir consulta con filtros
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;

    // Filtro por estado
    if (status && status !== 'all') {
      whereConditions.push(`jr.status = $${paramCount}`);
      queryParams.push(status);
      paramCount++;
    }

    // Filtro por departamento
    if (department) {
      whereConditions.push(`jr.department ILIKE $${paramCount}`);
      queryParams.push(`%${department}%`);
      paramCount++;
    }

    // Filtro por tipo de empleo
    if (employmentType) {
      whereConditions.push(`jr.employment_type = $${paramCount}`);
      queryParams.push(employmentType);
      paramCount++;
    }

    // Filtro por creador (solo si el usuario está autenticado)
    if (createdBy && req.user) {
      whereConditions.push(`jr.created_by = $${paramCount}`);
      queryParams.push(createdBy);
      paramCount++;
    }

    // Búsqueda por texto
    if (search) {
      whereConditions.push(`(jr.title ILIKE $${paramCount} OR jr.description ILIKE $${paramCount + 1})`);
      queryParams.push(`%${search}%`, `%${search}%`);
      paramCount += 2;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Consulta principal
    const rolesQuery = `
      SELECT 
        jr.*,
        u.full_name as creator_name,
        u.company_name as creator_company,
        COUNT(a.id) as applications_count
      FROM public.job_roles jr
      LEFT JOIN public.users u ON jr.created_by = u.id
      LEFT JOIN public.applications a ON jr.id = a.job_role_id
      ${whereClause}
      GROUP BY jr.id, u.full_name, u.company_name
      ORDER BY jr.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    queryParams.push(limitNum, offset);

    // Consulta para contar total
    const countQuery = `
      SELECT COUNT(DISTINCT jr.id) as total
      FROM public.job_roles jr
      LEFT JOIN public.users u ON jr.created_by = u.id
      ${whereClause}
    `;

    const countParams = queryParams.slice(0, -2); // Remover limit y offset

    const [rolesResult, countResult] = await Promise.all([
      query(rolesQuery, queryParams),
      query(countQuery, countParams)
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      roles: rolesResult.rows,
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
    console.error('Error obteniendo roles:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * GET /api/roles/:id
 * Obtener un rol específico
 */
/**
 * GET /api/roles/:id
 * Obtener detalles de un rol específico
 * Respuesta: role con id, title, description, requirements, candidatesCount, createdAt, status, userId
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const roleQuery = `
      SELECT 
        jr.id,
        jr.title,
        jr.description,
        jr.requirements,
        jr.department,
        jr.location,
        jr.employment_type,
        jr.salary_range,
        jr.status,
        jr.created_by as user_id,
        jr.created_at,
        jr.updated_at,
        u.full_name as creator_name,
        u.company_name as creator_company,
        COUNT(a.id) as candidates_count
      FROM public.job_roles jr
      LEFT JOIN public.users u ON jr.created_by = u.id
      LEFT JOIN public.applications a ON jr.id = a.job_role_id
      WHERE jr.id = $1
      GROUP BY jr.id, jr.title, jr.description, jr.requirements, jr.department, 
               jr.location, jr.employment_type, jr.salary_range, jr.status, 
               jr.created_by, jr.created_at, jr.updated_at, u.full_name, u.company_name
    `;

    const result = await query(roleQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado'
      });
    }

    const role = result.rows[0];

    // Formatear la respuesta según los requerimientos
    const roleDetails = {
      id: role.id,
      title: role.title,
      description: role.description,
      requirements: role.requirements,
      department: role.department,
      location: role.location,
      employmentType: role.employment_type,
      salaryRange: role.salary_range,
      candidatesCount: parseInt(role.candidates_count),
      createdAt: role.created_at,
      status: role.status,
      userId: role.user_id,
      creator: {
        name: role.creator_name,
        company: role.creator_company
      }
    };

    res.json({
      success: true,
      data: {
        role: roleDetails
      }
    });
  } catch (error) {
    console.error('Error obteniendo rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener rol'
    });
  }
});

/**
 * POST /api/roles
 * Crear un nuevo rol
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Validar datos de entrada
    const { error: validationError, value } = createRoleSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        error: {
          message: validationError.details[0].message,
          status: 400
        }
      });
    }

    const {
      title,
      description,
      requirements,
      department,
      location,
      employmentType,
      salaryRange
    } = value;

    const insertQuery = `
      INSERT INTO public.job_roles (
        title, description, requirements, department, location, 
        employment_type, salary_range, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await query(insertQuery, [
      title,
      description,
      requirements,
      department,
      location,
      employmentType,
      salaryRange,
      req.user.id
    ]);

    res.status(201).json({
      message: 'Rol creado exitosamente',
      role: result.rows[0]
    });
  } catch (error) {
    console.error('Error creando rol:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * PUT /api/roles/:id
 * Actualizar un rol existente
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Validar datos de entrada
    const { error: validationError, value } = updateRoleSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        error: {
          message: validationError.details[0].message,
          status: 400
        }
      });
    }

    // Verificar que el rol existe y pertenece al usuario
    const existingRole = await query(
      'SELECT * FROM public.job_roles WHERE id = $1',
      [id]
    );

    if (existingRole.rows.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Rol no encontrado',
          status: 404
        }
      });
    }

    // Verificar permisos (solo el creador o admin puede editar)
    if (existingRole.rows[0].created_by !== req.user.id && req.user.profile?.role !== 'admin') {
      return res.status(403).json({
        error: {
          message: 'No tienes permisos para editar este rol',
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
        const dbField = key === 'employmentType' ? 'employment_type' : 
                       key === 'salaryRange' ? 'salary_range' : key;
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
      UPDATE public.job_roles 
      SET ${updates.join(', ')}, updated_at = NOW() 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, values);

    res.json({
      message: 'Rol actualizado exitosamente',
      role: result.rows[0]
    });
  } catch (error) {
    console.error('Error actualizando rol:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * DELETE /api/roles/:id
 * Eliminar un rol
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el rol existe y pertenece al usuario
    const existingRole = await query(
      'SELECT * FROM public.job_roles WHERE id = $1',
      [id]
    );

    if (existingRole.rows.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Rol no encontrado',
          status: 404
        }
      });
    }

    // Verificar permisos
    if (existingRole.rows[0].created_by !== req.user.id && req.user.profile?.role !== 'admin') {
      return res.status(403).json({
        error: {
          message: 'No tienes permisos para eliminar este rol',
          status: 403
        }
      });
    }

    // Verificar si hay aplicaciones asociadas
    const applicationsCount = await query(
      'SELECT COUNT(*) as count FROM public.applications WHERE job_role_id = $1',
      [id]
    );

    if (parseInt(applicationsCount.rows[0].count) > 0) {
      // En lugar de eliminar, cambiar estado a 'closed'
      await query(
        'UPDATE public.job_roles SET status = $1, updated_at = NOW() WHERE id = $2',
        ['closed', id]
      );

      return res.json({
        message: 'Rol cerrado exitosamente (tiene aplicaciones asociadas)'
      });
    }

    // Eliminar el rol si no tiene aplicaciones
    await query('DELETE FROM public.job_roles WHERE id = $1', [id]);

    res.json({
      message: 'Rol eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando rol:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * GET /api/roles/:id/applications
 * Obtener aplicaciones de un rol específico
 */
router.get('/:id/applications', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    // Verificar que el rol existe y el usuario tiene permisos
    const roleCheck = await query(
      'SELECT created_by FROM public.job_roles WHERE id = $1',
      [id]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Rol no encontrado',
          status: 404
        }
      });
    }

    if (roleCheck.rows[0].created_by !== req.user.id && req.user.profile?.role !== 'admin') {
      return res.status(403).json({
        error: {
          message: 'No tienes permisos para ver las aplicaciones de este rol',
          status: 403
        }
      });
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE a.job_role_id = $1';
    let queryParams = [id];
    let paramCount = 2;

    if (status) {
      whereClause += ` AND a.status = $${paramCount}`;
      queryParams.push(status);
      paramCount++;
    }

    const applicationsQuery = `
      SELECT 
        a.*,
        e.score,
        e.summary as evaluation_summary
      FROM public.applications a
      LEFT JOIN public.evaluations e ON a.id = e.application_id
      ${whereClause}
      ORDER BY a.applied_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    queryParams.push(limitNum, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM public.applications a
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

module.exports = router;