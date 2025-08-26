const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../utils/database');
const router = express.Router();

/**
 * GET /api/dashboard/stats
 * Obtener estadísticas generales del dashboard
 * Respuesta: totalRoles, totalCandidates, averageScore, pendingReviews
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener total de roles creados por el usuario
    const totalRolesResult = await query(
      'SELECT COUNT(*) as count FROM job_roles WHERE created_by = $1',
      [userId]
    );
    const totalRoles = parseInt(totalRolesResult.rows[0].count);

    // Obtener total de candidatos para los roles del usuario
    const totalCandidatesResult = await query(`
      SELECT COUNT(DISTINCT a.id) as count 
      FROM applications a 
      JOIN job_roles jr ON a.job_role_id = jr.id 
      WHERE jr.created_by = $1
    `, [userId]);
    const totalCandidates = parseInt(totalCandidatesResult.rows[0].count);

    // Obtener promedio de puntuación de evaluaciones
    const averageScoreResult = await query(`
      SELECT AVG(e.score) as avg_score 
      FROM evaluations e 
      JOIN applications a ON e.application_id = a.id 
      JOIN job_roles jr ON a.job_role_id = jr.id 
      WHERE jr.created_by = $1 AND e.score IS NOT NULL
    `, [userId]);
    const averageScore = averageScoreResult.rows[0].avg_score 
      ? Math.round(parseFloat(averageScoreResult.rows[0].avg_score)) 
      : 0;

    // Obtener número de revisiones pendientes (aplicaciones en estado 'pending' o 'reviewing')
    const pendingReviewsResult = await query(`
      SELECT COUNT(*) as count 
      FROM applications a 
      JOIN job_roles jr ON a.job_role_id = jr.id 
      WHERE jr.created_by = $1 AND a.status IN ('pending', 'reviewing')
    `, [userId]);
    const pendingReviews = parseInt(pendingReviewsResult.rows[0].count);

    res.json({
      success: true,
      data: {
        totalRoles,
        totalCandidates,
        averageScore,
        pendingReviews
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas del dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener estadísticas'
    });
  }
});

/**
 * GET /api/dashboard/activity
 * Obtener actividad reciente del sistema
 * Respuesta: activities[] con id, type, title, description, time, score
 */
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    // Obtener actividad reciente: aplicaciones y evaluaciones
    const activitiesResult = await query(`
      SELECT 
        a.id,
        'application' as type,
        CONCAT('Nueva aplicación para ', jr.title) as title,
        CONCAT(a.candidate_name, ' aplicó al puesto') as description,
        a.applied_at as time,
        e.score
      FROM applications a
      JOIN job_roles jr ON a.job_role_id = jr.id
      LEFT JOIN evaluations e ON e.application_id = a.id
      WHERE jr.created_by = $1
      
      UNION ALL
      
      SELECT 
        jr.id,
        'role' as type,
        CONCAT('Nuevo rol creado: ', jr.title) as title,
        CONCAT('Rol en ', COALESCE(jr.department, 'departamento no especificado')) as description,
        jr.created_at as time,
        NULL as score
      FROM job_roles jr
      WHERE jr.created_by = $1
      
      ORDER BY time DESC
      LIMIT $2
    `, [userId, limit]);

    const activities = activitiesResult.rows.map(row => ({
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      time: row.time,
      score: row.score
    }));

    res.json({
      success: true,
      data: {
        activities
      }
    });

  } catch (error) {
    console.error('Error al obtener actividad reciente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener actividad reciente'
    });
  }
});

/**
 * GET /api/dashboard/analytics
 * Obtener datos de analytics completos
 * Respuesta: totalCandidates, totalRoles, averageScore, topCandidates[], scoreDistribution[], roleStats[], weeklyApplications[]
 */
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Reutilizar datos básicos del endpoint /stats
    const totalRolesResult = await query(
      'SELECT COUNT(*) as count FROM job_roles WHERE created_by = $1',
      [userId]
    );
    const totalRoles = parseInt(totalRolesResult.rows[0].count);

    const totalCandidatesResult = await query(`
      SELECT COUNT(DISTINCT a.id) as count 
      FROM applications a 
      JOIN job_roles jr ON a.job_role_id = jr.id 
      WHERE jr.created_by = $1
    `, [userId]);
    const totalCandidates = parseInt(totalCandidatesResult.rows[0].count);

    const averageScoreResult = await query(`
      SELECT AVG(e.score) as avg_score 
      FROM evaluations e 
      JOIN applications a ON e.application_id = a.id 
      JOIN job_roles jr ON a.job_role_id = jr.id 
      WHERE jr.created_by = $1 AND e.score IS NOT NULL
    `, [userId]);
    const averageScore = averageScoreResult.rows[0].avg_score 
      ? Math.round(parseFloat(averageScoreResult.rows[0].avg_score)) 
      : 0;

    // Obtener top candidatos (mejores puntuaciones)
    const topCandidatesResult = await query(`
      SELECT 
        a.id,
        a.candidate_name as name,
        a.candidate_email as email,
        jr.title as role_title,
        e.score,
        a.applied_at
      FROM applications a
      JOIN job_roles jr ON a.job_role_id = jr.id
      JOIN evaluations e ON e.application_id = a.id
      WHERE jr.created_by = $1 AND e.score IS NOT NULL
      ORDER BY e.score DESC
      LIMIT 5
    `, [userId]);
    const topCandidates = topCandidatesResult.rows;

    // Obtener distribución de puntuaciones
    const scoreDistributionResult = await query(`
      SELECT 
        CASE 
          WHEN e.score >= 90 THEN '90-100'
          WHEN e.score >= 80 THEN '80-89'
          WHEN e.score >= 70 THEN '70-79'
          WHEN e.score >= 60 THEN '60-69'
          ELSE '0-59'
        END as score_range,
        COUNT(*) as count
      FROM evaluations e
      JOIN applications a ON e.application_id = a.id
      JOIN job_roles jr ON a.job_role_id = jr.id
      WHERE jr.created_by = $1 AND e.score IS NOT NULL
      GROUP BY score_range
      ORDER BY score_range DESC
    `, [userId]);
    const scoreDistribution = scoreDistributionResult.rows;

    // Obtener estadísticas por rol
    const roleStatsResult = await query(`
      SELECT 
        jr.id,
        jr.title,
        COUNT(a.id) as applications_count,
        AVG(e.score) as avg_score,
        jr.status
      FROM job_roles jr
      LEFT JOIN applications a ON a.job_role_id = jr.id
      LEFT JOIN evaluations e ON e.application_id = a.id
      WHERE jr.created_by = $1
      GROUP BY jr.id, jr.title, jr.status
      ORDER BY applications_count DESC
    `, [userId]);
    const roleStats = roleStatsResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      applicationsCount: parseInt(row.applications_count),
      avgScore: row.avg_score ? Math.round(parseFloat(row.avg_score)) : 0,
      status: row.status
    }));

    // Obtener aplicaciones por semana (últimas 8 semanas)
    const weeklyApplicationsResult = await query(`
      SELECT 
        DATE_TRUNC('week', a.applied_at) as week,
        COUNT(*) as count
      FROM applications a
      JOIN job_roles jr ON a.job_role_id = jr.id
      WHERE jr.created_by = $1 
        AND a.applied_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY week
      ORDER BY week
    `, [userId]);
    const weeklyApplications = weeklyApplicationsResult.rows.map(row => ({
      week: row.week,
      count: parseInt(row.count)
    }));

    res.json({
      success: true,
      data: {
        totalCandidates,
        totalRoles,
        averageScore,
        topCandidates,
        scoreDistribution,
        roleStats,
        weeklyApplications
      }
    });

  } catch (error) {
    console.error('Error al obtener analytics del dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener analytics'
    });
  }
});

module.exports = router;