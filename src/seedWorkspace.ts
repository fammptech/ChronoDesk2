import {
  createCompanyRecord,
  createTeamMemberRecord,
  createTicketRecord,
  createAttendanceSessionRecord,
  createAuditLogRecord,
  createReportRecord,
} from './firebase';

export async function seedInitialWorkspaceData(ownerId: string): Promise<void> {
  // 1. Create Real ZDT Clients (Empresas do Project #3 / Governança ZDT)
  const tutoraId = await createCompanyRecord(
    ownerId,
    {
      name: 'Tutora Educação & Tecnologia',
      code: 'Tutora',
      githubRepo: 'zdttech-copilot/governanca-zdt',
      slaHours: 4,
      hourlyRate: 260,
      contractHours: 120,
      status: 'active',
    },
    `comp_tutora_${ownerId.slice(0, 10)}`
  );

  const ampmId = await createCompanyRecord(
    ownerId,
    {
      name: 'AMPM Conveniência & Operações',
      code: 'AMPM',
      githubRepo: 'zdttech-copilot/governanca-zdt',
      slaHours: 4,
      hourlyRate: 280,
      contractHours: 160,
      status: 'active',
    },
    `comp_ampm_${ownerId.slice(0, 10)}`
  );

  await createCompanyRecord(
    ownerId,
    {
      name: 'GoCase Comércio & Digital',
      code: 'GoCase',
      githubRepo: 'zdttech-copilot/governanca-zdt',
      slaHours: 6,
      hourlyRate: 250,
      contractHours: 80,
      status: 'active',
    },
    `comp_gocase_${ownerId.slice(0, 10)}`
  );

  await createCompanyRecord(
    ownerId,
    {
      name: 'Braveo Soluções Corporativas',
      code: 'Braveo',
      githubRepo: 'zdttech-copilot/governanca-zdt',
      slaHours: 4,
      hourlyRate: 270,
      contractHours: 100,
      status: 'active',
    },
    `comp_braveo_${ownerId.slice(0, 10)}`
  );

  await createCompanyRecord(
    ownerId,
    {
      name: 'MDR Advocacia & Governança',
      code: 'MDR',
      githubRepo: 'zdttech-copilot/governanca-zdt',
      slaHours: 6,
      hourlyRate: 250,
      contractHours: 90,
      status: 'active',
    },
    `comp_mdr_${ownerId.slice(0, 10)}`
  );

  // 2. Create Real ZDT Team Members (Equipe / Assignees do GitHub)
  await createTeamMemberRecord(
    ownerId,
    {
      name: 'Felipe Olio',
      roleTitle: 'Gestão / Governança & Sustentação ZDT',
      githubHandle: 'felipeolio',
      specialty: 'Governança ZDT, N1/N2 & Projetos',
      hourlyCost: 165,
      status: 'em_atendimento',
    },
    `mem_felipe_${ownerId.slice(0, 10)}`
  );

  await createTeamMemberRecord(
    ownerId,
    {
      name: 'Bertrand Dantas Bezerra',
      roleTitle: 'Especialista Sustentação & Projetos',
      githubHandle: 'Bertrand-ZDT',
      specialty: 'TOTVS, Parametrização & Sustentação',
      hourlyCost: 160,
      status: 'disponivel',
    },
    `mem_bertrand_${ownerId.slice(0, 10)}`
  );

  await createTeamMemberRecord(
    ownerId,
    {
      name: 'Caio Rafael',
      roleTitle: 'Consultor Técnico ZDT',
      githubHandle: 'caiorafaelzdt',
      specialty: 'Desenvolvimento & N1/Atendimento',
      hourlyCost: 150,
      status: 'disponivel',
    },
    `mem_caior_${ownerId.slice(0, 10)}`
  );

  await createTeamMemberRecord(
    ownerId,
    {
      name: 'Paulo Pragana',
      roleTitle: 'Consultor Sênior ZDT',
      githubHandle: 'pragana12',
      specialty: 'Sustentação, Bug/Correção & Releases',
      hourlyCost: 160,
      status: 'disponivel',
    },
    `mem_pragana_${ownerId.slice(0, 10)}`
  );

  await createTeamMemberRecord(
    ownerId,
    {
      name: 'Jeferson Lima',
      roleTitle: 'Analista de Sustentação & Desenvolvimento',
      githubHandle: 'Jeferson993',
      specialty: 'Análise, Customização & Suporte',
      hourlyCost: 145,
      status: 'disponivel',
    },
    `mem_jeferson_${ownerId.slice(0, 10)}`
  );

  // 3. Initial Mirrored Ticket & Session
  const nowMs = Date.now();
  const ticketId = await createTicketRecord(
    ownerId,
    {
      issueNumber: 69,
      title: 'AMPM — #314417 — Atendimento e Sustentação Governança ZDT',
      description:
        'Chamado sincronizado diretamente do quadro GitHub Project #3 (users/felipeolio/projects/3) e repositório zdttech-copilot/governanca-zdt.',
      companyId: ampmId || tutoraId,
      companyName: 'AMPM',
      assigneeName: 'Felipe Olio',
      githubAssignee: 'felipeolio',
      githubRepo: 'zdttech-copilot/governanca-zdt',
      githubIssueUrl: 'https://github.com/zdttech-copilot/governanca-zdt/issues/69',
      githubState: 'open',
      status: 'pausado',
      priority: 'alta',
      labelsSummary: 'task, ação-pendente',
      commentsCount: 2,
      lastCommentSummary: 'Sincronizado em tempo real com GitHub Project #3 e Governança ZDT.',
      totalSecondsWorked: 9105,
      activeSessionStartedAtMs: 0,
    },
    `tkt_69_${ownerId.slice(0, 10)}`
  );

  await createAttendanceSessionRecord(ownerId, {
    ticketId,
    issueNumber: 69,
    ticketTitle: 'AMPM — #314417 — Atendimento e Sustentação Governança ZDT',
    companyName: 'AMPM',
    agentName: 'Felipe Olio',
    startedAtIso: new Date(nowMs - 9105 * 1000).toISOString(),
    endedAtIso: new Date(nowMs).toISOString(),
    durationSeconds: 9105,
    notes: 'Sessão de atendimento sincronizada com o campo Horas Gastas do GitHub Project.',
    sessionStatus: 'em_andamento',
  });

  await createAuditLogRecord(ownerId, {
    eventType: 'sync_api',
    actorName: 'felipeolio',
    targetLabel: 'Project #3 · Governança ZDT',
    details: 'Quadro espelhado conectado com 8 colunas, clientes ZDT, esteiras e usuários.',
    origin: 'GitHub REST API',
  });

  await createReportRecord(ownerId, {
    title: 'Fechamento de Horas — Governança ZDT (Tutora, AMPM, GoCase, Braveo, MDR)',
    companyFilter: 'Todos os Clientes ZDT',
    periodLabel: 'Outubro / 2026',
    totalTickets: 1,
    totalSeconds: 9105,
    totalBilledAmount: 708.16,
    generatedBy: 'Felipe Olio',
  });
}
