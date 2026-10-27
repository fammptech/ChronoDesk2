/**
 * Exact Schema, Columns, Clients, Users, Labels, and Custom Fields
 * for @felipeolio's GitHub Project #3 ("Chamados") AND ZDT Organization Project #4 ("Governança ZDT")
 */

export interface ProjectFieldSchema {
  status: string;
  cliente: string;
  esteira: string;
  tipoDemanda: string;
  impedimento: string;
  priority: string;
  size: string;
  effort: string;
  chamado: string;
  horasGastas: string;
  estimate: string;
  startDate: string;
  targetDate: string;
  terminoPlanejado: string;
  proximoFollowUp: string;
  prioridadesSemanal: string;
}

export const PROJECT_BOARD_TARGETS: Record<
  'personal_3' | 'org_4',
  {
    key: 'personal_3' | 'org_4';
    label: string;
    projectId: string;
    projectUrl: string;
    defaultRepo: string;
    fieldIds: ProjectFieldSchema;
  }
> = {
  personal_3: {
    key: 'personal_3',
    label: 'users/felipeolio/projects/3 — Chamados',
    projectId: 'PVT_kwHOCCI68s4Bn8S0',
    projectUrl: 'https://github.com/users/felipeolio/projects/3',
    defaultRepo: 'zdttech-copilot/governanca-zdt',
    fieldIds: {
      status: 'PVTSSF_lAHOCCI68s4Bn8S0zhmel4g',
      cliente: 'PVTSSF_lAHOCCI68s4Bn8S0zhmel7o',
      esteira: 'PVTSSF_lAHOCCI68s4Bn8S0zhmel7w',
      tipoDemanda: 'PVTSSF_lAHOCCI68s4Bn8S0zhmel78',
      impedimento: 'PVTSSF_lAHOCCI68s4Bn8S0zhmel7c',
      priority: 'PVTSSF_lAHOCCI68s4Bn8S0zhmel68',
      size: 'PVTSSF_lAHOCCI68s4Bn8S0zhmel7A',
      effort: 'PVTSSF_lAHOCCI68s4Bn8S0zhmel7U',
      chamado: 'PVTSSF_lAHOCCI68s4Bn8S0zhmel8E',
      horasGastas: 'PVTF_lAHOCCI68s4Bn8S0zhmel60',
      estimate: 'PVTF_lAHOCCI68s4Bn8S0zhmel7E',
      startDate: 'PVTF_lAHOCCI68s4Bn8S0zhmel7M',
      targetDate: 'PVTF_lAHOCCI68s4Bn8S0zhmel7Q',
      terminoPlanejado: 'PVTF_lAHOCCI68s4Bn8S0zhmel7g',
      proximoFollowUp: 'PVTF_lAHOCCI68s4Bn8S0zhmel8A',
      prioridadesSemanal: 'PVTF_lAHOCCI68s4Bn8S0zhmel7k',
    },
  },
  org_4: {
    key: 'org_4',
    label: 'orgs/zdttech-copilot/projects/4 — Governança ZDT',
    projectId: 'PVT_kwDODck7Fs4Bg-wJ',
    projectUrl: 'https://github.com/orgs/zdttech-copilot/projects/4',
    defaultRepo: 'zdttech-copilot/governanca-zdt',
    fieldIds: {
      status: 'PVTSSF_lADODck7Fs4Bg-wJzhf8O78',
      cliente: 'PVTSSF_lADODck7Fs4Bg-wJzhf8O9Q',
      esteira: 'PVTSSF_lADODck7Fs4Bg-wJzhf8O9U',
      tipoDemanda: 'PVTSSF_lADODck7Fs4Bg-wJzhf9EC8',
      impedimento: 'PVTSSF_lADODck7Fs4Bg-wJzhf8O9E',
      priority: 'PVTSSF_lADODck7Fs4Bg-wJzhf8O8s',
      size: 'PVTSSF_lADODck7Fs4Bg-wJzhf8O8w',
      effort: 'PVTSSF_lADODck7Fs4Bg-wJzhf8O9A',
      chamado: 'PVTSSF_lADODck7Fs4Bg-wJzhhtfNQ',
      horasGastas: 'PVTF_lADODck7Fs4Bg-wJzhkNCZ4',
      estimate: 'PVTF_lADODck7Fs4Bg-wJzhf8O80',
      startDate: 'PVTF_lADODck7Fs4Bg-wJzhf8O84',
      targetDate: 'PVTF_lADODck7Fs4Bg-wJzhf8O88',
      terminoPlanejado: 'PVTF_lADODck7Fs4Bg-wJzhf8O9I',
      proximoFollowUp: 'PVTF_lADODck7Fs4Bg-wJzhhKlls',
      prioridadesSemanal: 'PVTF_lADODck7Fs4Bg-wJzhf8O9M',
    },
  },
};

// All 8 Exact Columns (Status Options) shared across both Projects
export const PROJECT_STATUS_COLUMNS = [
  { id: 'f75ad846', name: 'Backlog', color: 'GREEN' },
  { id: '43895d1f', name: 'Em análise / Refinamento', color: 'YELLOW' },
  { id: 'bd28435b', name: 'Aguardando aprovação', color: 'ORANGE' },
  { id: '3346a9c5', name: 'Impedimento', color: 'RED' },
  { id: '61e4505c', name: 'Pronto para execução', color: 'BLUE' },
  { id: '47fc9ee4', name: 'Em andamento', color: 'YELLOW' },
  { id: 'df73e18b', name: 'Em homologação', color: 'PURPLE' },
  { id: '98236657', name: 'Concluído', color: 'GREEN' },
] as const;

export const PROJECT_CLIENTES = [
  { id: '9dd47f26', name: 'Tutora', color: 'PURPLE' },
  { id: '3394f066', name: 'AMPM', color: 'YELLOW' },
  { id: '33230449', name: 'GoCase', color: 'BLUE' },
  { id: '4a93487e', name: 'Braveo', color: 'ORANGE' },
  { id: '6f127325', name: 'MDR', color: 'GREEN' },
] as const;

export const PROJECT_ESTEIRAS = [
  { id: '2e3155a0', name: 'N1 / Atendimento / Sustentação' },
  { id: '54954ba7', name: 'Desenvolvimento' },
  { id: 'efdba61c', name: 'Gestão / Governança' },
  { id: 'e0750e75', name: 'Projetos / Discovery' },
] as const;

export const PROJECT_TIPOS_DEMANDA = [
  { id: '5e2f50db', name: 'Incidente Crítico' },
  { id: 'c619391d', name: 'Dúvida / Suporte' },
  { id: 'a3fda112', name: 'Bug / Correção' },
  { id: '688f5a73', name: 'Parametrização / Análise' },
  { id: '8b236179', name: 'Melhoria' },
  { id: 'e2d26a45', name: 'Novo Desenvolvimento / Customização' },
  { id: 'dfad0ab9', name: 'Release / Go-Live' },
  { id: '41a74012', name: 'Release / Bug' },
  { id: 'a24a8a7d', name: 'Status Report' },
] as const;

export const PROJECT_IMPEDIMENTOS = [
  { id: 'ee3c6d41', name: '🚩Interno' },
  { id: '2a6a2d8d', name: '🚩Terceiro' },
  { id: '755ad2aa', name: '🚩Cliente' },
  { id: 'c97a319a', name: '🚩TOTVS' },
  { id: '6106c7aa', name: '🚩Aprovação' },
  { id: 'a83c12c1', name: '🚩Estimativa' },
  { id: '89a5b134', name: '🚩Acesso / Credencial' },
] as const;

export const PROJECT_PRIORITIES = [
  { id: '6c76281d', name: 'Urgent' },
  { id: 'f48e54af', name: 'High' },
  { id: '7d6b5376', name: 'Medium' },
  { id: '0ee5fb99', name: 'Low' },
] as const;

export const PROJECT_SIZES = [
  { id: '6c6483d2', name: 'XS' },
  { id: 'f784b110', name: 'S' },
  { id: '7515a9f1', name: 'M' },
  { id: '817d0097', name: 'L' },
  { id: 'db339eb2', name: 'XL' },
] as const;

export const PROJECT_EFFORTS = [
  { id: 'd2a58ae9', name: 'High' },
  { id: 'bdc97709', name: 'Medium' },
  { id: '0b83c2bc', name: 'Low' },
] as const;

export const PROJECT_ZDT_USERS = [
  { login: 'felipeolio', name: 'Felipe Olio' },
  { login: 'Bertrand-ZDT', name: 'Bertrand Dantas Bezerra' },
  { login: 'caiorafaelzdt', name: 'Caio Rafael' },
  { login: 'caiocustodio17', name: 'Caio Custódio' },
  { login: 'Jeferson993', name: 'Jeferson Lima' },
  { login: 'pragana12', name: 'Paulo Pragana' },
  { login: 'praganazdt', name: 'Pragana ZDT' },
  { login: 'amanda-fernandesZDT', name: 'Amanda Fernandes' },
  { login: 'andre-zdt', name: 'André ZDT' },
  { login: 'DerickZdt', name: 'Derick ZDT' },
  { login: 'wedsonzdt', name: 'Wedson ZDT' },
  { login: 'rafaaraujo83', name: 'Rafaela Araújo' },
  { login: 'owesleyoliveira', name: 'Wesley Oliveira' },
  { login: 'herllypetruccy', name: 'Herlly Petruccy' },
  { login: 'CaioBernardelliQ', name: 'Caio Bernardelli' },
  { login: 'zdt-copilot', name: 'ZDT Copilot' },
] as const;

export const PROJECT_LABELS = [
  'bug',
  'task',
  'epic',
  'enhancement',
  'question',
  'documentation',
  'encerramento-pendente',
  'ação-pendente',
  'follow-up-vencido',
  'duplicate',
  'help wanted',
  'good first issue',
] as const;

export interface MirroredBoardCard {
  itemId: string;
  contentId: string;
  contentType: 'Issue' | 'DraftIssue';
  issueNumber: number;
  title: string;
  body: string;
  state: 'OPEN' | 'CLOSED';
  url: string;
  repository: string;
  assignees: string[];
  labels: string[];
  commentsCount: number;
  // Exact Project Fields:
  statusColumn: string;
  statusOptionId: string;
  cliente: string;
  clienteOptionId: string;
  esteira: string;
  esteiraOptionId: string;
  tipoDemanda: string;
  tipoDemandaOptionId: string;
  impedimento: string;
  impedimentoOptionId: string;
  priority: string;
  priorityOptionId: string;
  size: string;
  sizeOptionId: string;
  effort: string;
  effortOptionId: string;
  chamado: string;
  horasGastas: number;
  estimate: number;
  startDate: string;
  targetDate: string;
  terminoPlanejado: string;
  proximoFollowUp: string;
  prioridadesSemanal: string;
  updatedAt: string;
}
