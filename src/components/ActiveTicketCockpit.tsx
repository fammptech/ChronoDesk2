import React, { useEffect, useState } from 'react';
import {
  Clock,
  Pause,
  Play,
  CheckCircle2,
  RotateCcw,
  ExternalLink,
  MessageSquare,
  GitBranch,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react';
import { Ticket, Company, TeamMember, IssueHistoryEntry } from '../types';
import { formatDurationHms } from '../utils/formatters';
import { IssueCommentAndClosePanel } from './IssueCommentAndClosePanel';
import { FormattedGitHubMarkdown } from './GitHubCardContentRenderer';

interface ActiveTicketCockpitProps {
  ticket: Ticket;
  currentColumnName: string;
  companies: Company[];
  teamMembers: TeamMember[];
  busyAction: boolean;
  sessionNote: string;
  onChangeSessionNote: (val: string) => void;
  onStartOrResume: (ticket: Ticket) => Promise<void>;
  onPause: (ticket: Ticket, elapsedCurrentRun: number) => Promise<void>;
  onCloseTicket: (ticket: Ticket, elapsedCurrentRun: number) => Promise<void>;
  onReopenTicket: (ticket: Ticket) => Promise<void>;
  onFetchGitHubComments: (ticket: Ticket) => Promise<void>;
  liveComments: Array<{ id: string; author: string; createdAt: string; body: string }>;
  loadingComments: boolean;
  issueHistory: IssueHistoryEntry[];
  onConfirmCommentOrClose: (params: {
    actionType: 'comment_and_move' | 'close_issue';
    commentMarkdown: string;
    targetStatusOptionId: string;
    targetStatusName: string;
  }) => Promise<void>;
  canStartTimer?: boolean;
  startTimerBlockedReason?: string;
  onOpenCardDetail?: () => void;
}

const STATUS_LABELS: Record<Ticket['status'], string> = {
  aberto: 'Aberto (Aguardando Início)',
  em_atendimento: 'Em Atendimento Ativo',
  pausado: 'Atendimento Pausado',
  encerrado: 'Concluído / Encerrado',
};

const PRIORITY_LABELS: Record<Ticket['priority'], string> = {
  baixa: 'Prioridade Baixa',
  media: 'Prioridade Média',
  alta: 'Prioridade Alta',
  critica: 'Prioridade Crítica (SLA)',
};

export const ActiveTicketCockpit: React.FC<ActiveTicketCockpitProps> = ({
  ticket,
  currentColumnName,
  busyAction,
  sessionNote,
  onChangeSessionNote,
  onStartOrResume,
  onPause,
  onCloseTicket,
  onReopenTicket,
  onFetchGitHubComments,
  liveComments,
  loadingComments,
  issueHistory,
  onConfirmCommentOrClose,
  canStartTimer = true,
  startTimerBlockedReason,
  onOpenCardDetail,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [showCommentPanel, setShowCommentPanel] = useState<boolean>(true);
  const [showFullBodyInCockpit, setShowFullBodyInCockpit] = useState<boolean>(false);

  useEffect(() => {
    if (ticket.status !== 'em_atendimento' || !ticket.activeSessionStartedAtMs) {
      return;
    }
    setNowMs(Date.now());
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [ticket.status, ticket.activeSessionStartedAtMs, ticket.id]);

  const currentRunSeconds =
    ticket.status === 'em_atendimento' && ticket.activeSessionStartedAtMs > 0
      ? Math.max(0, Math.floor((nowMs - ticket.activeSessionStartedAtMs) / 1000))
      : 0;

  const displayTotalSeconds = ticket.totalSecondsWorked + currentRunSeconds;

  const isRunning = ticket.status === 'em_atendimento';
  const isPaused = ticket.status === 'pausado';
  const isClosed = ticket.status === 'encerrado';

  return (
    <section
      aria-label="Console de Atendimento do Chamado"
      className="bg-white text-slate-900 rounded-xl border border-slate-200 shadow-xs p-6 lg:p-7 space-y-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* Left 7 columns: Core Ticket Info */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
          <div className="space-y-3.5">
            {/* Top Badges Row */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 font-mono font-semibold text-slate-700">
                {ticket.githubRepo}
              </span>

              <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-600">
                Coluna: <strong className="font-semibold text-slate-900">{currentColumnName}</strong>
              </span>

              <span
                className={`px-2.5 py-1 rounded-md border font-medium ${
                  ticket.priority === 'critica'
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : ticket.priority === 'alta'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : ticket.priority === 'media'
                    ? 'bg-sky-50 border-sky-200 text-sky-700'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                {PRIORITY_LABELS[ticket.priority]}
              </span>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-semibold ${
                  isRunning
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : isPaused
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : isClosed
                    ? 'bg-slate-100 border-slate-300 text-slate-700'
                    : 'bg-sky-50 border-sky-200 text-sky-800'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRunning
                      ? 'bg-emerald-500 animate-pulse'
                      : isPaused
                      ? 'bg-amber-500'
                      : isClosed
                      ? 'bg-slate-500'
                      : 'bg-sky-500'
                  }`}
                />
                {STATUS_LABELS[ticket.status]}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-display text-slate-900">
                CHAMADO #{ticket.issueNumber}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {onOpenCardDetail && (
                  <button
                    type="button"
                    onClick={onOpenCardDetail}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Abrir Card (Ver Conteúdo)</span>
                  </button>
                )}
                {ticket.githubIssueUrl && (
                  <a
                    href={ticket.githubIssueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Abrir no GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            <p className="text-base font-semibold text-slate-800 leading-snug">
              {ticket.title}
            </p>
            {ticket.description && (
              <div className="space-y-2">
                {showFullBodyInCockpit ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 max-h-80 overflow-y-auto">
                    <FormattedGitHubMarkdown content={ticket.description} />
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">
                    {ticket.description}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowFullBodyInCockpit((v) => !v)}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
                  >
                    {showFullBodyInCockpit
                      ? 'Recolher descrição no painel'
                      : 'Expandir descrição aqui'}
                  </button>
                  {onOpenCardDetail && (
                    <button
                      type="button"
                      onClick={onOpenCardDetail}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2 cursor-pointer"
                    >
                      Abrir visualização completa do card →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Metadata Block: Empresa & Responsável + GitHub Labels/Assignee */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Empresa
              </div>
              <div className="font-bold text-slate-900 mt-0.5">{ticket.companyName}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Responsável
              </div>
              <div className="font-bold text-slate-900 mt-0.5">{ticket.assigneeName}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                GitHub Assignee
              </div>
              <div className="font-mono text-xs font-semibold text-slate-700 mt-1">
                @{ticket.githubAssignee}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Labels Sincronizadas
              </div>
              <div
                className="text-xs font-medium text-slate-700 mt-1 truncate"
                title={ticket.labelsSummary}
              >
                {ticket.labelsSummary || 'Sem labels'}
              </div>
            </div>
          </div>

          {/* Note input for the current timer session */}
          <div className="space-y-1.5">
            <label
              htmlFor="session-note-input"
              className="block text-xs font-semibold text-slate-700"
            >
              Apontamento técnico da sessão do cronômetro (gravado em Sessões de Atendimento):
            </label>
            <input
              id="session-note-input"
              type="text"
              maxLength={450}
              value={sessionNote}
              onChange={(e) => onChangeSessionNote(e.target.value)}
              placeholder="Descreva a atividade executada neste turno de atendimento..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
            />
          </div>
        </div>

        {/* Right 5 columns: Stopwatch & Primary Controls */}
        <div
          className={`lg:col-span-5 flex flex-col justify-between rounded-xl border p-5 sm:p-6 transition-colors ${
            isRunning
              ? 'bg-emerald-50/50 border-emerald-300'
              : isPaused
              ? 'bg-amber-50/40 border-amber-200'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                <Clock className="w-4 h-4 text-slate-700" />
                <span>Cronômetro de Atendimento</span>
              </span>
              <span
                className={`font-mono font-semibold tabular-nums px-2 py-0.5 rounded border ${
                  isRunning
                    ? 'bg-emerald-100/80 border-emerald-300 text-emerald-900'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                Sessão atual: +{formatDurationHms(currentRunSeconds)}
              </span>
            </div>

            <div className="py-5 px-4 text-center bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div
                className="text-4xl sm:text-5xl font-bold font-mono tabular-nums tracking-tight text-slate-900"
                aria-live="polite"
              >
                ⏱ {formatDurationHms(displayTotalSeconds)}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Tempo total acumulado e auditado no Chamado #{ticket.issueNumber}
              </p>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="space-y-3 pt-4">
            {ticket.status !== 'encerrado' ? (
              <div className="grid grid-cols-2 gap-3">
                {ticket.status === 'em_atendimento' ? (
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => onPause(ticket, currentRunSeconds)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-amber-950 bg-amber-400 hover:bg-amber-300 border border-amber-500/40 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pausar Contagem</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyAction || !canStartTimer}
                    onClick={() => onStartOrResume(ticket)}
                    title={
                      !canStartTimer
                        ? startTimerBlockedReason ||
                          'Apenas o atendente atribuído a este card ou um Admin pode iniciar o cronômetro.'
                        : 'Iniciar contagem do tempo de atendimento'
                    }
                    className={`inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      !canStartTimer
                        ? 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed'
                        : 'text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer'
                    }`}
                  >
                    <Play className="w-4 h-4" />
                    <span>{!canStartTimer ? 'Timer Bloqueado (Não Atribuído)' : 'Iniciar Contagem'}</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => onCloseTicket(ticket, currentRunSeconds)}
                  title="Encerra apenas o turno atual do cronômetro e salva o tempo trabalhado (não fecha a issue no GitHub)"
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-slate-600" />
                  <span>Salvar & Parar Turno</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busyAction}
                onClick={() => onReopenTicket(ticket)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reabrir Chamado #{ticket.issueNumber}</span>
              </button>
            )}

            {!canStartTimer && startTimerBlockedReason && ticket.status !== 'encerrado' && (
              <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-[11px] text-amber-950 font-medium">
                {startTimerBlockedReason}
              </div>
            )}

            {/* GitHub Comments Inspector & Toggle */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowCommentPanel((v) => !v)}
                className="inline-flex items-center gap-1.5 text-slate-700 hover:text-slate-900 font-semibold cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-slate-600" />
                <span>
                  Comentários & Encerrar Issue ({issueHistory.length + ticket.commentsCount})
                </span>
                {showCommentPanel ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                type="button"
                disabled={loadingComments}
                onClick={() => onFetchGitHubComments(ticket)}
                className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{loadingComments ? 'Consultando API...' : 'Carregar Comentários GitHub'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* GitHub-Style Comment & Close Issue Panel (Adicionar comentário + Mover Coluna OU Encerrar issue com Modelo) */}
      {showCommentPanel && (
        <IssueCommentAndClosePanel
          issueNumber={ticket.issueNumber}
          issueTitle={ticket.title}
          currentColumnName={currentColumnName}
          currentAuthorName={ticket.assigneeName}
          currentAuthorHandle={ticket.githubAssignee}
          busyAction={busyAction}
          historyEntries={issueHistory}
          liveGitHubComments={liveComments}
          onConfirmCommentOrClose={onConfirmCommentOrClose}
          variant="cockpit"
        />
      )}

      {/* Bottom Architecture Pipeline Status Strip */}
      <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-700 font-semibold">Fluxo de Integração:</span>
          <span>GitHub (Issues · Labels · Assignees · Comentários · Status)</span>
          <span aria-hidden="true">→</span>
          <span>API / Webhook</span>
          <span aria-hidden="true">→</span>
          <span>Banco de Dados Firestore</span>
        </div>
        <div className="text-slate-500 truncate max-w-md">
          Última atividade: <span className="font-medium text-slate-700">{ticket.lastCommentSummary || 'Aguardando apontamento'}</span>
        </div>
      </div>
    </section>
  );
};
