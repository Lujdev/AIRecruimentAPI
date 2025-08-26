const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../utils/database');
const router = express.Router();

/**
 * GET /api/candidates
 * Obtener todos los candidatos de la empresa
 * Respuesta: candidates[] con id, name, email, roleTitle, score, appliedAt, status
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = 'applied_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Construir la consulta base
    let whereConditions = ['jr.created_by = $1'];
    let queryParams = [userId];
    let paramIndex = 2;

    // Filtro por estado
    if (status && status !== 'all') {
      whereConditions.push(`a.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    // Filtro de búsqueda por nombre o email
    if (search && search.trim()) {
      whereConditions.push(`(a.candidate_name ILIKE $${paramIndex} OR a.candidate_email ILIKE $${paramIndex})`);
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Validar campos de ordenamiento
    const validSortFields = ['applied_at', 'candidate_name', 'score', 'status'];
    const validSortOrders = ['ASC', 'DESC'];
    
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'applied_at';
    const finalSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    // Consulta principal para obtener candidatos
    const candidatesQuery = `
      SELECT 
        a.id,
        a.candidate_name as name,
        a.candidate_email as email,
        jr.title as role_title,
        COALESCE(e.score, 0) as score,
        a.applied_at,
        a.status,
        jr.id as role_id
      FROM applications a
      JOIN job_roles jr ON a.job_role_id = jr.id
      LEFT JOIN evaluations e ON e.application_id = a.id
      WHERE ${whereClause}
      ORDER BY ${finalSortBy === 'score' ? 'COALESCE(e.score, 0)' : finalSortBy} ${finalSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(parseInt(limit), offset);

    const candidatesResult = await query(candidatesQuery, queryParams);

    // Consulta para obtener el total de candidatos (para paginación)
    const countQuery = `
      SELECT COUNT(DISTINCT a.id) as total
      FROM applications a
      JOIN job_roles jr ON a.job_role_id = jr.id
      WHERE ${whereClause}
    `;

    const countResult = await query(countQuery, queryParams.slice(0, -2)); // Remover limit y offset
    const totalCandidates = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalCandidates / parseInt(limit));

    // Formatear los resultados
    const candidates = candidatesResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      roleTitle: row.role_title,
      score: parseInt(row.score) || 0,
      appliedAt: row.applied_at,
      status: row.status,
      roleId: row.role_id
    }));

    res.json({
      success: true,
      data: {
        candidates,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCandidates,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Error al obtener candidatos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener candidatos'
    });
  }
});

/**
 * GET /api/candidates/:id
 * Obtener detalles específicos de un candidato
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const candidateId = req.params.id;

    // Verificar que el candidato pertenece a un rol del usuario autenticado
    const candidateQuery = `
      SELECT 
        a.id,
        a.candidate_name as name,
        a.candidate_email as email,
        a.candidate_phone as phone,
        a.cv_file_path,
        a.cv_text,
        a.status,
        a.applied_at,
        jr.id as role_id,
        jr.title as role_title,
        jr.description as role_description,
        jr.requirements as role_requirements,
        e.score,
        e.strengths,
        e.weaknesses,
        e.summary as evaluation_summary,
        e.model_used,
        e.evaluation_date
      FROM applications a
      JOIN job_roles jr ON a.job_role_id = jr.id
      LEFT JOIN evaluations e ON e.application_id = a.id
      WHERE a.id = $1 AND jr.created_by = $2
    `;

    const result = await query(candidateQuery, [candidateId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Candidato no encontrado o no tienes permisos para verlo'
      });
    }

    const candidate = result.rows[0];

    // Formatear la respuesta
    const candidateDetails = {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      cvFilePath: candidate.cv_file_path,
      status: candidate.status,
      evaluation: candidate.score ? {
        score: candidate.score,
        strengths: candidate.strengths,
        weaknesses: candidate.weaknesses,
        summary: candidate.evaluation_summary,
        evaluationDate: candidate.evaluation_date
      } : null
    };

    res.json({
      success: true,
      data: candidateDetails
    });

  } catch (error) {
    console.error('Error al obtener detalles del candidato:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener detalles del candidato'
    });
  }
});

module.exports = router;