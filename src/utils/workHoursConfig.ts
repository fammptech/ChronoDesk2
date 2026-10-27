import { AttendanceSession, Company, TeamMember, Ticket } from '../types';
import { MirroredBoardCard, PROJECT_ZDT_USERS } from '../project3Schema';

export interface ClientWorkHoursRule {
  clientCode: string;
  useCustomSchedule: boolean;
  normalStart: string; // "HH:MM", default "08:00"
  normalEnd: string; // "HH:MM", default "18:00"
  weekendsAreOvertime: boolean;
  manualOvertimeHours: number;
  useCustomTechLimit?: boolean;
  maxTechnicians?: number; // default 2
  techAlertEnabled?: boolean; // default true
}

export type TechCountScope = 'in_progress_only' | 'timer_running_only' | 'all_assigned';

export interface WorkHoursSettings {
  defaultNormalStart: string; // "08:00"
  defaultNormalEnd: string; // "18:00"
  defaultWeekendsAreOvertime: boolean;
  defaultMaxTechniciansPerCompany: number; // default 2
  defaultTechAlertEnabled: boolean; // default true
  techCountScope: TechCountScope; // default 'in_progress_only' (cards "Em andamento")
  perClient: Record<string, ClientWorkHoursRule>;
}

export const DEFAULT_WORK_HOURS_SETTINGS: WorkHoursSettings = {
  defaultNormalStart: '08:00',
  defaultNormalEnd: '18:00',
  defaultWeekendsAreOvertime: true,
  defaultMaxTechniciansPerCompany: 2,
  defaultTechAlertEnabled: true,
  techCountScope: 'in_progress_only',
  perClient: {},
};

const STORAGE_KEY = 'chronodesk_work_hours_config_v2';

export function loadWorkHoursSettings(): WorkHoursSettings {
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ||
      window.localStorage.getItem('chronodesk_work_hours_config_v1');
    if (!raw) return DEFAULT_WORK_HOURS_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<WorkHoursSettings>;
    const validScope: TechCountScope =
      parsed.techCountScope === 'timer_running_only' || parsed.techCountScope === 'all_assigned'
        ? parsed.techCountScope
        : 'in_progress_only';
    // Ensure migration from v1 defaults to 'in_progress_only'
    const finalScope: TechCountScope = !window.localStorage.getItem(STORAGE_KEY)
      ? 'in_progress_only'
      : validScope;

    return {
      defaultNormalStart: parsed.defaultNormalStart || '08:00',
      defaultNormalEnd: parsed.defaultNormalEnd || '18:00',
      defaultWeekendsAreOvertime:
        typeof parsed.defaultWeekendsAreOvertime === 'boolean'
          ? parsed.defaultWeekendsAreOvertime
          : true,
      defaultMaxTechniciansPerCompany:
        typeof parsed.defaultMaxTechniciansPerCompany === 'number' &&
        parsed.defaultMaxTechniciansPerCompany >= 1
          ? parsed.defaultMaxTechniciansPerCompany
          : 2,
      defaultTechAlertEnabled:
        typeof parsed.defaultTechAlertEnabled === 'boolean'
          ? parsed.defaultTechAlertEnabled
          : true,
      techCountScope: finalScope,
      perClient: parsed.perClient || {},
    };
  } catch {
    return DEFAULT_WORK_HOURS_SETTINGS;
  }
}

export function saveWorkHoursSettings(settings: WorkHoursSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export function getEffectiveClientWorkHoursRule(
  settings: WorkHoursSettings,
  clientCode: string
): {
  normalStart: string;
  normalEnd: string;
  weekendsAreOvertime: boolean;
  useCustomSchedule: boolean;
  manualOvertimeHours: number;
  useCustomTechLimit: boolean;
  maxTechnicians: number;
  techAlertEnabled: boolean;
} {
  const key = (clientCode || '').trim();
  const custom = settings.perClient[key] || settings.perClient[key.toUpperCase()];

  const useCustomSchedule = Boolean(custom?.useCustomSchedule);
  const useCustomTechLimit = Boolean(custom?.useCustomTechLimit);

  const maxTechnicians = useCustomTechLimit
    ? Math.max(1, Number(custom?.maxTechnicians) || settings.defaultMaxTechniciansPerCompany || 2)
    : Math.max(1, Number(settings.defaultMaxTechniciansPerCompany) || 2);

  const techAlertEnabled = useCustomTechLimit
    ? typeof custom?.techAlertEnabled === 'boolean'
      ? custom.techAlertEnabled
      : settings.defaultTechAlertEnabled
    : settings.defaultTechAlertEnabled;

  if (useCustomSchedule && custom) {
    return {
      normalStart: custom.normalStart || settings.defaultNormalStart || '08:00',
      normalEnd: custom.normalEnd || settings.defaultNormalEnd || '18:00',
      weekendsAreOvertime: custom.weekendsAreOvertime,
      useCustomSchedule: true,
      manualOvertimeHours: Number(custom.manualOvertimeHours) || 0,
      useCustomTechLimit,
      maxTechnicians,
      techAlertEnabled,
    };
  }

  return {
    normalStart: settings.defaultNormalStart || '08:00',
    normalEnd: settings.defaultNormalEnd || '18:00',
    weekendsAreOvertime: settings.defaultWeekendsAreOvertime,
    useCustomSchedule: false,
    manualOvertimeHours: Number(custom?.manualOvertimeHours) || 0,
    useCustomTechLimit,
    maxTechnicians,
    techAlertEnabled,
  };
}

function parseTimeToMinutes(hhmm: string, fallbackMinutes: number): number {
  const parts = (hhmm || '').split(':');
  if (parts.length < 2) return fallbackMinutes;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return fallbackMinutes;
  return Math.max(0, Math.min(24 * 60, h * 60 + m));
}

/**
 * Calculates exact normal vs overtime seconds for a time interval [startMs, endMs]
 * based on a normal working window (e.g. 08:00 to 18:00).
 * Any time before normalStart or after normalEnd is counted as overtime.
 */
export function computeIntervalOvertimeSeconds(
  startMs: number,
  endMs: number,
  normalStart: string,
  normalEnd: string,
  weekendsAreOvertime: boolean
): { normalSeconds: number; overtimeSeconds: number } {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { normalSeconds: 0, overtimeSeconds: 0 };
  }

  const startMinutes = parseTimeToMinutes(normalStart, 8 * 60); // 08:00 -> 480
  const endMinutes = parseTimeToMinutes(normalEnd, 18 * 60); // 18:00 -> 1080

  let normalMsTotal = 0;
  let overtimeMsTotal = 0;

  const cursorDay = new Date(startMs);
  cursorDay.setHours(0, 0, 0, 0);

  let safetyDays = 0;
  while (cursorDay.getTime() < endMs && safetyDays < 366) {
    safetyDays += 1;
    const dayStartMs = cursorDay.getTime();
    const nextDay = new Date(cursorDay);
    nextDay.setDate(nextDay.getDate() + 1);
    const dayEndMs = nextDay.getTime();

    const sliceStart = Math.max(startMs, dayStartMs);
    const sliceEnd = Math.min(endMs, dayEndMs);

    if (sliceEnd > sliceStart) {
      const sliceDuration = sliceEnd - sliceStart;
      const dayOfWeek = cursorDay.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (weekendsAreOvertime && isWeekend) {
        overtimeMsTotal += sliceDuration;
      } else if (endMinutes > startMinutes) {
        const windowStartMs = dayStartMs + startMinutes * 60 * 1000;
        const windowEndMs = dayStartMs + endMinutes * 60 * 1000;
        const overlapStart = Math.max(sliceStart, windowStartMs);
        const overlapEnd = Math.min(sliceEnd, windowEndMs);
        const normalMs = Math.max(0, overlapEnd - overlapStart);
        normalMsTotal += normalMs;
        overtimeMsTotal += sliceDuration - normalMs;
      } else {
        overtimeMsTotal += sliceDuration;
      }
    }

    cursorDay.setDate(cursorDay.getDate() + 1);
  }

  return {
    normalSeconds: Math.round(normalMsTotal / 1000),
    overtimeSeconds: Math.round(overtimeMsTotal / 1000),
  };
}

export interface CompanyTechnicianAllocation {
  githubHandle: string;
  technicianName: string;
  totalSeconds: number;
  normalSeconds: number;
  overtimeSeconds: number;
  ticketCount: number;
  inProgressTicketCount: number; // Cards in "Em andamento" column or timer running
  activeTicketCount: number; // Timer actively ticking right now
  issueNumbers: number[];
  inProgressIssueNumbers: number[];
}

export interface CompanyLimitAlert {
  companyId: string;
  companyCode: string;
  companyName: string;
  maxAllowed: number;
  currentCount: number;
  technicians: CompanyTechnicianAllocation[];
}

function resolveTechFromNameOrHandle(
  handleOrName: string,
  teamMembers: TeamMember[]
): { handle: string; name: string } {
  const cleaned = (handleOrName || '').trim().replace(/^@/, '');
  if (!cleaned) {
    return { handle: 'felipeolio', name: 'Felipe Olio' };
  }
  const lower = cleaned.toLowerCase();
  const fromTeam = teamMembers.find(
    (m) => m.githubHandle.toLowerCase() === lower || m.name.toLowerCase() === lower
  );
  if (fromTeam) {
    return { handle: fromTeam.githubHandle, name: fromTeam.name };
  }
  const fromProject = PROJECT_ZDT_USERS.find(
    (u) => u.login.toLowerCase() === lower || u.name.toLowerCase() === lower
  );
  if (fromProject) {
    return { handle: fromProject.login, name: fromProject.name };
  }
  return { handle: cleaned.toLowerCase().replace(/\s+/g, '.'), name: cleaned };
}

function isCardInEmAndamento(card?: MirroredBoardCard, ticket?: Ticket): boolean {
  if (ticket?.status === 'em_atendimento') return true;
  if (!card) return false;
  if (card.state === 'CLOSED') return false;
  const colName = (card.statusColumn || '').trim().toLowerCase();
  return colName === 'em andamento' || card.statusOptionId === '47fc9ee4';
}

/**
 * Computes total consumed seconds, normal seconds, overtime seconds, and allocated technicians for a Company.
 * A technician is only considered "active" for the company limit alert when their card is "Em andamento"
 * (unless the user explicitly changes the scope in Config).
 */
export function calculateCompanyHoursBreakdown(params: {
  company: Company;
  tickets: Ticket[];
  sessions: AttendanceSession[];
  boardCards?: MirroredBoardCard[];
  teamMembers?: TeamMember[];
  settings: WorkHoursSettings;
  nowMs?: number;
}): {
  totalSeconds: number;
  normalSeconds: number;
  overtimeSeconds: number;
  effectiveRule: ReturnType<typeof getEffectiveClientWorkHoursRule>;
  technicians: CompanyTechnicianAllocation[];
  activeTechnicians: CompanyTechnicianAllocation[];
  exceedsTechLimit: boolean;
} {
  const {
    company,
    tickets,
    sessions,
    boardCards = [],
    teamMembers = [],
    settings,
    nowMs = Date.now(),
  } = params;
  const effectiveRule = getEffectiveClientWorkHoursRule(settings, company.code);

  const codeLower = company.code.toLowerCase();
  const nameLower = company.name.toLowerCase();

  const companyTickets = tickets.filter(
    (t) =>
      t.companyId === company.id ||
      (t.companyName || '').toLowerCase() === codeLower ||
      (t.companyName || '').toLowerCase() === nameLower
  );

  const companyCards = boardCards.filter(
    (c) =>
      (c.cliente || '').toLowerCase() === codeLower ||
      (c.cliente || '').toLowerCase() === nameLower
  );

  const cardByIssue = new Map<number, MirroredBoardCard>();
  for (const c of companyCards) {
    cardByIssue.set(c.issueNumber, c);
  }

  const ticketByIssue = new Map<number, Ticket>();
  for (const t of companyTickets) {
    ticketByIssue.set(t.issueNumber, t);
  }

  const ticketIssueNumbers = new Set<number>([
    ...companyTickets.map((t) => t.issueNumber),
    ...companyCards.map((c) => c.issueNumber),
  ]);

  let activeRunSecondsTotal = 0;
  let activeOvertimeSeconds = 0;

  // Track per-technician metrics within this company
  const techMap = new Map<string, CompanyTechnicianAllocation>();

  const ensureTech = (rawHandleOrName: string): CompanyTechnicianAllocation => {
    const resolved = resolveTechFromNameOrHandle(rawHandleOrName, teamMembers);
    const key = resolved.handle.toLowerCase();
    let entry = techMap.get(key);
    if (!entry) {
      entry = {
        githubHandle: resolved.handle,
        technicianName: resolved.name,
        totalSeconds: 0,
        normalSeconds: 0,
        overtimeSeconds: 0,
        ticketCount: 0,
        inProgressTicketCount: 0,
        activeTicketCount: 0,
        issueNumbers: [],
        inProgressIssueNumbers: [],
      };
      techMap.set(key, entry);
    }
    return entry;
  };

  // 1. Process boardCards assignees (captures multi-assignee cards on GitHub Project)
  for (const card of companyCards) {
    const linkedTicket = ticketByIssue.get(card.issueNumber);
    const inProgress = isCardInEmAndamento(card, linkedTicket);
    const assignees = card.assignees && card.assignees.length > 0 ? card.assignees : [];
    for (const login of assignees) {
      const entry = ensureTech(login);
      if (!entry.issueNumbers.includes(card.issueNumber)) {
        entry.issueNumbers.push(card.issueNumber);
        entry.ticketCount = entry.issueNumbers.length;
      }
      if (inProgress && !entry.inProgressIssueNumbers.includes(card.issueNumber)) {
        entry.inProgressIssueNumbers.push(card.issueNumber);
        entry.inProgressTicketCount = entry.inProgressIssueNumbers.length;
      }
    }
  }

  // 2. Process tickets & active timers
  for (const t of companyTickets) {
    const linkedCard = cardByIssue.get(t.issueNumber);
    const inProgress = isCardInEmAndamento(linkedCard, t);
    const entry = ensureTech(t.githubAssignee || t.assigneeName);
    if (!entry.issueNumbers.includes(t.issueNumber)) {
      entry.issueNumbers.push(t.issueNumber);
      entry.ticketCount = entry.issueNumbers.length;
    }
    if (inProgress && !entry.inProgressIssueNumbers.includes(t.issueNumber)) {
      entry.inProgressIssueNumbers.push(t.issueNumber);
      entry.inProgressTicketCount = entry.inProgressIssueNumbers.length;
    }

    let ticketRunSec = 0;
    let ticketRunOvertimeSec = 0;

    if (
      t.status === 'em_atendimento' &&
      t.activeSessionStartedAtMs > 0 &&
      nowMs > t.activeSessionStartedAtMs
    ) {
      ticketRunSec = Math.floor((nowMs - t.activeSessionStartedAtMs) / 1000);
      activeRunSecondsTotal += ticketRunSec;
      const { overtimeSeconds } = computeIntervalOvertimeSeconds(
        t.activeSessionStartedAtMs,
        nowMs,
        effectiveRule.normalStart,
        effectiveRule.normalEnd,
        effectiveRule.weekendsAreOvertime
      );
      ticketRunOvertimeSec = overtimeSeconds;
      activeOvertimeSeconds += overtimeSeconds;
      entry.activeTicketCount += 1;
    }

    const ticketTotalSec = t.totalSecondsWorked + ticketRunSec;
    entry.totalSeconds += ticketTotalSec;
    entry.overtimeSeconds += ticketRunOvertimeSec;
    entry.normalSeconds = Math.max(0, entry.totalSeconds - entry.overtimeSeconds);
  }

  const totalSeconds =
    companyTickets.reduce((acc, t) => acc + t.totalSecondsWorked, 0) + activeRunSecondsTotal;

  // 3. Process AttendanceSessions belonging to this company
  const companySessions = sessions.filter(
    (s) =>
      ticketIssueNumbers.has(s.issueNumber) ||
      (s.companyName || '').toLowerCase() === codeLower ||
      (s.companyName || '').toLowerCase() === nameLower
  );

  let sessionOvertimeSeconds = 0;
  for (const s of companySessions) {
    const entry = ensureTech(s.agentName);
    if (s.issueNumber && !entry.issueNumbers.includes(s.issueNumber)) {
      entry.issueNumbers.push(s.issueNumber);
      entry.ticketCount = entry.issueNumbers.length;
    }

    const startMs = Date.parse(s.startedAtIso);
    const endMs = Date.parse(s.endedAtIso);
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      const { overtimeSeconds } = computeIntervalOvertimeSeconds(
        startMs,
        endMs,
        effectiveRule.normalStart,
        effectiveRule.normalEnd,
        effectiveRule.weekendsAreOvertime
      );
      const wallSec = Math.max(1, Math.round((endMs - startMs) / 1000));
      const ratio = Math.min(1, overtimeSeconds / wallSec);
      const scaledOvertime = Math.round((s.durationSeconds || wallSec) * ratio);
      sessionOvertimeSeconds += scaledOvertime;

      entry.overtimeSeconds += scaledOvertime;
      entry.normalSeconds = Math.max(0, entry.totalSeconds - entry.overtimeSeconds);
    }
  }

  const manualOvertimeSeconds = Math.max(
    0,
    Math.round((effectiveRule.manualOvertimeHours || 0) * 3600)
  );

  const totalOvertimeSeconds =
    sessionOvertimeSeconds + activeOvertimeSeconds + manualOvertimeSeconds;
  const normalSeconds = Math.max(0, totalSeconds - (sessionOvertimeSeconds + activeOvertimeSeconds));

  const allTechnicians = Array.from(techMap.values()).sort(
    (a, b) =>
      b.inProgressTicketCount - a.inProgressTicketCount ||
      b.totalSeconds - a.totalSeconds ||
      b.ticketCount - a.ticketCount
  );

  // Technicians considered "active" for the company limit alert:
  // By default ('in_progress_only'), ONLY technicians who have at least one card in "Em andamento"!
  const activeTechnicians =
    settings.techCountScope === 'timer_running_only'
      ? allTechnicians.filter((t) => t.activeTicketCount > 0)
      : settings.techCountScope === 'all_assigned'
      ? allTechnicians.filter((t) => t.ticketCount > 0 || t.totalSeconds > 0)
      : allTechnicians.filter((t) => t.inProgressTicketCount > 0);

  const exceedsTechLimit =
    effectiveRule.techAlertEnabled && activeTechnicians.length > effectiveRule.maxTechnicians;

  return {
    totalSeconds,
    normalSeconds,
    overtimeSeconds: totalOvertimeSeconds,
    effectiveRule,
    technicians: allTechnicians,
    activeTechnicians,
    exceedsTechLimit,
  };
}

export interface TechnicianConsolidatedReportRow {
  githubHandle: string;
  technicianName: string;
  roleTitle: string;
  totalSeconds: number;
  normalSeconds: number;
  overtimeSeconds: number;
  totalTickets: number;
  inProgressTickets: number;
  activeTickets: number;
  companiesServed: Array<{
    companyCode: string;
    companyName: string;
    totalSeconds: number;
    normalSeconds: number;
    overtimeSeconds: number;
    ticketCount: number;
    inProgressTicketCount: number;
    issueNumbers: number[];
    inProgressIssueNumbers: number[];
  }>;
}

export function calculateFullHoursAndTechniciansReport(params: {
  companies: Company[];
  tickets: Ticket[];
  sessions: AttendanceSession[];
  boardCards: MirroredBoardCard[];
  teamMembers: TeamMember[];
  settings: WorkHoursSettings;
  nowMs?: number;
}) {
  const { companies, tickets, sessions, boardCards, teamMembers, settings, nowMs = Date.now() } =
    params;

  const companyReports = companies.map((company) => {
    const breakdown = calculateCompanyHoursBreakdown({
      company,
      tickets,
      sessions,
      boardCards,
      teamMembers,
      settings,
      nowMs,
    });
    return {
      company,
      ...breakdown,
    };
  });

  const alerts: CompanyLimitAlert[] = companyReports
    .filter((cr) => cr.exceedsTechLimit)
    .map((cr) => ({
      companyId: cr.company.id,
      companyCode: cr.company.code,
      companyName: cr.company.name,
      maxAllowed: cr.effectiveRule.maxTechnicians,
      currentCount: cr.activeTechnicians.length,
      technicians: cr.activeTechnicians,
    }));

  // Aggregate by technician across all companies
  const techReportMap = new Map<string, TechnicianConsolidatedReportRow>();

  for (const member of teamMembers) {
    const key = member.githubHandle.toLowerCase();
    techReportMap.set(key, {
      githubHandle: member.githubHandle,
      technicianName: member.name,
      roleTitle: member.roleTitle,
      totalSeconds: 0,
      normalSeconds: 0,
      overtimeSeconds: 0,
      totalTickets: 0,
      inProgressTickets: 0,
      activeTickets: 0,
      companiesServed: [],
    });
  }

  for (const cr of companyReports) {
    for (const tech of cr.technicians) {
      const key = tech.githubHandle.toLowerCase();
      let row = techReportMap.get(key);
      if (!row) {
        row = {
          githubHandle: tech.githubHandle,
          technicianName: tech.technicianName,
          roleTitle: 'Especialista ZDT',
          totalSeconds: 0,
          normalSeconds: 0,
          overtimeSeconds: 0,
          totalTickets: 0,
          inProgressTickets: 0,
          activeTickets: 0,
          companiesServed: [],
        };
        techReportMap.set(key, row);
      }

      row.totalSeconds += tech.totalSeconds;
      row.normalSeconds += tech.normalSeconds;
      row.overtimeSeconds += tech.overtimeSeconds;
      row.totalTickets += tech.ticketCount;
      row.inProgressTickets += tech.inProgressTicketCount;
      row.activeTickets += tech.activeTicketCount;
      row.companiesServed.push({
        companyCode: cr.company.code,
        companyName: cr.company.name,
        totalSeconds: tech.totalSeconds,
        normalSeconds: tech.normalSeconds,
        overtimeSeconds: tech.overtimeSeconds,
        ticketCount: tech.ticketCount,
        inProgressTicketCount: tech.inProgressTicketCount,
        issueNumbers: tech.issueNumbers,
        inProgressIssueNumbers: tech.inProgressIssueNumbers,
      });
    }
  }

  const technicianReports = Array.from(techReportMap.values()).sort(
    (a, b) =>
      b.inProgressTickets - a.inProgressTickets ||
      b.totalSeconds - a.totalSeconds ||
      b.totalTickets - a.totalTickets
  );

  return {
    companyReports,
    technicianReports,
    alerts,
  };
}
