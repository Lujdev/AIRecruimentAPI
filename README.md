# 🚀 RecruimentApp Backend API

Una API robusta para gestión de reclutamiento con inteligencia artificial, construida con Node.js, Express y Supabase. Esta aplicación permite a los reclutadores crear puestos de trabajo, recibir aplicaciones de candidatos y evaluar automáticamente CVs usando Google Gemini AI.

## ✨ Características Principales

- **🤖 Evaluación Automática de CVs**: Integración con Google Gemini AI para análisis inteligente de currículums
- **👥 Gestión de Usuarios**: Sistema de autenticación completo con Supabase Auth
- **📋 Gestión de Puestos**: Crear y administrar puestos de trabajo
- **📄 Aplicaciones de Candidatos**: Procesamiento de aplicaciones con subida de archivos PDF
- **📊 Dashboard y Estadísticas**: Métricas detalladas de evaluaciones y aplicaciones
- **🔒 Seguridad Avanzada**: Rate limiting, validación de datos, y políticas RLS
- **☁️ Almacenamiento en la Nube**: Integración con Supabase Storage para archivos

## 🛠️ Tecnologías Utilizadas

### Backend
- **Node.js** (>=18.0.0) - Runtime de JavaScript
- **Express.js** - Framework web
- **Supabase** - Base de datos PostgreSQL y autenticación
- **Google Gemini AI** - Evaluación automática de CVs
- **JWT** - Autenticación de tokens
- **Multer** - Manejo de archivos
- **PDF-Parse** - Extracción de texto de PDFs

### Seguridad y Validación
- **Helmet** - Headers de seguridad
- **CORS** - Control de acceso cross-origin
- **Rate Limiting** - Protección contra spam
- **Joi** - Validación de esquemas
- **bcryptjs** - Encriptación de contraseñas

## 📋 Prerrequisitos

- Node.js >= 18.0.0
- npm o yarn
- Cuenta de Supabase
- Cuenta de Google AI Studio (para Gemini API)

## 🚀 Instalación

### 1. Clonar el Repositorio

```bash
git clone <url-del-repositorio>
cd recruimentAPI
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

Copia el archivo de ejemplo y configura las variables:

```bash
cp example.env .env
```

Edita el archivo `.env` con tus credenciales:

```env
# Supabase Configuration
SUPABASE_URL=tu_supabase_url
SUPABASE_ANON_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_supabase_service_role_key

# Database Configuration
DATABASE_URL=tu_database_url

# Google Gemini API
GEMINI_API_KEY=tu_gemini_api_key

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
FRONTEND_URL=http://localhost:5173

# File Upload Configuration
MAX_FILE_SIZE=10485760
```

### 4. Configurar Base de Datos

Ejecuta las migraciones para crear las tablas:

```bash
npm run init-db
```

### 5. Configurar Supabase Storage

Ejecuta el script para configurar el bucket de almacenamiento:

```bash
node scripts/setup-storage.js
```

### 6. Iniciar el Servidor

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 📚 Documentación de la API

### Endpoints Principales

#### 🔐 Autenticación (`/api/auth`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/register` | Registro de nuevo usuario |
| POST | `/login` | Inicio de sesión |
| POST | `/google` | Autenticación con Google |
| POST | `/refresh` | Renovar token de acceso |
| POST | `/logout` | Cerrar sesión |
| GET | `/profile` | Obtener perfil del usuario |
| PUT | `/profile` | Actualizar perfil |

#### 📋 Puestos de Trabajo (`/api/roles`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/` | Listar puestos de trabajo |
| POST | `/` | Crear nuevo puesto |
| GET | `/:id` | Obtener puesto específico |
| PUT | `/:id` | Actualizar puesto |
| DELETE | `/:id` | Eliminar un rol y todas sus aplicaciones, evaluaciones y CVs asociados |

#### 📄 Candidatos (`/api/candidates`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/` | Listar todos los candidatos de la empresa |
| GET | `/:id` | Obtener detalles de un candidato |
| DELETE | `/:id` | Eliminar un candidato, su evaluación y su CV |

#### 🤖 Evaluaciones (`/api/evaluations`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/` | Listar evaluaciones |
| GET | `/:id` | Obtener evaluación específica |
| GET | `/application/:applicationId` | Evaluación por aplicación |
| POST | `/reevaluate` | Re-evaluar CV |
| GET | `/stats` | Estadísticas de evaluaciones |
| DELETE | `/:id` | Eliminar evaluación |

#### 📊 Dashboard (`/api/dashboard`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/stats` | Estadísticas generales |
| GET | `/recent-applications` | Aplicaciones recientes |
| GET | `/top-roles` | Puestos más populares |

### Ejemplos de Uso

#### Crear una Aplicación

```bash
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: multipart/form-data" \
  -F "jobRoleId=uuid-del-puesto" \
  -F "candidateName=Juan Pérez" \
  -F "candidateEmail=juan@email.com" \
  -F "candidatePhone=+1234567890" \
  -F "cv=@curriculum.pdf"
```

#### Obtener Evaluaciones

```bash
curl -X GET "http://localhost:3000/api/evaluations?page=1&limit=10&minScore=70" \
  -H "Authorization: Bearer tu-jwt-token"
```

## 🗄️ Estructura de la Base de Datos

### Tablas Principales

- **users**: Información de usuarios del sistema
- **job_roles**: Puestos de trabajo disponibles
- **applications**: Aplicaciones de candidatos
- **evaluations**: Evaluaciones automáticas de CVs

### Relaciones

- Un usuario puede crear múltiples puestos de trabajo
- Un puesto puede tener múltiples aplicaciones
- Cada aplicación puede tener una evaluación de IA

## 🔧 Scripts Disponibles

```bash
# Inicializar base de datos
npm run init-db

# Configurar setup completo
npm run setup

# Ejecutar en modo desarrollo
npm run dev

# Ejecutar tests
npm test
```

## 🔒 Seguridad

- **Rate Limiting**: 100 requests por 15 minutos por IP
- **Validación de Datos**: Esquemas Joi para todos los endpoints
- **Autenticación JWT**: Tokens seguros con Supabase
- **Row Level Security**: Políticas RLS en Supabase
- **Headers de Seguridad**: Helmet para protección adicional
- **Validación de Archivos**: Solo PDFs permitidos

## 🤖 Integración con IA

### Google Gemini AI

La aplicación utiliza Google Gemini para:

- **Análisis de CVs**: Evaluación automática contra descripciones de puestos
- **Puntuación**: Sistema de 0-100 basado en criterios específicos
- **Fortalezas y Debilidades**: Identificación automática de aspectos clave
- **Resúmenes**: Generación de resúmenes ejecutivos

### Configuración de Gemini

1. Obtén tu API key de [Google AI Studio](https://aistudio.google.com/)
2. Configura `GEMINI_API_KEY` en tu archivo `.env`
3. La aplicación usará automáticamente el modelo `gemini-1.5-flash`

## 📁 Estructura del Proyecto

```
recruimentAPI/
├── config/
│   ├── gemini.js          # Configuración de Gemini AI
│   └── supabase.js        # Configuración de Supabase
├── middleware/
│   └── auth.js            # Middleware de autenticación
├── migrations/
│   └── 001_initial_schema.sql  # Esquema inicial de BD
├── routes/
│   ├── auth.js            # Rutas de autenticación
│   ├── applications.js    # Rutas de aplicaciones
│   ├── evaluations.js     # Rutas de evaluaciones
│   ├── roles.js           # Rutas de puestos
│   ├── dashboard.js       # Rutas del dashboard
│   └── candidates.js      # Rutas de candidatos
├── scripts/
│   ├── init-db.js         # Inicialización de BD
│   ├── setup-storage.js   # Configuración de storage
│   └── test-groq.js       # Scripts de prueba
├── utils/
│   └── database.js        # Utilidades de base de datos
├── server.js              # Servidor principal
├── package.json           # Dependencias y scripts
└── README.md             # Este archivo
```

## 🚀 Despliegue

### Variables de Entorno de Producción

Asegúrate de configurar todas las variables necesarias en tu entorno de producción:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `GEMINI_API_KEY`
- `NODE_ENV=production`
- `FRONTEND_URL` (URL de tu frontend)

### Recomendaciones

- Usa un servicio de gestión de procesos como PM2
- Configura un proxy reverso con Nginx
- Implementa monitoreo y logging
- Configura backups automáticos de la base de datos

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📞 Soporte

Si tienes preguntas o necesitas ayuda:

- Abre un issue en GitHub
- Revisa la documentación de la API
- Consulta los logs del servidor para debugging

## 🔄 Changelog

### v1.0.0
- ✅ Sistema de autenticación completo
- ✅ Gestión de puestos de trabajo
- ✅ Aplicaciones con subida de CVs
- ✅ Evaluación automática con Gemini AI
- ✅ Dashboard con estadísticas
- ✅ API REST completa
- ✅ Seguridad y validación

---

**Desarrollado con ❤️ por el equipo de RecruimentApp**
