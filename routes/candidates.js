const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query, transaction } = require('../utils/database');
const { supabaseAdmin } = require('../config/supabase');
const { compareCandidatesWithGemini } = require('../config/gemini');
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
    let whereConditions = ['jr.created_by = $1' ];
    let queryParams = [userId];
    let paramCount = 2;

    // Filtro por estado
    if (status && status !== 'all') {
      whereConditions.push(`a.status = $${paramCount}`);
      queryParams.push(status);
      paramCount++;
    }

    // Filtro de búsqueda por nombre o email
    if (search && search.trim()) {
      whereConditions.push(`(a.candidate_name ILIKE $${paramCount} OR a.candidate_email ILIKE $${paramCount + 1})`);
      queryParams.push(`%${search.trim()}%`, `%${search.trim()}%`);
      paramCount += 2;
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
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
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

    const countResult = await query(countQuery, queryParams.slice(0, paramCount - 1)); // Usar solo los params del WHERE
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


/**
 * POST /api/candidates/compare
 * Compara dos o más candidatos para un puesto y devuelve la recomendación de la IA.
 */
router.post('/compare', authenticateToken, async (req, res) => {
  const { candidateIds, roleId } = req.body;
  const userId = req.user.id;

  // 1. Validar entrada
  if (!Array.isArray(candidateIds) || candidateIds.length < 2 || !roleId) {
    return res.status(400).json({
      success: false,
      message: 'Se requiere un array de al menos 2 IDs de candidatos y el ID del puesto.',
    });
  }

  try {
    // 2. Obtener la información del puesto y verificar permisos
    const roleQuery = await query(
      'SELECT title, description, requirements FROM job_roles WHERE id = $1 AND created_by = $2',
      [roleId, userId]
    );

    if (roleQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Puesto no encontrado o no tienes permisos para acceder a él.',
      });
    }
    const role = roleQuery.rows[0];

    // 3. Obtener la información y evaluación de cada candidato
    const candidatesQuery = `
      SELECT
        a.id,
        a.candidate_name as name,
        e.score,
        e.strengths,
        e.weaknesses,
        e.summary
      FROM applications a
      LEFT JOIN evaluations e ON a.id = e.application_id
      WHERE a.id = ANY($1::uuid[]) AND a.job_role_id = $2
    `;
    const candidatesResult = await query(candidatesQuery, [candidateIds, roleId]);

    const candidates = candidatesResult.rows.map(c => ({
      id: c.id,
      name: c.name,
      evaluation: {
        score: c.score,
        strengths: c.strengths || [],
        weaknesses: c.weaknesses || [],
        summary: c.summary || 'Sin evaluación previa.',
      },
    }));

    // Verificar que todos los candidatos fueron encontrados y tienen evaluación
    if (candidates.length !== candidateIds.length) {
      return res.status(404).json({
        success: false,
        message: 'Algunos candidatos no se encontraron o no pertenecen al puesto especificado.',
      });
    }
     const candidatesWithoutEvaluation = candidates.filter(c => !c.evaluation.score);
    if (candidatesWithoutEvaluation.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Los siguientes candidatos no tienen una evaluación: ${candidatesWithoutEvaluation.map(c => c.name).join(', ')}`,
        });
    }


    // 4. Llamar a Gemini para la comparación
    const comparisonResult = await compareCandidatesWithGemini(role, candidates);

    if (comparisonResult.error) {
      return res.status(500).json({
        success: false,
        message: comparisonResult.message,
      });
    }

    // 5. Devolver el resultado
    res.json({
      success: true,
      data: comparisonResult,
    });

  } catch (error) {
    console.error('Error al comparar candidatos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al comparar candidatos.',
    });
  }
});

/**
 * DELETE /api/candidates/:id
 * Eliminar un candidato, su evaluación y su CV
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // Usar una transacción para asegurar la atomicidad
    const result = await transaction(async (client) => {
      // 1. Obtener la aplicación y verificar permisos
      const appQuery = await client.query(
        `SELECT a.id, a.cv_file_path, jr.created_by 
         FROM applications a
         JOIN job_roles jr ON a.job_role_id = jr.id
         WHERE a.id = $1`,
        [id]
      );

      if (appQuery.rows.length === 0) {
        return { status: 404, message: 'Candidato no encontrado' };
      }

      const application = appQuery.rows[0];

      // Solo el creador del rol o un admin puede eliminar
      if (application.created_by !== userId && req.user.profile?.role !== 'admin') {
        return { status: 403, message: 'No tienes permisos para eliminar este candidato' };
      }

      // 2. Eliminar evaluación asociada (si existe)
      await client.query('DELETE FROM evaluations WHERE application_id = $1', [id]);

      // 3. Eliminar la aplicación
      await client.query('DELETE FROM applications WHERE id = $1', [id]);

      // 4. Devolver el path del CV para eliminarlo después de la transacción
      return { status: 200, cvFilePath: application.cv_file_path };
    });

    // Si la transacción falló o no se encontraron datos, devolver error
    if (result.status !== 200) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    // 5. Eliminar el archivo del CV de Supabase Storage
    if (result.cvFilePath) {
      const { error: storageError } = await supabaseAdmin.storage
        .from('cvs')
        .remove([result.cvFilePath]);

      if (storageError) {
        // No devolver un error fatal si solo falla la eliminación del archivo,
        // pero sí registrarlo.
        console.error(`Error al eliminar CV de Storage: ${result.cvFilePath}`, storageError);
      }
    }

    res.json({ success: true, message: 'Candidato eliminado exitosamente' });

  } catch (error) {
    console.error('Error al eliminar candidato:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

module.exports = router;
