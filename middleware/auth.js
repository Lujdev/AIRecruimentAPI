const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { query } = require('../utils/database');

/**
 * Middleware para verificar token JWT de Supabase
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: {
          message: 'Token de acceso requerido',
          status: 401
        }
      });
    }

    // Verificar token con Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: {
          message: 'Token inválido o expirado',
          status: 401
        }
      });
    }

    // Obtener información adicional del usuario desde nuestra base de datos
    try {
      const userResult = await query(
        'SELECT * FROM public.users WHERE id = $1',
        [user.id]
      );

      if (userResult.rows.length === 0) {
        // Si el usuario no existe en nuestra tabla, crearlo
        await query(
          `INSERT INTO public.users (id, email, full_name, avatar_url) 
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           full_name = EXCLUDED.full_name,
           avatar_url = EXCLUDED.avatar_url,
           updated_at = NOW()`,
          [user.id, user.email, user.user_metadata?.full_name, user.user_metadata?.avatar_url]
        );

        // Obtener el usuario recién creado
        const newUserResult = await query(
          'SELECT * FROM public.users WHERE id = $1',
          [user.id]
        );
        req.user = { ...user, profile: newUserResult.rows[0] };
      } else {
        req.user = { ...user, profile: userResult.rows[0] };
      }
    } catch (dbError) {
      console.error('Error obteniendo perfil de usuario:', dbError);
      req.user = user; // Continuar sin perfil si hay error en DB
    }

    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    return res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
}

/**
 * Middleware para verificar roles específicos
 * @param {Array} allowedRoles - Roles permitidos
 * @returns {Function} Middleware function
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.profile) {
      return res.status(401).json({
        error: {
          message: 'Usuario no autenticado',
          status: 401
        }
      });
    }

    const userRole = req.user.profile.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: {
          message: 'No tienes permisos para acceder a este recurso',
          status: 403
        }
      });
    }

    next();
  };
}

/**
 * Middleware opcional de autenticación (no falla si no hay token)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      req.user = null;
      return next();
    }

    // Obtener perfil del usuario
    try {
      const userResult = await query(
        'SELECT * FROM public.users WHERE id = $1',
        [user.id]
      );

      if (userResult.rows.length > 0) {
        req.user = { ...user, profile: userResult.rows[0] };
      } else {
        req.user = user;
      }
    } catch (dbError) {
      console.error('Error obteniendo perfil en auth opcional:', dbError);
      req.user = user;
    }

    next();
  } catch (error) {
    console.error('Error en autenticación opcional:', error);
    req.user = null;
    next();
  }
}

/**
 * Genera un token JWT personalizado (para casos especiales)
 * @param {Object} payload - Datos a incluir en el token
 * @param {string} expiresIn - Tiempo de expiración
 * @returns {string} JWT token
 */
function generateToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

/**
 * Verifica un token JWT personalizado
 * @param {string} token - Token a verificar
 * @returns {Object} Payload decodificado
 */
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = {
  authenticateToken,
  requireRole,
  optionalAuth,
  generateToken,
  verifyToken
};