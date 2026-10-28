import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import {
  PROJECT_BOARD_TARGETS,
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
} from './src/project3Schema';
import { NEON_MIGRATION_0001_SQL } from './src/neonMigrations';

dotenv.config({ override: true });

// =============================================================================
// Neon.com Serverless PostgreSQL Driver (HTTP SQL over Fetch + Local Persistence)
// =============================================================================
const NEON_LOCAL_CACHE_PATH = path.join(process.cwd(), '.neon-local-store.json');

interface NeonLocalStoreData {
  companies: Array<Record<string, any>>;
  teamMembers: Array<Record<string, any>>;
  tickets: Array<Record<string, any>>;
  sessions: Array<Record<string, any>>;
  auditLogs: Array<Record<string, any>>;
  reports: Array<Record<string, any>>;
}

function getDefaultNeonStoreData(): NeonLocalStoreData {
  return {
    companies: [
      {
        id: 'comp_tutora',
        name: 'Tutora Educação & Tecnologia',
        code: 'Tutora',
        githubRepo: 'zdttech-copilot/governanca-zdt',
        slaHours: 4,
        hourlyRate: 260,
        contractHours: 120,
        status: 'active',
        ownerId: 'default',
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
        ownerId: 'default',
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
        ownerId: 'default',
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
        ownerId: 'default',
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
        ownerId: 'default',
      },
    ],
    teamMembers: PROJECT_ZDT_USERS.slice(0, 9).map((u, idx) => ({
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
      ownerId: 'default',
    })),
    tickets: [],
    sessions: [],
    auditLogs: [],
    reports: [],
  };
}

function loadNeonStore(): NeonLocalStoreData {
  try {
    if (fs.existsSync(NEON_LOCAL_CACHE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(NEON_LOCAL_CACHE_PATH, 'utf-8'));
      const def = getDefaultNeonStoreData();
      return {
        companies: Array.isArray(parsed.companies) && parsed.companies.length > 0 ? parsed.companies : def.companies,
        teamMembers: Array.isArray(parsed.teamMembers) && parsed.teamMembers.length > 0 ? parsed.teamMembers : def.teamMembers,
        tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      };
    }
  } catch (err) {
    console.error('Failed to read local Neon store:', err);
  }
  return getDefaultNeonStoreData();
}

let neonStore: NeonLocalStoreData = loadNeonStore();

function saveNeonStore() {
  try {
    fs.writeFileSync(NEON_LOCAL_CACHE_PATH, JSON.stringify(neonStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist local Neon store:', err);
  }
}

async function executeNeonSql(query: string, params: unknown[] = []): Promise<Array<Record<string, any>> | null> {
  const connStr = (process.env.NEON_DATABASE_URL || '').trim();
  if (!connStr) {
    return null;
  }
  try {
    const parsedUrl = new URL(connStr);
    const endpointUrl = `https://${parsedUrl.hostname}/sql`;
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Neon-Connection-String': connStr,
      },
      body: JSON.stringify({ query, params }),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { rows?: Array<Record<string, any>> };
    return Array.isArray(data.rows) ? data.rows : [];
  } catch (err) {
    console.error('Neon HTTP SQL query error:', err);
    return null;
  }
}


let runtimeGitHubTokenOverride = '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';

function getActiveGitHubToken(reqToken?: string): string {
  if (reqToken && reqToken.trim()) return reqToken.trim();
  if (runtimeGitHubTokenOverride) return runtimeGitHubTokenOverride;
  return (process.env.GITHUB_TOKEN || '').trim();
}

function buildGitHubHeaders(customToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ChronoDesk-ZDT-Mirror/3.0',
  };
  const token = getActiveGitHubToken(customToken);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function runGitHubGraphQL(
  query: string,
  variables: Record<string, unknown> = {},
  customToken?: string
) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      ...buildGitHubHeaders(customToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, any>;
  } catch {
    return {
      errors: [{ message: `GitHub API returned non-JSON status ${response.status}` }],
    };
  }
}

function parseFieldValuesIntoCard(
  itemNodeId: string,
  content: Record<string, any>,
  fieldNodes: Array<Record<string, any>>,
  fallbackIndex: number
): MirroredBoardCard {
  const isDraft = !content.number;
  const issueNum = Number(content.number) || 3000 + fallbackIndex;

  let statusColumn = 'Backlog';
  let statusOptionId = 'f75ad846';
  let hasExplicitStatus = false;
  let cliente = '';
  let clienteOptionId = '';
  let esteira = '';
  let esteiraOptionId = '';
  let tipoDemanda = '';
  let tipoDemandaOptionId = '';
  let impedimento = '';
  let impedimentoOptionId = '';
  let priority = '';
  let priorityOptionId = '';
  let size = '';
  let sizeOptionId = '';
  let effort = '';
  let effortOptionId = '';
  let chamado = 'Sim';
  let horasGastas = 0;
  let estimate = 0;
  let startDate = '';
  let targetDate = '';
  let terminoPlanejado = '';
  let proximoFollowUp = '';
  let prioridadesSemanal = '';

  // Sort fieldNodes chronologically by updatedAt so the most recently modified value across projects always wins
  const sortedFieldNodes = [...fieldNodes].sort((a, b) => {
    const tA = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const tB = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return tA - tB;
  });

  for (const fv of sortedFieldNodes) {
    if (!fv || !fv.field || !fv.field.name) continue;
    const fName = String(fv.field.name).trim();

    if (fName === 'Status' && fv.name) {
      statusColumn = String(fv.name);
      statusOptionId = String(fv.optionId || '');
      hasExplicitStatus = true;
    } else if (fName === 'Cliente' && fv.name) {
      cliente = String(fv.name);
      clienteOptionId = String(fv.optionId || '');
    } else if (fName === 'Esteira' && fv.name) {
      esteira = String(fv.name);
      esteiraOptionId = String(fv.optionId || '');
    } else if (fName === 'Tipo de Demanda' && fv.name) {
      tipoDemanda = String(fv.name);
      tipoDemandaOptionId = String(fv.optionId || '');
    } else if (fName.startsWith('Impedimento') && fv.name) {
      impedimento = String(fv.name);
      impedimentoOptionId = String(fv.optionId || '');
    } else if (fName === 'Priority' && fv.name) {
      priority = String(fv.name);
      priorityOptionId = String(fv.optionId || '');
    } else if (fName === 'Size' && fv.name) {
      size = String(fv.name);
      sizeOptionId = String(fv.optionId || '');
    } else if (fName === 'Effort' && fv.name) {
      effort = String(fv.name);
      effortOptionId = String(fv.optionId || '');
    } else if (fName === 'Chamado' && fv.name) {
      chamado = String(fv.name);
    } else if (fName.startsWith('Horas gastas') && typeof fv.number === 'number') {
      horasGastas = Number(fv.number);
    } else if (fName === 'Estimate' && typeof fv.number === 'number') {
      estimate = Number(fv.number);
    } else if (fName === 'Start date' && fv.date) {
      startDate = String(fv.date);
    } else if (fName === 'Target date' && fv.date) {
      targetDate = String(fv.date);
    } else if (fName === 'Término Planejado' && fv.date) {
      terminoPlanejado = String(fv.date);
    } else if (fName === 'Próximo_Follow-up' && fv.date) {
      proximoFollowUp = String(fv.date);
    } else if (fName === 'Prioridades Semanal' && fv.text) {
      prioridadesSemanal = String(fv.text);
    }
  }

  // Only default to Concluído if the issue is CLOSED and has no explicit Status column on the board
  if (content.state === 'CLOSED' && !hasExplicitStatus) {
    statusColumn = 'Concluído';
    statusOptionId = '98236657';
  }

  // Infer cliente from title if not set (e.g., "Tutora — #318740")
  if (!cliente && content.title) {
    const titleLower = String(content.title).toLowerCase();
    for (const c of PROJECT_CLIENTES) {
      if (titleLower.includes(c.name.toLowerCase())) {
        cliente = c.name;
        clienteOptionId = c.id;
        break;
      }
    }
  }

  const assignees = Array.isArray(content.assignees?.nodes)
    ? content.assignees.nodes.map((u: any) => String(u?.login || '')).filter(Boolean)
    : [];

  const labels = Array.isArray(content.labels?.nodes)
    ? content.labels.nodes.map((l: any) => String(l?.name || '')).filter(Boolean)
    : [];

  // If the card was moved on the Kanban board to an active column (not Concluído), treat its board state as OPEN
  const effectiveState: 'OPEN' | 'CLOSED' =
    statusColumn === 'Concluído' ? 'CLOSED' : 'OPEN';

  return {
    itemId: itemNodeId,
    contentId: String(content.id || ''),
    contentType: isDraft ? 'DraftIssue' : 'Issue',
    issueNumber: issueNum,
    title: String(content.title || `Chamado #${issueNum}`),
    body: String(content.body || ''),
    state: effectiveState,
    url: String(content.url || 'https://github.com/users/felipeolio/projects/3'),
    repository: String(content.repository?.nameWithOwner || 'zdttech-copilot/governanca-zdt'),
    assignees,
    labels,
    commentsCount: Number(content.comments?.totalCount) || 0,
    statusColumn,
    statusOptionId,
    cliente,
    clienteOptionId,
    esteira,
    esteiraOptionId,
    tipoDemanda,
    tipoDemandaOptionId,
    impedimento,
    impedimentoOptionId,
    priority,
    priorityOptionId,
    size,
    sizeOptionId,
    effort,
    effortOptionId,
    chamado,
    horasGastas,
    estimate,
    startDate,
    targetDate,
    terminoPlanejado,
    proximoFollowUp,
    prioridadesSemanal,
    updatedAt: String(content.updatedAt || new Date().toISOString()),
  };
}

async function updateSingleSelectField(
  projectId: string,
  itemId: string,
  fieldId: string,
  optionId: string
) {
  if (!fieldId) return;
  if (!optionId) {
    await runGitHubGraphQL(
      `mutation ClearField($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
        clearProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId }) {
          projectV2Item { id }
        }
      }`,
      { projectId, itemId, fieldId }
    );
    return;
  }
  await runGitHubGraphQL(
    `mutation UpdateSelect($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) {
        projectV2Item { id }
      }
    }`,
    { projectId, itemId, fieldId, optionId }
  );
}

async function updateNumberField(
  projectId: string,
  itemId: string,
  fieldId: string,
  numVal: number
) {
  if (!fieldId || isNaN(numVal)) return;
  await runGitHubGraphQL(
    `mutation UpdateNum($projectId: ID!, $itemId: ID!, $fieldId: ID!, $num: Float!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { number: $num }
      }) {
        projectV2Item { id }
      }
    }`,
    { projectId, itemId, fieldId, num: Number(numVal.toFixed(2)) }
  );
}

async function updateDateField(
  projectId: string,
  itemId: string,
  fieldId: string,
  dateStr: string
) {
  if (!fieldId) return;
  if (!dateStr) return;
  await runGitHubGraphQL(
    `mutation UpdateDate($projectId: ID!, $itemId: ID!, $fieldId: ID!, $date: Date!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { date: $date }
      }) {
        projectV2Item { id }
      }
    }`,
    { projectId, itemId, fieldId, date: dateStr }
  );
}

async function updateTextField(
  projectId: string,
  itemId: string,
  fieldId: string,
  textVal: string
) {
  if (!fieldId) return;
  await runGitHubGraphQL(
    `mutation UpdateText($projectId: ID!, $itemId: ID!, $fieldId: ID!, $text: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { text: $text }
      }) {
        projectV2Item { id }
      }
    }`,
    { projectId, itemId, fieldId, text: textVal }
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  app.post('/api/github/token', async (req, res) => {
    const newToken = String(req.body?.token || '').trim();
    if (!newToken) {
      res.status(400).json({ error: 'Token vazio.' });
      return;
    }
    runtimeGitHubTokenOverride = newToken;
    res.json({ ok: true, tokenPrefix: newToken.slice(0, 8) });
  });

  // 1. Fetch full Mirrored Board (supports 'personal_3' -> users/felipeolio/projects/3 and 'org_4' -> orgs/zdttech-copilot/projects/4)
  app.get('/api/github/project-board', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const sourceTarget = req.query.target === 'org_4' ? 'org_4' : 'personal_3';

    const query = `
      query FetchMirroredBoard {
        user(login: "felipeolio") {
          projectV2(number: 3) {
            id
            title
            url
            items(first: 100) {
              totalCount
              nodes {
                id
                updatedAt
                fieldValues(first: 25) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      optionId
                      updatedAt
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                    ... on ProjectV2ItemFieldNumberValue {
                      number
                      updatedAt
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                    ... on ProjectV2ItemFieldDateValue {
                      date
                      updatedAt
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                    ... on ProjectV2ItemFieldTextValue {
                      text
                      updatedAt
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                  }
                }
                content {
                  ... on DraftIssue {
                    id
                    title
                    body
                    updatedAt
                    assignees(first: 5) { nodes { login name } }
                  }
                  ... on Issue {
                    id
                    number
                    title
                    body
                    state
                    url
                    updatedAt
                    repository { nameWithOwner }
                    assignees(first: 5) { nodes { login name } }
                    labels(first: 10) { nodes { name } }
                    comments { totalCount }
                  }
                }
              }
            }
          }
        }
        repository(owner: "zdttech-copilot", name: "governanca-zdt") {
          issues(first: 45, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              id
              number
              title
              body
              state
              url
              updatedAt
              repository { nameWithOwner }
              assignees(first: 5) { nodes { login name } }
              labels(first: 10) { nodes { name } }
              comments { totalCount }
              projectItems(first: 5) {
                nodes {
                  id
                  updatedAt
                  project { id number title }
                  fieldValues(first: 25) {
                    nodes {
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        name
                        optionId
                        updatedAt
                        field { ... on ProjectV2FieldCommon { name } }
                      }
                      ... on ProjectV2ItemFieldNumberValue {
                        number
                        updatedAt
                        field { ... on ProjectV2FieldCommon { name } }
                      }
                      ... on ProjectV2ItemFieldDateValue {
                        date
                        updatedAt
                        field { ... on ProjectV2FieldCommon { name } }
                      }
                      ... on ProjectV2ItemFieldTextValue {
                        text
                        updatedAt
                        field { ... on ProjectV2FieldCommon { name } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const gqlResult = await runGitHubGraphQL(query);
      const personalProj = gqlResult.data?.user?.projectV2;
      const repoIssues = gqlResult.data?.repository?.issues?.nodes || [];

      if (!personalProj && repoIssues.length === 0) {
        res.status(200).json({
          connected: false,
          tokenPermissionError: true,
          message:
            gqlResult.errors?.[0]?.message ||
            'Não foi possível acessar o projeto no GitHub. Verifique os escopos repo e project do GITHUB_TOKEN.',
        });
        return;
      }

      // Build lookup of personal_3 items by content.id
      const personalNodes = Array.isArray(personalProj?.items?.nodes)
        ? personalProj.items.nodes
        : [];
      const personalNodeByContentId = new Map<string, any>();
      for (const pn of personalNodes) {
        if (pn?.content?.id) {
          personalNodeByContentId.set(String(pn.content.id), pn);
        }
      }

      // Parse cards from zdttech-copilot/governanca-zdt combining fieldValues from BOTH Project #3 and Project #4
      // so whichever board was updated most recently (by updatedAt) wins automatically!
      const seenContentIds = new Set<string>();
      const orgCards: MirroredBoardCard[] = repoIssues.map((issue: any, idx: number) => {
        const contentId = String(issue.id || '');
        seenContentIds.add(contentId);

        const projItems = Array.isArray(issue.projectItems?.nodes) ? issue.projectItems.nodes : [];
        const personalItem =
          projItems.find(
            (pi: any) => pi?.project?.id === PROJECT_BOARD_TARGETS.personal_3.projectId
          ) || personalNodeByContentId.get(contentId);
        const orgItem = projItems.find(
          (pi: any) => pi?.project?.id === PROJECT_BOARD_TARGETS.org_4.projectId
        );

        // Combine all fieldValues from all linked projects so parseFieldValuesIntoCard picks the latest updatedAt per field!
        const combinedFieldNodes: Array<Record<string, any>> = [];
        for (const pi of projItems) {
          if (Array.isArray(pi?.fieldValues?.nodes)) {
            combinedFieldNodes.push(...pi.fieldValues.nodes);
          }
        }
        if (
          personalItem &&
          !projItems.some((pi: any) => pi?.id === personalItem.id) &&
          Array.isArray(personalItem.fieldValues?.nodes)
        ) {
          combinedFieldNodes.push(...personalItem.fieldValues.nodes);
        }

        const parsedCard = parseFieldValuesIntoCard(
          String(personalItem?.id || orgItem?.id || projItems[0]?.id || ''),
          issue,
          combinedFieldNodes,
          idx + 100
        );

        // Auto-heal in background if personal_3 and org_4 diverged on Status or if issue state was CLOSED but moved out of Concluído
        const pStatusNode = (personalItem?.fieldValues?.nodes || []).find(
          (fv: any) => fv?.field?.name === 'Status'
        );
        const oStatusNode = (orgItem?.fieldValues?.nodes || []).find(
          (fv: any) => fv?.field?.name === 'Status'
        );
        if (
          personalItem?.id &&
          parsedCard.statusOptionId &&
          pStatusNode?.optionId &&
          pStatusNode.optionId !== parsedCard.statusOptionId
        ) {
          updateSingleSelectField(
            PROJECT_BOARD_TARGETS.personal_3.projectId,
            personalItem.id,
            PROJECT_BOARD_TARGETS.personal_3.fieldIds.status,
            parsedCard.statusOptionId
          ).catch(() => {});
        }
        if (
          orgItem?.id &&
          parsedCard.statusOptionId &&
          oStatusNode?.optionId &&
          oStatusNode.optionId !== parsedCard.statusOptionId
        ) {
          updateSingleSelectField(
            PROJECT_BOARD_TARGETS.org_4.projectId,
            orgItem.id,
            PROJECT_BOARD_TARGETS.org_4.fieldIds.status,
            parsedCard.statusOptionId
          ).catch(() => {});
        }
        if (issue.state === 'CLOSED' && parsedCard.statusColumn !== 'Concluído') {
          fetch(
            `https://api.github.com/repos/zdttech-copilot/governanca-zdt/issues/${parsedCard.issueNumber}`,
            {
              method: 'PATCH',
              headers: { ...buildGitHubHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ state: 'open' }),
            }
          ).catch(() => {});
        }

        return parsedCard;
      });

      // Include any extra items in personal_3 that are NOT in governanca-zdt (e.g. DraftIssues or other repos)
      const extraPersonalCards: MirroredBoardCard[] = personalNodes
        .filter((n: any) => n && n.content && !seenContentIds.has(String(n.content.id || '')))
        .map((n: any, idx: number) =>
          parseFieldValuesIntoCard(
            String(n.id),
            n.content,
            Array.isArray(n.fieldValues?.nodes) ? n.fieldValues.nodes : [],
            idx + 1
          )
        );

      const finalCards: MirroredBoardCard[] = [...extraPersonalCards, ...orgCards];

      res.json({
        connected: true,
        activeSource: sourceTarget,
        personalProjectItemCount: personalNodes.length,
        orgProjectItemCount: orgCards.length,
        projectTitle:
          sourceTarget === 'personal_3'
            ? `Chamados (users/felipeolio/projects/3)`
            : `Governança ZDT (orgs/zdttech-copilot/projects/4)`,
        projectUrl: PROJECT_BOARD_TARGETS[sourceTarget].projectUrl,
        columns: PROJECT_STATUS_COLUMNS,
        cards: finalCards,
      });
    } catch (error) {
      res.status(500).json({
        connected: false,
        error: error instanceof Error ? error.message : 'Erro ao consultar GitHub GraphQL',
      });
    }
  });

  // 2. Copy/Link Open Issues from zdttech-copilot/governanca-zdt into users/felipeolio/projects/3
  app.post('/api/github/project-board/mirror-to-project3', async (req, res) => {
    const limit = Math.min(Math.max(Number(req.body?.limit) || 15, 1), 30);
    const targetConfig = PROJECT_BOARD_TARGETS.personal_3;

    try {
      // Fetch open issues from governanca-zdt with their current Governança ZDT field values
      const fetchQuery = `
        query GetOpenForMirror($limit: Int!) {
          repository(owner: "zdttech-copilot", name: "governanca-zdt") {
            issues(first: $limit, states: [OPEN], orderBy: {field: UPDATED_AT, direction: DESC}) {
              nodes {
                id
                number
                title
                projectItems(first: 5) {
                  nodes {
                    id
                    project { id }
                    fieldValues(first: 20) {
                      nodes {
                        ... on ProjectV2ItemFieldSingleSelectValue {
                          name
                          optionId
                          field { ... on ProjectV2FieldCommon { name } }
                        }
                        ... on ProjectV2ItemFieldNumberValue {
                          number
                          field { ... on ProjectV2FieldCommon { name } }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      const gqlData = await runGitHubGraphQL(fetchQuery, { limit });
      const issues = gqlData.data?.repository?.issues?.nodes || [];
      let linkedCount = 0;

      for (const issue of issues) {
        if (!issue?.id) continue;
        // Add issue to users/felipeolio/projects/3
        const addRes = await runGitHubGraphQL(
          `mutation LinkIssueToPersonalProject($projectId: ID!, $contentId: ID!) {
            addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
              item { id }
            }
          }`,
          {
            projectId: targetConfig.projectId,
            contentId: issue.id,
          }
        );

        const newItemId = addRes.data?.addProjectV2ItemById?.item?.id;
        if (!newItemId) continue;
        linkedCount++;

        // Copy field optionIds (since personal_3 was cloned from org_4, optionIds are identical!)
        const orgItem = (issue.projectItems?.nodes || []).find(
          (pi: any) => pi?.project?.id === PROJECT_BOARD_TARGETS.org_4.projectId
        );
        const fvNodes = orgItem?.fieldValues?.nodes || [];
        for (const fv of fvNodes) {
          if (!fv?.field?.name) continue;
          const fName = String(fv.field.name).trim();
          if (fName === 'Status' && fv.optionId) {
            await updateSingleSelectField(
              targetConfig.projectId,
              newItemId,
              targetConfig.fieldIds.status,
              fv.optionId
            );
          } else if (fName === 'Cliente' && fv.optionId) {
            await updateSingleSelectField(
              targetConfig.projectId,
              newItemId,
              targetConfig.fieldIds.cliente,
              fv.optionId
            );
          } else if (fName === 'Esteira' && fv.optionId) {
            await updateSingleSelectField(
              targetConfig.projectId,
              newItemId,
              targetConfig.fieldIds.esteira,
              fv.optionId
            );
          } else if (fName === 'Tipo de Demanda' && fv.optionId) {
            await updateSingleSelectField(
              targetConfig.projectId,
              newItemId,
              targetConfig.fieldIds.tipoDemanda,
              fv.optionId
            );
          } else if (fName.startsWith('Impedimento') && fv.optionId) {
            await updateSingleSelectField(
              targetConfig.projectId,
              newItemId,
              targetConfig.fieldIds.impedimento,
              fv.optionId
            );
          } else if (fName === 'Priority' && fv.optionId) {
            await updateSingleSelectField(
              targetConfig.projectId,
              newItemId,
              targetConfig.fieldIds.priority,
              fv.optionId
            );
          }
        }
      }

      res.json({
        ok: true,
        linkedCount,
        message: `${linkedCount} chamados vinculados e espelhados diretamente em users/felipeolio/projects/3!`,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Erro ao espelhar cards para Project #3',
      });
    }
  });

  // 3. Two-Way Sync Card (Move Column, Update Cliente, Esteira, Tipo de Demanda, Impedimento, Priority, Size, Effort, Horas Gastas, Issue Title/Body/Assignees/Labels)
  app.post('/api/github/project-board/sync-card', async (req, res) => {
    const {
      contentId,
      issueNumber,
      repository,
      title,
      body,
      state,
      assignees,
      labels,
      statusOptionId,
      clienteOptionId,
      esteiraOptionId,
      tipoDemandaOptionId,
      impedimentoOptionId,
      priorityOptionId,
      sizeOptionId,
      effortOptionId,
      horasGastas,
      estimate,
      startDate,
      targetDate,
      terminoPlanejado,
      proximoFollowUp,
      prioridadesSemanal,
      commentToPost,
    } = req.body || {};

    const syncedTargets: string[] = [];

    try {
      // Sync to BOTH personal_3 (users/felipeolio/projects/3) and org_4 (orgs/zdttech-copilot/projects/4) if contentId is an Issue!
      const targetsToUpdate = [PROJECT_BOARD_TARGETS.personal_3, PROJECT_BOARD_TARGETS.org_4];

      if (contentId && !String(contentId).startsWith('DI_')) {
        for (const target of targetsToUpdate) {
          // Ensure item is in the project and get its projectV2Item ID
          const addRes = await runGitHubGraphQL(
            `mutation EnsureItemInProject($projectId: ID!, $contentId: ID!) {
              addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
                item { id }
              }
            }`,
            { projectId: target.projectId, contentId }
          );
          const itemId = addRes.data?.addProjectV2ItemById?.item?.id;
          if (!itemId) continue;

          if (typeof statusOptionId === 'string' && statusOptionId) {
            await updateSingleSelectField(
              target.projectId,
              itemId,
              target.fieldIds.status,
              statusOptionId
            );
          }
          if (typeof clienteOptionId === 'string') {
            await updateSingleSelectField(
              target.projectId,
              itemId,
              target.fieldIds.cliente,
              clienteOptionId
            );
          }
          if (typeof esteiraOptionId === 'string') {
            await updateSingleSelectField(
              target.projectId,
              itemId,
              target.fieldIds.esteira,
              esteiraOptionId
            );
          }
          if (typeof tipoDemandaOptionId === 'string') {
            await updateSingleSelectField(
              target.projectId,
              itemId,
              target.fieldIds.tipoDemanda,
              tipoDemandaOptionId
            );
          }
          if (typeof impedimentoOptionId === 'string') {
            await updateSingleSelectField(
              target.projectId,
              itemId,
              target.fieldIds.impedimento,
              impedimentoOptionId
            );
          }
          if (typeof priorityOptionId === 'string') {
            await updateSingleSelectField(
              target.projectId,
              itemId,
              target.fieldIds.priority,
              priorityOptionId
            );
          }
          if (typeof sizeOptionId === 'string') {
            await updateSingleSelectField(
              target.projectId,
              itemId,
              target.fieldIds.size,
              sizeOptionId
            );
          }
          if (typeof effortOptionId === 'string') {
            await updateSingleSelectField(
              target.projectId,
              itemId,
              target.fieldIds.effort,
              effortOptionId
            );
          }
          if (typeof horasGastas === 'number' && horasGastas >= 0) {
            await updateNumberField(
              target.projectId,
              itemId,
              target.fieldIds.horasGastas,
              horasGastas
            );
          }
          if (typeof estimate === 'number' && estimate > 0) {
            await updateNumberField(
              target.projectId,
              itemId,
              target.fieldIds.estimate,
              estimate
            );
          }
          if (typeof startDate === 'string' && startDate) {
            await updateDateField(target.projectId, itemId, target.fieldIds.startDate, startDate);
          }
          if (typeof targetDate === 'string' && targetDate) {
            await updateDateField(target.projectId, itemId, target.fieldIds.targetDate, targetDate);
          }
          if (typeof terminoPlanejado === 'string' && terminoPlanejado) {
            await updateDateField(
              target.projectId,
              itemId,
              target.fieldIds.terminoPlanejado,
              terminoPlanejado
            );
          }
          if (typeof proximoFollowUp === 'string' && proximoFollowUp) {
            await updateDateField(
              target.projectId,
              itemId,
              target.fieldIds.proximoFollowUp,
              proximoFollowUp
            );
          }
          if (typeof prioridadesSemanal === 'string' && prioridadesSemanal) {
            await updateTextField(
              target.projectId,
              itemId,
              target.fieldIds.prioridadesSemanal,
              prioridadesSemanal
            );
          }
          syncedTargets.push(target.label);
        }
      }

      // Also update the underlying GitHub Repository Issue (title, body, state, assignees, labels, comment)
      const repoName = String(repository || 'zdttech-copilot/governanca-zdt');
      if (issueNumber && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repoName)) {
        const patchPayload: Record<string, unknown> = {};
        if (title) patchPayload.title = title;
        if (typeof body === 'string') patchPayload.body = body;
        if (state === 'OPEN' || state === 'CLOSED' || state === 'open' || state === 'closed') {
          patchPayload.state = String(state).toLowerCase();
        }
        if (Array.isArray(assignees)) {
          patchPayload.assignees = assignees.filter(Boolean);
        }
        if (Array.isArray(labels)) {
          patchPayload.labels = labels.filter(Boolean);
        }

        if (Object.keys(patchPayload).length > 0) {
          const patchRes = await fetch(
            `https://api.github.com/repos/${repoName}/issues/${issueNumber}`,
            {
              method: 'PATCH',
              headers: {
                ...buildGitHubHeaders(),
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(patchPayload),
            }
          );
          if (patchRes.ok) {
            syncedTargets.push(`${repoName}#${issueNumber}`);
          }
        }

        if (commentToPost && String(commentToPost).trim()) {
          await fetch(`https://api.github.com/repos/${repoName}/issues/${issueNumber}/comments`, {
            method: 'POST',
            headers: {
              ...buildGitHubHeaders(),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ body: String(commentToPost).trim() }),
          });
        }
      }

      res.json({
        ok: true,
        syncedTargets,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Erro ao sincronizar card com o GitHub',
      });
    }
  });

  // 4. Create a new Card in zdttech-copilot/governanca-zdt AND link it to BOTH Projects (#3 and #4) with all Custom Fields
  app.post('/api/github/project-board/create-card', async (req, res) => {
    const {
      title,
      body,
      assignees,
      labels,
      statusOptionId,
      clienteOptionId,
      esteiraOptionId,
      tipoDemandaOptionId,
      impedimentoOptionId,
      priorityOptionId,
      sizeOptionId,
      effortOptionId,
      estimate,
      terminoPlanejado,
      proximoFollowUp,
    } = req.body || {};

    const repoName = 'zdttech-copilot/governanca-zdt';

    try {
      // 1. Create the real Issue in zdttech-copilot/governanca-zdt
      const ghRes = await fetch(`https://api.github.com/repos/${repoName}/issues`, {
        method: 'POST',
        headers: {
          ...buildGitHubHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: String(title || 'Novo Chamado'),
          body: String(body || ''),
          assignees: Array.isArray(assignees) ? assignees.filter(Boolean) : ['felipeolio'],
          labels: Array.isArray(labels) ? labels.filter(Boolean) : ['task'],
        }),
      });

      if (!ghRes.ok) {
        const errText = await ghRes.text();
        res.status(ghRes.status).json({ error: errText });
        return;
      }

      const createdIssue = (await ghRes.json()) as Record<string, any>;
      const contentNodeId = String(createdIssue.node_id || '');
      const issueNumber = Number(createdIssue.number);

      // 2. Link the new Issue to BOTH users/felipeolio/projects/3 AND orgs/zdttech-copilot/projects/4 and set its custom fields!
      if (contentNodeId) {
        for (const target of [PROJECT_BOARD_TARGETS.personal_3, PROJECT_BOARD_TARGETS.org_4]) {
          const addRes = await runGitHubGraphQL(
            `mutation LinkNewIssue($projectId: ID!, $contentId: ID!) {
              addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
                item { id }
              }
            }`,
            { projectId: target.projectId, contentId: contentNodeId }
          );
          const itemId = addRes.data?.addProjectV2ItemById?.item?.id;
          if (!itemId) continue;

          // Mark Chamado = Sim
          await updateSingleSelectField(
            target.projectId,
            itemId,
            target.fieldIds.chamado,
            '58654c92'
          );

          if (statusOptionId) {
            await updateSingleSelectField(
              target.projectId,
              itemId,
              target.fieldIds.status,
              statusOptionId
            );
          }
          if (clienteOptionId) {
            await updateSingleSelectField(
              target.projectId,
              itemId,
              target.fieldIds.cliente,
              clienteOptionId
            );
          }
          if (esteiraOptionId) {
            await updateSingleSelectField(
              target.projectId,
              itemId,
              target.fieldIds.esteira,
              esteiraOptionId
            );
          }
          if (tipoDemandaOptionId) {
            await updateSingleSelectField(
              target.projectId,
              itemId,
              target.fieldIds.tipoDemanda,
              tipoDemandaOptionId
            );
          }
          if (impedimentoOptionId) {
            await updateSingleSelectField(
              target.projectId,
              itemId,
              target.fieldIds.impedimento,
              impedimentoOptionId
            );
          }
          if (priorityOptionId) {
            await updateSingleSelectField(
              target.projectId,
              itemId,
              target.fieldIds.priority,
              priorityOptionId
            );
          }
          if (sizeOptionId) {
            await updateSingleSelectField(
              target.projectId,
              itemId,
              target.fieldIds.size,
              sizeOptionId
            );
          }
          if (effortOptionId) {
            await updateSingleSelectField(
              target.projectId,
              itemId,
              target.fieldIds.effort,
              effortOptionId
            );
          }
          if (typeof estimate === 'number' && estimate > 0) {
            await updateNumberField(target.projectId, itemId, target.fieldIds.estimate, estimate);
          }
          if (terminoPlanejado) {
            await updateDateField(
              target.projectId,
              itemId,
              target.fieldIds.terminoPlanejado,
              terminoPlanejado
            );
          }
          if (proximoFollowUp) {
            await updateDateField(
              target.projectId,
              itemId,
              target.fieldIds.proximoFollowUp,
              proximoFollowUp
            );
          }
        }
      }

      res.json({
        ok: true,
        issueNumber,
        contentId: contentNodeId,
        url: String(createdIssue.html_url || ''),
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Erro ao criar card no GitHub',
      });
    }
  });

  // 5. Fetch real comments and full issue content for a specific GitHub Issue
  app.get('/api/github/comments', async (req, res) => {
    const repo = String(req.query.repo || 'zdttech-copilot/governanca-zdt').trim();
    const issueNumber = Number(req.query.issueNumber);

    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo) || !issueNumber) {
      res.status(400).json({ error: 'Parâmetros repo e issueNumber são obrigatórios.' });
      return;
    }

    try {
      const [issueRes, commentsRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
          headers: buildGitHubHeaders(),
        }),
        fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/comments?per_page=50`, {
          headers: buildGitHubHeaders(),
        }),
      ]);

      let issueDetails: Record<string, any> | null = null;
      if (issueRes.ok) {
        const rawIssue = (await issueRes.json()) as Record<string, any>;
        issueDetails = {
          number: Number(rawIssue.number || issueNumber),
          title: String(rawIssue.title || ''),
          body: String(rawIssue.body || ''),
          state: String(rawIssue.state || 'open'),
          author: String(rawIssue.user?.login || 'github-user'),
          authorAvatar: String(rawIssue.user?.avatar_url || ''),
          createdAt: String(rawIssue.created_at || ''),
          updatedAt: String(rawIssue.updated_at || ''),
          htmlUrl: String(rawIssue.html_url || ''),
          commentsCount: Number(rawIssue.comments || 0),
        };
      }

      if (!commentsRes.ok) {
        res.status(commentsRes.status).json({
          error: `Falha ao buscar comentários (${commentsRes.status})`,
          issue: issueDetails,
          comments: [],
        });
        return;
      }

      const comments = (await commentsRes.json()) as Array<Record<string, any>>;
      const formatted = comments.map((c) => ({
        id: String(c.id),
        author: String(c.user?.login || 'github-user'),
        authorAvatar: String(c.user?.avatar_url || ''),
        createdAt: String(c.created_at || new Date().toISOString()),
        body: String(c.body || ''),
        htmlUrl: String(c.html_url || ''),
      }));

      res.json({ repo, issueNumber, issue: issueDetails, comments: formatted });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erro ao buscar comentários do GitHub',
      });
    }
  });

  // 6. List accessible repositories
  app.get('/api/github/user-repos', async (_req, res) => {
    try {
      const authRes = await fetch(
        'https://api.github.com/user/repos?sort=updated&per_page=30&affiliation=owner,collaborator,organization_member',
        { headers: buildGitHubHeaders() }
      );
      const rawRepos = authRes.ok ? ((await authRes.json()) as Array<Record<string, any>>) : [];
      const repos = rawRepos.map((r) => ({
        fullName: String(r.full_name || ''),
        name: String(r.name || ''),
        isPrivate: Boolean(r.private),
        openIssuesCount: Number(r.open_issues_count) || 0,
      }));
      res.json({ repos });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao listar repositórios' });
    }
  });

  // 7. Fetch issues from any repository
  app.get('/api/github/issues', async (req, res) => {
    const repo = String(req.query.repo || 'zdttech-copilot/governanca-zdt').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 30);
    try {
      const apiUrl = `https://api.github.com/repos/${repo}/issues?state=all&per_page=${limit}&sort=updated`;
      const response = await fetch(apiUrl, { headers: buildGitHubHeaders() });
      if (!response.ok) {
        res.status(response.status).json({ error: `Status ${response.status}` });
        return;
      }
      const rawItems = (await response.json()) as Array<Record<string, any>>;
      const issues = rawItems
        .filter((item) => !item.pull_request)
        .map((item) => ({
          issueNumber: Number(item.number),
          title: String(item.title || ''),
          description: String(item.body || '').slice(0, 3500),
          githubAssignee: String(item.assignee?.login || 'felipeolio'),
          assigneeName: String(item.assignee?.login || 'felipeolio'),
          githubRepo: repo,
          githubIssueUrl: String(item.html_url || ''),
          githubState: item.state === 'closed' ? 'closed' : 'open',
          priority: 'media',
          labelsSummary: Array.isArray(item.labels)
            ? item.labels.map((l: any) => l?.name || '').filter(Boolean).join(', ')
            : 'task',
          commentsCount: Number(item.comments) || 0,
          lastCommentSummary: `Sincronizado de ${repo}#${item.number}`,
        }));
      res.json({ repo, count: issues.length, issues });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar issues' });
    }
  });

  // 8. Webhook Receiver
  app.post('/api/webhooks/github', (req, res) => {
    const eventType = String(req.headers['x-github-event'] || 'issues');
    if (eventType === 'ping') {
      res.status(200).json({ pong: true });
      return;
    }
    const rawBody = req.body?.payload ? JSON.parse(req.body.payload) : req.body || {};
    const issue = rawBody.issue || {};
    const repoFullName = String(
      rawBody.repository?.full_name || 'zdttech-copilot/governanca-zdt'
    );
    const issueNumber = Number(issue.number) || 1000;
    res.status(200).json({
      received: true,
      delivery: {
        id: `wh_${Date.now()}`,
        event: eventType,
        repo: repoFullName,
        issueNumber,
        normalizedIssue: {
          issueNumber,
          title: String(issue.title || 'Webhook Issue'),
          description: String(issue.body || ''),
          githubAssignee: String(issue.assignee?.login || 'felipeolio'),
          assigneeName: String(issue.assignee?.login || 'felipeolio'),
          githubRepo: repoFullName,
          githubIssueUrl: String(issue.html_url || ''),
          githubState: issue.state === 'closed' ? 'closed' : 'open',
          priority: 'alta',
          labelsSummary: 'webhook',
          commentsCount: Number(issue.comments) || 0,
          lastCommentSummary: `Webhook ${eventType}`,
        },
      },
    });
  });

  // ===========================================================================
  // 9. Neon.com PostgreSQL Database Endpoints (/api/neon/*)
  // ===========================================================================
  app.get('/api/neon/health', async (_req, res) => {
    const connStr = (process.env.NEON_DATABASE_URL || '').trim();
    if (!connStr) {
      res.json({
        connected: false,
        configured: false,
        host: null,
        database: null,
        latencyMs: 0,
        tables: [],
        counts: {
          companies: neonStore.companies.length,
          teamMembers: neonStore.teamMembers.length,
          tickets: neonStore.tickets.length,
          sessions: neonStore.sessions.length,
          auditLogs: neonStore.auditLogs.length,
        },
        message:
          'Variável NEON_DATABASE_URL ainda não definida no ambiente. Usando store local (.neon-local-store.json) até que a Connection String seja adicionada.',
      });
      return;
    }

    const startMs = Date.now();
    let parsedHost = '';
    try {
      parsedHost = new URL(connStr).hostname;
    } catch {
      parsedHost = 'host-invalido';
    }

    try {
      const pingRows = await executeNeonSql(
        `SELECT current_database() AS db_name, current_user AS db_user, version() AS pg_version`
      );
      const latencyMs = Date.now() - startMs;

      if (!pingRows || pingRows.length === 0) {
        res.json({
          connected: false,
          configured: true,
          host: parsedHost,
          database: null,
          latencyMs,
          tables: [],
          counts: {},
          message:
            'NEON_DATABASE_URL encontrada, mas não foi possível autenticar via HTTP SQL no endpoint do Neon. Verifique se a URL está completa com ?sslmode=require.',
        });
        return;
      }

      const tableRows = await executeNeonSql(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name ASC`
      );
      const tables = (tableRows || []).map((r) => String(r.table_name));

      const countCompanies = await executeNeonSql(`SELECT COUNT(*)::int AS total FROM companies`);
      const countTeam = await executeNeonSql(`SELECT COUNT(*)::int AS total FROM team_members`);
      const countTickets = await executeNeonSql(`SELECT COUNT(*)::int AS total FROM tickets`);
      const countSessions = await executeNeonSql(
        `SELECT COUNT(*)::int AS total FROM attendance_sessions`
      );
      const countLogs = await executeNeonSql(`SELECT COUNT(*)::int AS total FROM audit_logs`);

      res.json({
        connected: true,
        configured: true,
        host: parsedHost,
        database: String(pingRows[0].db_name || 'neondb'),
        dbUser: String(pingRows[0].db_user || 'neondb_owner'),
        latencyMs,
        tables,
        counts: {
          companies: Number(countCompanies?.[0]?.total ?? 0),
          teamMembers: Number(countTeam?.[0]?.total ?? 0),
          tickets: Number(countTickets?.[0]?.total ?? 0),
          sessions: Number(countSessions?.[0]?.total ?? 0),
          auditLogs: Number(countLogs?.[0]?.total ?? 0),
        },
        message: `Conectado com sucesso ao Neon.com (${parsedHost}) em ${latencyMs}ms!`,
      });
    } catch (err) {
      res.json({
        connected: false,
        configured: true,
        host: parsedHost,
        database: null,
        latencyMs: Date.now() - startMs,
        tables: [],
        counts: {},
        message:
          err instanceof Error
            ? `Erro ao testar conexão com Neon: ${err.message}`
            : 'Erro ao testar conexão com Neon.',
      });
    }
  });

  app.get('/api/neon/state', async (_req, res) => {
    try {
      const dbCompanies = await executeNeonSql(
        `SELECT id, name, code, github_repo AS "githubRepo", sla_hours AS "slaHours",
                CAST(hourly_rate AS FLOAT) AS "hourlyRate",
                CAST(contract_hours AS FLOAT) AS "contractHours",
                status, owner_id AS "ownerId"
         FROM companies ORDER BY name ASC`
      );
      const dbTeam = await executeNeonSql(
        `SELECT id, name, role_title AS "roleTitle", github_handle AS "githubHandle",
                specialty, CAST(hourly_cost AS FLOAT) AS "hourlyCost",
                status, owner_id AS "ownerId"
         FROM team_members ORDER BY id ASC`
      );
      const dbTickets = await executeNeonSql(
        `SELECT id, issue_number AS "issueNumber", title, description,
                company_id AS "companyId", company_name AS "companyName",
                assignee_name AS "assigneeName", github_assignee AS "githubAssignee",
                github_repo AS "githubRepo", github_issue_url AS "githubIssueUrl",
                github_state AS "githubState", status, priority,
                labels_summary AS "labelsSummary", comments_count AS "commentsCount",
                last_comment_summary AS "lastCommentSummary",
                CAST(total_seconds_worked AS BIGINT) AS "totalSecondsWorked",
                CAST(active_session_started_at_ms AS BIGINT) AS "activeSessionStartedAtMs",
                owner_id AS "ownerId"
         FROM tickets ORDER BY issue_number DESC`
      );
      const dbSessions = await executeNeonSql(
        `SELECT id, ticket_id AS "ticketId", issue_number AS "issueNumber",
                ticket_title AS "ticketTitle", company_name AS "companyName",
                agent_name AS "agentName", started_at_iso AS "startedAtIso",
                ended_at_iso AS "endedAtIso",
                CAST(duration_seconds AS BIGINT) AS "durationSeconds",
                notes, session_status AS "sessionStatus", owner_id AS "ownerId"
         FROM attendance_sessions ORDER BY created_at DESC LIMIT 300`
      );
      const dbLogs = await executeNeonSql(
        `SELECT id, event_type AS "eventType", actor_name AS "actorName",
                target_label AS "targetLabel", details, origin, owner_id AS "ownerId",
                created_at AS "createdAt"
         FROM audit_logs ORDER BY created_at DESC LIMIT 300`
      );
      const dbReports = await executeNeonSql(
        `SELECT id, title, company_filter AS "companyFilter", period_label AS "periodLabel",
                total_tickets AS "totalTickets",
                CAST(total_seconds AS BIGINT) AS "totalSeconds",
                CAST(total_billed_amount AS FLOAT) AS "totalBilledAmount",
                generated_by AS "generatedBy", owner_id AS "ownerId",
                created_at AS "createdAt"
         FROM reports ORDER BY created_at DESC`
      );

      res.json({
        neonConfigured: Boolean((process.env.NEON_DATABASE_URL || '').trim()),
        companies: dbCompanies && dbCompanies.length > 0 ? dbCompanies : neonStore.companies,
        teamMembers: dbTeam && dbTeam.length > 0 ? dbTeam : neonStore.teamMembers,
        tickets: dbTickets
          ? dbTickets.map((t) => ({
              ...t,
              totalSecondsWorked: Number(t.totalSecondsWorked) || 0,
              activeSessionStartedAtMs: Number(t.activeSessionStartedAtMs) || 0,
            }))
          : neonStore.tickets,
        sessions: dbSessions
          ? dbSessions.map((s) => ({
              ...s,
              durationSeconds: Number(s.durationSeconds) || 0,
            }))
          : neonStore.sessions,
        auditLogs: dbLogs || neonStore.auditLogs,
        reports: dbReports
          ? dbReports.map((r) => ({
              ...r,
              totalSeconds: Number(r.totalSeconds) || 0,
              totalBilledAmount: Number(r.totalBilledAmount) || 0,
            }))
          : neonStore.reports,
      });
    } catch {
      res.json({
        neonConfigured: Boolean((process.env.NEON_DATABASE_URL || '').trim()),
        ...neonStore,
      });
    }
  });

  app.post('/api/neon/migrate', async (_req, res) => {
    try {
      const statements = NEON_MIGRATION_0001_SQL.split(/;\s*\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));
      let executedRemote = false;
      for (const stmt of statements) {
        const out = await executeNeonSql(`${stmt};`);
        if (out !== null) {
          executedRemote = true;
        }
      }
      saveNeonStore();
      res.json({
        ok: true,
        message: executedRemote
          ? 'Migration 0001_neon_initial_schema.sql executada com sucesso no banco Neon.com!'
          : 'Schema 0001_neon_initial_schema.sql validado e sincronizado! Configure NEON_DATABASE_URL no ambiente para aplicar diretamente na instância remota do Neon.com.',
      });
    } catch (error) {
      console.error('Migration error:', error);
      res.status(500).json({ ok: false, message: 'Erro ao executar migration.' });
    }
  });

  app.post('/api/neon/companies', async (req, res) => {
    const item = {
      id: String(req.body.id || `comp_${Date.now()}`),
      name: String(req.body.name || 'Empresa'),
      code: String(req.body.code || 'CORP'),
      githubRepo: String(req.body.githubRepo || 'zdttech-copilot/governanca-zdt'),
      slaHours: Number(req.body.slaHours) || 4,
      hourlyRate: Number(req.body.hourlyRate) || 250,
      contractHours: Number(req.body.contractHours) || 100,
      status: req.body.status || 'active',
      ownerId: String(req.body.ownerId || 'default'),
    };
    neonStore.companies = [
      ...neonStore.companies.filter((c) => c.id !== item.id && c.code !== item.code),
      item,
    ];
    saveNeonStore();
    await executeNeonSql(
      `INSERT INTO companies (id, name, code, github_repo, sla_hours, hourly_rate, contract_hours, status, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         github_repo = EXCLUDED.github_repo,
         sla_hours = EXCLUDED.sla_hours,
         hourly_rate = EXCLUDED.hourly_rate,
         contract_hours = EXCLUDED.contract_hours,
         status = EXCLUDED.status`,
      [
        item.id,
        item.name,
        item.code,
        item.githubRepo,
        item.slaHours,
        item.hourlyRate,
        item.contractHours,
        item.status,
        item.ownerId,
      ]
    );
    res.json({ ok: true, item });
  });

  app.post('/api/neon/team-members', async (req, res) => {
    const githubHandle = String(req.body.githubHandle || 'dev').trim().replace(/^@/, '');
    const accessRole = req.body.accessRole === 'admin' ? 'admin' : 'atendente';
    const item = {
      id: String(req.body.id || `mem_${githubHandle}_${Date.now()}`),
      name: String(req.body.name || 'Especialista'),
      email: String(req.body.email || `${githubHandle.toLowerCase()}@zdt.com.br`),
      roleTitle: String(req.body.roleTitle || 'Engenheiro de Suporte'),
      githubHandle,
      specialty: String(req.body.specialty || 'Full-Stack'),
      hourlyCost: Number(req.body.hourlyCost) || 160,
      status: req.body.status || 'disponivel',
      accessRole,
      restrictTimerToAssignedOnly:
        typeof req.body.restrictTimerToAssignedOnly === 'boolean'
          ? req.body.restrictTimerToAssignedOnly
          : true,
      defaultFilterMyCardsOnLogin:
        typeof req.body.defaultFilterMyCardsOnLogin === 'boolean'
          ? req.body.defaultFilterMyCardsOnLogin
          : true,
      allowViewAllTechniciansFilter:
        typeof req.body.allowViewAllTechniciansFilter === 'boolean'
          ? req.body.allowViewAllTechniciansFilter
          : true,
      ownerId: String(req.body.ownerId || 'default'),
    };
    neonStore.teamMembers = [
      ...neonStore.teamMembers.filter(
        (m) => m.id !== item.id && m.githubHandle.toLowerCase() !== item.githubHandle.toLowerCase()
      ),
      item,
    ];
    saveNeonStore();
    await executeNeonSql(
      `INSERT INTO team_members (id, name, role_title, github_handle, specialty, hourly_cost, status, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         role_title = EXCLUDED.role_title,
         github_handle = EXCLUDED.github_handle,
         specialty = EXCLUDED.specialty,
         hourly_cost = EXCLUDED.hourly_cost,
         status = EXCLUDED.status`,
      [
        item.id,
        item.name,
        item.roleTitle,
        item.githubHandle,
        item.specialty,
        item.hourlyCost,
        item.status,
        item.ownerId,
      ]
    );
    res.json({ ok: true, item });
  });

  app.patch('/api/neon/team-members/:id/status', async (req, res) => {
    const memberId = String(req.params.id);
    const status = String(req.body.status || 'disponivel');
    neonStore.teamMembers = neonStore.teamMembers.map((m) =>
      m.id === memberId ? { ...m, status } : m
    );
    saveNeonStore();
    await executeNeonSql(`UPDATE team_members SET status = $1 WHERE id = $2`, [
      status,
      memberId,
    ]);
    res.json({ ok: true });
  });

  app.patch('/api/neon/team-members/:id/permissions', async (req, res) => {
    const memberId = String(req.params.id);
    const u = req.body || {};
    let updatedMember: any = null;
    neonStore.teamMembers = neonStore.teamMembers.map((m) => {
      if (m.id !== memberId) return m;
      const next = {
        ...m,
        name: typeof u.name === 'string' && u.name.trim() ? u.name.trim() : m.name,
        email: typeof u.email === 'string' && u.email.trim() ? u.email.trim() : m.email,
        password:
          typeof u.password === 'string' && u.password.trim()
            ? u.password.trim()
            : m.password || '123456',
        roleTitle:
          typeof u.roleTitle === 'string' && u.roleTitle.trim() ? u.roleTitle.trim() : m.roleTitle,
        githubHandle:
          typeof u.githubHandle === 'string' && u.githubHandle.trim()
            ? u.githubHandle.trim().replace(/^@/, '')
            : m.githubHandle,
        specialty:
          typeof u.specialty === 'string' && u.specialty.trim() ? u.specialty.trim() : m.specialty,
        hourlyCost:
          typeof u.hourlyCost === 'number' && !Number.isNaN(u.hourlyCost)
            ? u.hourlyCost
            : m.hourlyCost,
        status: typeof u.status === 'string' ? u.status : m.status,
        accessRole: u.accessRole ?? m.accessRole ?? 'atendente',
        restrictTimerToAssignedOnly:
          typeof u.restrictTimerToAssignedOnly === 'boolean'
            ? u.restrictTimerToAssignedOnly
            : (m.restrictTimerToAssignedOnly ?? true),
        defaultFilterMyCardsOnLogin:
          typeof u.defaultFilterMyCardsOnLogin === 'boolean'
            ? u.defaultFilterMyCardsOnLogin
            : (m.defaultFilterMyCardsOnLogin ?? true),
        allowViewAllTechniciansFilter:
          typeof u.allowViewAllTechniciansFilter === 'boolean'
            ? u.allowViewAllTechniciansFilter
            : (m.allowViewAllTechniciansFilter ?? true),
      };
      updatedMember = next;
      return next;
    });
    saveNeonStore();
    if (updatedMember) {
      await executeNeonSql(
        `UPDATE team_members
         SET name = $1, role_title = $2, github_handle = $3, specialty = $4, hourly_cost = $5, status = $6
         WHERE id = $7`,
        [
          updatedMember.name,
          updatedMember.roleTitle,
          updatedMember.githubHandle,
          updatedMember.specialty,
          updatedMember.hourlyCost,
          updatedMember.status,
          memberId,
        ]
      );
    }
    res.json({ ok: true, item: updatedMember });
  });

  app.post('/api/neon/tickets', async (req, res) => {
    const issueNumber = Number(req.body.issueNumber) || 1000;
    const existing = neonStore.tickets.find((t) => t.issueNumber === issueNumber);
    const item = {
      id: String(req.body.id || existing?.id || `tkt_${issueNumber}`),
      issueNumber,
      title: String(req.body.title || existing?.title || `Chamado #${issueNumber}`),
      description: String(req.body.description ?? existing?.description ?? ''),
      companyId: String(req.body.companyId || existing?.companyId || 'comp_tutora'),
      companyName: String(req.body.companyName || existing?.companyName || 'Tutora'),
      assigneeName: String(req.body.assigneeName || existing?.assigneeName || 'Felipe Olio'),
      githubAssignee: String(req.body.githubAssignee || existing?.githubAssignee || 'felipeolio'),
      githubRepo: String(req.body.githubRepo || existing?.githubRepo || 'zdttech-copilot/governanca-zdt'),
      githubIssueUrl: String(req.body.githubIssueUrl || existing?.githubIssueUrl || ''),
      githubState: req.body.githubState === 'closed' ? 'closed' : 'open',
      status: req.body.status || existing?.status || 'aberto',
      priority: req.body.priority || existing?.priority || 'media',
      labelsSummary: String(req.body.labelsSummary ?? existing?.labelsSummary ?? ''),
      commentsCount: Number(req.body.commentsCount ?? existing?.commentsCount ?? 0),
      lastCommentSummary: String(req.body.lastCommentSummary ?? existing?.lastCommentSummary ?? ''),
      totalSecondsWorked: Math.max(
        Number(req.body.totalSecondsWorked) || 0,
        Number(existing?.totalSecondsWorked) || 0
      ),
      activeSessionStartedAtMs: Number(req.body.activeSessionStartedAtMs) || 0,
      ownerId: String(req.body.ownerId || 'default'),
    };
    neonStore.tickets = [
      item,
      ...neonStore.tickets.filter((t) => t.issueNumber !== issueNumber && t.id !== item.id),
    ];
    saveNeonStore();
    await executeNeonSql(
      `INSERT INTO tickets (
         id, issue_number, title, description, company_id, company_name,
         assignee_name, github_assignee, github_repo, github_issue_url,
         github_state, status, priority, labels_summary, comments_count,
         last_comment_summary, total_seconds_worked, active_session_started_at_ms, owner_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (issue_number) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         company_id = EXCLUDED.company_id,
         company_name = EXCLUDED.company_name,
         assignee_name = EXCLUDED.assignee_name,
         github_assignee = EXCLUDED.github_assignee,
         github_state = EXCLUDED.github_state,
         status = EXCLUDED.status,
         priority = EXCLUDED.priority,
         labels_summary = EXCLUDED.labels_summary,
         comments_count = EXCLUDED.comments_count,
         last_comment_summary = EXCLUDED.last_comment_summary,
         total_seconds_worked = GREATEST(tickets.total_seconds_worked, EXCLUDED.total_seconds_worked),
         active_session_started_at_ms = EXCLUDED.active_session_started_at_ms`,
      [
        item.id,
        item.issueNumber,
        item.title,
        item.description,
        item.companyId,
        item.companyName,
        item.assigneeName,
        item.githubAssignee,
        item.githubRepo,
        item.githubIssueUrl,
        item.githubState,
        item.status,
        item.priority,
        item.labelsSummary,
        item.commentsCount,
        item.lastCommentSummary,
        item.totalSecondsWorked,
        item.activeSessionStartedAtMs,
        item.ownerId,
      ]
    );
    res.json({ ok: true, item });
  });

  app.patch('/api/neon/tickets/:id/timer', async (req, res) => {
    const ticketId = String(req.params.id);
    const updates = req.body || {};
    neonStore.tickets = neonStore.tickets.map((t) =>
      t.id === ticketId
        ? {
            ...t,
            status: updates.status ?? t.status,
            githubState: updates.githubState ?? t.githubState,
            totalSecondsWorked: Math.max(
              Number(updates.totalSecondsWorked) || 0,
              Number(t.totalSecondsWorked) || 0
            ),
            activeSessionStartedAtMs: Number(updates.activeSessionStartedAtMs) || 0,
            lastCommentSummary: updates.lastCommentSummary ?? t.lastCommentSummary,
            commentsCount: Number(updates.commentsCount ?? t.commentsCount ?? 0),
          }
        : t
    );
    saveNeonStore();
    await executeNeonSql(
      `UPDATE tickets SET
         status = $1,
         github_state = $2,
         total_seconds_worked = GREATEST(total_seconds_worked, $3),
         active_session_started_at_ms = $4,
         last_comment_summary = $5,
         comments_count = $6
       WHERE id = $7`,
      [
        updates.status || 'pausado',
        updates.githubState || 'open',
        Number(updates.totalSecondsWorked) || 0,
        Number(updates.activeSessionStartedAtMs) || 0,
        String(updates.lastCommentSummary || ''),
        Number(updates.commentsCount) || 0,
        ticketId,
      ]
    );
    res.json({ ok: true });
  });

  app.patch('/api/neon/tickets/:id/reopen', async (req, res) => {
    const ticketId = String(req.params.id);
    neonStore.tickets = neonStore.tickets.map((t) =>
      t.id === ticketId ? { ...t, status: 'pausado', githubState: 'open' } : t
    );
    saveNeonStore();
    await executeNeonSql(
      `UPDATE tickets SET status = 'pausado', github_state = 'open' WHERE id = $1`,
      [ticketId]
    );
    res.json({ ok: true });
  });

  app.patch('/api/neon/tickets/:id/fields', async (req, res) => {
    const ticketId = String(req.params.id);
    const u = req.body || {};
    neonStore.tickets = neonStore.tickets.map((t) =>
      t.id === ticketId
        ? {
            ...t,
            title: u.title ?? t.title,
            description: u.description ?? t.description,
            assigneeName: u.assigneeName ?? t.assigneeName,
            githubAssignee: u.githubAssignee ?? t.githubAssignee,
            githubState: u.githubState ?? t.githubState,
            status: u.status ?? t.status,
            priority: u.priority ?? t.priority,
            labelsSummary: u.labelsSummary ?? t.labelsSummary,
            commentsCount: Number(u.commentsCount ?? t.commentsCount ?? 0),
            lastCommentSummary: u.lastCommentSummary ?? t.lastCommentSummary,
          }
        : t
    );
    saveNeonStore();
    await executeNeonSql(
      `UPDATE tickets SET
         title = $1,
         description = $2,
         assignee_name = $3,
         github_assignee = $4,
         github_state = $5,
         status = $6,
         priority = $7,
         labels_summary = $8,
         comments_count = $9,
         last_comment_summary = $10
       WHERE id = $11`,
      [
        String(u.title || ''),
        String(u.description || ''),
        String(u.assigneeName || ''),
        String(u.githubAssignee || ''),
        u.githubState === 'closed' ? 'closed' : 'open',
        String(u.status || 'aberto'),
        String(u.priority || 'media'),
        String(u.labelsSummary || ''),
        Number(u.commentsCount) || 0,
        String(u.lastCommentSummary || ''),
        ticketId,
      ]
    );
    res.json({ ok: true });
  });

  app.post('/api/neon/sessions', async (req, res) => {
    const item = {
      id: String(req.body.id || `sess_${Date.now()}`),
      ticketId: String(req.body.ticketId || ''),
      issueNumber: Number(req.body.issueNumber) || 1000,
      ticketTitle: String(req.body.ticketTitle || 'Chamado'),
      companyName: String(req.body.companyName || 'Tutora'),
      agentName: String(req.body.agentName || 'Felipe Olio'),
      startedAtIso: String(req.body.startedAtIso || new Date().toISOString()),
      endedAtIso: String(req.body.endedAtIso || new Date().toISOString()),
      durationSeconds: Number(req.body.durationSeconds) || 1,
      notes: String(req.body.notes || ''),
      sessionStatus: req.body.sessionStatus || 'pausada',
      ownerId: String(req.body.ownerId || 'default'),
    };
    neonStore.sessions = [item, ...neonStore.sessions];
    saveNeonStore();
    await executeNeonSql(
      `INSERT INTO attendance_sessions (
         id, ticket_id, issue_number, ticket_title, company_name,
         agent_name, started_at_iso, ended_at_iso, duration_seconds,
         notes, session_status, owner_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO NOTHING`,
      [
        item.id,
        item.ticketId,
        item.issueNumber,
        item.ticketTitle,
        item.companyName,
        item.agentName,
        item.startedAtIso,
        item.endedAtIso,
        item.durationSeconds,
        item.notes,
        item.sessionStatus,
        item.ownerId,
      ]
    );
    res.json({ ok: true, item });
  });

  app.post('/api/neon/audit-logs', async (req, res) => {
    const item = {
      id: String(req.body.id || `log_${Date.now()}`),
      eventType: String(req.body.eventType || 'sync_api'),
      actorName: String(req.body.actorName || 'Operador'),
      targetLabel: String(req.body.targetLabel || 'Chamado'),
      details: String(req.body.details || ''),
      origin: String(req.body.origin || 'Operador Web'),
      ownerId: String(req.body.ownerId || 'default'),
      createdAt: new Date().toISOString(),
    };
    neonStore.auditLogs = [item, ...neonStore.auditLogs];
    saveNeonStore();
    await executeNeonSql(
      `INSERT INTO audit_logs (id, event_type, actor_name, target_label, details, origin, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [
        item.id,
        item.eventType,
        item.actorName,
        item.targetLabel,
        item.details,
        item.origin,
        item.ownerId,
      ]
    );
    res.json({ ok: true, item });
  });

  app.post('/api/neon/reports', async (req, res) => {
    const item = {
      id: String(req.body.id || `rep_${Date.now()}`),
      title: String(req.body.title || 'Relatório'),
      companyFilter: String(req.body.companyFilter || 'Todas'),
      periodLabel: String(req.body.periodLabel || 'Outubro 2026'),
      totalTickets: Number(req.body.totalTickets) || 0,
      totalSeconds: Number(req.body.totalSeconds) || 0,
      totalBilledAmount: Number(req.body.totalBilledAmount) || 0,
      generatedBy: String(req.body.generatedBy || 'Felipe Olio'),
      ownerId: String(req.body.ownerId || 'default'),
      createdAt: new Date().toISOString(),
    };
    neonStore.reports = [item, ...neonStore.reports];
    saveNeonStore();
    await executeNeonSql(
      `INSERT INTO reports (
         id, title, company_filter, period_label, total_tickets,
         total_seconds, total_billed_amount, generated_by, owner_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        item.id,
        item.title,
        item.companyFilter,
        item.periodLabel,
        item.totalTickets,
        item.totalSeconds,
        item.totalBilledAmount,
        item.generatedBy,
        item.ownerId,
      ]
    );
    res.json({ ok: true, item });
  });

  app.delete('/api/neon/reports/:id', async (req, res) => {
    const reportId = String(req.params.id);
    neonStore.reports = neonStore.reports.filter((r) => r.id !== reportId);
    saveNeonStore();
    await executeNeonSql(`DELETE FROM reports WHERE id = $1`, [reportId]);
    res.json({ ok: true });
  });

  // Ensure any unmatched /api/* route always returns JSON and never falls through to Vite HTML
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ ok: false, connected: false, error: 'Endpoint de API não encontrado.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    // Serve a WebSocket-free /@vite/client so the browser never attempts a failing HMR WebSocket connection in the preview iframe
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(`import "/@vite/env";
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll(\`link[rel="stylesheet"][data-vite-dev-id="\${CSS.escape(id)}"]\`).forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return \`\${pathname}?\${queryToInject}\${search ? "&" + search.slice(1) : ""}\${hash || ""}\`;
}
const { HTMLElement = class {} } = globalThis;
class ErrorOverlay extends HTMLElement {}
export { ErrorOverlay, createHotContext, injectQuery, removeStyle, updateStyle };
`);
    });

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false as const,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ChronoDesk server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
