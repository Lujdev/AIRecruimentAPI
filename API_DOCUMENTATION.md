# API Documentation - Recruitment System

## Base URL
```
http://localhost:3000/api
```

## Authentication
Most endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

---

## 🔐 Authentication Endpoints

### POST /api/auth/register
**Description:** Register a new user account

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe",
  "companyName": "Acme Corp" // optional
}
```

**Response (201):**
```json
{
  "message": "Usuario registrado exitosamente. Revisa tu email para confirmar tu cuenta.",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "emailConfirmed": false
  }
}
```

**Error Responses:**
- `400` - Validation error
- `500` - Server error

---

### POST /api/auth/login
**Description:** Authenticate user and get access token

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Inicio de sesión exitoso",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "profile": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "company_name": "Acme Corp",
      "role": "recruiter",
      "created_at": "2024-01-01T00:00:00Z"
    }
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_at": 1234567890
  }
}
```

**Error Responses:**
- `400` - Validation error
- `401` - Invalid credentials
- `500` - Server error

---

### POST /api/auth/google
**Description:** Get Google OAuth URL for authentication

**Response (200):**
```json
{
  "url": "https://accounts.google.com/oauth/authorize?...",
  "message": "Redirige al usuario a esta URL para autenticación con Google"
}
```

---

### POST /api/auth/refresh
**Description:** Refresh access token using refresh token

**Request Body:**
```json
{
  "refresh_token": "refresh_token_here"
}
```

**Response (200):**
```json
{
  "session": {
    "access_token": "new_jwt_token",
    "refresh_token": "new_refresh_token",
    "expires_at": 1234567890
  }
}
```

---

### POST /api/auth/logout
**Description:** Logout user (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "message": "Sesión cerrada exitosamente"
}
```

---

### GET /api/auth/profile
**Description:** Get current user profile (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "profile": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "company_name": "Acme Corp",
      "role": "recruiter",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

---

### PUT /api/auth/profile
**Description:** Update user profile (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "fullName": "John Smith", // optional
  "companyName": "New Corp", // optional
  "role": "admin" // optional, values: admin, recruiter, hr_manager
}
```

**Response (200):**
```json
{
  "message": "Perfil actualizado exitosamente",
  "profile": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Smith",
    "company_name": "New Corp",
    "role": "admin",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

## 📋 Job Roles Endpoints

### GET /api/roles
**Description:** Get all job roles with optional filters

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 10, max: 50) - Items per page
- `status` (string, default: 'active') - Filter by status: active, inactive, closed, all
- `department` (string) - Filter by department
- `employmentType` (string) - Filter by employment type: full-time, part-time, contract, internship
- `search` (string) - Search in title and description
- `createdBy` (string) - Filter by creator ID (requires auth)

**Response (200):**
```json
{
  "roles": [
    {
      "id": "uuid",
      "title": "Senior Developer",
      "description": "Full-stack developer position",
      "requirements": "5+ years experience",
      "department": "Engineering",
      "location": "Remote",
      "employment_type": "full-time",
      "salary_range": "$80,000 - $120,000",
      "status": "active",
      "created_by": "uuid",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "creator_name": "John Doe",
      "creator_company": "Acme Corp",
      "applications_count": 15
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

---

### GET /api/roles/:id
**Description:** Get specific job role details

**Response (200):**
```json
{
  "success": true,
  "data": {
    "role": {
      "id": "uuid",
      "title": "Senior Developer",
      "description": "Full-stack developer position",
      "requirements": "5+ years experience",
      "department": "Engineering",
      "location": "Remote",
      "employmentType": "full-time",
      "salaryRange": "$80,000 - $120,000",
      "candidatesCount": 15,
      "createdAt": "2024-01-01T00:00:00Z",
      "status": "active",
      "userId": "uuid",
      "creator": {
        "name": "John Doe",
        "company": "Acme Corp"
      }
    }
  }
}
```

---

### POST /api/roles
**Description:** Create new job role (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "title": "Senior Developer",
  "description": "Full-stack developer position with 5+ years experience",
  "requirements": "React, Node.js, PostgreSQL experience required",
  "department": "Engineering", // optional
  "location": "Remote", // optional
  "employmentType": "full-time", // optional, default: full-time
  "salaryRange": "$80,000 - $120,000" // optional
}
```

**Response (201):**
```json
{
  "message": "Rol creado exitosamente",
  "role": {
    "id": "uuid",
    "title": "Senior Developer",
    "description": "Full-stack developer position with 5+ years experience",
    "requirements": "React, Node.js, PostgreSQL experience required",
    "department": "Engineering",
    "location": "Remote",
    "employment_type": "full-time",
    "salary_range": "$80,000 - $120,000",
    "status": "active",
    "created_by": "uuid",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### PUT /api/roles/:id
**Description:** Update job role (requires authentication, only creator or admin)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "title": "Lead Developer", // optional
  "description": "Updated description", // optional
  "requirements": "Updated requirements", // optional
  "department": "Engineering", // optional
  "location": "Hybrid", // optional
  "employmentType": "full-time", // optional
  "salaryRange": "$90,000 - $130,000", // optional
  "status": "inactive" // optional: active, inactive, closed
}
```

**Response (200):**
```json
{
  "message": "Rol actualizado exitosamente",
  "role": {
    "id": "uuid",
    "title": "Lead Developer",
    "description": "Updated description",
    "requirements": "Updated requirements",
    "department": "Engineering",
    "location": "Hybrid",
    "employment_type": "full-time",
    "salary_range": "$90,000 - $130,000",
    "status": "inactive",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### DELETE /api/roles/:id
**Description:** Delete job role (requires authentication, only creator or admin)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "message": "Rol eliminado exitosamente"
}
```

**Note:** If role has applications, it will be closed instead of deleted.

---

### GET /api/roles/:id/candidates
**Description:** Get all candidates for a specific role (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 10, max: 50) - Items per page
- `status` (string) - Filter by application status
- `search` (string) - Search in candidate name or email

**Response (200):**
```json
{
  "candidates": [
    {
      "id": "uuid",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "cvUrl": "https://storage.url/cv.pdf",
      "score": 85,
      "strengths": ["React", "Node.js"],
      "weaknesses": ["Testing"],
      "evaluation": "Strong technical skills...",
      "evaluation_date": "2024-01-01T00:00:00Z",
      "appliedAt": "2024-01-01T00:00:00Z",
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

### GET /api/roles/:id/applications
**Description:** Get applications for a specific role (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 10, max: 50) - Items per page
- `status` (string) - Filter by application status

**Response (200):**
```json
{
  "applications": [
    {
      "id": "uuid",
      "job_role_id": "uuid",
      "candidate_name": "Jane Smith",
      "candidate_email": "jane@example.com",
      "candidate_phone": "+1234567890",
      "cv_file_path": "https://storage.url/cv.pdf",
      "status": "pending",
      "applied_at": "2024-01-01T00:00:00Z",
      "score": 85,
      "evaluation_summary": "Strong technical skills..."
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

## 📄 Applications Endpoints

### POST /api/applications
**Description:** Submit job application with CV

**Request Body:** (multipart/form-data)
- `cv` (file, required) - PDF file
- `jobRoleId` (string, required) - UUID of job role
- `candidateName` (string, required) - Candidate's full name
- `candidateEmail` (string, required) - Candidate's email
- `candidatePhone` (string, optional) - Candidate's phone

**Response (201):**
```json
{
  "message": "Aplicación creada exitosamente. La evaluación se procesará en breve.",
  "application": {
    "id": "uuid",
    "jobRoleId": "uuid",
    "candidateName": "Jane Smith",
    "candidateEmail": "jane@example.com",
    "candidatePhone": "+1234567890",
    "status": "pending",
    "cvFilePath": "https://storage.url/cv.pdf"
  }
}
```

**Error Responses:**
- `400` - Validation error or file not provided
- `404` - Job role not found
- `409` - Application already exists for this candidate
- `500` - Server error

---

### GET /api/applications
**Description:** Get applications (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 10, max: 50) - Items per page
- `status` (string) - Filter by status: pending, reviewing, interviewed, hired, rejected
- `jobRoleId` (string) - Filter by job role ID
- `search` (string) - Search in candidate name or email

**Response (200):**
```json
{
  "applications": [
    {
      "id": "uuid",
      "job_role_id": "uuid",
      "candidate_name": "Jane Smith",
      "candidate_email": "jane@example.com",
      "candidate_phone": "+1234567890",
      "cv_file_path": "https://storage.url/cv.pdf",
      "status": "pending",
      "applied_at": "2024-01-01T00:00:00Z",
      "job_title": "Senior Developer",
      "department": "Engineering",
      "score": 85,
      "strengths": ["React", "Node.js"],
      "weaknesses": ["Testing"],
      "evaluation_summary": "Strong technical skills..."
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

---

### GET /api/applications/:id
**Description:** Get specific application (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "application": {
    "id": "uuid",
    "job_role_id": "uuid",
    "candidate_name": "Jane Smith",
    "candidate_email": "jane@example.com",
    "candidate_phone": "+1234567890",
    "cv_file_path": "https://storage.url/cv.pdf",
    "status": "pending",
    "applied_at": "2024-01-01T00:00:00Z",
    "job_title": "Senior Developer",
    "job_description": "Full-stack developer position",
    "job_requirements": "5+ years experience",
    "department": "Engineering",
    "job_creator_id": "uuid",
    "score": 85,
    "strengths": ["React", "Node.js"],
    "weaknesses": ["Testing"],
    "evaluation_summary": "Strong technical skills...",
    "evaluation_date": "2024-01-01T00:00:00Z"
  }
}
```

---

### PUT /api/applications/:id
**Description:** Update application (requires authentication, only creator or admin)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "status": "reviewing", // optional: pending, reviewing, interviewed, hired, rejected
  "candidateName": "Jane Doe", // optional
  "candidateEmail": "jane.doe@example.com", // optional
  "candidatePhone": "+0987654321" // optional
}
```

**Response (200):**
```json
{
  "message": "Aplicación actualizada exitosamente",
  "application": {
    "id": "uuid",
    "job_role_id": "uuid",
    "candidate_name": "Jane Doe",
    "candidate_email": "jane.doe@example.com",
    "candidate_phone": "+0987654321",
    "status": "reviewing",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### DELETE /api/applications/:id
**Description:** Delete application (requires authentication, only creator or admin)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "message": "Aplicación eliminada exitosamente"
}
```

---

## 👥 Candidates Endpoints

### GET /api/candidates
**Description:** Get all candidates for user's roles (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 10) - Items per page
- `status` (string) - Filter by status
- `search` (string) - Search in name or email
- `sortBy` (string, default: 'applied_at') - Sort field: applied_at, candidate_name, score, status
- `sortOrder` (string, default: 'DESC') - Sort order: ASC, DESC

**Response (200):**
```json
{
  "success": true,
  "data": {
    "candidates": [
      {
        "id": "uuid",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "roleTitle": "Senior Developer",
        "score": 85,
        "appliedAt": "2024-01-01T00:00:00Z",
        "status": "pending",
        "roleId": "uuid"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalCandidates": 25,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

### GET /api/candidates/:id
**Description:** Get specific candidate details (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "cvFilePath": "https://storage.url/cv.pdf",
    "status": "pending",
    "evaluation": {
      "score": 85,
      "strengths": ["React", "Node.js"],
      "weaknesses": ["Testing"],
      "summary": "Strong technical skills...",
      "evaluationDate": "2024-01-01T00:00:00Z"
    }
  }
}
```

---

## 📊 Dashboard Endpoints

### GET /api/dashboard/stats
**Description:** Get dashboard statistics (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalRoles": 5,
    "totalCandidates": 25,
    "averageScore": 78,
    "pendingReviews": 8
  }
}
```

---

### GET /api/dashboard/activity
**Description:** Get recent activity (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `limit` (number, default: 10) - Number of activities to return

**Response (200):**
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "uuid",
        "type": "application",
        "title": "Nueva aplicación para Senior Developer",
        "description": "Jane Smith aplicó al puesto",
        "time": "2024-01-01T00:00:00Z",
        "score": 85
      },
      {
        "id": "uuid",
        "type": "role",
        "title": "Nuevo rol creado: Frontend Developer",
        "description": "Rol en Engineering",
        "time": "2024-01-01T00:00:00Z",
        "score": null
      }
    ]
  }
}
```

---

### GET /api/dashboard/analytics
**Description:** Get comprehensive analytics data (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalCandidates": 25,
    "totalRoles": 5,
    "averageScore": 78,
    "topCandidates": [
      {
        "id": "uuid",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "role_title": "Senior Developer",
        "score": 95,
        "applied_at": "2024-01-01T00:00:00Z"
      }
    ],
    "scoreDistribution": [
      {
        "score_range": "90-100",
        "count": 5
      },
      {
        "score_range": "80-89",
        "count": 8
      }
    ],
    "roleStats": [
      {
        "id": "uuid",
        "title": "Senior Developer",
        "applicationsCount": 15,
        "avgScore": 82,
        "status": "active"
      }
    ],
    "weeklyApplications": [
      {
        "week": "2024-01-01T00:00:00Z",
        "count": 5
      }
    ]
  }
}
```

---

## 🔍 Evaluations Endpoints

### GET /api/evaluations
**Description:** Get evaluations (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 10, max: 50) - Items per page
- `jobRoleId` (string) - Filter by job role ID
- `minScore` (number) - Minimum score filter
- `maxScore` (number) - Maximum score filter
- `sortBy` (string, default: 'evaluation_date') - Sort field: evaluation_date, score, candidate_name, job_title
- `sortOrder` (string, default: 'desc') - Sort order: asc, desc

**Response (200):**
```json
{
  "evaluations": [
    {
      "id": "uuid",
      "application_id": "uuid",
      "score": 85,
      "strengths": ["React", "Node.js"],
      "weaknesses": ["Testing"],
      "summary": "Strong technical skills...",
      "model_used": "llama-3.1-8b-instant",
      "evaluation_date": "2024-01-01T00:00:00Z",
      "candidate_name": "Jane Smith",
      "candidate_email": "jane@example.com",
      "application_status": "pending",
      "applied_at": "2024-01-01T00:00:00Z",
      "job_title": "Senior Developer",
      "department": "Engineering",
      "job_role_id": "uuid"
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

---

### GET /api/evaluations/:id
**Description:** Get specific evaluation (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "evaluation": {
    "id": "uuid",
    "application_id": "uuid",
    "score": 85,
    "strengths": ["React", "Node.js"],
    "weaknesses": ["Testing"],
    "summary": "Strong technical skills...",
    "model_used": "llama-3.1-8b-instant",
    "evaluation_date": "2024-01-01T00:00:00Z",
    "candidate_name": "Jane Smith",
    "candidate_email": "jane@example.com",
    "candidate_phone": "+1234567890",
    "application_status": "pending",
    "applied_at": "2024-01-01T00:00:00Z",
    "cv_file_path": "https://storage.url/cv.pdf",
    "job_title": "Senior Developer",
    "job_description": "Full-stack developer position",
    "job_requirements": "5+ years experience",
    "department": "Engineering",
    "job_creator_id": "uuid"
  }
}
```

---

### GET /api/evaluations/application/:applicationId
**Description:** Get evaluation by application ID (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "evaluation": {
    "id": "uuid",
    "application_id": "uuid",
    "score": 85,
    "strengths": ["React", "Node.js"],
    "weaknesses": ["Testing"],
    "summary": "Strong technical skills...",
    "model_used": "llama-3.1-8b-instant",
    "evaluation_date": "2024-01-01T00:00:00Z",
    "candidate_name": "Jane Smith",
    "candidate_email": "jane@example.com",
    "candidate_phone": "+1234567890",
    "application_status": "pending",
    "applied_at": "2024-01-01T00:00:00Z",
    "cv_file_path": "https://storage.url/cv.pdf",
    "job_title": "Senior Developer",
    "job_description": "Full-stack developer position",
    "job_requirements": "5+ years experience",
    "department": "Engineering",
    "job_creator_id": "uuid"
  }
}
```

---

### POST /api/evaluations/reevaluate
**Description:** Re-evaluate a CV (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "applicationId": "uuid"
}
```

**Response (200):**
```json
{
  "message": "CV re-evaluado exitosamente",
  "evaluation": {
    "id": "uuid",
    "application_id": "uuid",
    "score": 88,
    "strengths": ["React", "Node.js", "TypeScript"],
    "weaknesses": ["Testing"],
    "summary": "Updated evaluation...",
    "model_used": "llama-3.1-8b-instant",
    "evaluation_date": "2024-01-01T00:00:00Z"
  }
}
```

---

### GET /api/evaluations/stats
**Description:** Get evaluation statistics (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `jobRoleId` (string) - Filter by job role ID

**Response (200):**
```json
{
  "stats": {
    "totalEvaluations": 25,
    "averageScore": "78.5",
    "minScore": 45,
    "maxScore": 95,
    "scoreDistribution": {
      "high": 8, // >= 80
      "medium": 12, // 60-79
      "low": 5 // < 60
    }
  }
}
```

---

### DELETE /api/evaluations/:id
**Description:** Delete evaluation (requires authentication, only creator or admin)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "message": "Evaluación eliminada exitosamente"
}
```

---

## 📝 Common Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful" // optional
}
```

### Error Response
```json
{
  "error": {
    "message": "Error description",
    "status": 400
  }
}
```

### Pagination Response
```json
{
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## 🔒 Authentication & Authorization

### User Roles
- `admin` - Full access to all resources
- `recruiter` - Can manage own job roles and applications
- `hr_manager` - Can manage HR-related resources

### Permission Matrix
| Resource | Admin | Recruiter | HR Manager |
|----------|-------|-----------|------------|
| Own Job Roles | ✅ | ✅ | ✅ |
| Other Job Roles | ✅ | ❌ | ❌ |
| Own Applications | ✅ | ✅ | ✅ |
| Other Applications | ✅ | ❌ | ❌ |
| All Evaluations | ✅ | Own only | Own only |
| Dashboard Stats | ✅ | Own only | Own only |

---

## 📋 Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 500 | Internal Server Error |

---

## 🔧 File Upload

### Supported File Types
- **CV Files**: PDF only
- **Max File Size**: 10MB (configurable via `MAX_FILE_SIZE` env var)

### File Storage
- Files are stored in Supabase Storage
- Public URLs are generated for file access
- Files are automatically cleaned up when applications are deleted

---

## 🚀 Rate Limiting

Currently no rate limiting is implemented, but it's recommended to add rate limiting for production use.

---

## 📚 Additional Notes

1. **UUIDs**: All IDs are UUIDs (v4)
2. **Timestamps**: All timestamps are in ISO 8601 format with UTC timezone
3. **File Uploads**: Use `multipart/form-data` for file uploads
4. **Search**: Text search is case-insensitive and uses ILIKE
5. **Pagination**: Default page size is 10, maximum is 50
6. **AI Evaluation**: CVs are automatically evaluated using Groq's Llama model
7. **Real-time**: No WebSocket support currently implemented
