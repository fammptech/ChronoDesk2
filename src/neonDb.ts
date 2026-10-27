import {
  Company,
  TeamMember,
  Ticket,
  AttendanceSession,
  AuditEventType,
  AuditOrigin,
  AuditLog,
  ReportRecord,
  BLUEPRINT_CONSTRAINTS,
} from './types';

export interface NeonWorkspaceState {
  neonConfigured?: boolean;
  companies: Company[];
  teamMembers: TeamMember[];
  tickets: Ticket[];
  sessions: AttendanceSession[];
  auditLogs: AuditLog[];
  reports: ReportRecord[];
}

export function createSafeId(prefix: string): string {
  const randomPart = Math.random()
    .toString(36)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8);
  return `${prefix}_${Date.now()}_${randomPart}`
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, BLUEPRINT_CONSTRAINTS.ID_MAX_LEN);
}

export async function fetchNeonWorkspaceState(): Promise<NeonWorkspaceState> {
  try {
    const res = await fetch('/api/neon/state', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('Failed to fetch Neon state');
    }
    return (await res.json()) as NeonWorkspaceState;
  } catch (error) {
    console.error('Error loading Neon workspace state:', error);
    return {
      companies: [],
      teamMembers: [],
      tickets: [],
      sessions: [],
      auditLogs: [],
      reports: [],
    };
  }
}

export async function runNeonMigrations(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('/api/neon/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return {
      ok: Boolean(data.ok),
      message: String(data.message || 'Migrations processadas.'),
    };
  } catch (error) {
    console.error('Error running Neon migrations:', error);
    return {
      ok: false,
      message: 'Falha ao executar migrations no endpoint /api/neon/migrate.',
    };
  }
}

export async function createCompanyRecord(
  ownerId: string,
  input: Omit<Company, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  customId?: string
): Promise<string> {
  const id = customId || createSafeId('comp');
  await fetch('/api/neon/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ownerId, ...input }),
  });
  return id;
}

export async function createTeamMemberRecord(
  ownerId: string,
  input: Omit<TeamMember, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  customId?: string
): Promise<string> {
  const id = customId || createSafeId('mem');
  await fetch('/api/neon/team-members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ownerId, ...input }),
  });
  return id;
}

export async function updateTeamMemberStatus(memberId: string, status: TeamMember['status']) {
  await fetch(`/api/neon/team-members/${encodeURIComponent(memberId)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export async function createTicketRecord(
  ownerId: string,
  input: Omit<Ticket, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  customId?: string
): Promise<string> {
  const id = customId || `tkt_${input.issueNumber}`;
  await fetch('/api/neon/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ownerId, ...input }),
  });
  return id;
}

export async function updateTicketTimerAction(
  ticketId: string,
  updates: {
    status: Ticket['status'];
    githubState: Ticket['githubState'];
    totalSecondsWorked: number;
    activeSessionStartedAtMs: number;
    lastCommentSummary: string;
    commentsCount: number;
  }
) {
  await fetch(`/api/neon/tickets/${encodeURIComponent(ticketId)}/timer`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function reopenClosedTicketAction(ticketId: string) {
  await fetch(`/api/neon/tickets/${encodeURIComponent(ticketId)}/reopen`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function updateTicketCardFieldsAction(
  ticketId: string,
  updates: {
    title: string;
    description: string;
    assigneeName: string;
    githubAssignee: string;
    githubState: Ticket['githubState'];
    status: Ticket['status'];
    priority: Ticket['priority'];
    labelsSummary: string;
    commentsCount: number;
    lastCommentSummary: string;
  }
) {
  await fetch(`/api/neon/tickets/${encodeURIComponent(ticketId)}/fields`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function createAttendanceSessionRecord(
  ownerId: string,
  input: Omit<AttendanceSession, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  customId?: string
): Promise<string> {
  const id = customId || createSafeId('sess');
  await fetch('/api/neon/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ownerId, ...input }),
  });
  return id;
}

export async function createAuditLogRecord(
  ownerId: string,
  input: {
    eventType: AuditEventType;
    actorName: string;
    targetLabel: string;
    details: string;
    origin: AuditOrigin;
  }
): Promise<string> {
  const id = createSafeId('log');
  await fetch('/api/neon/audit-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ownerId, ...input }),
  });
  return id;
}

export async function createReportRecord(
  ownerId: string,
  input: Omit<ReportRecord, 'id' | 'ownerId' | 'createdAt'>
): Promise<string> {
  const id = createSafeId('rep');
  await fetch('/api/neon/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ownerId, ...input }),
  });
  return id;
}

export async function deleteReportRecord(reportId: string) {
  await fetch(`/api/neon/reports/${encodeURIComponent(reportId)}`, {
    method: 'DELETE',
  });
}
