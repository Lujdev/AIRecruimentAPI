# API Documentation - RecruimentApp

## Información General

**Base URL:** `http://localhost:3000`  
**Versión:** 1.0.0  
**Formato de respuesta:** JSON  
**Autenticación:** Bearer Token (JWT de Supabase)

## Autenticación

La API utiliza autenticación basada en JWT tokens de Supabase. Para acceder a endpoints protegidos, incluye el token en el header `Authorization`:

```
Authorization: Bearer <tu_jwt_token>
```

### Tipos de Usuario
- **admin**: Acceso completo a todos los recursos
- **recruiter**: Puede gestionar sus propios roles y candidatos
- **hr_manager**: Gestión de recursos humanos

## Endpoints

### 1. Health Check

#### GET /health
Verifica el estado del servidor.

**Requisitos:** Ninguno

**Respuesta:**
```json
{
  "status": "OK",
  "message": "RecruimentApp Backend está funcionando correctamente",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

---

## 2. Autenticación (/api/auth)

### POST /api/auth/register
Registra un nuevo usuario en el sistema.

**Requisitos:**
- Content-Type: application/json

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123",
  "fullName": "Juan Pérez",
  "companyName": "Mi Empresa" // opcional
}
```

**Validaciones:**
- `email`: Email válido, requerido
- `password`: Mínimo 6 caracteres, requerido
- `fullName`: 2-100 caracteres, requerido
- `companyName`: Máximo 255 caracteres, opcional

**Respuesta exitosa (201):**
```json
{
  "message": "Usuario registrado exitosamente. Revisa tu email para confirmar tu cuenta.",
  "user": {
    "id": "uuid-del-usuario",
    "email": "usuario@ejemplo.com",
    "emailConfirmed": false
  }
}
```

**Errores:**
- `400`: Datos de validación inválidos
- `500`: Error interno del servidor

### POST /api/auth/login
Inicia sesión de usuario.

**Requisitos:**
- Content-Type: application/json

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123"
}
```

**Respuesta exitosa (200):**
```json
{
  "message": "Inicio de sesión exitoso",
  "user": {
    "id": "uuid-del-usuario",
    "email": "usuario@ejemplo.com",
    "profile": {
      "id": "uuid-del-usuario",
      "email": "usuario@ejemplo.com",
      "full_name": "Juan Pérez",
      "company_name": "Mi Empresa",
      "role": "recruiter",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  },
  "session": {
    "access_token": "jwt_token_aqui",
    "refresh_token": "refresh_token_aqui",
    "expires_at": 1705312200
  }
}
```

**Errores:**
- `400`: Datos de validación inválidos
- `401`: Credenciales inválidas
- `500`: Error interno del servidor

### POST /api/auth/google
Inicia autenticación con Google OAuth.

**Requisitos:** Ninguno

**Respuesta exitosa (200):**
```json
{
  "url": "https://accounts.google.com/oauth/authorize?...",
  "message": "Redirige al usuario a esta URL para autenticación con Google"
}
```

### POST /api/auth/refresh
Renueva el token de acceso.

**Requisitos:**
- Content-Type: application/json

**Body:**
```json
{
  "refresh_token": "refresh_token_aqui"
}
```

**Respuesta exitosa (200):**
```json
{
  "session": {
    "access_token": "nuevo_jwt_token",
    "refresh_token": "nuevo_refresh_token",
    "expires_at": 1705312200
  }
}
```

### POST /api/auth/logout
Cierra la sesión del usuario.

**Requisitos:**
- Authorization: Bearer Token

**Respuesta exitosa (200):**
```json
{
  "message": "Sesión cerrada exitosamente"
}
```

### GET /api/auth/profile
Obtiene el perfil del usuario autenticado.

**Requisitos:**
- Authorization: Bearer Token

**Respuesta exitosa (200):**
```json
{
  "user": {
    "id": "uuid-del-usuario",
    "email": "usuario@ejemplo.com",
    "profile": {
      "id": "uuid-del-usuario",
      "email": "usuario@ejemplo.com",
      "full_name": "Juan Pérez",
      "company_name": "Mi Empresa",
      "role": "recruiter",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

### PUT /api/auth/profile
Actualiza el perfil del usuario.

**Requisitos:**
- Authorization: Bearer Token
- Content-Type: application/json

**Body:**
```json
{
  "fullName": "Juan Carlos Pérez", // opcional
  "companyName": "Nueva Empresa", // opcional
  "role": "admin" // opcional, valores: admin, recruiter, hr_manager
}
```

**Respuesta exitosa (200):**
```json
{
  "message": "Perfil actualizado exitosamente",
  "profile": {
    "id": "uuid-del-usuario",
    "email": "usuario@ejemplo.com",
    "full_name": "Juan Carlos Pérez",
    "company_name": "Nueva Empresa",
    "role": "admin",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 3. Roles de Trabajo (/api/roles)

### GET /api/roles
Obtiene todos los roles de trabajo con filtros opcionales.

**Requisitos:** Ninguno (autenticación opcional)

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 10, max: 50)
- `status` (opcional): Estado del rol (active, inactive, closed, all)
- `department` (opcional): Filtro por departamento
- `employmentType` (opcional): Tipo de empleo (full-time, part-time, contract, internship)
- `search` (opcional): Búsqueda por título o descripción
- `createdBy` (opcional): Filtrar por creador (requiere autenticación)

**Respuesta exitosa (200):**
```json
{
  "roles": [
    {
      "id": "uuid-del-rol",
      "title": "Desarrollador Frontend",
      "description": "Desarrollador especializado en React y TypeScript",
      "requirements": "3+ años de experiencia en React",
      "department": "Tecnología",
      "location": "Madrid, España",
      "employment_type": "full-time",
      "salary_range": "40,000 - 60,000 EUR",
      "status": "active",
      "created_by": "uuid-del-creador",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z",
      "creator_name": "Juan Pérez",
      "creator_company": "Mi Empresa",
      "applications_count": 5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### GET /api/roles/:id
Obtiene un rol específico por ID.

**Requisitos:** Ninguno (autenticación opcional)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "role": {
      "id": "uuid-del-rol",
      "title": "Desarrollador Frontend",
      "description": "Desarrollador especializado en React y TypeScript",
      "requirements": "3+ años de experiencia en React",
      "department": "Tecnología",
      "location": "Madrid, España",
      "employmentType": "full-time",
      "salaryRange": "40,000 - 60,000 EUR",
      "candidatesCount": 5,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "status": "active",
      "userId": "uuid-del-creador",
      "creator": {
        "name": "Juan Pérez",
        "company": "Mi Empresa"
      }
    }
  }
}
```

### POST /api/roles
Crea un nuevo rol de trabajo.

**Requisitos:**
- Authorization: Bearer Token
- Content-Type: application/json

**Body:**
```json
{
  "title": "Desarrollador Frontend",
  "description": "Desarrollador especializado en React y TypeScript con experiencia en desarrollo de aplicaciones web modernas",
  "requirements": "3+ años de experiencia en React, TypeScript, HTML5, CSS3",
  "department": "Tecnología", // opcional
  "location": "Madrid, España", // opcional
  "employmentType": "full-time", // opcional, valores: full-time, part-time, contract, internship
  "salaryRange": "40,000 - 60,000 EUR" // opcional
}
```

**Validaciones:**
- `title`: 3-255 caracteres, requerido
- `description`: Mínimo 10 caracteres, requerido
- `requirements`: Opcional
- `department`: Máximo 100 caracteres, opcional
- `location`: Máximo 255 caracteres, opcional
- `employmentType`: Valores válidos, default: full-time
- `salaryRange`: Máximo 100 caracteres, opcional

**Respuesta exitosa (201):**
```json
{
  "message": "Rol creado exitosamente",
  "role": {
    "id": "uuid-del-rol",
    "title": "Desarrollador Frontend",
    "description": "Desarrollador especializado en React y TypeScript",
    "requirements": "3+ años de experiencia en React",
    "department": "Tecnología",
    "location": "Madrid, España",
    "employment_type": "full-time",
    "salary_range": "40,000 - 60,000 EUR",
    "status": "active",
    "created_by": "uuid-del-usuario",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### PUT /api/roles/:id
Actualiza un rol existente.

**Requisitos:**
- Authorization: Bearer Token
- Content-Type: application/json

**Body:** (todos los campos son opcionales)
```json
{
  "title": "Desarrollador Frontend Senior",
  "description": "Nueva descripción actualizada",
  "requirements": "5+ años de experiencia en React",
  "department": "Tecnología",
  "location": "Barcelona, España",
  "employmentType": "full-time",
  "salaryRange": "50,000 - 70,000 EUR",
  "status": "active" // valores: active, inactive, closed
}
```

**Respuesta exitosa (200):**
```json
{
  "message": "Rol actualizado exitosamente",
  "role": {
    "id": "uuid-del-rol",
    "title": "Desarrollador Frontend Senior",
    "description": "Nueva descripción actualizada",
    "requirements": "5+ años de experiencia en React",
    "department": "Tecnología",
    "location": "Barcelona, España",
    "employment_type": "full-time",
    "salary_range": "50,000 - 70,000 EUR",
    "status": "active",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### DELETE /api/roles/:id
Elimina un rol (o lo marca como cerrado si tiene aplicaciones).

**Requisitos:**
- Authorization: Bearer Token

**Respuesta exitosa (200):**
```json
{
  "message": "Rol eliminado exitosamente"
}
```

O si tiene aplicaciones asociadas:
```json
{
  "message": "Rol cerrado exitosamente (tiene aplicaciones asociadas)"
}
```

### GET /api/roles/:id/candidates
Obtiene todos los candidatos para un rol específico.

**Requisitos:**
- Authorization: Bearer Token

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 10, max: 50)
- `status` (opcional): Estado de la aplicación
- `search` (opcional): Búsqueda por nombre o email

**Respuesta exitosa (200):**
```json
{
  "candidates": [
    {
      "id": "uuid-de-aplicacion",
      "name": "María García",
      "email": "maria@ejemplo.com",
      "cvUrl": "https://storage.supabase.co/object/public/cvs/archivo.pdf",
      "score": 85,
      "strengths": ["React", "TypeScript", "CSS"],
      "weaknesses": ["Testing", "Performance"],
      "evaluation": "Candidato con excelente experiencia en React...",
      "evaluation_date": "2024-01-15T10:30:00.000Z",
      "appliedAt": "2024-01-15T10:30:00.000Z",
      "status": "pending"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## 4. Aplicaciones (/api/applications)

### POST /api/applications
Crea una nueva aplicación con CV.

**Requisitos:**
- Content-Type: multipart/form-data

**Body (Form Data):**
- `jobRoleId`: UUID del rol (string)
- `candidateName`: Nombre del candidato (string)
- `candidateEmail`: Email del candidato (string)
- `candidatePhone`: Teléfono del candidato (string, opcional)
- `cv`: Archivo PDF del CV (file, requerido)

**Validaciones:**
- `jobRoleId`: UUID válido, requerido
- `candidateName`: 2-255 caracteres, requerido
- `candidateEmail`: Email válido, requerido
- `candidatePhone`: Máximo 50 caracteres, opcional
- `cv`: Solo archivos PDF, máximo 10MB

**Respuesta exitosa (201):**
```json
{
  "message": "Aplicación creada exitosamente. La evaluación se procesará en breve.",
  "application": {
    "id": "uuid-de-aplicacion",
    "jobRoleId": "uuid-del-rol",
    "candidateName": "María García",
    "candidateEmail": "maria@ejemplo.com",
    "candidatePhone": "+34 123 456 789",
    "status": "pending",
    "cvFilePath": "https://storage.supabase.co/object/public/cvs/archivo.pdf"
  }
}
```

### GET /api/applications
Obtiene aplicaciones (solo usuarios autenticados).

**Requisitos:**
- Authorization: Bearer Token

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 10, max: 50)
- `status` (opcional): Estado de la aplicación
- `jobRoleId` (opcional): Filtrar por rol específico
- `search` (opcional): Búsqueda por nombre o email

**Respuesta exitosa (200):**
```json
{
  "applications": [
    {
      "id": "uuid-de-aplicacion",
      "job_role_id": "uuid-del-rol",
      "candidate_name": "María García",
      "candidate_email": "maria@ejemplo.com",
      "candidate_phone": "+34 123 456 789",
      "cv_file_path": "https://storage.supabase.co/object/public/cvs/archivo.pdf",
      "cv_text": "Texto extraído del CV...",
      "status": "pending",
      "applied_at": "2024-01-15T10:30:00.000Z",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z",
      "job_title": "Desarrollador Frontend",
      "department": "Tecnología",
      "score": 85,
      "strengths": ["React", "TypeScript"],
      "weaknesses": ["Testing"],
      "evaluation_summary": "Candidato con excelente experiencia..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### GET /api/applications/:id
Obtiene una aplicación específica.

**Requisitos:**
- Authorization: Bearer Token

**Respuesta exitosa (200):**
```json
{
  "application": {
    "id": "uuid-de-aplicacion",
    "job_role_id": "uuid-del-rol",
    "candidate_name": "María García",
    "candidate_email": "maria@ejemplo.com",
    "candidate_phone": "+34 123 456 789",
    "cv_file_path": "https://storage.supabase.co/object/public/cvs/archivo.pdf",
    "cv_text": "Texto extraído del CV...",
    "status": "pending",
    "applied_at": "2024-01-15T10:30:00.000Z",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z",
    "job_title": "Desarrollador Frontend",
    "job_description": "Desarrollador especializado en React...",
    "job_requirements": "3+ años de experiencia en React",
    "department": "Tecnología",
    "job_creator_id": "uuid-del-creador",
    "score": 85,
    "strengths": ["React", "TypeScript"],
    "weaknesses": ["Testing"],
    "evaluation_summary": "Candidato con excelente experiencia...",
    "evaluation_date": "2024-01-15T10:30:00.000Z"
  }
}
```

### PUT /api/applications/:id
Actualiza una aplicación.

**Requisitos:**
- Authorization: Bearer Token
- Content-Type: application/json

**Body:**
```json
{
  "status": "reviewing", // valores: pending, reviewing, interviewed, hired, rejected
  "candidateName": "María García López", // opcional
  "candidateEmail": "maria.garcia@ejemplo.com", // opcional
  "candidatePhone": "+34 987 654 321" // opcional
}
```

**Respuesta exitosa (200):**
```json
{
  "message": "Aplicación actualizada exitosamente",
  "application": {
    "id": "uuid-de-aplicacion",
    "job_role_id": "uuid-del-rol",
    "candidate_name": "María García López",
    "candidate_email": "maria.garcia@ejemplo.com",
    "candidate_phone": "+34 987 654 321",
    "status": "reviewing",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### DELETE /api/applications/:id
Elimina una aplicación.

**Requisitos:**
- Authorization: Bearer Token

**Respuesta exitosa (200):**
```json
{
  "message": "Aplicación eliminada exitosamente"
}
```

---

## 5. Evaluaciones (/api/evaluations)

### GET /api/evaluations
Obtiene evaluaciones con filtros.

**Requisitos:**
- Authorization: Bearer Token

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 10, max: 50)
- `jobRoleId` (opcional): Filtrar por rol específico
- `minScore` (opcional): Puntuación mínima
- `maxScore` (opcional): Puntuación máxima
- `sortBy` (opcional): Campo de ordenamiento (evaluation_date, score, candidate_name, job_title)
- `sortOrder` (opcional): Orden (asc, desc)

**Respuesta exitosa (200):**
```json
{
  "evaluations": [
    {
      "id": "uuid-de-evaluacion",
      "application_id": "uuid-de-aplicacion",
      "score": 85,
      "strengths": ["React", "TypeScript", "CSS"],
      "weaknesses": ["Testing", "Performance"],
      "summary": "Candidato con excelente experiencia en React y TypeScript...",
      "model_used": "gemini-vision",
      "evaluation_date": "2024-01-15T10:30:00.000Z",
      "created_at": "2024-01-15T10:30:00.000Z",
      "candidate_name": "María García",
      "candidate_email": "maria@ejemplo.com",
      "application_status": "pending",
      "applied_at": "2024-01-15T10:30:00.000Z",
      "job_title": "Desarrollador Frontend",
      "department": "Tecnología",
      "job_role_id": "uuid-del-rol"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### GET /api/evaluations/:id
Obtiene una evaluación específica.

**Requisitos:**
- Authorization: Bearer Token

**Respuesta exitosa (200):**
```json
{
  "evaluation": {
    "id": "uuid-de-evaluacion",
    "application_id": "uuid-de-aplicacion",
    "score": 85,
    "strengths": ["React", "TypeScript", "CSS"],
    "weaknesses": ["Testing", "Performance"],
    "summary": "Candidato con excelente experiencia en React y TypeScript...",
    "model_used": "gemini-vision",
    "evaluation_date": "2024-01-15T10:30:00.000Z",
    "created_at": "2024-01-15T10:30:00.000Z",
    "candidate_name": "María García",
    "candidate_email": "maria@ejemplo.com",
    "candidate_phone": "+34 123 456 789",
    "application_status": "pending",
    "applied_at": "2024-01-15T10:30:00.000Z",
    "cv_file_path": "https://storage.supabase.co/object/public/cvs/archivo.pdf",
    "job_title": "Desarrollador Frontend",
    "job_description": "Desarrollador especializado en React...",
    "job_requirements": "3+ años de experiencia en React",
    "department": "Tecnología",
    "job_creator_id": "uuid-del-creador"
  }
}
```

### GET /api/evaluations/application/:applicationId
Obtiene evaluación por ID de aplicación.

**Requisitos:**
- Authorization: Bearer Token

**Respuesta exitosa (200):**
```json
{
  "evaluation": {
    "id": "uuid-de-evaluacion",
    "application_id": "uuid-de-aplicacion",
    "score": 85,
    "strengths": ["React", "TypeScript", "CSS"],
    "weaknesses": ["Testing", "Performance"],
    "summary": "Candidato con excelente experiencia en React y TypeScript...",
    "model_used": "gemini-vision",
    "evaluation_date": "2024-01-15T10:30:00.000Z",
    "created_at": "2024-01-15T10:30:00.000Z",
    "candidate_name": "María García",
    "candidate_email": "maria@ejemplo.com",
    "candidate_phone": "+34 123 456 789",
    "application_status": "pending",
    "applied_at": "2024-01-15T10:30:00.000Z",
    "cv_file_path": "https://storage.supabase.co/object/public/cvs/archivo.pdf",
    "job_title": "Desarrollador Frontend",
    "job_description": "Desarrollador especializado en React...",
    "job_requirements": "3+ años de experiencia en React",
    "department": "Tecnología",
    "job_creator_id": "uuid-del-creador"
  }
}
```

### POST /api/evaluations/reevaluate
Re-evalúa un CV existente.

**Requisitos:**
- Authorization: Bearer Token
- Content-Type: application/json

**Body:**
```json
{
  "applicationId": "uuid-de-aplicacion"
}
```

**Respuesta exitosa (200):**
```json
{
  "message": "CV re-evaluado exitosamente",
  "evaluation": {
    "id": "uuid-de-evaluacion",
    "application_id": "uuid-de-aplicacion",
    "score": 88,
    "strengths": ["React", "TypeScript", "CSS", "Testing"],
    "weaknesses": ["Performance"],
    "summary": "Candidato con excelente experiencia en React y TypeScript...",
    "model_used": "gemini-text",
    "evaluation_date": "2024-01-15T10:30:00.000Z"
  }
}
```

### GET /api/evaluations/stats
Obtiene estadísticas de evaluaciones.

**Requisitos:**
- Authorization: Bearer Token

**Query Parameters:**
- `jobRoleId` (opcional): Filtrar por rol específico

**Respuesta exitosa (200):**
```json
{
  "stats": {
    "totalEvaluations": 25,
    "averageScore": 75.5,
    "minScore": 45,
    "maxScore": 95,
    "scoreDistribution": {
      "high": 8,    // >= 80
      "medium": 12, // 60-79
      "low": 5      // < 60
    }
  }
}
```

### DELETE /api/evaluations/:id
Elimina una evaluación.

**Requisitos:**
- Authorization: Bearer Token

**Respuesta exitosa (200):**
```json
{
  "message": "Evaluación eliminada exitosamente"
}
```

---

## 6. Dashboard (/api/dashboard)

### GET /api/dashboard/stats
Obtiene estadísticas generales del dashboard.

**Requisitos:**
- Authorization: Bearer Token

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "totalRoles": 15,
    "totalCandidates": 125,
    "averageScore": 78,
    "pendingReviews": 8
  }
}
```

### GET /api/dashboard/activity
Obtiene actividad reciente del sistema.

**Requisitos:**
- Authorization: Bearer Token

**Query Parameters:**
- `limit` (opcional): Número de actividades (default: 10)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "uuid-de-aplicacion",
        "type": "application",
        "title": "Nueva aplicación para Desarrollador Frontend",
        "description": "María García aplicó al puesto",
        "time": "2024-01-15T10:30:00.000Z",
        "score": 85
      },
      {
        "id": "uuid-del-rol",
        "type": "role",
        "title": "Nuevo rol creado: Desarrollador Backend",
        "description": "Rol en Tecnología",
        "time": "2024-01-15T09:15:00.000Z",
        "score": null
      }
    ]
  }
}
```

### GET /api/dashboard/analytics
Obtiene datos de analytics completos.

**Requisitos:**
- Authorization: Bearer Token

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "totalCandidates": 125,
    "totalRoles": 15,
    "averageScore": 78,
    "topCandidates": [
      {
        "id": "uuid-de-aplicacion",
        "name": "María García",
        "email": "maria@ejemplo.com",
        "role_title": "Desarrollador Frontend",
        "score": 95,
        "applied_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "scoreDistribution": [
      {
        "score_range": "90-100",
        "count": 8
      },
      {
        "score_range": "80-89",
        "count": 12
      }
    ],
    "roleStats": [
      {
        "id": "uuid-del-rol",
        "title": "Desarrollador Frontend",
        "applicationsCount": 25,
        "avgScore": 82,
        "status": "active"
      }
    ],
    "weeklyApplications": [
      {
        "week": "2024-01-08T00:00:00.000Z",
        "count": 5
      },
      {
        "week": "2024-01-15T00:00:00.000Z",
        "count": 8
      }
    ]
  }
}
```

---

## 7. Candidatos (/api/candidates)

### GET /api/candidates
Obtiene todos los candidatos de la empresa.

**Requisitos:**
- Authorization: Bearer Token

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 10)
- `status` (opcional): Estado de la aplicación
- `search` (opcional): Búsqueda por nombre o email
- `sortBy` (opcional): Campo de ordenamiento (applied_at, candidate_name, score, status)
- `sortOrder` (opcional): Orden (ASC, DESC)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "candidates": [
      {
        "id": "uuid-de-aplicacion",
        "name": "María García",
        "email": "maria@ejemplo.com",
        "roleTitle": "Desarrollador Frontend",
        "score": 85,
        "appliedAt": "2024-01-15T10:30:00.000Z",
        "status": "pending",
        "roleId": "uuid-del-rol"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCandidates": 45,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### GET /api/candidates/:id
Obtiene detalles específicos de un candidato.

**Requisitos:**
- Authorization: Bearer Token

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-de-aplicacion",
    "name": "María García",
    "email": "maria@ejemplo.com",
    "phone": "+34 123 456 789",
    "cvFilePath": "https://storage.supabase.co/object/public/cvs/archivo.pdf",
    "status": "pending",
    "evaluation": {
      "score": 85,
      "strengths": ["React", "TypeScript", "CSS"],
      "weaknesses": ["Testing", "Performance"],
      "summary": "Candidato con excelente experiencia en React y TypeScript...",
      "evaluationDate": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

---

## Códigos de Error

### Errores de Validación (400)
```json
{
  "error": {
    "message": "El email es requerido",
    "status": 400
  }
}
```

### No Autorizado (401)
```json
{
  "error": {
    "message": "Token de acceso requerido",
    "status": 401
  }
}
```

### Prohibido (403)
```json
{
  "error": {
    "message": "No tienes permisos para acceder a este recurso",
    "status": 403
  }
}
```

### No Encontrado (404)
```json
{
  "error": {
    "message": "Recurso no encontrado",
    "status": 404
  }
}
```

### Conflicto (409)
```json
{
  "error": {
    "message": "Ya existe una aplicación de este candidato para este rol",
    "status": 409
  }
}
```

### Error Interno del Servidor (500)
```json
{
  "error": {
    "message": "Error interno del servidor",
    "status": 500
  }
}
```

---

## Límites y Restricciones

- **Rate Limiting**: 10,000 requests por 15 minutos por IP
- **Tamaño máximo de archivo**: 10MB para CVs
- **Formatos de archivo permitidos**: Solo PDF para CVs
- **Paginación**: Máximo 50 elementos por página
- **Tamaño de respuesta**: Límite de 10MB para requests

---

## Notas Adicionales

1. **Evaluación Automática**: Los CVs se evalúan automáticamente usando IA (Gemini) después de la subida
2. **Almacenamiento**: Los archivos se almacenan en Supabase Storage
3. **Autenticación**: Utiliza Supabase Auth para gestión de usuarios
4. **Base de Datos**: PostgreSQL con Supabase
5. **CORS**: Configurado para permitir requests desde el frontend especificado en `FRONTEND_URL`

---

## Ejemplos de Uso

### Flujo Completo de Aplicación

1. **Crear Rol**:
   ```bash
   POST /api/roles
   Authorization: Bearer <token>
   Content-Type: application/json
   
   {
     "title": "Desarrollador Frontend",
     "description": "Desarrollador especializado en React",
     "requirements": "3+ años de experiencia"
   }
   ```

2. **Aplicar al Rol**:
   ```bash
   POST /api/applications
   Content-Type: multipart/form-data
   
   jobRoleId: <rol_id>
   candidateName: María García
   candidateEmail: maria@ejemplo.com
   cv: <archivo_pdf>
   ```

3. **Ver Evaluación**:
   ```bash
   GET /api/evaluations/application/<application_id>
   Authorization: Bearer <token>
   ```

4. **Actualizar Estado**:
   ```bash
   PUT /api/applications/<application_id>
   Authorization: Bearer <token>
   Content-Type: application/json
   
   {
     "status": "reviewing"
   }
   ```
