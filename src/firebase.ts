import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  OperationType,
  FirestoreErrorInfo,
  BLUEPRINT_CONSTRAINTS,
  Company,
  TeamMember,
  Ticket,
  AttendanceSession,
  AuditEventType,
  AuditOrigin,
  ReportRecord,
} from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  return signOut(auth);
}

// Helper to generate safe document IDs matching ^[a-zA-Z0-9_\-]+$
export function createSafeId(prefix: string): string {
  const randomPart = Math.random().toString(36).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  const id = `${prefix}_${Date.now()}_${randomPart}`
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, BLUEPRINT_CONSTRAINTS.ID_MAX_LEN);
  return id;
}

export function sanitizeStr(val: string, maxLen: number, fallback = '-'): string {
  const trimmed = (val || '').trim();
  if (!trimmed) return fallback.slice(0, maxLen);
  return trimmed.slice(0, maxLen);
}

export function sanitizeCode(val: string, maxLen = 32): string {
  const cleaned = (val || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_\-]/g, '_')
    .slice(0, maxLen);
  return cleaned || 'CORP';
}

// Firestore Write Actions with strict schema adherence and handleFirestoreError

export async function createCompanyRecord(
  ownerId: string,
  input: Omit<Company, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  customId?: string
): Promise<string> {
  const docId = customId && BLUEPRINT_CONSTRAINTS.ID_PATTERN.test(customId)
    ? customId.slice(0, 128)
    : createSafeId('comp');
  const path = `companies/${docId}`;
  const payload = {
    name: sanitizeStr(input.name, BLUEPRINT_CONSTRAINTS.COMPANY.NAME_MAX, 'Empresa'),
    code: sanitizeCode(input.code, BLUEPRINT_CONSTRAINTS.COMPANY.CODE_MAX),
    githubRepo: sanitizeStr(input.githubRepo, BLUEPRINT_CONSTRAINTS.COMPANY.REPO_MAX, 'vercel/next.js'),
    slaHours: Math.min(Math.max(Number(input.slaHours) || 4, 1), 720),
    hourlyRate: Math.min(Math.max(Number(input.hourlyRate) || 220, 0), 100000),
    contractHours: Math.min(Math.max(Number(input.contractHours) || 40, 0), 10000),
    status: ['active', 'paused', 'archived'].includes(input.status) ? input.status : 'active',
    ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'companies', docId), payload);
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createTeamMemberRecord(
  ownerId: string,
  input: Omit<TeamMember, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  customId?: string
): Promise<string> {
  const docId = customId && BLUEPRINT_CONSTRAINTS.ID_PATTERN.test(customId)
    ? customId.slice(0, 128)
    : createSafeId('member');
  const path = `teamMembers/${docId}`;
  const payload = {
    name: sanitizeStr(input.name, BLUEPRINT_CONSTRAINTS.TEAM.NAME_MAX, 'Especialista'),
    roleTitle: sanitizeStr(input.roleTitle, BLUEPRINT_CONSTRAINTS.TEAM.ROLE_MAX, 'Engenheiro de Suporte'),
    githubHandle: sanitizeStr(input.githubHandle, BLUEPRINT_CONSTRAINTS.TEAM.HANDLE_MAX, 'dev'),
    specialty: sanitizeStr(input.specialty, BLUEPRINT_CONSTRAINTS.TEAM.SPECIALTY_MAX, 'Full-Stack & Infra'),
    hourlyCost: Math.min(Math.max(Number(input.hourlyCost) || 140, 0), 100000),
    status: ['disponivel', 'em_atendimento', 'ausente'].includes(input.status)
      ? input.status
      : 'disponivel',
    ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'teamMembers', docId), payload);
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTeamMemberStatus(memberId: string, status: TeamMember['status']) {
  const path = `teamMembers/${memberId}`;
  try {
    await updateDoc(doc(db, 'teamMembers', memberId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createTicketRecord(
  ownerId: string,
  input: Omit<Ticket, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  customId?: string
): Promise<string> {
  const docId = customId && BLUEPRINT_CONSTRAINTS.ID_PATTERN.test(customId)
    ? customId.slice(0, 128)
    : createSafeId('tkt');
  const path = `tickets/${docId}`;
  const payload = {
    issueNumber: Math.min(Math.max(Math.round(Number(input.issueNumber) || 1000), 1), 99999999),
    title: sanitizeStr(input.title, BLUEPRINT_CONSTRAINTS.TICKET.TITLE_MAX, 'Chamado sem título'),
    description: (input.description || '').slice(0, BLUEPRINT_CONSTRAINTS.TICKET.DESC_MAX),
    companyId: input.companyId.slice(0, 128),
    companyName: sanitizeStr(input.companyName, BLUEPRINT_CONSTRAINTS.TICKET.COMPANY_NAME_MAX, 'XPTO'),
    assigneeName: sanitizeStr(input.assigneeName, BLUEPRINT_CONSTRAINTS.TICKET.ASSIGNEE_MAX, 'Felipe'),
    githubAssignee: sanitizeStr(input.githubAssignee, BLUEPRINT_CONSTRAINTS.TICKET.GH_ASSIGNEE_MAX, 'felipe'),
    githubRepo: sanitizeStr(input.githubRepo, BLUEPRINT_CONSTRAINTS.TICKET.REPO_MAX, 'vercel/next.js'),
    githubIssueUrl: (input.githubIssueUrl || '').slice(0, BLUEPRINT_CONSTRAINTS.TICKET.URL_MAX),
    githubState: input.githubState === 'closed' ? 'closed' : 'open',
    status: ['aberto', 'em_atendimento', 'pausado', 'encerrado'].includes(input.status)
      ? input.status
      : 'aberto',
    priority: ['baixa', 'media', 'alta', 'critica'].includes(input.priority)
      ? input.priority
      : 'media',
    labelsSummary: (input.labelsSummary || '').slice(0, BLUEPRINT_CONSTRAINTS.TICKET.LABELS_MAX),
    commentsCount: Math.min(Math.max(Math.round(Number(input.commentsCount) || 0), 0), 100000),
    lastCommentSummary: (input.lastCommentSummary || '').slice(0, BLUEPRINT_CONSTRAINTS.TICKET.LAST_COMMENT_MAX),
    totalSecondsWorked: Math.min(Math.max(Math.round(Number(input.totalSecondsWorked) || 0), 0), 315360000),
    activeSessionStartedAtMs: Math.max(Math.round(Number(input.activeSessionStartedAtMs) || 0), 0),
    ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'tickets', docId), payload);
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
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
  const path = `tickets/${ticketId}`;
  try {
    await updateDoc(doc(db, 'tickets', ticketId), {
      status: updates.status,
      githubState: updates.githubState,
      totalSecondsWorked: Math.min(Math.max(Math.round(updates.totalSecondsWorked), 0), 315360000),
      activeSessionStartedAtMs: Math.max(Math.round(updates.activeSessionStartedAtMs), 0),
      lastCommentSummary: (updates.lastCommentSummary || '').slice(0, BLUEPRINT_CONSTRAINTS.TICKET.LAST_COMMENT_MAX),
      commentsCount: Math.min(Math.max(Math.round(updates.commentsCount), 0), 100000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function reopenClosedTicketAction(ticketId: string) {
  const path = `tickets/${ticketId}`;
  try {
    await updateDoc(doc(db, 'tickets', ticketId), {
      status: 'pausado',
      githubState: 'open',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
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
  const path = `tickets/${ticketId}`;
  try {
    await updateDoc(doc(db, 'tickets', ticketId), {
      title: sanitizeStr(updates.title, BLUEPRINT_CONSTRAINTS.TICKET.TITLE_MAX, 'Chamado'),
      description: (updates.description || '').slice(0, BLUEPRINT_CONSTRAINTS.TICKET.DESC_MAX),
      assigneeName: sanitizeStr(updates.assigneeName, BLUEPRINT_CONSTRAINTS.TICKET.ASSIGNEE_MAX, 'Felipe'),
      githubAssignee: sanitizeStr(updates.githubAssignee, BLUEPRINT_CONSTRAINTS.TICKET.GH_ASSIGNEE_MAX, 'felipeolio'),
      githubState: updates.githubState === 'closed' ? 'closed' : 'open',
      status: ['aberto', 'em_atendimento', 'pausado', 'encerrado'].includes(updates.status)
        ? updates.status
        : 'aberto',
      priority: ['baixa', 'media', 'alta', 'critica'].includes(updates.priority)
        ? updates.priority
        : 'media',
      labelsSummary: (updates.labelsSummary || '').slice(0, BLUEPRINT_CONSTRAINTS.TICKET.LABELS_MAX),
      commentsCount: Math.min(Math.max(Math.round(updates.commentsCount || 0), 0), 100000),
      lastCommentSummary: (updates.lastCommentSummary || '').slice(
        0,
        BLUEPRINT_CONSTRAINTS.TICKET.LAST_COMMENT_MAX
      ),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createAttendanceSessionRecord(
  ownerId: string,
  input: Omit<AttendanceSession, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  customId?: string
): Promise<string> {
  const docId = customId && BLUEPRINT_CONSTRAINTS.ID_PATTERN.test(customId)
    ? customId.slice(0, 128)
    : createSafeId('sess');
  const path = `sessions/${docId}`;
  const payload = {
    ticketId: input.ticketId.slice(0, 128),
    issueNumber: Math.min(Math.max(Math.round(Number(input.issueNumber) || 1000), 1), 99999999),
    ticketTitle: sanitizeStr(input.ticketTitle, BLUEPRINT_CONSTRAINTS.SESSION.TITLE_MAX, 'Chamado'),
    companyName: sanitizeStr(input.companyName, BLUEPRINT_CONSTRAINTS.SESSION.COMPANY_MAX, 'XPTO'),
    agentName: sanitizeStr(input.agentName, BLUEPRINT_CONSTRAINTS.SESSION.AGENT_MAX, 'Felipe'),
    startedAtIso: sanitizeStr(input.startedAtIso, BLUEPRINT_CONSTRAINTS.SESSION.ISO_MAX, new Date().toISOString()),
    endedAtIso: (input.endedAtIso || '').slice(0, BLUEPRINT_CONSTRAINTS.SESSION.ISO_MAX),
    durationSeconds: Math.min(Math.max(Math.round(Number(input.durationSeconds) || 0), 0), 315360000),
    notes: (input.notes || '').slice(0, BLUEPRINT_CONSTRAINTS.SESSION.NOTES_MAX),
    sessionStatus: ['em_andamento', 'pausada', 'finalizada'].includes(input.sessionStatus)
      ? input.sessionStatus
      : 'finalizada',
    ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'sessions', docId), payload);
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
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
  const docId = createSafeId('log');
  const path = `auditLogs/${docId}`;
  const payload = {
    eventType: input.eventType,
    actorName: sanitizeStr(input.actorName, BLUEPRINT_CONSTRAINTS.AUDIT.ACTOR_MAX, 'Sistema'),
    targetLabel: sanitizeStr(input.targetLabel, BLUEPRINT_CONSTRAINTS.AUDIT.TARGET_MAX, 'Chamado'),
    details: sanitizeStr(input.details, BLUEPRINT_CONSTRAINTS.AUDIT.DETAILS_MAX, 'Operação registrada'),
    origin: input.origin,
    ownerId,
    createdAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'auditLogs', docId), payload);
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createReportRecord(
  ownerId: string,
  input: Omit<ReportRecord, 'id' | 'ownerId' | 'createdAt'>
): Promise<string> {
  const docId = createSafeId('rep');
  const path = `reports/${docId}`;
  const payload = {
    title: sanitizeStr(input.title, BLUEPRINT_CONSTRAINTS.REPORT.TITLE_MAX, 'Relatório de Atendimento'),
    companyFilter: sanitizeStr(input.companyFilter, BLUEPRINT_CONSTRAINTS.REPORT.COMPANY_MAX, 'Todas'),
    periodLabel: sanitizeStr(input.periodLabel, BLUEPRINT_CONSTRAINTS.REPORT.PERIOD_MAX, 'Outubro 2026'),
    totalTickets: Math.min(Math.max(Math.round(Number(input.totalTickets) || 0), 0), 1000000),
    totalSeconds: Math.min(Math.max(Math.round(Number(input.totalSeconds) || 0), 0), 315360000),
    totalBilledAmount: Math.min(Math.max(Number(input.totalBilledAmount) || 0, 0), 1000000000),
    generatedBy: sanitizeStr(input.generatedBy, BLUEPRINT_CONSTRAINTS.REPORT.GEN_BY_MAX, 'Felipe'),
    ownerId,
    createdAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'reports', docId), payload);
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteReportRecord(reportId: string) {
  const path = `reports/${reportId}`;
  try {
    await deleteDoc(doc(db, 'reports', reportId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
