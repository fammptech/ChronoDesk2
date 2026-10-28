export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export type CompanyStatus = 'active' | 'paused' | 'archived';

export interface Company {
  id: string;
  name: string;
  code: string;
  githubRepo: string;
  slaHours: number;
  hourlyRate: number;
  contractHours: number;
  status: CompanyStatus;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type TeamMemberStatus = 'disponivel' | 'em_atendimento' | 'ausente';

export type UserAccessRole = 'admin' | 'atendente';

export interface AtendentePermissionRules {
  /** Atendente só pode iniciar o timer de um card ao qual está atribuído (Ativa / Inativa) */
  restrictTimerToAssignedOnly: boolean;
  /** Ao logar no sistema, o Atendente visualiza apenas os seus cards filtrados por padrão (Ativa / Inativa) */
  defaultFilterMyCardsOnLogin: boolean;
  /** Permite que o Atendente altere o filtro para visualizar os cards de todos os técnicos (Ativa / Inativa) */
  allowViewAllTechniciansFilter: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  email?: string;
  password?: string;
  roleTitle: string;
  githubHandle: string;
  specialty: string;
  hourlyCost: number;
  status: TeamMemberStatus;
  accessRole?: UserAccessRole;
  restrictTimerToAssignedOnly?: boolean;
  defaultFilterMyCardsOnLogin?: boolean;
  allowViewAllTechniciansFilter?: boolean;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type TicketStatus = 'aberto' | 'em_atendimento' | 'pausado' | 'encerrado';
export type TicketPriority = 'baixa' | 'media' | 'alta' | 'critica';

export interface Ticket {
  id: string;
  issueNumber: number;
  title: string;
  description: string;
  companyId: string;
  companyName: string;
  assigneeName: string;
  githubAssignee: string;
  githubRepo: string;
  githubIssueUrl: string;
  githubState: 'open' | 'closed';
  status: TicketStatus;
  priority: TicketPriority;
  labelsSummary: string;
  commentsCount: number;
  lastCommentSummary: string;
  totalSecondsWorked: number;
  activeSessionStartedAtMs: number;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type SessionStatus = 'em_andamento' | 'pausada' | 'finalizada';

export interface AttendanceSession {
  id: string;
  ticketId: string;
  issueNumber: number;
  ticketTitle: string;
  companyName: string;
  agentName: string;
  startedAtIso: string;
  endedAtIso: string;
  durationSeconds: number;
  notes: string;
  sessionStatus: SessionStatus;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AuditEventType =
  | 'webhook_github'
  | 'sync_api'
  | 'sessao_iniciada'
  | 'sessao_pausada'
  | 'chamado_encerrado'
  | 'chamado_criado'
  | 'empresa_cadastrada'
  | 'relatorio_gerado';

export type AuditOrigin = 'GitHub Webhook' | 'GitHub REST API' | 'Operador Web' | 'Sistema';

export interface AuditLog {
  id: string;
  eventType: AuditEventType;
  actorName: string;
  targetLabel: string;
  details: string;
  origin: AuditOrigin;
  ownerId: string;
  createdAt?: unknown;
}

export interface ReportRecord {
  id: string;
  title: string;
  companyFilter: string;
  periodLabel: string;
  totalTickets: number;
  totalSeconds: number;
  totalBilledAmount: number;
  generatedBy: string;
  ownerId: string;
  createdAt?: unknown;
}

export interface IssueHistoryEntry {
  id: string;
  issueNumber: number;
  actionType: 'comment_and_move' | 'close_issue';
  commentMarkdown: string;
  authorName: string;
  authorHandle: string;
  createdAtIso: string;
  previousColumn: string;
  targetColumn: string;
  closedIssue: boolean;
}


// Validation constants synchronized verbatim with firebase-blueprint.json & firestore.rules
export const BLUEPRINT_CONSTRAINTS = {
  ID_PATTERN: /^[a-zA-Z0-9_\-]+$/,
  ID_MAX_LEN: 128,
  COMPANY: {
    NAME_MAX: 120,
    CODE_MAX: 32,
    REPO_MAX: 160,
    SLA_MIN: 1,
    SLA_MAX: 720,
    RATE_MAX: 100000,
    CONTRACT_MAX: 10000,
  },
  TEAM: {
    NAME_MAX: 120,
    ROLE_MAX: 100,
    HANDLE_MAX: 80,
    SPECIALTY_MAX: 120,
    COST_MAX: 100000,
  },
  TICKET: {
    TITLE_MAX: 240,
    DESC_MAX: 4000,
    COMPANY_NAME_MAX: 120,
    ASSIGNEE_MAX: 120,
    GH_ASSIGNEE_MAX: 80,
    REPO_MAX: 160,
    URL_MAX: 400,
    LABELS_MAX: 300,
    LAST_COMMENT_MAX: 500,
  },
  SESSION: {
    TITLE_MAX: 240,
    COMPANY_MAX: 120,
    AGENT_MAX: 120,
    ISO_MAX: 64,
    NOTES_MAX: 1000,
  },
  AUDIT: {
    ACTOR_MAX: 120,
    TARGET_MAX: 200,
    DETAILS_MAX: 1000,
  },
  REPORT: {
    TITLE_MAX: 200,
    COMPANY_MAX: 120,
    PERIOD_MAX: 100,
    GEN_BY_MAX: 120,
  },
} as const;
