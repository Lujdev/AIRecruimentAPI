const express = require('express');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { query } = require('../utils/database');
const Joi = require('joi');
const router = express.Router();

// Esquemas de validación
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Debe ser un email válido',
    'any.required': 'El email es requerido'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'La contraseña debe tener al menos 6 caracteres',
    'any.required': 'La contraseña es requerida'
  }),
  fullName: Joi.string().min(2).max(100).required().messages({
    'string.min': 'El nombre debe tener al menos 2 caracteres',
    'string.max': 'El nombre no puede exceder 100 caracteres',
    'any.required': 'El nombre completo es requerido'
  }),
  companyName: Joi.string().max(255).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const updateProfileSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).optional(),
  companyName: Joi.string().max(255).optional(),
  role: Joi.string().valid('admin', 'recruiter', 'hr_manager').optional()
});

/**
 * POST /api/auth/register
 * Registro de nuevo usuario
 */
router.post('/register', async (req, res) => {
  try {
    // Validar datos de entrada
    const { error: validationError, value } = registerSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        error: {
          message: validationError.details[0].message,
          status: 400
        }
      });
    }

    const { email, password, fullName, companyName } = value;

    // Registrar usuario en Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company_name: companyName
        }
      }
    });

    if (error) {
      return res.status(400).json({
        error: {
          message: error.message,
          status: 400
        }
      });
    }

    // Si el usuario fue creado exitosamente
    if (data.user) {
      // Crear perfil en nuestra base de datos
      try {
        await query(
          `INSERT INTO public.users (id, email, full_name, company_name) 
           VALUES ($1, $2, $3, $4)`,
          [data.user.id, email, fullName, companyName]
        );
      } catch (dbError) {
        console.error('Error creando perfil de usuario:', dbError);
        // No fallar el registro si hay error en la DB
      }
    }

    res.status(201).json({
      message: 'Usuario registrado exitosamente. Revisa tu email para confirmar tu cuenta.',
      user: {
        id: data.user?.id,
        email: data.user?.email,
        emailConfirmed: data.user?.email_confirmed_at ? true : false
      }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * POST /api/auth/login
 * Inicio de sesión
 */
router.post('/login', async (req, res) => {
  try {
    // Validar datos de entrada
    const { error: validationError, value } = loginSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        error: {
          message: validationError.details[0].message,
          status: 400
        }
      });
    }

    const { email, password } = value;

    // Autenticar con Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({
        error: {
          message: 'Credenciales inválidas',
          status: 401
        }
      });
    }

    // Obtener perfil del usuario
    let userProfile = null;
    try {
      const profileResult = await query(
        'SELECT * FROM public.users WHERE id = $1',
        [data.user.id]
      );
      userProfile = profileResult.rows[0] || null;
    } catch (dbError) {
      console.error('Error obteniendo perfil:', dbError);
    }

    res.json({
      message: 'Inicio de sesión exitoso',
      user: {
        id: data.user.id,
        email: data.user.email,
        profile: userProfile
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * POST /api/auth/google
 * Autenticación con Google
 */
router.post('/google', async (req, res) => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.FRONTEND_URL}/auth/callback`
      }
    });

    if (error) {
      return res.status(400).json({
        error: {
          message: error.message,
          status: 400
        }
      });
    }

    res.json({
      url: data.url,
      message: 'Redirige al usuario a esta URL para autenticación con Google'
    });
  } catch (error) {
    console.error('Error en autenticación con Google:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * POST /api/auth/refresh
 * Renovar token de acceso
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: {
          message: 'Refresh token requerido',
          status: 400
        }
      });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token
    });

    if (error) {
      return res.status(401).json({
        error: {
          message: 'Refresh token inválido',
          status: 401
        }
      });
    }

    res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });
  } catch (error) {
    console.error('Error renovando token:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * POST /api/auth/logout
 * Cerrar sesión
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(400).json({
        error: {
          message: error.message,
          status: 400
        }
      });
    }

    res.json({
      message: 'Sesión cerrada exitosamente'
    });
  } catch (error) {
    console.error('Error cerrando sesión:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * GET /api/auth/profile
 * Obtener perfil del usuario autenticado
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        profile: req.user.profile
      }
    });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

/**
 * PUT /api/auth/profile
 * Actualizar perfil del usuario
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    // Validar datos de entrada
    const { error: validationError, value } = updateProfileSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        error: {
          message: validationError.details[0].message,
          status: 400
        }
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    // Construir consulta dinámica
    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined) {
        const dbField = key === 'fullName' ? 'full_name' : 
                       key === 'companyName' ? 'company_name' : key;
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

    values.push(req.user.id);
    const updateQuery = `
      UPDATE public.users 
      SET ${updates.join(', ')}, updated_at = NOW() 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Usuario no encontrado',
          status: 404
        }
      });
    }

    res.json({
      message: 'Perfil actualizado exitosamente',
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({
      error: {
        message: 'Error interno del servidor',
        status: 500
      }
    });
  }
});

module.exports = router;