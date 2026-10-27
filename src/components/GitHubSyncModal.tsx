import React, { useState } from 'react';
import { X, RefreshCw, Webhook, Plus, Check } from 'lucide-react';
import { Company, TeamMember, TicketPriority } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface GitHubSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  teamMembers: TeamMember[];
  onSyncGitHubRepo: (params: {
    repo: string;
    companyId: string;
    defaultAssigneeName: string;
    limit: number;
  }) => Promise<void>;
  onTriggerWebhookEvent: (params: {
    eventType: 'issues' | 'issue_comment';
    action: string;
    companyId: string;
    assigneeName: string;
    issueNumber: number;
    title: string;
    labelsSummary: string;
    commentBody: string;
  }) => Promise<void>;
  onCreateManualTicket: (params: {
    issueNumber: number;
    title: string;
    description: string;
    companyId: string;
    assigneeName: string;
    priority: TicketPriority;
    labelsSummary: string;
  }) => Promise<void>;
}

export const GitHubSyncModal: React.FC<GitHubSyncModalProps> = ({
  isOpen,
  onClose,
  companies,
  teamMembers,
  onSyncGitHubRepo,
  onTriggerWebhookEvent,
  onCreateManualTicket,
}) => {
  const [activeTab, setActiveTab] = useState<'api' | 'webhook' | 'manual'>('api');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companies[0]?.id || '');
  const [selectedAssignee, setSelectedAssignee] = useState<string>(teamMembers[0]?.name || 'Felipe');
  const [repoInput, setRepoInput] = useState<string>(companies[0]?.githubRepo || 'vercel/next.js');
  const [limitInput, setLimitInput] = useState<number>(4);
  const [userRepos, setUserRepos] = useState<
    Array<{ fullName: string; name: string; openIssuesCount: number }>
  >([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);

  const loadFelipeRepos = async () => {
    setLoadingRepos(true);
    try {
      const res = await fetch('/api/github/user-repos?username=felipeolio');
      const data = await res.json();
      if (res.ok && Array.isArray(data.repos)) {
        setUserRepos(data.repos);
        if (data.repos.length > 0) {
          setRepoInput(data.repos[0].fullName);
        }
      }
    } catch {
      // ignore error
    } finally {
      setLoadingRepos(false);
    }
  };

  // Webhook fields
  const [whEvent, setWhEvent] = useState<'issues' | 'issue_comment'>('issues');
  const [whAction, setWhAction] = useState<string>('opened');
  const [whIssueNum, setWhIssueNum] = useState<number>(1249);
  const [whTitle, setWhTitle] = useState<string>(
    'Timeout na reconciliação de eventos de faturamento via Webhook'
  );
  const [whLabels, setWhLabels] = useState<string>('bug, production, webhook');
  const [whComment, setWhComment] = useState<string>(
    'Payload recebido via POST /api/webhooks/github e atribuído automaticamente.'
  );

  // Manual ticket fields
  const [manualNum, setManualNum] = useState<number>(1250);
  const [manualTitle, setManualTitle] = useState<string>('');
  const [manualDesc, setManualDesc] = useState<string>('');
  const [manualPriority, setManualPriority] = useState<TicketPriority>('alta');
  const [manualLabels, setManualLabels] = useState<string>('suporte, sla');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const effectiveCompanyId = selectedCompanyId || companies[0]?.id || '';

  const handleCompanyChange = (compId: string) => {
    setSelectedCompanyId(compId);
    const found = companies.find((c) => c.id === compId);
    if (found) {
      setRepoInput(found.githubRepo);
    }
  };

  const handleRunApiSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveCompanyId) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await onSyncGitHubRepo({
        repo: repoInput.trim(),
        companyId: effectiveCompanyId,
        defaultAssigneeName: selectedAssignee,
        limit: limitInput,
      });
      setFeedback('Issues sincronizadas com sucesso via GitHub REST API e salvas no banco.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Falha na sincronização com o GitHub.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveCompanyId) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await onTriggerWebhookEvent({
        eventType: whEvent,
        action: whAction,
        companyId: effectiveCompanyId,
        assigneeName: selectedAssignee,
        issueNumber: whIssueNum,
        title: whTitle,
        labelsSummary: whLabels,
        commentBody: whComment,
      });
      setFeedback('Evento de Webhook processado em /api/webhooks/github e gravado na Auditoria.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao disparar Webhook.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveCompanyId || !manualTitle.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await onCreateManualTicket({
        issueNumber: manualNum,
        title: manualTitle,
        description: manualDesc,
        companyId: effectiveCompanyId,
        assigneeName: selectedAssignee,
        priority: manualPriority,
        labelsSummary: manualLabels,
      });
      setManualTitle('');
      setManualDesc('');
      setFeedback('Chamado registrado no banco de dados com sucesso.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao criar chamado.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-display">
              Integração GitHub Issues — API & Webhook
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Importe Issues, Labels, Assignees, Comentários e Status diretamente para o Banco de Dados
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Filter/Mode Tabs */}
        <div className="px-6 pt-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('api');
              setFeedback(null);
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'api'
                ? 'border-slate-900 text-slate-900 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            GitHub REST API (IssuesAo Vivo)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('webhook');
              setFeedback(null);
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'webhook'
                ? 'border-slate-900 text-slate-900 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Webhook Receiver (/api/webhooks/github)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('manual');
              setFeedback(null);
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'manual'
                ? 'border-slate-900 text-slate-900 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Novo Chamado Manual
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Shared Company & Assignee Target Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Empresa Destino (Contrato)
              </label>
              <Select value={effectiveCompanyId} onValueChange={handleCompanyChange}>
                <SelectTrigger className="w-full h-9.5 bg-white">
                  <SelectValue placeholder="Selecione a empresa destino" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.name} ({c.githubRepo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Responsável Técnico Padrão
              </label>
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger className="w-full h-9.5 bg-white">
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.name}>
                      {m.name} (@{m.githubHandle})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {activeTab === 'api' && (
            <form onSubmit={handleRunApiSync} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-xs text-slate-700">
                  Conta GitHub detectada: <strong className="font-mono">@felipeolio</strong>
                </div>
                <button
                  type="button"
                  disabled={loadingRepos}
                  onClick={loadFelipeRepos}
                  className="px-3 py-1 text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {loadingRepos ? 'Buscando repositórios...' : 'Carregar Repositórios de @felipeolio'}
                </button>
              </div>

              {userRepos.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Selecionar Repositório de @felipeolio
                  </label>
                  <Select value={repoInput} onValueChange={setRepoInput}>
                    <SelectTrigger className="w-full h-9.5 font-mono bg-white">
                      <SelectValue placeholder="Selecione o repositório" />
                    </SelectTrigger>
                    <SelectContent>
                      {userRepos.map((r) => (
                        <SelectItem key={r.fullName} value={r.fullName} className="font-mono">
                          {r.fullName} ({r.openIssuesCount} issues abertas)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Repositório GitHub (owner/repo)
                  </label>
                  <input
                    type="text"
                    required
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    placeholder="ex: vercel/next.js ou facebook/react"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Qtd. de Issues Recentes
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={limitInput}
                    onChange={(e) => setLimitInput(Number(e.target.value) || 4)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Consulta em tempo real a API oficial <span className="font-mono">https://api.github.com/repos/{repoInput}/issues</span> e importa Issues, Labels, Assignees, contagem de Comentários e Status para o Firestore.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${submitting ? 'animate-spin' : ''}`} />
                  <span>{submitting ? 'Sincronizando Issues...' : 'Importar Issues do GitHub'}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'webhook' && (
            <form onSubmit={handleRunWebhook} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono">
                POST /api/webhooks/github · Header: X-GitHub-Event: {whEvent}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Evento GitHub
                  </label>
                  <Select
                    value={whEvent}
                    onValueChange={(val) => setWhEvent(val as 'issues' | 'issue_comment')}
                  >
                    <SelectTrigger className="w-full h-9.5 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="issues">issues</SelectItem>
                      <SelectItem value="issue_comment">issue_comment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Action
                  </label>
                  <Select value={whAction} onValueChange={setWhAction}>
                    <SelectTrigger className="w-full h-9.5 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="opened">opened</SelectItem>
                      <SelectItem value="labeled">labeled</SelectItem>
                      <SelectItem value="assigned">assigned</SelectItem>
                      <SelectItem value="created">comment.created</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Issue #
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={whIssueNum}
                    onChange={(e) => setWhIssueNum(Number(e.target.value) || 1249)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Título da Issue no Payload
                </label>
                <input
                  type="text"
                  required
                  value={whTitle}
                  onChange={(e) => setWhTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Labels (separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    value={whLabels}
                    onChange={(e) => setWhLabels(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Comentário / Nota do Evento
                  </label>
                  <input
                    type="text"
                    value={whComment}
                    onChange={(e) => setWhComment(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Webhook className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Enviando Webhook...' : 'Disparar Webhook Real'}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'manual' && (
            <form onSubmit={handleCreateManual} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Número do Chamado (#)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={manualNum}
                    onChange={(e) => setManualNum(Number(e.target.value) || 1250)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Prioridade SLA
                  </label>
                  <Select
                    value={manualPriority}
                    onValueChange={(val) => setManualPriority(val as TicketPriority)}
                  >
                    <SelectTrigger className="w-full h-9.5 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Labels
                  </label>
                  <input
                    type="text"
                    value={manualLabels}
                    onChange={(e) => setManualLabels(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Título do Chamado
                </label>
                <input
                  type="text"
                  required
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Ex: Investigar erro de timeout na integração da XPTO"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Descrição Técnica
                </label>
                <textarea
                  rows={2}
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  placeholder="Contexto técnico, passos de reprodução e impacto..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Salvando...' : 'Criar Chamado'}</span>
                </button>
              </div>
            </form>
          )}

          {feedback && (
            <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-2 text-xs text-slate-800">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
