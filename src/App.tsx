import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  Search,
  LogIn,
  LogOut,
  Database,
  Webhook,
  Play,
  Pause,
  CheckCircle2,
  LayoutGrid,
  List,
  ExternalLink,
  GitFork,
  Plus,
  RefreshCw,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { auth, signInWithGoogle, signOutUser } from './firebase';
import {
  fetchNeonWorkspaceState,
  runNeonMigrations,
  createCompanyRecord,
  createTeamMemberRecord,
  updateTeamMemberStatus,
  updateTeamMemberPermissions,
  createTicketRecord,
  updateTicketTimerAction,
  reopenClosedTicketAction,
  updateTicketCardFieldsAction,
  createAttendanceSessionRecord,
  createAuditLogRecord,
  createReportRecord,
  deleteReportRecord,
} from './neonDb';
import {
  AtendentePermissionRules,
  Company,
  TeamMember,
  Ticket,
  AttendanceSession,
  AuditLog,
  ReportRecord,
  TicketPriority,
  IssueHistoryEntry,
} from './types';
import {
  PROJECT_STATUS_COLUMNS,
  PROJECT_CLIENTES,
  PROJECT_ESTEIRAS,
  PROJECT_TIPOS_DEMANDA,
  PROJECT_IMPEDIMENTOS,
  PROJECT_PRIORITIES,
  PROJECT_SIZES,
  PROJECT_EFFORTS,
  PROJECT_ZDT_USERS,
  MirroredBoardCard,
} from './project3Schema';
import { formatDurationHms } from './utils/formatters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';
import { ActiveTicketCockpit } from './components/ActiveTicketCockpit';
import { KanbanBoardMirror, ProjectMetaState } from './components/KanbanBoardMirror';
import { GitHubSyncModal } from './components/GitHubSyncModal';
import { CompaniesView } from './components/CompaniesView';
import { TeamView } from './components/TeamView';
import { DatabaseAuditView } from './components/DatabaseAuditView';
import { DashboardReportsView } from './components/DashboardReportsView';
import { HoursReportsView } from './components/HoursReportsView';
import { WorkHoursConfigPanel } from './components/WorkHoursConfigPanel';
import { NeonMigrationsPanel } from './components/NeonMigrationsPanel';
import { LoginScreen } from './components/LoginScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  WorkHoursSettings,
  loadWorkHoursSettings,
  saveWorkHoursSettings,
  calculateFullHoursAndTechniciansReport,
} from './utils/workHoursConfig';

type NavSection =
  | 'chamados'
  | 'empresas'
  | 'equipe'
  | 'auditoria'
  | 'dashboard'
  | 'relatorios_horas'
  | 'config';

const INITIAL_ZDT_COMPANIES: Company[] = [
  {
    id: 'comp_tutora',
    name: 'Tutora Educação & Tecnologia',
    code: 'Tutora',
    githubRepo: 'zdttech-copilot/governanca-zdt',
    slaHours: 4,
    hourlyRate: 260,
    contractHours: 120,
    status: 'active',
    ownerId: 'demo',
  },
  {
    id: 'comp_ampm',
    name: 'AMPM Conveniência & Operações',
    code: 'AMPM',
    githubRepo: 'zdttech-copilot/governanca-zdt',
    slaHours: 4,
    hourlyRate: 280,
    contractHours: 160,
    status: 'active',
    ownerId: 'demo',
  },
  {
    id: 'comp_gocase',
    name: 'GoCase Comércio & Digital',
    code: 'GoCase',
    githubRepo: 'zdttech-copilot/governanca-zdt',
    slaHours: 6,
    hourlyRate: 250,
    contractHours: 80,
    status: 'active',
    ownerId: 'demo',
  },
  {
    id: 'comp_braveo',
    name: 'Braveo Soluções Corporativas',
    code: 'Braveo',
    githubRepo: 'zdttech-copilot/governanca-zdt',
    slaHours: 4,
    hourlyRate: 270,
    contractHours: 100,
    status: 'active',
    ownerId: 'demo',
  },
  {
    id: 'comp_mdr',
    name: 'MDR Advocacia & Governança',
    code: 'MDR',
    githubRepo: 'zdttech-copilot/governanca-zdt',
    slaHours: 6,
    hourlyRate: 250,
    contractHours: 90,
    status: 'active',
    ownerId: 'demo',
  },
];

const INITIAL_ZDT_TEAM: TeamMember[] = PROJECT_ZDT_USERS.slice(0, 9).map((u, idx) => ({
  id: `mem_${u.login}`,
  name: u.name,
  email: idx === 0 ? 'fammp.tech@gmail.com' : `${u.login.toLowerCase()}@zdt.com.br`,
  roleTitle: idx === 0 ? 'Gestão / Governança ZDT' : 'Especialista Sustentação & Projetos ZDT',
  githubHandle: u.login,
  specialty: 'N1 / Atendimento / Sustentação / Desenvolvimento',
  hourlyCost: 160,
  status: idx === 0 ? 'em_atendimento' : 'disponivel',
  accessRole: idx === 0 ? 'admin' : 'atendente',
  restrictTimerToAssignedOnly: true,
  defaultFilterMyCardsOnLogin: true,
  allowViewAllTechniciansFilter: true,
  ownerId: 'demo',
}));

function mapStatusColumnToTicketStatus(statusColumn: string, _state: 'OPEN' | 'CLOSED'): Ticket['status'] {
  if (statusColumn === 'Concluído') return 'encerrado';
  if (
    statusColumn === 'Em andamento' ||
    statusColumn === 'Aguardando aprovação' ||
    statusColumn === 'Impedimento' ||
    statusColumn === 'Em homologação'
  ) {
    return 'pausado';
  }
  return 'aberto';
}

function mapProjectPriorityToTicketPriority(projPriority: string): TicketPriority {
  if (projPriority === 'Urgent') return 'critica';
  if (projPriority === 'High') return 'alta';
  if (projPriority === 'Low') return 'baixa';
  return 'media';
}

function resolveUserDisplayName(githubLogin: string): string {
  const found = PROJECT_ZDT_USERS.find(
    (u) => u.login.toLowerCase() === (githubLogin || '').toLowerCase()
  );
  return found ? found.name : githubLogin || 'Felipe Olio';
}

async function safeParseResponseJson(res: Response): Promise<Record<string, any> | null> {
  try {
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) {
      return null;
    }
    return JSON.parse(text) as Record<string, any>;
  } catch {
    return null;
  }
}

function ChronoDeskWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [activeNav, setActiveNav] = useState<NavSection>('chamados');
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [appTheme, setAppTheme] = useState<'atual' | 'git' | 'zdt' | 'dark'>(() => {
    try {
      const saved = window.localStorage.getItem('chronodesk_theme');
      if (saved === 'atual' || saved === 'git' || saved === 'zdt' || saved === 'dark') {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'atual';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appTheme);
    try {
      window.localStorage.setItem('chronodesk_theme', appTheme);
    } catch {
      // ignore storage errors
    }
  }, [appTheme]);

  // Normal Working Hours (08h-18h default) & Overtime Parameterization per Client
  const [workHoursSettings, setWorkHoursSettings] = useState<WorkHoursSettings>(() =>
    loadWorkHoursSettings()
  );

  const handleUpdateWorkHoursSettings = (next: WorkHoursSettings) => {
    setWorkHoursSettings(next);
    saveWorkHoursSettings(next);
  };

  // Firestore State
  const [dbCompanies, setDbCompanies] = useState<Company[]>([]);
  const [dbTeam, setDbTeam] = useState<TeamMember[]>([]);
  const [dbTickets, setDbTickets] = useState<Ticket[]>([]);
  const [dbSessions, setDbSessions] = useState<AttendanceSession[]>([]);
  const [dbAuditLogs, setDbAuditLogs] = useState<AuditLog[]>([]);
  const [dbReports, setDbReports] = useState<ReportRecord[]>([]);

  // Local Fallback State
  const [localCompanies, setLocalCompanies] = useState<Company[]>(INITIAL_ZDT_COMPANIES);
  const [localTeam, setLocalTeam] = useState<TeamMember[]>(INITIAL_ZDT_TEAM);
  const [localTickets, setLocalTickets] = useState<Ticket[]>([]);
  const [localSessions, setLocalSessions] = useState<AttendanceSession[]>([]);
  const [localAuditLogs, setLocalAuditLogs] = useState<AuditLog[]>([]);
  const [localReports, setLocalReports] = useState<ReportRecord[]>([]);

  // Live Mirrored Board Cards from GitHub Project #3 / #4
  const [boardCards, setBoardCards] = useState<MirroredBoardCard[]>([]);
  const [projectMeta, setProjectMeta] = useState<ProjectMetaState>({
    connected: false,
    tokenPermissionError: false,
    activeSource: 'personal_3',
    personalProjectItemCount: 0,
    orgProjectItemCount: 0,
    projectTitle: 'Chamados (users/felipeolio/projects/3)',
    projectUrl: 'https://github.com/users/felipeolio/projects/3',
  });
  const [syncingBoard, setSyncingBoard] = useState<boolean>(false);
  const [mirroringToPersonal, setMirroringToPersonal] = useState<boolean>(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);
  const autoMirroredPersonalRef = useRef<boolean>(false);
  // Tracks ONLY timers explicitly started by the user clicking Iniciar/Atender in this session (issueNumber -> startedAtMs)
  const [activeTimers, setActiveTimers] = useState<Record<number, number>>({});
  const activeTimersRef = useRef<Record<number, number>>({});
  // Tracks accumulated seconds after pausing (persisted in localStorage) so switching cards or syncing never loses count
  const [pausedTotals, setPausedTotals] = useState<Record<number, number>>(() => {
    try {
      const raw = window.localStorage.getItem('chronodesk_paused_totals_v1');
      if (raw) {
        return JSON.parse(raw) as Record<number, number>;
      }
    } catch {
      // ignore storage errors
    }
    return {};
  });
  const pausedTotalsRef = useRef<Record<number, number>>(pausedTotals);

  const recordPausedTotal = useCallback((issueNumber: number, totalSeconds: number) => {
    const nextVal = Math.max(0, Math.round(totalSeconds));
    pausedTotalsRef.current = {
      ...pausedTotalsRef.current,
      [issueNumber]: nextVal,
    };
    setPausedTotals((prev) => ({
      ...prev,
      [issueNumber]: nextVal,
    }));
    try {
      window.localStorage.setItem(
        'chronodesk_paused_totals_v1',
        JSON.stringify(pausedTotalsRef.current)
      );
    } catch {
      // ignore storage errors
    }
  }, []);

  const [selectedIssueNumber, setSelectedIssueNumber] = useState<number>(0);
  const [openCardModalIssueNumber, setOpenCardModalIssueNumber] = useState<number | null>(null);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'todos' | Ticket['status']>('todos');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [technicianFilter, setTechnicianFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sessionNote, setSessionNote] = useState<string>(
    'Atendimento técnico e atualização de status sincronizada com o GitHub Project #3.'
  );

  // Global Atendente Permission Rules (configurable by Admin as Active or Inactive)
  const [globalAtendenteRules, setGlobalAtendenteRules] = useState<AtendentePermissionRules>(() => {
    try {
      const raw = window.localStorage.getItem('chronodesk_atendente_rules_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AtendentePermissionRules>;
        return {
          restrictTimerToAssignedOnly: parsed.restrictTimerToAssignedOnly ?? true,
          defaultFilterMyCardsOnLogin: parsed.defaultFilterMyCardsOnLogin ?? true,
          allowViewAllTechniciansFilter: parsed.allowViewAllTechniciansFilter ?? true,
        };
      }
    } catch {
      // ignore storage errors
    }
    return {
      restrictTimerToAssignedOnly: true,
      defaultFilterMyCardsOnLogin: true,
      allowViewAllTechniciansFilter: true,
    };
  });

  const [selectedOperatorId, setSelectedOperatorId] = useState<string>(() => {
    try {
      const saved = window.localStorage.getItem('chronodesk_active_operator_v1');
      if (saved) return saved;
    } catch {
      // ignore storage errors
    }
    return 'mem_felipeolio';
  });

  const [isOperatorLoggedIn, setIsOperatorLoggedIn] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem('chronodesk_session_logged_in_v1') === 'true';
    } catch {
      return false;
    }
  });

  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [busyAction, setBusyAction] = useState<boolean>(false);
  const [syncingCompanyId, setSyncingCompanyId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const [liveComments, setLiveComments] = useState<
    Array<{ id: string; author: string; createdAt: string; body: string }>
  >([]);
  const [loadingComments, setLoadingComments] = useState<boolean>(false);

  // Per-issue comment & column movement history (persisted in localStorage)
  const [issueHistoryByNumber, setIssueHistoryByNumber] = useState<
    Record<number, IssueHistoryEntry[]>
  >(() => {
    try {
      const raw = window.localStorage.getItem('chronodesk_issue_history_v1');
      if (raw) {
        return JSON.parse(raw) as Record<number, IssueHistoryEntry[]>;
      }
    } catch {
      // ignore storage errors
    }
    return {};
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'chronodesk_issue_history_v1',
        JSON.stringify(issueHistoryByNumber)
      );
    } catch {
      // ignore storage errors
    }
  }, [issueHistoryByNumber]);

  const [neonConfigured, setNeonConfigured] = useState<boolean>(false);
  const [runningNeonMigration, setRunningNeonMigration] = useState<boolean>(false);

  // 1. Firebase Auth listener (optional identity context)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // 2. Neon.com Serverless PostgreSQL state loader
  const refreshNeonWorkspaceState = useCallback(async () => {
    const state = await fetchNeonWorkspaceState();
    setNeonConfigured(Boolean(state.neonConfigured));
    if (state.companies.length > 0) setDbCompanies(state.companies);
    if (state.teamMembers.length > 0) setDbTeam(state.teamMembers);
    if (state.tickets.length > 0) {
      setDbTickets(
        [...state.tickets].sort((a, b) => b.issueNumber - a.issueNumber)
      );
    }
    setDbSessions(state.sessions);
    setDbAuditLogs(state.auditLogs);
    setDbReports(state.reports);
  }, []);

  useEffect(() => {
    refreshNeonWorkspaceState();
  }, [refreshNeonWorkspaceState, authReady, user]);

  const handleRunNeonMigrations = async () => {
    setRunningNeonMigration(true);
    try {
      const result = await runNeonMigrations();
      await refreshNeonWorkspaceState();
      setStatusBanner(result.message);
    } finally {
      setRunningNeonMigration(false);
    }
  };

  const companies = dbCompanies.length > 0 ? dbCompanies : localCompanies;
  const teamMembers = useMemo<TeamMember[]>(() => {
    const raw = dbTeam.length > 0 ? dbTeam : localTeam;
    return raw.map((m, idx) => ({
      ...m,
      accessRole:
        m.accessRole ||
        (m.githubHandle.toLowerCase() === 'felipeolio' || idx === 0 ? 'admin' : 'atendente'),
      restrictTimerToAssignedOnly: m.restrictTimerToAssignedOnly ?? true,
      defaultFilterMyCardsOnLogin: m.defaultFilterMyCardsOnLogin ?? true,
      allowViewAllTechniciansFilter: m.allowViewAllTechniciansFilter ?? true,
    }));
  }, [dbTeam, localTeam]);

  const currentOperator = useMemo<TeamMember>(() => {
    return (
      teamMembers.find((m) => m.id === selectedOperatorId) ||
      teamMembers[0] ||
      INITIAL_ZDT_TEAM[0]
    );
  }, [teamMembers, selectedOperatorId]);

  const isCurrentOperatorAdmin = (currentOperator.accessRole || 'atendente') === 'admin';

  const effectiveRestrictTimerToAssigned =
    !isCurrentOperatorAdmin &&
    globalAtendenteRules.restrictTimerToAssignedOnly &&
    (currentOperator.restrictTimerToAssignedOnly ?? true);

  const effectiveDefaultFilterMyCards =
    !isCurrentOperatorAdmin &&
    globalAtendenteRules.defaultFilterMyCardsOnLogin &&
    (currentOperator.defaultFilterMyCardsOnLogin ?? true);

  const effectiveAllowViewAllTechnicians =
    isCurrentOperatorAdmin ||
    (globalAtendenteRules.allowViewAllTechniciansFilter &&
      (currentOperator.allowViewAllTechniciansFilter ?? true));

  // Enforce technicianFilter lock if Atendente is not allowed to filter other technicians
  useEffect(() => {
    if (!effectiveAllowViewAllTechnicians && technicianFilter !== currentOperator.githubHandle) {
      setTechnicianFilter(currentOperator.githubHandle);
    }
  }, [effectiveAllowViewAllTechnicians, technicianFilter, currentOperator.githubHandle]);

  const handleSelectOperator = useCallback(
    (memberId: string) => {
      setSelectedOperatorId(memberId);
      setIsOperatorLoggedIn(true);
      try {
        window.localStorage.setItem('chronodesk_active_operator_v1', memberId);
        window.sessionStorage.setItem('chronodesk_session_logged_in_v1', 'true');
      } catch {
        // ignore storage errors
      }
      const target = teamMembers.find((m) => m.id === memberId);
      if (!target) return;

      const isTargetAdmin = (target.accessRole || 'atendente') === 'admin';
      const shouldFilterOwnCards =
        !isTargetAdmin &&
        globalAtendenteRules.defaultFilterMyCardsOnLogin &&
        (target.defaultFilterMyCardsOnLogin ?? true);

      if (shouldFilterOwnCards) {
        setTechnicianFilter(target.githubHandle);
        const firstAssignedCard = boardCards.find((c) =>
          c.assignees.some((a) => a.toLowerCase() === target.githubHandle.toLowerCase())
        );
        if (firstAssignedCard) {
          setSelectedIssueNumber(firstAssignedCard.issueNumber);
        }
        setStatusBanner(
          `Logado como ${target.name} (@${target.githubHandle} · Perfil Atendente). Visualizando seus cards filtrados por padrão — caso queira, altere o filtro de técnico para "Todos os Técnicos".`
        );
      } else {
        setTechnicianFilter('ALL');
        setStatusBanner(
          isTargetAdmin
            ? `Logado como ${target.name} (@${target.githubHandle} · Perfil Admin — Acesso Full).`
            : `Logado como ${target.name} (@${target.githubHandle} · Perfil Atendente).`
        );
      }
    },
    [teamMembers, globalAtendenteRules.defaultFilterMyCardsOnLogin, boardCards]
  );

  const handleLogoutOperator = useCallback(() => {
    setIsOperatorLoggedIn(false);
    try {
      window.sessionStorage.removeItem('chronodesk_session_logged_in_v1');
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleUpdateGlobalAtendenteRules = useCallback(
    async (nextRules: AtendentePermissionRules) => {
      setGlobalAtendenteRules(nextRules);
      try {
        window.localStorage.setItem('chronodesk_atendente_rules_v1', JSON.stringify(nextRules));
      } catch {
        // ignore storage errors
      }
      setLocalTeam((prev) =>
        prev.map((m) =>
          (m.accessRole || 'atendente') === 'atendente'
            ? {
                ...m,
                restrictTimerToAssignedOnly: nextRules.restrictTimerToAssignedOnly,
                defaultFilterMyCardsOnLogin: nextRules.defaultFilterMyCardsOnLogin,
                allowViewAllTechniciansFilter: nextRules.allowViewAllTechniciansFilter,
              }
            : m
        )
      );
      setDbTeam((prev) =>
        prev.map((m) =>
          (m.accessRole || 'atendente') === 'atendente'
            ? {
                ...m,
                restrictTimerToAssignedOnly: nextRules.restrictTimerToAssignedOnly,
                defaultFilterMyCardsOnLogin: nextRules.defaultFilterMyCardsOnLogin,
                allowViewAllTechniciansFilter: nextRules.allowViewAllTechniciansFilter,
              }
            : m
        )
      );
      if (
        !isCurrentOperatorAdmin &&
        nextRules.defaultFilterMyCardsOnLogin &&
        technicianFilter === 'ALL'
      ) {
        setTechnicianFilter(currentOperator.githubHandle);
      }
      if (!isCurrentOperatorAdmin && !nextRules.allowViewAllTechniciansFilter) {
        setTechnicianFilter(currentOperator.githubHandle);
      }
      setStatusBanner('Permissões globais do perfil Atendente atualizadas pelo Admin!');
    },
    [isCurrentOperatorAdmin, technicianFilter, currentOperator.githubHandle]
  );

  const rawTickets = dbTickets.length > 0 ? dbTickets : localTickets;

  // Enforce that a ticket NEVER has status 'em_atendimento' or activeSessionStartedAtMs > 0
  // unless the user explicitly clicked Iniciar/Atender in this session and did not pause/stop it.
  const tickets = useMemo<Ticket[]>(() => {
    const mergedByIssue = new Map<number, Ticket>();
    for (const lt of localTickets) {
      mergedByIssue.set(lt.issueNumber, lt);
    }
    for (const rt of rawTickets) {
      const prev = mergedByIssue.get(rt.issueNumber);
      mergedByIssue.set(rt.issueNumber, {
        ...rt,
        totalSecondsWorked: Math.max(rt.totalSecondsWorked || 0, prev?.totalSecondsWorked || 0),
      });
    }

    const baseList = Array.from(mergedByIssue.values()).sort(
      (a, b) => b.issueNumber - a.issueNumber
    );

    return baseList.map((t) => {
      const explicitStartMs = activeTimers[t.issueNumber] || 0;
      const minTotal = Math.max(
        t.totalSecondsWorked || 0,
        pausedTotals[t.issueNumber] || 0,
        pausedTotalsRef.current[t.issueNumber] || 0
      );
      const matchingCard = boardCards.find((c) => c.issueNumber === t.issueNumber);
      const isCardInConcluidoColumn = matchingCard
        ? matchingCard.statusColumn === 'Concluído'
        : t.status === 'encerrado';

      if (explicitStartMs > 0 && !isCardInConcluidoColumn) {
        return {
          ...t,
          status: 'em_atendimento',
          githubState: 'open',
          activeSessionStartedAtMs: explicitStartMs,
          totalSecondsWorked: minTotal,
        };
      }
      if (!isCardInConcluidoColumn && t.status === 'encerrado') {
        return {
          ...t,
          status: 'pausado',
          githubState: 'open',
          activeSessionStartedAtMs: 0,
          totalSecondsWorked: minTotal,
        };
      }
      if (t.status === 'em_atendimento' || t.activeSessionStartedAtMs > 0) {
        return {
          ...t,
          status: t.status === 'em_atendimento' ? 'pausado' : t.status,
          activeSessionStartedAtMs: 0,
          totalSecondsWorked: minTotal,
        };
      }
      if (minTotal !== t.totalSecondsWorked) {
        return {
          ...t,
          totalSecondsWorked: minTotal,
        };
      }
      return t;
    });
  }, [rawTickets, localTickets, activeTimers, pausedTotals, boardCards]);

  const sessions = dbSessions.length > 0 ? dbSessions : localSessions;
  const auditLogs = dbAuditLogs.length > 0 ? dbAuditLogs : localAuditLogs;
  const reports = dbReports.length > 0 ? dbReports : localReports;

  const ticketsByIssueNumber = useMemo(() => {
    const map: Record<number, Ticket> = {};
    for (const t of tickets) {
      map[t.issueNumber] = t;
    }
    return map;
  }, [tickets]);

  const techLimitAlerts = useMemo(() => {
    return calculateFullHoursAndTechniciansReport({
      companies,
      tickets,
      sessions,
      boardCards,
      teamMembers,
      settings: workHoursSettings,
    }).alerts;
  }, [companies, tickets, sessions, boardCards, teamMembers, workHoursSettings]);

  // Convert a MirroredBoardCard into a Ticket object for Firestore / Cockpit
  const convertCardToTicketPayload = useCallback(
    (card: MirroredBoardCard, existingTicket?: Ticket): Omit<Ticket, 'id' | 'ownerId'> => {
      const matchedComp =
        companies.find((c) => c.code.toLowerCase() === (card.cliente || '').toLowerCase()) ||
        companies[0] ||
        INITIAL_ZDT_COMPANIES[0];

      const ghLogin = card.assignees[0] || 'felipeolio';
      const assigneeName = resolveUserDisplayName(ghLogin);
      const mappedStatus = mapStatusColumnToTicketStatus(card.statusColumn, card.state);
      const mappedPriority = mapProjectPriorityToTicketPriority(card.priority);

      const labelParts = [...card.labels];
      if (card.esteira) labelParts.push(card.esteira);
      if (card.tipoDemanda) labelParts.push(card.tipoDemanda);
      if (card.impedimento) labelParts.push(card.impedimento);

      const githubSeconds = Math.round((card.horasGastas || 0) * 3600);
      const pausedFloor = pausedTotalsRef.current[card.issueNumber] || 0;
      const totalSecondsWorked = existingTicket
        ? Math.max(existingTicket.totalSecondsWorked, pausedFloor, githubSeconds)
        : Math.max(pausedFloor, githubSeconds);

      // Timer ONLY runs if explicitly active in activeTimersRef (started by user clicking Iniciar/Atender and not paused)
      const explicitStartMs =
        card.statusColumn === 'Concluído'
          ? 0
          : activeTimersRef.current[card.issueNumber] || 0;

      const finalStatus: Ticket['status'] =
        card.statusColumn === 'Concluído'
          ? 'encerrado'
          : explicitStartMs > 0
          ? 'em_atendimento'
          : existingTicket?.status === 'pausado' || pausedFloor > 0
          ? 'pausado'
          : mappedStatus;

      return {
        issueNumber: card.issueNumber,
        title: card.title,
        description: card.body || `Card #${card.issueNumber} (${card.statusColumn})`,
        companyId: matchedComp.id,
        companyName: card.cliente || matchedComp.code,
        assigneeName,
        githubAssignee: ghLogin,
        githubRepo: card.repository || 'zdttech-copilot/governanca-zdt',
        githubIssueUrl: card.url,
        githubState: card.state === 'CLOSED' ? 'closed' : 'open',
        status: finalStatus,
        priority: mappedPriority,
        labelsSummary: labelParts.join(', ') || 'task',
        commentsCount: card.commentsCount || 0,
        lastCommentSummary: `Coluna GitHub: ${card.statusColumn}${
          card.esteira ? ` · ${card.esteira}` : ''
        }`,
        totalSecondsWorked,
        activeSessionStartedAtMs: explicitStartMs,
      };
    },
    [companies]
  );

  // 3. Pull Live Mirrored Board from GitHub Project #3 & #4
  const handlePullFromGitHubBoard = useCallback(async () => {
    setSyncingBoard(true);
    try {
      const res = await fetch(`/api/github/project-board?_t=${Date.now()}`, {
        cache: 'no-store',
      });
      const data = await safeParseResponseJson(res);
      if (!data) {
        return;
      }

      if (!data.connected) {
        setProjectMeta((prev) => ({
          ...prev,
          connected: false,
          tokenPermissionError: Boolean(data.tokenPermissionError),
          message: data.message,
        }));
        return;
      }

      const fetchedCardsRaw: MirroredBoardCard[] = Array.isArray(data.cards) ? data.cards : [];
      const fetchedCards: MirroredBoardCard[] = fetchedCardsRaw.map((c) => {
        const savedSecs = pausedTotalsRef.current[c.issueNumber] || 0;
        const savedHours = savedSecs > 0 ? Number((savedSecs / 3600).toFixed(4)) : 0;
        const isCurrentlyRunning = Boolean(activeTimersRef.current[c.issueNumber]);
        return {
          ...c,
          horasGastas: Math.max(c.horasGastas || 0, savedHours),
          statusColumn:
            isCurrentlyRunning && c.statusColumn !== 'Concluído'
              ? 'Em andamento'
              : c.statusColumn,
          statusOptionId:
            isCurrentlyRunning && c.statusColumn !== 'Concluído'
              ? '47fc9ee4'
              : c.statusOptionId,
        };
      });
      setBoardCards(fetchedCards);

      setProjectMeta({
        connected: true,
        tokenPermissionError: false,
        activeSource: data.activeSource || 'personal_3',
        personalProjectItemCount: Number(data.personalProjectItemCount) || 0,
        orgProjectItemCount: Number(data.orgProjectItemCount) || 0,
        projectTitle: data.projectTitle || 'Chamados (users/felipeolio/projects/3)',
        projectUrl: data.projectUrl || 'https://github.com/users/felipeolio/projects/3',
      });

      // Sync cards into localTickets so Table view, Dashboard, Empresas, and Equipe have all live GitHub cards immediately!
      setLocalTickets((prev) => {
        const prevMap = new Map(prev.map((t) => [t.issueNumber, t]));
        return fetchedCards.map((card) => {
          const existing = prevMap.get(card.issueNumber);
          const payload = convertCardToTicketPayload(card, existing);
          return {
            id: existing?.id || `gh_card_${card.issueNumber}`,
            ownerId: 'demo',
            ...payload,
          };
        });
      });

      // If authenticated with user, sync any changed cards to Neon DB
      if (user) {
        for (const card of fetchedCards) {
          const existing = dbTickets.find((t) => t.issueNumber === card.issueNumber);
          const payload = convertCardToTicketPayload(card, existing);
          if (!existing) {
            await createTicketRecord(
              user.uid,
              payload,
              `tkt_${card.issueNumber}_${user.uid.slice(0, 8)}`
            );
          } else {
            if (
              (existing.status === 'em_atendimento' || existing.activeSessionStartedAtMs > 0) &&
              !activeTimersRef.current[card.issueNumber] &&
              existing.status !== 'encerrado'
            ) {
              await updateTicketTimerAction(existing.id, {
                status: payload.status === 'em_atendimento' ? 'pausado' : payload.status,
                githubState: payload.githubState,
                totalSecondsWorked: payload.totalSecondsWorked,
                activeSessionStartedAtMs: 0,
                lastCommentSummary: existing.lastCommentSummary,
                commentsCount: payload.commentsCount,
              });
            }

            const hasChanged =
              existing.status !== payload.status ||
              existing.title !== payload.title ||
              existing.githubState !== payload.githubState ||
              existing.githubAssignee !== payload.githubAssignee ||
              existing.labelsSummary !== payload.labelsSummary ||
              existing.lastCommentSummary !== payload.lastCommentSummary;

            if (hasChanged) {
              if (existing.status === 'encerrado' && payload.status !== 'encerrado') {
                await reopenClosedTicketAction(existing.id);
              }
              if (existing.status !== 'encerrado' || payload.status !== 'encerrado') {
                await updateTicketCardFieldsAction(existing.id, {
                  title: payload.title,
                  description: payload.description,
                  assigneeName: payload.assigneeName,
                  githubAssignee: payload.githubAssignee,
                  githubState: payload.githubState,
                  status: payload.status,
                  priority: payload.priority,
                  labelsSummary: payload.labelsSummary,
                  commentsCount: payload.commentsCount,
                  lastCommentSummary: payload.lastCommentSummary,
                });
              }
            }
          }
        }
      }

      // If personal_3 (users/felipeolio/projects/3) has 0 items on GitHub, automatically mirror the open cards to it once!
      if (
        Number(data.personalProjectItemCount) === 0 &&
        fetchedCards.length > 0 &&
        !autoMirroredPersonalRef.current
      ) {
        autoMirroredPersonalRef.current = true;
        fetch('/api/github/project-board/mirror-to-project3', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 15 }),
        })
          .then((r) => safeParseResponseJson(r))
          .then((mirrorData) => {
            if (mirrorData && mirrorData.ok && mirrorData.linkedCount > 0) {
              setProjectMeta((prev) => ({
                ...prev,
                personalProjectItemCount: mirrorData.linkedCount,
              }));
              setStatusBanner(
                `Espelhamento concluído: ${mirrorData.linkedCount} cards vinculados diretamente em users/felipeolio/projects/3 e sincronizados aqui!`
              );
            }
          })
          .catch(() => {});
      }
    } catch {
      // Ignore transient network or server reload errors during sync
    } finally {
      setSyncingBoard(false);
    }
  }, [convertCardToTicketPayload, dbTickets, user]);

  useEffect(() => {
    handlePullFromGitHubBoard();
  }, []);

  useEffect(() => {
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        handlePullFromGitHubBoard();
      }
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);

    if (!autoSyncEnabled) {
      return () => {
        window.removeEventListener('focus', onFocusOrVisible);
        document.removeEventListener('visibilitychange', onFocusOrVisible);
      };
    }

    const timer = window.setInterval(() => {
      handlePullFromGitHubBoard();
    }, 10000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [autoSyncEnabled, handlePullFromGitHubBoard]);

  const handleMirrorOpenIssuesToProject3 = async () => {
    setMirroringToPersonal(true);
    try {
      const res = await fetch('/api/github/project-board/mirror-to-project3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 20 }),
      });
      const data = await safeParseResponseJson(res);
      if (data && data.ok) {
        setStatusBanner(data.message);
        await handlePullFromGitHubBoard();
      }
    } finally {
      setMirroringToPersonal(false);
    }
  };

  // Active Ticket for Cockpit
  const activeTicket = useMemo<Ticket | null>(() => {
    const targetNum =
      selectedIssueNumber ||
      boardCards.find((c) => c.statusColumn === 'Em andamento')?.issueNumber ||
      boardCards[0]?.issueNumber ||
      tickets[0]?.issueNumber ||
      0;

    if (!targetNum) return tickets[0] || null;
    if (ticketsByIssueNumber[targetNum]) {
      return ticketsByIssueNumber[targetNum];
    }
    const card = boardCards.find((c) => c.issueNumber === targetNum);
    if (!card) return tickets[0] || null;
    return {
      id: `gh_card_${card.issueNumber}`,
      ownerId: user?.uid || 'demo',
      ...convertCardToTicketPayload(card),
    };
  }, [selectedIssueNumber, boardCards, tickets, ticketsByIssueNumber, user, convertCardToTicketPayload]);

  // RBAC helper: check if currentOperator is allowed to start the timer on a given Card or Ticket
  const checkCanStartTimerOnCard = useCallback(
    (card: MirroredBoardCard): { allowed: boolean; reason?: string } => {
      if (isCurrentOperatorAdmin || !effectiveRestrictTimerToAssigned) {
        return { allowed: true };
      }
      const handleLower = currentOperator.githubHandle.toLowerCase();
      const nameLower = currentOperator.name.toLowerCase();
      const isAssigned = card.assignees.some(
        (a) => a.toLowerCase() === handleLower || a.toLowerCase() === nameLower
      );
      if (!isAssigned) {
        return {
          allowed: false,
          reason: `Permissão de Atendente (@${currentOperator.githubHandle}): Você só pode iniciar o timer em cards atribuídos a você. Este card está atribuído a ${
            card.assignees.length > 0 ? card.assignees.map((a) => `@${a}`).join(', ') : 'outro técnico'
          }.`,
        };
      }
      return { allowed: true };
    },
    [isCurrentOperatorAdmin, effectiveRestrictTimerToAssigned, currentOperator]
  );

  const checkCanStartTimerOnTicket = useCallback(
    (ticket: Ticket): { allowed: boolean; reason?: string } => {
      if (isCurrentOperatorAdmin || !effectiveRestrictTimerToAssigned) {
        return { allowed: true };
      }
      const matchingCard = boardCards.find((c) => c.issueNumber === ticket.issueNumber);
      if (matchingCard) {
        return checkCanStartTimerOnCard(matchingCard);
      }
      const handleLower = currentOperator.githubHandle.toLowerCase();
      const nameLower = currentOperator.name.toLowerCase();
      const isAssigned =
        (ticket.githubAssignee || '').toLowerCase() === handleLower ||
        (ticket.assigneeName || '').toLowerCase() === nameLower;
      if (!isAssigned) {
        return {
          allowed: false,
          reason: `Permissão de Atendente (@${currentOperator.githubHandle}): Você só pode iniciar o timer em cards atribuídos a você. Este card está atribuído a @${ticket.githubAssignee}.`,
        };
      }
      return { allowed: true };
    },
    [
      isCurrentOperatorAdmin,
      effectiveRestrictTimerToAssigned,
      currentOperator,
      boardCards,
      checkCanStartTimerOnCard,
    ]
  );

  // Filter Board Cards by global search, company filter & technician filter
  const visibleBoardCards = useMemo(() => {
    return boardCards.filter((c) => {
      if (companyFilter !== 'ALL' && c.cliente.toLowerCase() !== companyFilter.toLowerCase()) {
        return false;
      }
      if (technicianFilter !== 'ALL') {
        const techLower = technicianFilter.toLowerCase();
        const hasTech = c.assignees.some((a) => a.toLowerCase() === techLower);
        if (!hasTech) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inNum = String(c.issueNumber).includes(q);
        const inTitle = c.title.toLowerCase().includes(q);
        const inCliente = (c.cliente || '').toLowerCase().includes(q);
        const inEsteira = (c.esteira || '').toLowerCase().includes(q);
        const inUser = c.assignees.some((a) => a.toLowerCase().includes(q));
        const inLabels = c.labels.some((l) => l.toLowerCase().includes(q));
        if (!inNum && !inTitle && !inCliente && !inEsteira && !inUser && !inLabels) {
          return false;
        }
      }
      return true;
    });
  }, [boardCards, companyFilter, technicianFilter, searchQuery]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (ticketStatusFilter !== 'todos' && t.status !== ticketStatusFilter) return false;
      if (companyFilter !== 'ALL' && t.companyName.toLowerCase() !== companyFilter.toLowerCase()) {
        return false;
      }
      if (technicianFilter !== 'ALL') {
        const techLower = technicianFilter.toLowerCase();
        const matchingCard = boardCards.find((c) => c.issueNumber === t.issueNumber);
        const matchesCardAssignee = matchingCard?.assignees.some(
          (a) => a.toLowerCase() === techLower
        );
        const matchesTicketAssignee = t.githubAssignee.toLowerCase() === techLower;
        if (!matchesCardAssignee && !matchesTicketAssignee) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = String(t.issueNumber).includes(q);
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchAssignee = t.assigneeName.toLowerCase().includes(q);
        const matchCompany = t.companyName.toLowerCase().includes(q);
        const matchLabels = t.labelsSummary.toLowerCase().includes(q);
        if (!matchNum && !matchTitle && !matchAssignee && !matchCompany && !matchLabels) {
          return false;
        }
      }
      return true;
    });
  }, [tickets, ticketStatusFilter, companyFilter, technicianFilter, boardCards, searchQuery]);

  // Move Card to any of the 8 GitHub Status Columns
  const handleMoveCardToStatusColumn = async (
    card: MirroredBoardCard,
    targetStatusOptionId: string,
    targetStatusName: string
  ) => {
    setBusyAction(true);
    try {
      const newState: 'OPEN' | 'CLOSED' =
        targetStatusOptionId === '98236657' || targetStatusName === 'Concluído'
          ? 'CLOSED'
          : 'OPEN';

      // Optimistic UI update on boardCards
      setBoardCards((prev) =>
        prev.map((c) =>
          c.issueNumber === card.issueNumber
            ? {
                ...c,
                statusOptionId: targetStatusOptionId,
                statusColumn: targetStatusName,
                state: newState,
              }
            : c
        )
      );

      const mappedStatus = mapStatusColumnToTicketStatus(targetStatusName, newState);
      const existingTicket = ticketsByIssueNumber[card.issueNumber];

      // Moving a card to Concluído or another column stops any running timer and saves its elapsed time
      let updatedTotalSeconds = Math.max(
        existingTicket?.totalSecondsWorked || 0,
        pausedTotalsRef.current[card.issueNumber] || 0
      );
      if (newState === 'CLOSED' || targetStatusName !== 'Em andamento') {
        const runningStartMs = activeTimersRef.current[card.issueNumber] || 0;
        if (runningStartMs > 0) {
          const elapsed = Math.max(1, Math.floor((Date.now() - runningStartMs) / 1000));
          updatedTotalSeconds += elapsed;
          recordPausedTotal(card.issueNumber, updatedTotalSeconds);
        }
        delete activeTimersRef.current[card.issueNumber];
        setActiveTimers((prev) => {
          const next = { ...prev };
          delete next[card.issueNumber];
          return next;
        });
      }
      const activeStartMs = activeTimersRef.current[card.issueNumber] || 0;
      const nextTicketStatus: Ticket['status'] =
        newState === 'CLOSED'
          ? 'encerrado'
          : activeStartMs > 0
          ? 'em_atendimento'
          : mappedStatus;

      if (user && existingTicket && existingTicket.status !== 'encerrado') {
        await updateTicketTimerAction(existingTicket.id, {
          status: nextTicketStatus,
          githubState: newState === 'CLOSED' ? 'closed' : 'open',
          totalSecondsWorked: updatedTotalSeconds,
          activeSessionStartedAtMs: activeStartMs,
          lastCommentSummary: `Movido para coluna "${targetStatusName}" no GitHub Project.`,
          commentsCount: existingTicket.commentsCount,
        });
      } else {
        setLocalTickets((prev) =>
          prev.map((t) =>
            t.issueNumber === card.issueNumber
              ? {
                  ...t,
                  status: nextTicketStatus,
                  githubState: newState === 'CLOSED' ? 'closed' : 'open',
                  totalSecondsWorked: updatedTotalSeconds,
                  activeSessionStartedAtMs: activeStartMs,
                }
              : t
          )
        );
      }

      await fetch('/api/github/project-board/sync-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: card.contentId,
          issueNumber: card.issueNumber,
          repository: card.repository,
          state: newState,
          statusOptionId: targetStatusOptionId,
        }),
      });

      setStatusBanner(
        `Card #${card.issueNumber} movido para a coluna "${targetStatusName}" e sincronizado no GitHub Project!`
      );
    } finally {
      setBusyAction(false);
    }
  };

  // Transactional Comment + Column Move OR Issue Closure with Markdown Template
  const handleConfirmCommentOrCloseIssue = async (
    issueNumber: number,
    params: {
      actionType: 'comment_and_move' | 'close_issue';
      commentMarkdown: string;
      targetStatusOptionId: string;
      targetStatusName: string;
    }
  ) => {
    setBusyAction(true);
    try {
      const matchingCard = boardCards.find((c) => c.issueNumber === issueNumber);
      const existingTicket = ticketsByIssueNumber[issueNumber];
      const previousColumn =
        matchingCard?.statusColumn ||
        (existingTicket?.status === 'encerrado'
          ? 'Concluído'
          : existingTicket?.status === 'em_atendimento'
          ? 'Em andamento'
          : 'Backlog');

      const isClosingIssue =
        params.actionType === 'close_issue' ||
        params.targetStatusOptionId === '98236657' ||
        params.targetStatusName === 'Concluído';

      const finalStatusOptionId = isClosingIssue ? '98236657' : params.targetStatusOptionId;
      const finalStatusColumn = isClosingIssue ? 'Concluído' : params.targetStatusName;
      const newState: 'OPEN' | 'CLOSED' = isClosingIssue ? 'CLOSED' : 'OPEN';

      const authorHandle =
        matchingCard?.assignees[0] || existingTicket?.githubAssignee || 'felipeolio';
      const authorName =
        existingTicket?.assigneeName || resolveUserDisplayName(authorHandle);
      const nowIso = new Date().toISOString();

      const newHistoryEntry: IssueHistoryEntry = {
        id: `hist_${issueNumber}_${Date.now()}`,
        issueNumber,
        actionType: isClosingIssue ? 'close_issue' : 'comment_and_move',
        commentMarkdown: params.commentMarkdown,
        authorName,
        authorHandle,
        createdAtIso: nowIso,
        previousColumn,
        targetColumn: finalStatusColumn,
        closedIssue: isClosingIssue,
      };

      setIssueHistoryByNumber((prev) => ({
        ...prev,
        [issueNumber]: [newHistoryEntry, ...(prev[issueNumber] || [])],
      }));

      // If closing the issue or moving away from Em andamento, stop active timer and save elapsed time
      let updatedTotalSeconds = Math.max(
        existingTicket?.totalSecondsWorked || 0,
        pausedTotalsRef.current[issueNumber] || 0
      );
      if (isClosingIssue || finalStatusColumn !== 'Em andamento') {
        const runningStartMs = activeTimersRef.current[issueNumber] || 0;
        if (runningStartMs > 0) {
          const elapsed = Math.max(1, Math.floor((Date.now() - runningStartMs) / 1000));
          updatedTotalSeconds += elapsed;
          recordPausedTotal(issueNumber, updatedTotalSeconds);
        }
        delete activeTimersRef.current[issueNumber];
        setActiveTimers((prev) => {
          const next = { ...prev };
          delete next[issueNumber];
          return next;
        });
      }

      // Immediate UI update on boardCards (moves card across Kanban columns immediately without page reload)
      setBoardCards((prev) =>
        prev.map((c) =>
          c.issueNumber === issueNumber
            ? {
                ...c,
                statusOptionId: finalStatusOptionId,
                statusColumn: finalStatusColumn,
                state: newState,
                commentsCount: (c.commentsCount || 0) + 1,
              }
            : c
        )
      );

      const activeStartMs = activeTimersRef.current[issueNumber] || 0;
      const mappedStatus = mapStatusColumnToTicketStatus(finalStatusColumn, newState);
      const nextTicketStatus: Ticket['status'] = isClosingIssue
        ? 'encerrado'
        : activeStartMs > 0
        ? 'em_atendimento'
        : mappedStatus;

      const summaryLine = isClosingIssue
        ? `Issue encerrada por @${authorHandle} (${previousColumn} → Concluído): ${params.commentMarkdown
            .replace(/\s+/g, ' ')
            .slice(0, 180)}`
        : `Comentário de @${authorHandle} (${previousColumn} → ${finalStatusColumn}): ${params.commentMarkdown
            .replace(/\s+/g, ' ')
            .slice(0, 180)}`;

      setLocalTickets((prev) =>
        prev.map((t) =>
          t.issueNumber === issueNumber
            ? {
                ...t,
                status: nextTicketStatus,
                githubState: isClosingIssue ? 'closed' : 'open',
                totalSecondsWorked: updatedTotalSeconds,
                activeSessionStartedAtMs: activeStartMs,
                commentsCount: (t.commentsCount || 0) + 1,
                lastCommentSummary: summaryLine,
              }
            : t
        )
      );

      const auditDetails = isClosingIssue
        ? `Encerramento da Issue #${issueNumber} por @${authorHandle} (${authorName}) em ${new Date(
            nowIso
          ).toLocaleString('pt-BR')} · Movido de "${previousColumn}" para "Concluído" · Comentário: ${params.commentMarkdown
            .replace(/\s+/g, ' ')
            .slice(0, 450)}`
        : `Comentário e movimentação na Issue #${issueNumber} por @${authorHandle} (${authorName}) em ${new Date(
            nowIso
          ).toLocaleString('pt-BR')} · Movido de "${previousColumn}" para "${finalStatusColumn}" · Comentário: ${params.commentMarkdown
            .replace(/\s+/g, ' ')
            .slice(0, 450)}`;

      if (user) {
        const existingDb = dbTickets.find((t) => t.issueNumber === issueNumber);
        if (existingDb) {
          if (existingDb.status === 'encerrado' && !isClosingIssue) {
            await reopenClosedTicketAction(existingDb.id);
          }
          if (existingDb.status !== 'encerrado' || !isClosingIssue) {
            await updateTicketTimerAction(existingDb.id, {
              status: nextTicketStatus,
              githubState: isClosingIssue ? 'closed' : 'open',
              totalSecondsWorked: updatedTotalSeconds,
              activeSessionStartedAtMs: activeStartMs,
              lastCommentSummary: summaryLine,
              commentsCount: (existingDb.commentsCount || 0) + 1,
            });
          }
        }
        await createAuditLogRecord(user.uid, {
          eventType: isClosingIssue ? 'chamado_encerrado' : 'sync_api',
          actorName: `${authorName} (@${authorHandle})`,
          targetLabel: `Issue #${issueNumber} · ${previousColumn} → ${finalStatusColumn}`,
          details: auditDetails,
          origin: 'Operador Web',
        });
      } else {
        setLocalAuditLogs((prev) => [
          {
            id: `audit_${Date.now()}`,
            eventType: isClosingIssue ? 'chamado_encerrado' : 'sync_api',
            actorName: `${authorName} (@${authorHandle})`,
            targetLabel: `Issue #${issueNumber} · ${previousColumn} → ${finalStatusColumn}`,
            details: auditDetails,
            origin: 'Operador Web',
            ownerId: 'demo',
            createdAt: nowIso,
          },
          ...prev,
        ]);
      }

      // Sync comment + state + column with GitHub REST & GraphQL API
      await fetch('/api/github/project-board/sync-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: matchingCard?.contentId || '',
          issueNumber,
          repository:
            matchingCard?.repository ||
            existingTicket?.githubRepo ||
            'zdttech-copilot/governanca-zdt',
          state: newState,
          statusOptionId: finalStatusOptionId,
          commentToPost: params.commentMarkdown,
        }),
      });

      setStatusBanner(
        isClosingIssue
          ? `Issue #${issueNumber} encerrada com comentário de encerramento e movida automaticamente de "${previousColumn}" para "Concluído"!`
          : `Comentário registrado na Issue #${issueNumber} e card movido de "${previousColumn}" para "${finalStatusColumn}"!`
      );
    } finally {
      setBusyAction(false);
    }
  };

  // Pause Timer & Sync "Horas gastas" to GitHub Project (NEVER restarts on sync)
  const handlePauseTicket = async (
    ticket: Ticket,
    elapsedCurrentRun: number,
    options?: { switchedToIssueNumber?: number }
  ) => {
    setBusyAction(true);
    const prevStartedAtMs =
      activeTimersRef.current[ticket.issueNumber] || ticket.activeSessionStartedAtMs || 0;
    // Immediately clear from activeTimersRef and activeTimers state so no automatic or manual sync can ever restart the timer!
    delete activeTimersRef.current[ticket.issueNumber];
    setActiveTimers((prev) => {
      const next = { ...prev };
      delete next[ticket.issueNumber];
      return next;
    });

    const computedElapsed =
      elapsedCurrentRun > 0
        ? elapsedCurrentRun
        : prevStartedAtMs > 0
        ? Math.max(1, Math.floor((Date.now() - prevStartedAtMs) / 1000))
        : 0;
    const addedSeconds = Math.max(0, computedElapsed);
    const previousSavedSeconds = Math.max(
      ticket.totalSecondsWorked || 0,
      pausedTotalsRef.current[ticket.issueNumber] || 0,
      pausedTotals[ticket.issueNumber] || 0
    );
    const newTotalSeconds = previousSavedSeconds + addedSeconds;
    recordPausedTotal(ticket.issueNumber, newTotalSeconds);
    const newHorasCard = Number((newTotalSeconds / 3600).toFixed(4));
    const newHorasDecimal = Number((newTotalSeconds / 3600).toFixed(2));
    const endedIso = new Date().toISOString();
    const startedIso =
      prevStartedAtMs > 0
        ? new Date(prevStartedAtMs).toISOString()
        : new Date(Date.now() - addedSeconds * 1000).toISOString();
    const noteText =
      sessionNote.trim() ||
      `Sessão pausada por ${ticket.assigneeName} (+${formatDurationHms(addedSeconds)}).`;

    try {
      const matchingCard = boardCards.find((c) => c.issueNumber === ticket.issueNumber);
      setBoardCards((prev) =>
        prev.map((c) =>
          c.issueNumber === ticket.issueNumber
            ? {
                ...c,
                horasGastas: newHorasCard,
              }
            : c
        )
      );

      setLocalTickets((prev) => {
        const exists = prev.some((t) => t.issueNumber === ticket.issueNumber);
        if (!exists) {
          return [
            {
              ...ticket,
              status: 'pausado',
              totalSecondsWorked: newTotalSeconds,
              activeSessionStartedAtMs: 0,
              lastCommentSummary: noteText,
            },
            ...prev,
          ];
        }
        return prev.map((t) =>
          t.issueNumber === ticket.issueNumber
            ? {
                ...t,
                status: 'pausado',
                totalSecondsWorked: newTotalSeconds,
                activeSessionStartedAtMs: 0,
                lastCommentSummary: noteText,
              }
            : t
        );
      });

      const ownerUid = user?.uid || 'default';
      const existing = dbTickets.find((t) => t.issueNumber === ticket.issueNumber);
      if (existing) {
        await updateTicketTimerAction(existing.id, {
          status: 'pausado',
          githubState: 'open',
          totalSecondsWorked: newTotalSeconds,
          activeSessionStartedAtMs: 0,
          lastCommentSummary: noteText,
          commentsCount: existing.commentsCount,
        });
      } else {
        const { id: _ignoreId, ownerId: _ignoreOwner, ...ticketPayload } = ticket;
        await createTicketRecord(
          ownerUid,
          {
            ...ticketPayload,
            status: 'pausado',
            githubState: 'open',
            totalSecondsWorked: newTotalSeconds,
            activeSessionStartedAtMs: 0,
            lastCommentSummary: noteText,
          },
          `tkt_${ticket.issueNumber}`
        );
      }
      await createAttendanceSessionRecord(ownerUid, {
        ticketId: existing?.id || ticket.id,
        issueNumber: ticket.issueNumber,
        ticketTitle: ticket.title,
        companyName: ticket.companyName,
        agentName: ticket.assigneeName,
        startedAtIso: startedIso,
        endedAtIso: endedIso,
        durationSeconds: Math.max(1, addedSeconds),
        notes: noteText,
        sessionStatus: 'pausada',
      });
      await createAuditLogRecord(ownerUid, {
        eventType: 'sessao_pausada',
        actorName: ticket.assigneeName,
        targetLabel: `Card #${ticket.issueNumber} · ${ticket.companyName}`,
        details: `Sessão pausada (+${formatDurationHms(addedSeconds)} · Total ${formatDurationHms(newTotalSeconds)}). Horas gastas no GitHub atualizadas para ${newHorasDecimal}h.`,
        origin: 'Operador Web',
      });
      setLocalSessions((prev) => [
        {
          id: `sess_${Date.now()}`,
          ticketId: ticket.id,
          issueNumber: ticket.issueNumber,
          ticketTitle: ticket.title,
          companyName: ticket.companyName,
          agentName: ticket.assigneeName,
          startedAtIso: startedIso,
          endedAtIso: endedIso,
          durationSeconds: Math.max(1, addedSeconds),
          notes: noteText,
          sessionStatus: 'pausada',
          ownerId: ownerUid,
        },
        ...prev,
      ]);
      await refreshNeonWorkspaceState();

      await fetch('/api/github/project-board/sync-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: matchingCard?.contentId || '',
          issueNumber: ticket.issueNumber,
          repository: ticket.githubRepo,
          horasGastas: newHorasDecimal,
        }),
      });

      if (options?.switchedToIssueNumber) {
        setStatusBanner(
          `Cronômetro do Card #${ticket.issueNumber} pausado e salvo automaticamente (${formatDurationHms(newTotalSeconds)}) ao selecionar o Card #${options.switchedToIssueNumber}.`
        );
      } else {
        setStatusBanner(
          `Cronômetro do Card #${ticket.issueNumber} pausado (${formatDurationHms(newTotalSeconds)}). Só voltará a contar quando você clicar em Iniciar/Retomar.`
        );
      }
    } finally {
      setBusyAction(false);
    }
  };

  // Select a Card: if another card has a running timer, automatically pause & save it on that card first!
  const handleSelectIssueCard = async (targetIssueNumber: number) => {
    const runningEntries = Object.entries(activeTimersRef.current).filter(
      ([issueNumStr, startedAt]) => Number(issueNumStr) !== targetIssueNumber && startedAt > 0
    );

    setSelectedIssueNumber(targetIssueNumber);
    setLiveComments([]);

    for (const [issueNumStr, startedAtMs] of runningEntries) {
      const runningIssueNum = Number(issueNumStr);
      const elapsedSeconds = Math.max(1, Math.floor((Date.now() - startedAtMs) / 1000));
      const existingTicket = ticketsByIssueNumber[runningIssueNum];
      const matchingCard = boardCards.find((c) => c.issueNumber === runningIssueNum);
      const ticketToPause: Ticket | null =
        existingTicket ||
        (matchingCard
          ? {
              id: `gh_card_${matchingCard.issueNumber}`,
              ownerId: user?.uid || 'demo',
              ...convertCardToTicketPayload(matchingCard),
            }
          : null);

      if (ticketToPause) {
        await handlePauseTicket(ticketToPause, elapsedSeconds, {
          switchedToIssueNumber: targetIssueNumber,
        });
      }
    }
  };

  // Start / Resume Timer on a Ticket or BoardCard (ONLY place that starts the timer)
  const handleStartOrResumeTicket = async (ticket: Ticket) => {
    // RBAC Check: Atendente can only start timer on cards assigned to them when restrictTimerToAssignedOnly is Active
    const permCheck = checkCanStartTimerOnTicket(ticket);
    if (!permCheck.allowed) {
      setStatusBanner(
        permCheck.reason ||
          'Permissão negada: Como Atendente, você só pode iniciar o timer de um card ao qual está atribuído.'
      );
      return;
    }

    // If another card has an active timer running, pause and save it first!
    const otherRunningEntries = Object.entries(activeTimersRef.current).filter(
      ([issueNumStr, startedAt]) => Number(issueNumStr) !== ticket.issueNumber && startedAt > 0
    );
    for (const [issueNumStr, startedAtMs] of otherRunningEntries) {
      const runningIssueNum = Number(issueNumStr);
      const elapsedSeconds = Math.max(1, Math.floor((Date.now() - startedAtMs) / 1000));
      const existingTicket = ticketsByIssueNumber[runningIssueNum];
      const matchingRunningCard = boardCards.find((c) => c.issueNumber === runningIssueNum);
      const ticketToPause: Ticket | null =
        existingTicket ||
        (matchingRunningCard
          ? {
              id: `gh_card_${matchingRunningCard.issueNumber}`,
              ownerId: user?.uid || 'demo',
              ...convertCardToTicketPayload(matchingRunningCard),
            }
          : null);
      if (ticketToPause) {
        await handlePauseTicket(ticketToPause, elapsedSeconds, {
          switchedToIssueNumber: ticket.issueNumber,
        });
      }
    }

    setBusyAction(true);
    setSelectedIssueNumber(ticket.issueNumber);
    const nowMs = Date.now();
    const preservedTotalSeconds = Math.max(
      ticket.totalSecondsWorked || 0,
      pausedTotalsRef.current[ticket.issueNumber] || 0,
      pausedTotals[ticket.issueNumber] || 0
    );
    activeTimersRef.current[ticket.issueNumber] = nowMs;
    setActiveTimers((prev) => ({ ...prev, [ticket.issueNumber]: nowMs }));
    const noteText =
      sessionNote.trim() ||
      `${ticket.assigneeName}: Atendimento iniciado no Card #${ticket.issueNumber}.`;

    try {
      // Update boardCards to "Em andamento" (47fc9ee4)
      const matchingCard = boardCards.find((c) => c.issueNumber === ticket.issueNumber);
      setBoardCards((prev) =>
        prev.map((c) =>
          c.issueNumber === ticket.issueNumber
            ? { ...c, statusColumn: 'Em andamento', statusOptionId: '47fc9ee4', state: 'OPEN' }
            : c
        )
      );

      setLocalTickets((prev) => {
        const exists = prev.some((t) => t.issueNumber === ticket.issueNumber);
        if (!exists) {
          return [
            {
              ...ticket,
              status: 'em_atendimento',
              githubState: 'open',
              totalSecondsWorked: preservedTotalSeconds,
              activeSessionStartedAtMs: nowMs,
              lastCommentSummary: noteText,
            },
            ...prev,
          ];
        }
        return prev.map((t) =>
          t.issueNumber === ticket.issueNumber
            ? {
                ...t,
                status: 'em_atendimento',
                githubState: 'open',
                totalSecondsWorked: preservedTotalSeconds,
                activeSessionStartedAtMs: nowMs,
                lastCommentSummary: noteText,
              }
            : t
        );
      });

      if (user) {
        const existing = dbTickets.find((t) => t.issueNumber === ticket.issueNumber);
        if (existing) {
          if (existing.status === 'encerrado') {
            await reopenClosedTicketAction(existing.id);
          }
          await updateTicketTimerAction(existing.id, {
            status: 'em_atendimento',
            githubState: 'open',
            totalSecondsWorked: Math.max(existing.totalSecondsWorked || 0, preservedTotalSeconds),
            activeSessionStartedAtMs: nowMs,
            lastCommentSummary: noteText,
            commentsCount: existing.commentsCount,
          });
        } else {
          const { id: _ignoreId, ownerId: _ignoreOwner, ...ticketPayload } = ticket;
          await createTicketRecord(
            user.uid,
            {
              ...ticketPayload,
              status: 'em_atendimento',
              githubState: 'open',
              totalSecondsWorked: preservedTotalSeconds,
              activeSessionStartedAtMs: nowMs,
              lastCommentSummary: noteText,
            },
            `tkt_${ticket.issueNumber}_${user.uid.slice(0, 8)}`
          );
        }
        await createAuditLogRecord(user.uid, {
          eventType: 'sessao_iniciada',
          actorName: ticket.assigneeName,
          targetLabel: `Card #${ticket.issueNumber} · ${ticket.companyName}`,
          details: `Cronômetro iniciado e card movido para "Em andamento" no GitHub Project.`,
          origin: 'Operador Web',
        });
      }

      await fetch('/api/github/project-board/sync-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: matchingCard?.contentId || '',
          issueNumber: ticket.issueNumber,
          repository: ticket.githubRepo,
          state: 'OPEN',
          statusOptionId: '47fc9ee4', // Em andamento
        }),
      });

      setStatusBanner(
        `Cronômetro iniciado no Card #${ticket.issueNumber} — Coluna no GitHub atualizada para "Em andamento".`
      );
    } finally {
      setBusyAction(false);
    }
  };

  // End / Stop Attendance Timer ONLY (does NOT move card to Concluído/Encerrado and does NOT close the card)
  const handleCloseTicket = async (ticket: Ticket, elapsedCurrentRun: number) => {
    setBusyAction(true);
    const prevStartedAtMs =
      activeTimersRef.current[ticket.issueNumber] || ticket.activeSessionStartedAtMs || 0;
    delete activeTimersRef.current[ticket.issueNumber];
    setActiveTimers((prev) => {
      const next = { ...prev };
      delete next[ticket.issueNumber];
      return next;
    });

    const computedElapsed =
      elapsedCurrentRun > 0
        ? elapsedCurrentRun
        : prevStartedAtMs > 0
        ? Math.max(1, Math.floor((Date.now() - prevStartedAtMs) / 1000))
        : 0;
    const addedSeconds =
      ticket.status === 'em_atendimento' || prevStartedAtMs > 0 ? Math.max(0, computedElapsed) : 0;
    const previousSavedSeconds = Math.max(
      ticket.totalSecondsWorked || 0,
      pausedTotalsRef.current[ticket.issueNumber] || 0,
      pausedTotals[ticket.issueNumber] || 0
    );
    const newTotalSeconds = previousSavedSeconds + addedSeconds;
    recordPausedTotal(ticket.issueNumber, newTotalSeconds);
    const newHorasCard = Number((newTotalSeconds / 3600).toFixed(4));
    const newHorasDecimal = Number((newTotalSeconds / 3600).toFixed(2));
    const endedIso = new Date().toISOString();
    const startedIso =
      prevStartedAtMs > 0
        ? new Date(prevStartedAtMs).toISOString()
        : new Date(Date.now() - addedSeconds * 1000).toISOString();
    const noteText =
      sessionNote.trim() ||
      `Turno de atendimento encerrado no Card #${ticket.issueNumber} por ${ticket.assigneeName} (+${formatDurationHms(addedSeconds)}).`;

    try {
      const matchingCard = boardCards.find((c) => c.issueNumber === ticket.issueNumber);
      // ONLY update horasGastas — keep the card in its exact current column and state!
      setBoardCards((prev) =>
        prev.map((c) =>
          c.issueNumber === ticket.issueNumber
            ? {
                ...c,
                horasGastas: newHorasCard,
              }
            : c
        )
      );

      if (user) {
        const existing = dbTickets.find((t) => t.issueNumber === ticket.issueNumber);
        if (existing) {
          if (existing.status === 'encerrado') {
            await reopenClosedTicketAction(existing.id);
          }
          await updateTicketTimerAction(existing.id, {
            status: 'pausado',
            githubState: 'open',
            totalSecondsWorked: newTotalSeconds,
            activeSessionStartedAtMs: 0,
            lastCommentSummary: noteText,
            commentsCount: existing.commentsCount,
          });
        } else {
          const { id: _ignoreId, ownerId: _ignoreOwner, ...ticketPayload } = ticket;
          await createTicketRecord(
            user.uid,
            {
              ...ticketPayload,
              status: 'pausado',
              githubState: 'open',
              totalSecondsWorked: newTotalSeconds,
              activeSessionStartedAtMs: 0,
              lastCommentSummary: noteText,
            },
            `tkt_${ticket.issueNumber}_${user.uid.slice(0, 8)}`
          );
        }
        await createAttendanceSessionRecord(user.uid, {
          ticketId: existing?.id || ticket.id,
          issueNumber: ticket.issueNumber,
          ticketTitle: ticket.title,
          companyName: ticket.companyName,
          agentName: ticket.assigneeName,
          startedAtIso: startedIso,
          endedAtIso: endedIso,
          durationSeconds: addedSeconds > 0 ? addedSeconds : Math.max(1, newTotalSeconds),
          notes: noteText,
          sessionStatus: 'finalizada',
        });
        await createAuditLogRecord(user.uid, {
          eventType: 'sessao_pausada',
          actorName: ticket.assigneeName,
          targetLabel: `Card #${ticket.issueNumber} · ${ticket.companyName}`,
          details: `Timer de atendimento encerrado (+${formatDurationHms(addedSeconds)} · Total ${formatDurationHms(newTotalSeconds)}). Card mantido aberto na coluna "${matchingCard?.statusColumn || 'atual'}".`,
          origin: 'Operador Web',
        });
      } else {
        setLocalSessions((prev) => [
          {
            id: `sess_${Date.now()}`,
            ticketId: ticket.id,
            issueNumber: ticket.issueNumber,
            ticketTitle: ticket.title,
            companyName: ticket.companyName,
            agentName: ticket.assigneeName,
            startedAtIso: startedIso,
            endedAtIso: endedIso,
            durationSeconds: addedSeconds > 0 ? addedSeconds : Math.max(1, newTotalSeconds),
            notes: noteText,
            sessionStatus: 'finalizada',
            ownerId: 'demo',
          },
          ...prev,
        ]);
      }

      setLocalTickets((prev) =>
        prev.map((t) =>
          t.issueNumber === ticket.issueNumber
            ? {
                ...t,
                status: 'pausado',
                githubState: 'open',
                totalSecondsWorked: newTotalSeconds,
                activeSessionStartedAtMs: 0,
                lastCommentSummary: noteText,
              }
            : t
        )
      );

      // Sync ONLY Horas gastas to GitHub Project — do NOT close the issue or move column!
      await fetch('/api/github/project-board/sync-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: matchingCard?.contentId || '',
          issueNumber: ticket.issueNumber,
          repository: ticket.githubRepo,
          horasGastas: newHorasDecimal,
        }),
      });

      setStatusBanner(
        `Timer de atendimento do Card #${ticket.issueNumber} encerrado (${formatDurationHms(newTotalSeconds)} acumulados). O card permanece aberto na coluna "${matchingCard?.statusColumn || 'atual'}"!`
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleReopenTicket = async (ticket: Ticket) => {
    setBusyAction(true);
    try {
      const matchingCard = boardCards.find((c) => c.issueNumber === ticket.issueNumber);
      setBoardCards((prev) =>
        prev.map((c) =>
          c.issueNumber === ticket.issueNumber
            ? { ...c, statusColumn: 'Em andamento', statusOptionId: '47fc9ee4', state: 'OPEN' }
            : c
        )
      );

      if (user) {
        const existing = dbTickets.find((t) => t.issueNumber === ticket.issueNumber);
        if (existing) {
          await reopenClosedTicketAction(existing.id);
        }
      }
      setLocalTickets((prev) =>
        prev.map((t) =>
          t.issueNumber === ticket.issueNumber
            ? { ...t, status: 'pausado', githubState: 'open' }
            : t
        )
      );

      await fetch('/api/github/project-board/sync-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: matchingCard?.contentId || '',
          issueNumber: ticket.issueNumber,
          repository: ticket.githubRepo,
          state: 'OPEN',
          statusOptionId: '47fc9ee4',
        }),
      });
      setStatusBanner(`Card #${ticket.issueNumber} reaberto no ChronoDesk e no GitHub.`);
    } finally {
      setBusyAction(false);
    }
  };

  // Full Card Edit Modal Save -> Updates GitHub Project V2 custom fields + Issue + Firestore
  const handleSaveFullCardSync = async (
    card: MirroredBoardCard,
    updates: {
      title: string;
      body: string;
      state: 'OPEN' | 'CLOSED';
      assignees: string[];
      labels: string[];
      statusOptionId: string;
      clienteOptionId: string;
      esteiraOptionId: string;
      tipoDemandaOptionId: string;
      impedimentoOptionId: string;
      priorityOptionId: string;
      sizeOptionId: string;
      effortOptionId: string;
      horasGastas: number;
      estimate: number;
      terminoPlanejado: string;
      proximoFollowUp: string;
      prioridadesSemanal: string;
      commentToPost: string;
    }
  ) => {
    setBusyAction(true);
    try {
      const statusName =
        PROJECT_STATUS_COLUMNS.find((c) => c.id === updates.statusOptionId)?.name ||
        card.statusColumn;
      const clienteName =
        PROJECT_CLIENTES.find((c) => c.id === updates.clienteOptionId)?.name || '';
      const esteiraName =
        PROJECT_ESTEIRAS.find((c) => c.id === updates.esteiraOptionId)?.name || '';
      const tipoDemandaName =
        PROJECT_TIPOS_DEMANDA.find((c) => c.id === updates.tipoDemandaOptionId)?.name || '';
      const impedimentoName =
        PROJECT_IMPEDIMENTOS.find((c) => c.id === updates.impedimentoOptionId)?.name || '';
      const priorityName =
        PROJECT_PRIORITIES.find((c) => c.id === updates.priorityOptionId)?.name || '';
      const sizeName = PROJECT_SIZES.find((c) => c.id === updates.sizeOptionId)?.name || '';
      const effortName = PROJECT_EFFORTS.find((c) => c.id === updates.effortOptionId)?.name || '';

      // Optimistic update in boardCards
      const updatedCard: MirroredBoardCard = {
        ...card,
        title: updates.title,
        body: updates.body,
        state: updates.state,
        assignees: updates.assignees,
        labels: updates.labels,
        statusOptionId: updates.statusOptionId,
        statusColumn: statusName,
        clienteOptionId: updates.clienteOptionId,
        cliente: clienteName,
        esteiraOptionId: updates.esteiraOptionId,
        esteira: esteiraName,
        tipoDemandaOptionId: updates.tipoDemandaOptionId,
        tipoDemanda: tipoDemandaName,
        impedimentoOptionId: updates.impedimentoOptionId,
        impedimento: impedimentoName,
        priorityOptionId: updates.priorityOptionId,
        priority: priorityName,
        sizeOptionId: updates.sizeOptionId,
        size: sizeName,
        effortOptionId: updates.effortOptionId,
        effort: effortName,
        horasGastas: updates.horasGastas,
        estimate: updates.estimate,
        terminoPlanejado: updates.terminoPlanejado,
        proximoFollowUp: updates.proximoFollowUp,
        prioridadesSemanal: updates.prioridadesSemanal,
      };

      setBoardCards((prev) =>
        prev.map((c) => (c.issueNumber === card.issueNumber ? updatedCard : c))
      );

      // Push all fields to GitHub GraphQL & REST API
      await fetch('/api/github/project-board/sync-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: card.contentId,
          issueNumber: card.issueNumber,
          repository: card.repository,
          ...updates,
        }),
      });

      // Update local/Firestore ticket
      const existingTicket = ticketsByIssueNumber[card.issueNumber];
      const payload = convertCardToTicketPayload(updatedCard, existingTicket);
      payload.totalSecondsWorked = Math.round(updates.horasGastas * 3600);

      setLocalTickets((prev) =>
        prev.map((t) => (t.issueNumber === card.issueNumber ? { ...t, ...payload } : t))
      );

      if (user && existingTicket && existingTicket.status !== 'encerrado') {
        await updateTicketCardFieldsAction(existingTicket.id, {
          title: payload.title,
          description: payload.description,
          assigneeName: payload.assigneeName,
          githubAssignee: payload.githubAssignee,
          githubState: payload.githubState,
          status: payload.status,
          priority: payload.priority,
          labelsSummary: payload.labelsSummary,
          commentsCount: payload.commentsCount,
          lastCommentSummary: payload.lastCommentSummary,
        });
      }

      setStatusBanner(
        `Card #${card.issueNumber} atualizado e sincronizado com o GitHub Project #3 e Governança ZDT!`
      );
    } finally {
      setBusyAction(false);
    }
  };

  // Create New Card on GitHub + Link to Projects #3 and #4
  const handleCreateFullCardOnGitHub = async (payload: {
    title: string;
    body: string;
    assignees: string[];
    labels: string[];
    statusOptionId: string;
    clienteOptionId: string;
    esteiraOptionId: string;
    tipoDemandaOptionId: string;
    impedimentoOptionId: string;
    priorityOptionId: string;
    sizeOptionId: string;
    effortOptionId: string;
    estimate: number;
    terminoPlanejado: string;
    proximoFollowUp: string;
  }) => {
    setBusyAction(true);
    try {
      const res = await fetch('/api/github/project-board/create-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await safeParseResponseJson(res);
      if (data && data.ok) {
        await handlePullFromGitHubBoard();
        if (data.issueNumber) {
          setSelectedIssueNumber(Number(data.issueNumber));
        }
        setStatusBanner(
          `Novo Card #${data.issueNumber} criado no GitHub e vinculado aos Projects #3 e #4!`
        );
      }
    } finally {
      setBusyAction(false);
    }
  };

  // GitHub REST API Sync Handler (from Modal)
  const handleSyncGitHubRepo = async ({
    repo,
    companyId,
    defaultAssigneeName,
    limit,
  }: {
    repo: string;
    companyId: string;
    defaultAssigneeName: string;
    limit: number;
  }) => {
    const company = companies.find((c) => c.id === companyId) || companies[0];
    if (!company) throw new Error('Cadastre uma empresa antes de sincronizar.');

    const res = await fetch(
      `/api/github/issues?repo=${encodeURIComponent(repo)}&limit=${limit}`
    );
    const data = await safeParseResponseJson(res);
    if (!res.ok || !data) {
      throw new Error(data?.error || 'Erro ao consultar GitHub API');
    }

    await handlePullFromGitHubBoard();
    setStatusBanner(
      `${data.count || 0} Issues sincronizadas do repositório ${repo} (${company.code}).`
    );
    if (defaultAssigneeName) {
      // keep reference used
    }
  };

  const handleTriggerWebhookEvent = async ({
    eventType,
    action,
    companyId,
    assigneeName,
    issueNumber,
    title,
    labelsSummary,
    commentBody,
  }: {
    eventType: 'issues' | 'issue_comment';
    action: string;
    companyId: string;
    assigneeName: string;
    issueNumber: number;
    title: string;
    labelsSummary: string;
    commentBody: string;
  }) => {
    const company = companies.find((c) => c.id === companyId) || companies[0];
    if (!company) throw new Error('Selecione uma empresa válida.');

    const response = await fetch('/api/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': eventType,
      },
      body: JSON.stringify({
        action,
        repository: { full_name: company.githubRepo },
        sender: { login: 'felipeolio' },
        issue: {
          number: issueNumber,
          title,
          body: commentBody,
          state: 'open',
          comments: 1,
          labels: labelsSummary.split(',').map((s) => ({ name: s.trim() })),
          assignee: { login: 'felipeolio', name: assigneeName },
          html_url: `https://github.com/${company.githubRepo}/issues/${issueNumber}`,
        },
      }),
    });

    const data = await safeParseResponseJson(response);
    if (!response.ok || !data?.delivery?.normalizedIssue) {
      throw new Error('Falha ao processar payload no endpoint /api/webhooks/github.');
    }
    setStatusBanner(`Webhook #${issueNumber} recebido com sucesso.`);
  };

  const handleFetchGitHubComments = async (ticket: Ticket) => {
    setLoadingComments(true);
    try {
      const res = await fetch(
        `/api/github/comments?repo=${encodeURIComponent(ticket.githubRepo)}&issueNumber=${ticket.issueNumber}`
      );
      const data = await safeParseResponseJson(res);
      if (res.ok && data && Array.isArray(data.comments) && data.comments.length > 0) {
        setLiveComments(data.comments);
      } else {
        setLiveComments([
          {
            id: 'c1',
            author: ticket.githubAssignee,
            createdAt: new Date().toISOString(),
            body: ticket.lastCommentSummary || 'Card sincronizado com o GitHub Project #3.',
          },
        ]);
      }
    } catch {
      setLiveComments([
        {
          id: 'c_fallback',
          author: ticket.githubAssignee,
          createdAt: new Date().toISOString(),
          body: ticket.lastCommentSummary || 'Sincronizado com o repositório.',
        },
      ]);
    } finally {
      setLoadingComments(false);
    }
  };

  if (!isOperatorLoggedIn) {
    return (
      <LoginScreen
        teamMembers={teamMembers}
        globalAtendenteRules={globalAtendenteRules}
        onLoginSuccess={(member) => {
          handleSelectOperator(member.id);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-30">
        {/* Zone 1: Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveNav('chamados');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
        >
          ChronoDesk
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveNav('chamados')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeNav === 'chamados'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Chamados & Quadro
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('empresas')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeNav === 'empresas'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Clientes / Empresas
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('equipe')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeNav === 'equipe'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Cadastro de Usuários
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('auditoria')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeNav === 'auditoria'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Auditoria
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('dashboard')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeNav === 'dashboard'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('relatorios_horas')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
              activeNav === 'relatorios_horas'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <span>Relatórios de Horas</span>
            {techLimitAlerts.length > 0 && (
              <span
                className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-rose-600 text-white rounded"
                title={`${techLimitAlerts.length} empresa(s) acima do limite de técnicos`}
              >
                ! {techLimitAlerts.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('config')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeNav === 'config'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Config
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handlePullFromGitHubBoard}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Sincronizar GitHub
          </button>
        </div>
      </header>

      {/* Workspace Sub-Toolbar */}
      <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <Database className="w-3.5 h-3.5 text-slate-700" />
          <span className="font-medium text-slate-800">
            Espelho Bidirecional: GitHub Project #3 (@felipeolio) · Governança ZDT · Neon.com Serverless Postgres
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {neonConfigured
              ? 'Neon.com conectado (NEON_DATABASE_URL ativo)'
              : 'Neon.com pronto (Veja Migrations e Tutorial na aba Config)'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 4-Theme Selector: Atual | GIT | ZDT | Full Dark */}
          <div
            role="group"
            aria-label="Seletor de Tema Visual"
            className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded-md p-0.5"
          >
            <button
              type="button"
              onClick={() => setAppTheme('atual')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                appTheme === 'atual'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tema Atual (Padrão ChronoDesk)"
            >
              <span>Atual</span>
            </button>

            <button
              type="button"
              onClick={() => setAppTheme('git')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                appTheme === 'git'
                  ? 'bg-[#238636] text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tema GIT (Cores oficiais Git #F05032 & GitHub Primer #0D1117 / #238636)"
            >
              <span>GIT</span>
            </button>

            <button
              type="button"
              onClick={() => setAppTheme('zdt')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                appTheme === 'zdt'
                  ? 'bg-[#0052FF] text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tema ZDT (Cores oficiais da marca ZDT: Azul #0052FF, Ciano #00E5E5 e Branco)"
            >
              <img
                src="/assets/aistudio/image_8bdd76b7.png"
                alt="Logo ZDT"
                referrerPolicy="no-referrer"
                className="w-3.5 h-3.5 rounded-xs object-cover shrink-0"
              />
              <span>ZDT</span>
            </button>

            <button
              type="button"
              onClick={() => setAppTheme('dark')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                appTheme === 'dark'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tema Full Dark (Obsidian High-Contrast)"
            >
              <span>Full Dark</span>
            </button>
          </div>

          <span aria-hidden="true">·</span>

          {activeNav === 'chamados' && (
            <>
              <div className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('board')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    viewMode === 'board'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Quadro Kanban (8 Colunas)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Tabela</span>
                </button>
              </div>
              <span aria-hidden="true">·</span>
            </>
          )}
          <button
            type="button"
            onClick={() => setIsSyncModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-slate-700 hover:text-slate-900 font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Webhook className="w-3.5 h-3.5" />
            <span>Repositórios & Webhook</span>
          </button>
          {/* Quick Active User / Role Switcher in Sub-Toolbar */}
          <div className="inline-flex items-center gap-2">
            <span className="text-slate-500 font-medium whitespace-nowrap">Usuário:</span>
            <div className="w-56">
              <Select value={currentOperator.id} onValueChange={handleSelectOperator}>
                <SelectTrigger
                  aria-label="Alternar usuário logado"
                  className="h-7 text-xs bg-white border-slate-300"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {(m.accessRole || 'atendente') === 'admin' ? '[Admin] ' : '[Atendente] '}
                      {m.name} (@{m.githubHandle})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              type="button"
              onClick={handleLogoutOperator}
              title="Sair da sessão atual e abrir a Tela de Login"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span>Trocar Login</span>
            </button>
          </div>
          <span aria-hidden="true">·</span>
          {user ? (
            <button
              type="button"
              onClick={() => signOutUser()}
              className="inline-flex items-center gap-1.5 text-slate-700 hover:text-rose-700 font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair ({user.displayName || 'Operador'})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => signInWithGoogle()}
              className="inline-flex items-center gap-1.5 font-semibold text-sky-700 hover:text-sky-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Conectar Conta Google</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 space-y-6">
        {statusBanner && (
          <div className="px-4 py-3 bg-white border border-slate-300 rounded-lg flex items-center justify-between gap-4 text-xs text-slate-800">
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-slate-500 hover:text-slate-900 font-medium cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Global Alert Banner when any company has more technicians than its configured limit (default > 2) */}
        {techLimitAlerts.length > 0 && activeNav !== 'relatorios_horas' && (
          <div
            role="alert"
            className="px-4 py-3.5 bg-amber-50 border border-amber-300 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">
                  Alerta de Alocação de Técnicos por Empresa:
                </span>{' '}
                {techLimitAlerts.map((al, idx) => (
                  <span key={al.companyId}>
                    {idx > 0 && ' · '}
                    <strong>{al.companyCode}</strong> possui{' '}
                    <strong>
                      {al.currentCount} técnicos (
                      {al.technicians.map((t) => `@${t.githubHandle}`).join(', ')})
                    </strong>{' '}
                    — acima do limite parametrizado de {al.maxAllowed} técnicos!
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveNav('relatorios_horas')}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Ver Relatório de Horas & Técnicos
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('config')}
                className="px-3 py-1.5 text-xs font-semibold text-amber-950 bg-amber-200/80 hover:bg-amber-300/80 rounded-lg transition-colors cursor-pointer"
              >
                Personalizar Limite (Config)
              </button>
            </div>
          </div>
        )}

        {activeNav === 'chamados' && (
          <div className="space-y-6">
            {/* Active Ticket Cockpit */}
            {activeTicket && (() => {
              const cockpitPerm = checkCanStartTimerOnTicket(activeTicket);
              return (
                <ActiveTicketCockpit
                  ticket={activeTicket}
                  currentColumnName={
                    boardCards.find((c) => c.issueNumber === activeTicket.issueNumber)
                      ?.statusColumn ||
                    (activeTicket.status === 'encerrado'
                      ? 'Concluído'
                      : activeTicket.status === 'em_atendimento'
                      ? 'Em andamento'
                      : 'Pronto para execução')
                  }
                  companies={companies}
                  teamMembers={teamMembers}
                  busyAction={busyAction}
                  sessionNote={sessionNote}
                  onChangeSessionNote={setSessionNote}
                  onStartOrResume={handleStartOrResumeTicket}
                  onPause={handlePauseTicket}
                  onCloseTicket={handleCloseTicket}
                  onReopenTicket={handleReopenTicket}
                  onFetchGitHubComments={handleFetchGitHubComments}
                  liveComments={liveComments}
                  loadingComments={loadingComments}
                  issueHistory={issueHistoryByNumber[activeTicket.issueNumber] || []}
                  onConfirmCommentOrClose={async (params) => {
                    await handleConfirmCommentOrCloseIssue(activeTicket.issueNumber, params);
                  }}
                  canStartTimer={cockpitPerm.allowed}
                  startTimerBlockedReason={cockpitPerm.reason}
                  onOpenCardDetail={() => {
                    setViewMode('board');
                    setOpenCardModalIssueNumber(activeTicket.issueNumber);
                  }}
                />
              );
            })()}

            {/* Quick Global Search & Technician Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-72">
                  <Select value={companyFilter} onValueChange={setCompanyFilter}>
                    <SelectTrigger
                      aria-label="Filtrar por cliente"
                      className="w-full bg-white"
                    >
                      <SelectValue placeholder="Filtrar por cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">
                        Todos os Clientes (Tutora, AMPM, GoCase, Braveo, MDR)
                      </SelectItem>
                      {PROJECT_CLIENTES.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          Cliente: {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Technician Filter (Defaults to My Cards for Atendente on login, switchable to All Technicians if allowed) */}
                <div className="w-72">
                  <Select
                    value={technicianFilter}
                    disabled={!effectiveAllowViewAllTechnicians}
                    onValueChange={(val) => {
                      if (!effectiveAllowViewAllTechnicians) {
                        setTechnicianFilter(currentOperator.githubHandle);
                        return;
                      }
                      setTechnicianFilter(val);
                    }}
                  >
                    <SelectTrigger
                      aria-label="Filtrar por técnico"
                      className="w-full bg-white"
                      title={
                        !effectiveAllowViewAllTechnicians
                          ? 'Permissão para filtrar todos os técnicos está inativa para Atendentes'
                          : 'Filtrar por Técnico / Atendente'
                      }
                    >
                      <SelectValue placeholder="Filtrar por técnico" />
                    </SelectTrigger>
                    <SelectContent>
                      {effectiveAllowViewAllTechnicians && (
                        <SelectItem value="ALL">
                          Todos os Técnicos ({teamMembers.length})
                        </SelectItem>
                      )}
                      {teamMembers.map((m) => (
                        <SelectItem key={m.id} value={m.githubHandle}>
                          {m.githubHandle.toLowerCase() ===
                          currentOperator.githubHandle.toLowerCase()
                            ? `Meus Cards: @${m.githubHandle} (${m.name})`
                            : `Técnico: @${m.githubHandle} (${m.name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por #issue, cliente, título, usuário (@felipeolio), tag..."
                    className="pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg w-72"
                  />
                </div>
              </div>

              <div className="text-xs text-slate-600 flex items-center gap-2">
                <span>
                  Operador:{' '}
                  <strong className="text-slate-900">
                    {currentOperator.name} (@{currentOperator.githubHandle})
                  </strong>{' '}
                  · Perfil:{' '}
                  <strong className="text-slate-900">
                    {isCurrentOperatorAdmin ? 'Admin (Acesso Full)' : 'Atendente'}
                  </strong>
                </span>
                {!isCurrentOperatorAdmin &&
                  technicianFilter.toLowerCase() ===
                    currentOperator.githubHandle.toLowerCase() &&
                  effectiveAllowViewAllTechnicians && (
                    <button
                      type="button"
                      onClick={() => setTechnicianFilter('ALL')}
                      className="text-xs font-semibold text-slate-900 underline underline-offset-2 cursor-pointer"
                    >
                      Ver Todos os Técnicos
                    </button>
                  )}
              </div>
            </div>

            {viewMode === 'board' ? (
              <KanbanBoardMirror
                cards={visibleBoardCards}
                ticketsByIssueNumber={ticketsByIssueNumber}
                activeIssueNumber={activeTicket?.issueNumber || 0}
                busyAction={busyAction}
                projectMeta={projectMeta}
                syncingBoard={syncingBoard}
                mirroringToPersonal={mirroringToPersonal}
                autoSyncEnabled={autoSyncEnabled}
                onToggleAutoSync={() => setAutoSyncEnabled((v) => !v)}
                onPullFromGitHubBoard={handlePullFromGitHubBoard}
                onMirrorOpenIssuesToProject3={handleMirrorOpenIssuesToProject3}
                onSelectCard={(card) => {
                  handleSelectIssueCard(card.issueNumber);
                }}
                onStartOrResumeCard={async (card) => {
                  const t =
                    ticketsByIssueNumber[card.issueNumber] || {
                      id: `gh_card_${card.issueNumber}`,
                      ownerId: user?.uid || 'demo',
                      ...convertCardToTicketPayload(card),
                    };
                  await handleStartOrResumeTicket(t);
                }}
                onPauseCard={async (card, elapsed) => {
                  const t =
                    ticketsByIssueNumber[card.issueNumber] || {
                      id: `gh_card_${card.issueNumber}`,
                      ownerId: user?.uid || 'demo',
                      ...convertCardToTicketPayload(card),
                    };
                  await handlePauseTicket(t, elapsed);
                }}
                onCloseCard={async (card, elapsed) => {
                  const t =
                    ticketsByIssueNumber[card.issueNumber] || {
                      id: `gh_card_${card.issueNumber}`,
                      ownerId: user?.uid || 'demo',
                      ...convertCardToTicketPayload(card),
                    };
                  await handleCloseTicket(t, elapsed);
                }}
                onMoveCardToStatusColumn={handleMoveCardToStatusColumn}
                onSaveFullCardSync={handleSaveFullCardSync}
                onCreateFullCardOnGitHub={handleCreateFullCardOnGitHub}
                issueHistoryByNumber={issueHistoryByNumber}
                onConfirmCommentOrCloseCard={async (card, params) => {
                  await handleConfirmCommentOrCloseIssue(card.issueNumber, params);
                }}
                externalAssigneeFilter={technicianFilter}
                onChangeExternalAssigneeFilter={setTechnicianFilter}
                canViewAllTechnicians={effectiveAllowViewAllTechnicians}
                currentOperatorHandle={currentOperator.githubHandle}
                canStartTimerOnCard={checkCanStartTimerOnCard}
                externalOpenIssueNumber={openCardModalIssueNumber}
                onClearExternalOpenIssue={() => setOpenCardModalIssueNumber(null)}
              />
            ) : (
              /* Table View */
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                    {(
                      [
                        { id: 'todos', label: 'Todos' },
                        { id: 'aberto', label: 'Backlog / Pronto' },
                        { id: 'em_atendimento', label: 'Em Andamento' },
                        { id: 'pausado', label: 'Aguardando / Impedimento / Homologação' },
                        { id: 'encerrado', label: 'Concluídos' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setTicketStatusFilter(tab.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          ticketStatusFilter === tab.id
                            ? 'bg-white text-slate-900 shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-4">Card / Issue</th>
                          <th className="py-3 px-4">Cliente</th>
                          <th className="py-3 px-4">Usuário (Assignee)</th>
                          <th className="py-3 px-4">Tags · Esteira · Tipo</th>
                          <th className="py-3 px-4">Coluna GitHub</th>
                          <th className="py-3 px-4 text-right">Horas Trabalhadas</th>
                          <th className="py-3 px-4 text-right">Controle Rápido</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {filteredTickets.map((t) => {
                          const isSelected = activeTicket?.issueNumber === t.issueNumber;
                          const card = boardCards.find((c) => c.issueNumber === t.issueNumber);
                          return (
                            <tr
                              key={t.id}
                              onClick={() => {
                                handleSelectIssueCard(t.issueNumber);
                              }}
                              className={`transition-colors cursor-pointer ${
                                isSelected ? 'bg-slate-100/90' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-3.5 px-4">
                                <div className="flex items-baseline gap-2">
                                  <span className="font-mono font-bold text-slate-900">
                                    #{t.issueNumber}
                                  </span>
                                  <span className="font-medium text-slate-900 line-clamp-1">
                                    {t.title}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 font-mono">
                                  {t.githubRepo} · Prioridade {card?.priority || t.priority}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                                {card?.cliente || t.companyName}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="text-slate-900 font-medium">{t.assigneeName}</div>
                                <div className="text-xs text-slate-500 font-mono">
                                  @{t.githubAssignee}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs">
                                <div className="truncate">{t.labelsSummary}</div>
                                {card?.esteira && (
                                  <div className="text-slate-400 truncate">{card.esteira}</div>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-xs font-semibold whitespace-nowrap">
                                <span className="text-slate-800">
                                  {card?.statusColumn || t.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs font-bold text-slate-900 whitespace-nowrap">
                                ⏱ {formatDurationHms(t.totalSecondsWorked)}
                              </td>
                              <td
                                className="py-3.5 px-4 text-right whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleSelectIssueCard(t.issueNumber);
                                      setViewMode('board');
                                      setOpenCardModalIssueNumber(t.issueNumber);
                                    }}
                                    title="Abrir card e visualizar todo o conteúdo do GitHub"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Abrir Card</span>
                                  </button>
                                  {t.status !== 'encerrado' &&
                                    (t.status === 'em_atendimento' ? (
                                      <button
                                        type="button"
                                        disabled={busyAction}
                                        onClick={() => handlePauseTicket(t, 0)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-900 bg-amber-300 hover:bg-amber-400 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                                      >
                                        <Pause className="w-3 h-3" />
                                        <span>Pausar</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={busyAction || !checkCanStartTimerOnTicket(t)}
                                        onClick={() => {
                                          handleStartOrResumeTicket(t);
                                        }}
                                        title={
                                          checkCanStartTimerOnTicket(t)
                                            ? 'Iniciar contagem de atendimento'
                                            : `Permissão restrita: apenas @${t.githubAssignee || 'sem-atribuicao'} ou Admin pode iniciar este timer`
                                        }
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 ${
                                          checkCanStartTimerOnTicket(t)
                                            ? 'text-white bg-emerald-600 hover:bg-emerald-500 cursor-pointer'
                                            : 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed'
                                        }`}
                                      >
                                        <Play className="w-3 h-3" />
                                        <span>Iniciar</span>
                                      </button>
                                    ))}
                                  {t.status !== 'encerrado' && (
                                    <button
                                      type="button"
                                      disabled={busyAction}
                                      onClick={() => handleCloseTicket(t, 0)}
                                      title="Encerrar apenas o timer de atendimento (mantém o card aberto)"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Encerrar</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {activeNav === 'empresas' && (
          <CompaniesView
            companies={companies}
            tickets={tickets}
            sessions={sessions}
            boardCards={boardCards}
            teamMembers={teamMembers}
            workHoursSettings={workHoursSettings}
            onOpenConfigTab={() => setActiveNav('config')}
            syncingCompanyId={syncingCompanyId}
            onCreateCompany={async (data) => {
              const ownerUid = user?.uid || 'default';
              await createCompanyRecord(ownerUid, data);
              await createAuditLogRecord(ownerUid, {
                eventType: 'empresa_cadastrada',
                actorName: user?.displayName || 'Operador',
                targetLabel: `${data.code} · ${data.name}`,
                details: `Cliente ${data.code} cadastrado com repositório ${data.githubRepo}.`,
                origin: 'Operador Web',
              });
              setLocalCompanies((prev) => [
                ...prev,
                { ...data, id: `comp_${Date.now()}`, ownerId: ownerUid },
              ]);
              await refreshNeonWorkspaceState();
              setStatusBanner(`Cliente ${data.code} cadastrado no Neon.com com sucesso.`);
            }}
            onQuickSyncCompany={async (company) => {
              setSyncingCompanyId(company.id);
              try {
                await handlePullFromGitHubBoard();
              } finally {
                setSyncingCompanyId(null);
              }
            }}
          />
        )}

        {activeNav === 'equipe' && (
          <TeamView
            teamMembers={teamMembers}
            tickets={tickets}
            currentOperator={currentOperator}
            globalAtendenteRules={globalAtendenteRules}
            onSelectOperator={handleSelectOperator}
            onUpdateGlobalAtendenteRules={handleUpdateGlobalAtendenteRules}
            onCreateMember={async (data) => {
              const ownerUid = user?.uid || 'default';
              const newId = await createTeamMemberRecord(ownerUid, data);
              setLocalTeam((prev) => [
                ...prev,
                { ...data, id: newId || `mem_${Date.now()}`, ownerId: ownerUid },
              ]);
              await refreshNeonWorkspaceState();
              setStatusBanner(
                `Usuário ${data.name} (@${data.githubHandle} · Perfil ${
                  data.accessRole === 'admin' ? 'Admin' : 'Atendente'
                }) cadastrado com sucesso!`
              );
            }}
            onChangeMemberStatus={async (memberId, status) => {
              await updateTeamMemberStatus(memberId, status);
              setLocalTeam((prev) =>
                prev.map((m) => (m.id === memberId ? { ...m, status } : m))
              );
              await refreshNeonWorkspaceState();
            }}
            onChangeMemberPermissions={async (memberId, updates) => {
              await updateTeamMemberPermissions(memberId, updates);
              setLocalTeam((prev) =>
                prev.map((m) => (m.id === memberId ? { ...m, ...updates } : m))
              );
              setDbTeam((prev) =>
                prev.map((m) => (m.id === memberId ? { ...m, ...updates } : m))
              );
              await refreshNeonWorkspaceState();
              setStatusBanner('Cadastro e permissões do usuário atualizados com sucesso!');
            }}
            onApplyProfilePermissionsToAllAtendentes={async (rules) => {
              const atendentes = teamMembers.filter(
                (m) => (m.accessRole || 'atendente') === 'atendente'
              );
              for (const at of atendentes) {
                await updateTeamMemberPermissions(at.id, {
                  restrictTimerToAssignedOnly: rules.restrictTimerToAssignedOnly,
                  defaultFilterMyCardsOnLogin: rules.defaultFilterMyCardsOnLogin,
                  allowViewAllTechniciansFilter: rules.allowViewAllTechniciansFilter,
                });
              }
              await refreshNeonWorkspaceState();
              setStatusBanner(
                `Permissões do perfil Atendente aplicadas a ${atendentes.length} usuários!`
              );
            }}
          />
        )}

        {activeNav === 'auditoria' && (
          <DatabaseAuditView sessions={sessions} auditLogs={auditLogs} />
        )}

        {activeNav === 'dashboard' && (
          <DashboardReportsView
            companies={companies}
            tickets={tickets}
            sessions={sessions}
            reports={reports}
            onGenerateReport={async (params) => {
              const actor = user?.displayName || 'Felipe Olio';
              const ownerUid = user?.uid || 'default';
              await createReportRecord(ownerUid, {
                ...params,
                generatedBy: actor,
              });
              await createAuditLogRecord(ownerUid, {
                eventType: 'relatorio_gerado',
                actorName: actor,
                targetLabel: params.title,
                details: `Relatório emitido (${params.totalTickets} chamados, ${formatDurationHms(params.totalSeconds)}).`,
                origin: 'Operador Web',
              });
              setLocalReports((prev) => [
                {
                  id: `rep_${Date.now()}`,
                  ...params,
                  generatedBy: actor,
                  ownerId: ownerUid,
                  createdAt: new Date().toISOString(),
                },
                ...prev,
              ]);
              await refreshNeonWorkspaceState();
              setStatusBanner(`Relatório "${params.title}" salvo no banco de dados Neon.`);
            }}
            onDeleteReport={async (reportId) => {
              await deleteReportRecord(reportId);
              setLocalReports((prev) => prev.filter((r) => r.id !== reportId));
              await refreshNeonWorkspaceState();
            }}
          />
        )}

        {activeNav === 'relatorios_horas' && (
          <HoursReportsView
            companies={companies}
            tickets={tickets}
            sessions={sessions}
            boardCards={boardCards}
            teamMembers={teamMembers}
            workHoursSettings={workHoursSettings}
            onChangeWorkHoursSettings={handleUpdateWorkHoursSettings}
            onOpenConfigTab={() => setActiveNav('config')}
          />
        )}

        {activeNav === 'config' && (
          <section className="space-y-5" aria-label="Configurações do Espelho GitHub Projects">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="font-mono font-bold text-slate-900">
                      users/felipeolio/projects/3 (Chamados)
                    </span>
                    <span aria-hidden="true">↔</span>
                    <span className="font-mono font-semibold text-slate-800">
                      orgs/zdttech-copilot/projects/4 (Governança ZDT)
                    </span>
                    <span aria-hidden="true">·</span>
                    <a
                      href="https://github.com/users/felipeolio/projects/3"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-slate-800 hover:text-slate-950 font-semibold underline underline-offset-2"
                    >
                      <span>Abrir Project #3</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <span aria-hidden="true">·</span>
                    <a
                      href="https://github.com/orgs/zdttech-copilot/projects/4"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-950 underline underline-offset-2"
                    >
                      <span>Abrir Project #4</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 font-display">
                    Espelho Bidirecional do Quadro GitHub — 8 Colunas, Clientes, Esteiras, Usuários e Tags
                  </h2>
                  <p className="text-xs text-slate-500">
                    {projectMeta.connected
                      ? `Conectado em tempo real via GitHub GraphQL API (${boardCards.length} cards carregados · ${projectMeta.personalProjectItemCount} em Project #3 · ${projectMeta.orgProjectItemCount} em Governança ZDT).`
                      : 'Sincronizando estrutura e cards do GitHub Project...'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {projectMeta.personalProjectItemCount < 10 && (
                    <button
                      type="button"
                      disabled={mirroringToPersonal || syncingBoard}
                      onClick={handleMirrorOpenIssuesToProject3}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      title="Copia e vincula as Issues abertas do repositório zdttech-copilot/governanca-zdt diretamente para dentro do seu quadro pessoal users/felipeolio/projects/3"
                    >
                      <GitFork className={`w-3.5 h-3.5 ${mirroringToPersonal ? 'animate-spin' : ''}`} />
                      <span>
                        {mirroringToPersonal
                          ? 'Espelhando no Project #3...'
                          : 'Vincular Cards ao Project #3'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setAutoSyncEnabled((v) => !v)}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      autoSyncEnabled
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {autoSyncEnabled ? 'Auto-Sync GitHub Ativo (10s + Foco)' : 'Ativar Auto-Sync (10s)'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSyncModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Novo Card no GitHub</span>
                  </button>

                  <button
                    type="button"
                    disabled={syncingBoard}
                    onClick={handlePullFromGitHubBoard}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingBoard ? 'animate-spin' : ''}`} />
                    <span>{syncingBoard ? 'Sincronizando GitHub...' : 'Sincronizar Agora'}</span>
                  </button>
                </div>
              </div>
            </div>

            <WorkHoursConfigPanel
              companies={companies}
              tickets={tickets}
              sessions={sessions}
              boardCards={boardCards}
              teamMembers={teamMembers}
              settings={workHoursSettings}
              onChangeSettings={handleUpdateWorkHoursSettings}
              onSaveFeedback={(msg) => setStatusBanner(msg)}
            />

            <NeonMigrationsPanel
              onRunMigrations={handleRunNeonMigrations}
              runningMigration={runningNeonMigration}
            />
          </section>
        )}
      </main>

      <GitHubSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        companies={companies}
        teamMembers={teamMembers}
        onSyncGitHubRepo={handleSyncGitHubRepo}
        onTriggerWebhookEvent={handleTriggerWebhookEvent}
        onCreateManualTicket={async (params) => {
          const matchedCliente =
            PROJECT_CLIENTES.find(
              (c) =>
                c.name.toLowerCase() ===
                (companies.find((comp) => comp.id === params.companyId)?.code || '').toLowerCase()
            ) || PROJECT_CLIENTES[0];
          await handleCreateFullCardOnGitHub({
            title: params.title,
            body: params.description,
            assignees: ['felipeolio'],
            labels: params.labelsSummary
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            statusOptionId: PROJECT_STATUS_COLUMNS[0].id,
            clienteOptionId: matchedCliente.id,
            esteiraOptionId: PROJECT_ESTEIRAS[0].id,
            tipoDemandaOptionId: PROJECT_TIPOS_DEMANDA[1].id,
            impedimentoOptionId: '',
            priorityOptionId: PROJECT_PRIORITIES[1].id,
            sizeOptionId: PROJECT_SIZES[2].id,
            effortOptionId: PROJECT_EFFORTS[1].id,
            estimate: 2,
            terminoPlanejado: '',
            proximoFollowUp: '',
          });
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ChronoDeskWorkspace />
    </ErrorBoundary>
  );
}
