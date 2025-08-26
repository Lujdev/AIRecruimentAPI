-- Migración inicial para RecruimentApp
-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de usuarios (extiende auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  role VARCHAR(50) DEFAULT 'recruiter' CHECK (role IN ('admin', 'recruiter', 'hr_manager')),
  company_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de roles/puestos de trabajo
CREATE TABLE IF NOT EXISTS public.job_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  department VARCHAR(100),
  location VARCHAR(255),
  employment_type VARCHAR(50) DEFAULT 'full-time' CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'internship')),
  salary_range VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
  created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de aplicaciones/candidatos
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_role_id UUID REFERENCES public.job_roles(id) ON DELETE CASCADE,
  candidate_name VARCHAR(255) NOT NULL,
  candidate_email VARCHAR(255) NOT NULL,
  candidate_phone VARCHAR(50),
  cv_file_path TEXT NOT NULL,
  cv_text TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'interviewed', 'hired', 'rejected')),
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de evaluaciones de IA
CREATE TABLE IF NOT EXISTS public.evaluations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  strengths JSONB,
  weaknesses JSONB,
  summary TEXT,
  model_used VARCHAR(100),
  evaluation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_job_roles_status ON public.job_roles(status);
CREATE INDEX IF NOT EXISTS idx_job_roles_created_by ON public.job_roles(created_by);
CREATE INDEX IF NOT EXISTS idx_applications_job_role_id ON public.applications(job_role_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_evaluations_application_id ON public.evaluations(application_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_score ON public.evaluations(score);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_roles_updated_at ON public.job_roles;
CREATE TRIGGER update_job_roles_updated_at BEFORE UPDATE ON public.job_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_applications_updated_at ON public.applications;
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Políticas RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- Política para usuarios: pueden ver y editar su propio perfil
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Política para job_roles: usuarios autenticados pueden ver todos los roles
CREATE POLICY "Authenticated users can view job roles" ON public.job_roles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create job roles" ON public.job_roles
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own job roles" ON public.job_roles
  FOR UPDATE USING (auth.uid() = created_by);

-- Política para applications: usuarios pueden ver aplicaciones de sus roles
CREATE POLICY "Users can view applications for their job roles" ON public.applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.job_roles 
      WHERE job_roles.id = applications.job_role_id 
      AND job_roles.created_by = auth.uid()
    )
  );

CREATE POLICY "Anyone can create applications" ON public.applications
  FOR INSERT WITH CHECK (true);

-- Política para evaluations: usuarios pueden ver evaluaciones de aplicaciones de sus roles
CREATE POLICY "Users can view evaluations for their applications" ON public.evaluations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.job_roles jr ON a.job_role_id = jr.id
      WHERE a.id = evaluations.application_id 
      AND jr.created_by = auth.uid()
    )
  );

CREATE POLICY "System can create evaluations" ON public.evaluations
  FOR INSERT WITH CHECK (true);