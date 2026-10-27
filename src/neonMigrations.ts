export const NEON_MIGRATION_0001_SQL = `-- =============================================================================
-- ChronoDesk (ZDT Governance) — Neon.com Serverless PostgreSQL Migration
-- Migration: 0001_neon_initial_schema.sql
-- Compatível com: Neon.com (PostgreSQL 15 / 16 / 17)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Tabela de Clientes / Empresas (companies)
CREATE TABLE IF NOT EXISTS companies (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  code VARCHAR(32) NOT NULL UNIQUE,
  github_repo VARCHAR(160) NOT NULL DEFAULT 'zdttech-copilot/governanca-zdt',
  sla_hours INTEGER NOT NULL DEFAULT 4 CHECK (sla_hours BETWEEN 1 AND 720),
  hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 250.00,
  contract_hours NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
  status VARCHAR(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  owner_id VARCHAR(128) NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_companies_updated_at ON companies;
CREATE TRIGGER trg_companies_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. Tabela de Técnicos / Equipe (team_members)
CREATE TABLE IF NOT EXISTS team_members (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  role_title VARCHAR(120) NOT NULL,
  github_handle VARCHAR(80) NOT NULL UNIQUE,
  specialty VARCHAR(160) NOT NULL,
  hourly_cost NUMERIC(10, 2) NOT NULL DEFAULT 160.00,
  status VARCHAR(32) NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'em_atendimento', 'ausente')),
  owner_id VARCHAR(128) NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_team_members_updated_at ON team_members;
CREATE TRIGGER trg_team_members_updated_at
BEFORE UPDATE ON team_members
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Tabela de Chamados / Issues Sincronizadas (tickets)
CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR(128) PRIMARY KEY,
  issue_number INTEGER NOT NULL UNIQUE,
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  company_id VARCHAR(128) NOT NULL,
  company_name VARCHAR(140) NOT NULL,
  assignee_name VARCHAR(120) NOT NULL,
  github_assignee VARCHAR(80) NOT NULL,
  github_repo VARCHAR(160) NOT NULL DEFAULT 'zdttech-copilot/governanca-zdt',
  github_issue_url VARCHAR(500) NOT NULL DEFAULT '',
  github_state VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (github_state IN ('open', 'closed')),
  status VARCHAR(32) NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_atendimento', 'pausado', 'encerrado')),
  priority VARCHAR(24) NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'critica')),
  labels_summary VARCHAR(400) NOT NULL DEFAULT '',
  comments_count INTEGER NOT NULL DEFAULT 0,
  last_comment_summary VARCHAR(500) NOT NULL DEFAULT '',
  total_seconds_worked BIGINT NOT NULL DEFAULT 0 CHECK (total_seconds_worked >= 0),
  active_session_started_at_ms BIGINT NOT NULL DEFAULT 0 CHECK (active_session_started_at_ms >= 0),
  owner_id VARCHAR(128) NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_issue_number ON tickets (issue_number);
CREATE INDEX IF NOT EXISTS idx_tickets_company_name ON tickets (company_name);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);

DROP TRIGGER IF EXISTS trg_tickets_updated_at ON tickets;
CREATE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Tabela de Sessões de Atendimento Cronometradas (attendance_sessions)
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id VARCHAR(128) PRIMARY KEY,
  ticket_id VARCHAR(128) NOT NULL,
  issue_number INTEGER NOT NULL,
  ticket_title VARCHAR(240) NOT NULL,
  company_name VARCHAR(140) NOT NULL,
  agent_name VARCHAR(120) NOT NULL,
  started_at_iso VARCHAR(64) NOT NULL,
  ended_at_iso VARCHAR(64) NOT NULL DEFAULT '',
  duration_seconds BIGINT NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  notes VARCHAR(500) NOT NULL DEFAULT '',
  session_status VARCHAR(32) NOT NULL DEFAULT 'pausada' CHECK (session_status IN ('em_andamento', 'pausada', 'finalizada')),
  owner_id VARCHAR(128) NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_issue_number ON attendance_sessions (issue_number);
CREATE INDEX IF NOT EXISTS idx_sessions_company_name ON attendance_sessions (company_name);

DROP TRIGGER IF EXISTS trg_sessions_updated_at ON attendance_sessions;
CREATE TRIGGER trg_sessions_updated_at
BEFORE UPDATE ON attendance_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Tabela de Auditoria de Operações e Sincronizações (audit_logs)
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(128) PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  actor_name VARCHAR(120) NOT NULL,
  target_label VARCHAR(180) NOT NULL,
  details VARCHAR(600) NOT NULL,
  origin VARCHAR(64) NOT NULL DEFAULT 'Operador Web',
  owner_id VARCHAR(128) NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);

-- 6. Tabela de Relatórios Consolidados (reports)
CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(128) PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  company_filter VARCHAR(120) NOT NULL,
  period_label VARCHAR(80) NOT NULL,
  total_tickets INTEGER NOT NULL DEFAULT 0,
  total_seconds BIGINT NOT NULL DEFAULT 0,
  total_billed_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  generated_by VARCHAR(120) NOT NULL,
  owner_id VARCHAR(128) NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Tabela de Histórico de Comentários e Movimentações (issue_history)
CREATE TABLE IF NOT EXISTS issue_history (
  id VARCHAR(128) PRIMARY KEY,
  issue_number INTEGER NOT NULL,
  action_type VARCHAR(32) NOT NULL CHECK (action_type IN ('comment_and_move', 'close_issue')),
  comment_markdown TEXT NOT NULL,
  author_name VARCHAR(120) NOT NULL,
  author_handle VARCHAR(80) NOT NULL,
  previous_column VARCHAR(80) NOT NULL,
  target_column VARCHAR(80) NOT NULL,
  closed_issue BOOLEAN NOT NULL DEFAULT FALSE,
  created_at_iso TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_history_issue_number ON issue_history (issue_number, created_at_iso DESC);

-- 8. Tabela de Parametrização de Horário Comercial e Limite de Técnicos (work_hours_settings)
CREATE TABLE IF NOT EXISTS work_hours_settings (
  id VARCHAR(64) PRIMARY KEY DEFAULT 'global',
  global_start_time VARCHAR(8) NOT NULL DEFAULT '08:00',
  global_end_time VARCHAR(8) NOT NULL DEFAULT '18:00',
  global_max_technicians_per_company INTEGER NOT NULL DEFAULT 2,
  client_rules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Inicial (Clientes ZDT)
INSERT INTO companies (id, name, code, github_repo, sla_hours, hourly_rate, contract_hours, status, owner_id)
VALUES
  ('comp_tutora', 'Tutora Educação & Tecnologia', 'Tutora', 'zdttech-copilot/governanca-zdt', 4, 260, 120, 'active', 'default'),
  ('comp_ampm', 'AMPM Conveniência & Operações', 'AMPM', 'zdttech-copilot/governanca-zdt', 4, 280, 160, 'active', 'default'),
  ('comp_gocase', 'GoCase Comércio & Digital', 'GoCase', 'zdttech-copilot/governanca-zdt', 6, 250, 80, 'active', 'default'),
  ('comp_braveo', 'Braveo Soluções Corporativas', 'Braveo', 'zdttech-copilot/governanca-zdt', 4, 270, 100, 'active', 'default'),
  ('comp_mdr', 'MDR Advocacia & Governança', 'MDR', 'zdttech-copilot/governanca-zdt', 6, 250, 90, 'active', 'default')
ON CONFLICT (code) DO NOTHING;`;
