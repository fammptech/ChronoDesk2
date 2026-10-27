import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Plus,
  Play,
  Pause,
  CheckCircle2,
  Edit3,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  X,
  Send,
  GitFork,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
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
  PROJECT_LABELS,
  MirroredBoardCard,
} from '../project3Schema';
import { Ticket, IssueHistoryEntry } from '../types';
import { formatDurationHms } from '../utils/formatters';
import { IssueCommentAndClosePanel } from './IssueCommentAndClosePanel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export interface ProjectMetaState {
  connected: boolean;
  tokenPermissionError?: boolean;
  activeSource: 'personal_3' | 'org_4';
  personalProjectItemCount: number;
  orgProjectItemCount: number;
  projectTitle: string;
  projectUrl: string;
  message?: string;
}

interface KanbanBoardMirrorProps {
  cards: MirroredBoardCard[];
  ticketsByIssueNumber: Record<number, Ticket>;
  activeIssueNumber: number;
  busyAction: boolean;
  projectMeta: ProjectMetaState;
  syncingBoard: boolean;
  mirroringToPersonal: boolean;
  autoSyncEnabled: boolean;
  onToggleAutoSync: () => void;
  onPullFromGitHubBoard: () => Promise<void>;
  onMirrorOpenIssuesToProject3: () => Promise<void>;
  onSelectCard: (card: MirroredBoardCard) => void;
  onStartOrResumeCard: (card: MirroredBoardCard) => Promise<void>;
  onPauseCard: (card: MirroredBoardCard, elapsedSeconds: number) => Promise<void>;
  onCloseCard: (card: MirroredBoardCard, elapsedSeconds: number) => Promise<void>;
  onMoveCardToStatusColumn: (
    card: MirroredBoardCard,
    targetStatusOptionId: string,
    targetStatusName: string
  ) => Promise<void>;
  onSaveFullCardSync: (
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
  ) => Promise<void>;
  onCreateFullCardOnGitHub: (payload: {
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
  }) => Promise<void>;
  issueHistoryByNumber: Record<number, IssueHistoryEntry[]>;
  onConfirmCommentOrCloseCard: (
    card: MirroredBoardCard,
    params: {
      actionType: 'comment_and_move' | 'close_issue';
      commentMarkdown: string;
      targetStatusOptionId: string;
      targetStatusName: string;
    }
  ) => Promise<void>;
}

export const KanbanBoardMirror: React.FC<KanbanBoardMirrorProps> = ({
  cards,
  ticketsByIssueNumber,
  activeIssueNumber,
  busyAction,
  projectMeta,
  syncingBoard,
  mirroringToPersonal,
  autoSyncEnabled,
  onToggleAutoSync,
  onPullFromGitHubBoard,
  onMirrorOpenIssuesToProject3,
  onSelectCard,
  onStartOrResumeCard,
  onPauseCard,
  onCloseCard,
  onMoveCardToStatusColumn,
  onSaveFullCardSync,
  onCreateFullCardOnGitHub,
  issueHistoryByNumber,
  onConfirmCommentOrCloseCard,
}) => {
  // Board-level Filters matching exact GitHub Project fields
  const [filterCliente, setFilterCliente] = useState<string>('ALL');
  const [filterEsteira, setFilterEsteira] = useState<string>('ALL');
  const [filterAssignee, setFilterAssignee] = useState<string>('ALL');
  const [filterLabel, setFilterLabel] = useState<string>('ALL');
  const [hideEmptyColumns, setHideEmptyColumns] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const hasAnyRunningTimer = useMemo(() => {
    return Object.values(ticketsByIssueNumber).some(
      (t) => t.status === 'em_atendimento' && (t.activeSessionStartedAtMs || 0) > 0
    );
  }, [ticketsByIssueNumber]);

  useEffect(() => {
    if (!hasAnyRunningTimer) return;
    setNowMs(Date.now());
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [hasAnyRunningTimer]);

  // Full Card Editor Modal State
  const [editingCard, setEditingCard] = useState<MirroredBoardCard | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editState, setEditState] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [editAssignees, setEditAssignees] = useState<string[]>([]);
  const [editLabels, setEditLabels] = useState<string[]>([]);
  const [editStatusOptionId, setEditStatusOptionId] = useState('');
  const [editClienteOptionId, setEditClienteOptionId] = useState('');
  const [editEsteiraOptionId, setEditEsteiraOptionId] = useState('');
  const [editTipoDemandaOptionId, setEditTipoDemandaOptionId] = useState('');
  const [editImpedimentoOptionId, setEditImpedimentoOptionId] = useState('');
  const [editPriorityOptionId, setEditPriorityOptionId] = useState('');
  const [editSizeOptionId, setEditSizeOptionId] = useState('');
  const [editEffortOptionId, setEditEffortOptionId] = useState('');
  const [editHorasGastas, setEditHorasGastas] = useState<number>(0);
  const [editEstimate, setEditEstimate] = useState<number>(0);
  const [editTerminoPlanejado, setEditTerminoPlanejado] = useState('');
  const [editProximoFollowUp, setEditProximoFollowUp] = useState('');
  const [editPrioridadesSemanal, setEditPrioridadesSemanal] = useState('');
  const [editComment, setEditComment] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Create New Card Modal State
  const [creatingInStatusOptionId, setCreatingInStatusOptionId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newAssignees, setNewAssignees] = useState<string[]>(['felipeolio']);
  const [newLabels, setNewLabels] = useState<string[]>(['task']);
  const [newClienteOptionId, setNewClienteOptionId] = useState<string>(PROJECT_CLIENTES[0].id);
  const [newEsteiraOptionId, setNewEsteiraOptionId] = useState<string>(PROJECT_ESTEIRAS[0].id);
  const [newTipoDemandaOptionId, setNewTipoDemandaOptionId] = useState<string>(
    PROJECT_TIPOS_DEMANDA[1].id
  );
  const [newImpedimentoOptionId, setNewImpedimentoOptionId] = useState<string>('');
  const [newPriorityOptionId, setNewPriorityOptionId] = useState<string>(PROJECT_PRIORITIES[1].id);
  const [newSizeOptionId, setNewSizeOptionId] = useState<string>(PROJECT_SIZES[2].id);
  const [newEffortOptionId, setNewEffortOptionId] = useState<string>(PROJECT_EFFORTS[1].id);
  const [newEstimate, setNewEstimate] = useState<number>(2);
  const [newTerminoPlanejado, setNewTerminoPlanejado] = useState<string>('');
  const [newProximoFollowUp, setNewProximoFollowUp] = useState<string>('');
  const [creatingCard, setCreatingCard] = useState(false);

  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      if (filterCliente !== 'ALL' && c.cliente !== filterCliente) return false;
      if (filterEsteira !== 'ALL' && c.esteira !== filterEsteira) return false;
      if (filterAssignee !== 'ALL' && !c.assignees.includes(filterAssignee)) return false;
      if (filterLabel !== 'ALL' && !c.labels.includes(filterLabel)) return false;
      return true;
    });
  }, [cards, filterCliente, filterEsteira, filterAssignee, filterLabel]);

  const openEditModal = (card: MirroredBoardCard) => {
    onSelectCard(card);
    const linkedTicket = ticketsByIssueNumber[card.issueNumber];
    const workedHours = linkedTicket
      ? Number((linkedTicket.totalSecondsWorked / 3600).toFixed(4))
      : card.horasGastas;

    setEditingCard(card);
    setEditTitle(card.title);
    setEditBody(card.body);
    setEditState(card.state);
    setEditAssignees(card.assignees.length > 0 ? card.assignees : ['felipeolio']);
    setEditLabels(card.labels);
    setEditStatusOptionId(
      card.statusOptionId ||
        PROJECT_STATUS_COLUMNS.find((col) => col.name === card.statusColumn)?.id ||
        PROJECT_STATUS_COLUMNS[0].id
    );
    setEditClienteOptionId(
      card.clienteOptionId ||
        PROJECT_CLIENTES.find((cl) => cl.name === card.cliente)?.id ||
        ''
    );
    setEditEsteiraOptionId(
      card.esteiraOptionId ||
        PROJECT_ESTEIRAS.find((es) => es.name === card.esteira)?.id ||
        ''
    );
    setEditTipoDemandaOptionId(
      card.tipoDemandaOptionId ||
        PROJECT_TIPOS_DEMANDA.find((td) => td.name === card.tipoDemanda)?.id ||
        ''
    );
    setEditImpedimentoOptionId(
      card.impedimentoOptionId ||
        PROJECT_IMPEDIMENTOS.find((im) => im.name === card.impedimento)?.id ||
        ''
    );
    setEditPriorityOptionId(
      card.priorityOptionId ||
        PROJECT_PRIORITIES.find((pr) => pr.name === card.priority)?.id ||
        ''
    );
    setEditSizeOptionId(
      card.sizeOptionId || PROJECT_SIZES.find((sz) => sz.name === card.size)?.id || ''
    );
    setEditEffortOptionId(
      card.effortOptionId || PROJECT_EFFORTS.find((ef) => ef.name === card.effort)?.id || ''
    );
    setEditHorasGastas(workedHours || card.horasGastas || 0);
    setEditEstimate(card.estimate || 0);
    setEditTerminoPlanejado(card.terminoPlanejado || '');
    setEditProximoFollowUp(card.proximoFollowUp || '');
    setEditPrioridadesSemanal(card.prioridadesSemanal || '');
    setEditComment('');
  };

  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard || !editTitle.trim()) return;
    setSavingEdit(true);
    try {
      await onSaveFullCardSync(editingCard, {
        title: editTitle.trim(),
        body: editBody,
        state: editStatusOptionId === '98236657' ? 'CLOSED' : editState,
        assignees: editAssignees,
        labels: editLabels,
        statusOptionId: editStatusOptionId,
        clienteOptionId: editClienteOptionId,
        esteiraOptionId: editEsteiraOptionId,
        tipoDemandaOptionId: editTipoDemandaOptionId,
        impedimentoOptionId: editImpedimentoOptionId,
        priorityOptionId: editPriorityOptionId,
        sizeOptionId: editSizeOptionId,
        effortOptionId: editEffortOptionId,
        horasGastas: Number(editHorasGastas) || 0,
        estimate: Number(editEstimate) || 0,
        terminoPlanejado: editTerminoPlanejado,
        proximoFollowUp: editProximoFollowUp,
        prioridadesSemanal: editPrioridadesSemanal,
        commentToPost: editComment.trim(),
      });
      setEditingCard(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatingInStatusOptionId || !newTitle.trim()) return;
    setCreatingCard(true);
    try {
      await onCreateFullCardOnGitHub({
        title: newTitle.trim(),
        body: newBody,
        assignees: newAssignees,
        labels: newLabels,
        statusOptionId: creatingInStatusOptionId,
        clienteOptionId: newClienteOptionId,
        esteiraOptionId: newEsteiraOptionId,
        tipoDemandaOptionId: newTipoDemandaOptionId,
        impedimentoOptionId: newImpedimentoOptionId,
        priorityOptionId: newPriorityOptionId,
        sizeOptionId: newSizeOptionId,
        effortOptionId: newEffortOptionId,
        estimate: Number(newEstimate) || 0,
        terminoPlanejado: newTerminoPlanejado,
        proximoFollowUp: newProximoFollowUp,
      });
      setNewTitle('');
      setNewBody('');
      setCreatingInStatusOptionId(null);
    } finally {
      setCreatingCard(false);
    }
  };

  const toggleItemInList = (list: string[], item: string, setter: (val: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter((x) => x !== item));
    } else {
      setter([...list, item]);
    }
  };

  return (
    <section className="space-y-5" aria-label="Espelho do Quadro GitHub Projects">
      {/* Exact Field Filters: Cliente, Esteira, Usuário (Assignee), Tag (Label) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-48">
            <Select value={filterCliente} onValueChange={setFilterCliente}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  Cliente: Todos ({PROJECT_CLIENTES.length})
                </SelectItem>
                {PROJECT_CLIENTES.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    Cliente: {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-56">
            <Select value={filterEsteira} onValueChange={setFilterEsteira}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue placeholder="Esteira" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  Esteira: Todas ({PROJECT_ESTEIRAS.length})
                </SelectItem>
                {PROJECT_ESTEIRAS.map((e) => (
                  <SelectItem key={e.id} value={e.name}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-60">
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue placeholder="Usuário GitHub" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  Usuário GitHub: Todos ({PROJECT_ZDT_USERS.length})
                </SelectItem>
                {PROJECT_ZDT_USERS.map((u) => (
                  <SelectItem key={u.login} value={u.login}>
                    @{u.login} — {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-48">
            <Select value={filterLabel} onValueChange={setFilterLabel}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue placeholder="Tag / Label" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tag / Label: Todas</SelectItem>
                {PROJECT_LABELS.map((lbl) => (
                  <SelectItem key={lbl} value={lbl}>
                    Tag: {lbl}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideEmptyColumns}
            onChange={(e) => setHideEmptyColumns(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span>Ocultar colunas vazias</span>
        </label>
      </div>

      {/* Horizontal Scrollable 8-Column Kanban Board matching GitHub Project V2 */}
      <div className="overflow-x-auto pb-4">
        <div className="flex items-start gap-4 min-w-max">
          {PROJECT_STATUS_COLUMNS.map((col, colIndex) => {
            const colCards = filteredCards.filter((c) => {
              if (c.statusOptionId && c.statusOptionId === col.id) return true;
              return c.statusColumn.toLowerCase() === col.name.toLowerCase();
            });

            if (hideEmptyColumns && colCards.length === 0) {
              return null;
            }

            const prevCol = colIndex > 0 ? PROJECT_STATUS_COLUMNS[colIndex - 1] : null;
            const nextCol =
              colIndex < PROJECT_STATUS_COLUMNS.length - 1
                ? PROJECT_STATUS_COLUMNS[colIndex + 1]
                : null;

            const totalSecondsCol = colCards.reduce((acc, card) => {
              const t = ticketsByIssueNumber[card.issueNumber];
              const liveRun =
                t?.status === 'em_atendimento' && (t.activeSessionStartedAtMs || 0) > 0
                  ? Math.max(0, Math.floor((nowMs - t.activeSessionStartedAtMs) / 1000))
                  : 0;
              const secs = t
                ? t.totalSecondsWorked + liveRun
                : Math.round((card.horasGastas || 0) * 3600);
              return acc + secs;
            }, 0);

            return (
              <div
                key={col.id}
                className="w-80 shrink-0 bg-slate-100/90 border border-slate-200 rounded-xl p-3.5 flex flex-col space-y-3 min-h-[580px]"
              >
                {/* Column Header */}
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          col.color === 'GREEN'
                            ? 'bg-emerald-500'
                            : col.color === 'YELLOW'
                            ? 'bg-amber-500'
                            : col.color === 'ORANGE'
                            ? 'bg-orange-500'
                            : col.color === 'RED'
                            ? 'bg-rose-500'
                            : col.color === 'BLUE'
                            ? 'bg-sky-500'
                            : 'bg-purple-500'
                        }`}
                      />
                      <h3 className="text-sm font-bold text-slate-900 font-display">
                        {col.name}
                      </h3>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                      {colCards.length} {colCards.length === 1 ? 'card' : 'cards'} · ⏱{' '}
                      {formatDurationHms(totalSecondsCol)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCreatingInStatusOptionId(col.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer shrink-0"
                    title={`Criar card em ${col.name}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Card</span>
                  </button>
                </div>

                {/* Cards Stack */}
                <div className="space-y-3 flex-1">
                  {colCards.map((card) => {
                    const isFocused = card.issueNumber === activeIssueNumber;
                    const linkedTicket = ticketsByIssueNumber[card.issueNumber];
                    const isRunning =
                      linkedTicket?.status === 'em_atendimento' &&
                      (linkedTicket.activeSessionStartedAtMs || 0) > 0;
                    const currentRunSecs = isRunning
                      ? Math.max(
                          0,
                          Math.floor((nowMs - linkedTicket.activeSessionStartedAtMs) / 1000)
                        )
                      : 0;
                    const baseSecs = linkedTicket
                      ? linkedTicket.totalSecondsWorked
                      : Math.round((card.horasGastas || 0) * 3600);
                    const totalSecs = baseSecs + currentRunSecs;

                    return (
                      <article
                        key={`${card.itemId || card.contentId}_${card.issueNumber}`}
                        onClick={() => onSelectCard(card)}
                        className={`bg-white rounded-lg p-3.5 border transition-all cursor-pointer space-y-2.5 ${
                          isFocused
                            ? 'border-slate-900 ring-1 ring-slate-900 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Top Metadata Row: Cliente · #Issue · Priority */}
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <div className="truncate">
                            <span className="font-bold text-slate-900">
                              {card.cliente || 'ZDT'}
                            </span>
                            <span aria-hidden="true"> · </span>
                            <a
                              href={card.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="font-mono font-bold text-slate-800 hover:underline"
                            >
                              #{card.issueNumber}
                            </a>
                            {card.priority && (
                              <>
                                <span aria-hidden="true"> · </span>
                                <span
                                  className={
                                    card.priority === 'Urgent' || card.priority === 'High'
                                      ? 'font-semibold text-rose-700'
                                      : 'text-slate-600'
                                  }
                                >
                                  {card.priority}
                                </span>
                              </>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(card);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-900 rounded cursor-pointer shrink-0"
                            title="Editar todos os campos do Card e sincronizar com o GitHub"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Title */}
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                            {card.title}
                          </h4>
                          {card.body && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                              {card.body.replace(/#+/g, '').trim()}
                            </p>
                          )}
                        </div>

                        {/* Custom Project Fields: Esteira, Tipo de Demanda, Impedimento */}
                        {(card.esteira || card.tipoDemanda || card.impedimento) && (
                          <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                            {card.esteira && (
                              <div className="truncate">
                                <span className="text-slate-400">Esteira:</span>{' '}
                                <span className="font-medium text-slate-800">{card.esteira}</span>
                              </div>
                            )}
                            {card.tipoDemanda && (
                              <div className="truncate">
                                <span className="text-slate-400">Tipo:</span>{' '}
                                <span className="font-medium text-slate-800">
                                  {card.tipoDemanda}
                                </span>
                              </div>
                            )}
                            {card.impedimento && (
                              <div className="flex items-center gap-1 text-rose-700 font-semibold truncate">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>Impedimento: {card.impedimento}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Assignees (Usuários) & Labels (Tags) & Dates */}
                        <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-400">Usuários:</span>
                            <span className="font-mono font-medium text-slate-800 truncate">
                              {card.assignees.length > 0
                                ? card.assignees.map((a) => `@${a}`).join(', ')
                                : '@felipeolio'}
                            </span>
                          </div>

                          {card.labels.length > 0 && (
                            <div className="truncate" title={card.labels.join(', ')}>
                              <span className="text-slate-400">Tags:</span>{' '}
                              <span className="text-slate-700 font-medium">
                                {card.labels.join(', ')}
                              </span>
                            </div>
                          )}

                          {(card.terminoPlanejado || card.proximoFollowUp) && (
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-0.5 font-mono">
                              <Calendar className="w-3 h-3 shrink-0 text-slate-400" />
                              {card.terminoPlanejado && (
                                <span>Término: {card.terminoPlanejado}</span>
                              )}
                              {card.proximoFollowUp && (
                                <span>Follow-up: {card.proximoFollowUp}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Quick Column Selector + Timer Controls */}
                        <div
                          className="pt-2.5 border-t border-slate-100 space-y-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono tabular-nums text-xs font-bold text-slate-900">
                              ⏱ {formatDurationHms(totalSecs)}
                            </span>

                            <div className="flex items-center gap-1">
                              {prevCol && (
                                <button
                                  type="button"
                                  disabled={busyAction}
                                  onClick={() =>
                                    onMoveCardToStatusColumn(card, prevCol.id, prevCol.name)
                                  }
                                  className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                                  title={`Mover para ${prevCol.name} no GitHub`}
                                >
                                  <ArrowLeft className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {card.statusColumn !== 'Concluído' &&
                                (isRunning ? (
                                  <button
                                    type="button"
                                    disabled={busyAction}
                                    onClick={() => onPauseCard(card, currentRunSecs)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-900 bg-amber-300 hover:bg-amber-400 rounded cursor-pointer whitespace-nowrap shrink-0"
                                  >
                                    <Pause className="w-3 h-3" />
                                    <span>Pausar</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={busyAction}
                                    onClick={() => {
                                      onStartOrResumeCard(card);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded cursor-pointer whitespace-nowrap shrink-0"
                                  >
                                    <Play className="w-3 h-3" />
                                    <span>Atender</span>
                                  </button>
                                ))}

                              {card.statusColumn !== 'Concluído' && (
                                <button
                                  type="button"
                                  disabled={busyAction}
                                  onClick={() => onCloseCard(card, currentRunSecs)}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                  title="Encerrar timer de atendimento (mantém o card na coluna atual)"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {nextCol && (
                                <button
                                  type="button"
                                  disabled={busyAction}
                                  onClick={() =>
                                    onMoveCardToStatusColumn(card, nextCol.id, nextCol.name)
                                  }
                                  className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                                  title={`Mover para ${nextCol.name} no GitHub`}
                                >
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Direct Jump to Any of the 8 Columns */}
                          <Select
                            value={col.id}
                            disabled={busyAction}
                            onValueChange={(val) => {
                              const targetCol = PROJECT_STATUS_COLUMNS.find(
                                (c) => c.id === val
                              );
                              if (targetCol) {
                                onMoveCardToStatusColumn(card, targetCol.id, targetCol.name);
                              }
                            }}
                          >
                            <SelectTrigger
                              aria-label="Mover card diretamente para outra coluna do GitHub"
                              className="w-full h-7.5 px-2.5 py-1 text-[11px] bg-slate-50 border-slate-200 rounded text-slate-700 font-medium"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PROJECT_STATUS_COLUMNS.map((sc) => (
                                <SelectItem key={sc.id} value={sc.id}>
                                  Coluna GitHub: {sc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </article>
                    );
                  })}

                  {colCards.length === 0 && (
                    <div className="py-10 px-3 text-center border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 space-y-2">
                      <p>Nenhum card em {col.name}.</p>
                      <button
                        type="button"
                        onClick={() => setCreatingInStatusOptionId(col.id)}
                        className="text-slate-800 font-semibold underline underline-offset-2 cursor-pointer"
                      >
                        + Adicionar card
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full Bidirectional Card Edit Modal with ALL GitHub Project #3 / #4 Custom Fields */}
      {editingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl overflow-hidden shadow-xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Editar Card #{editingCard.issueNumber} — Sincronização Bidirecional GitHub Project
                </h3>
                <p className="text-xs text-slate-500">
                  Atualiza simultaneamente o repositório ({editingCard.repository}), o Project #3 (@felipeolio) e o Governança ZDT.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCard(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveEditSubmit}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título do Chamado / Issue
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              {/* Row 1: Coluna (Status), Cliente, Esteira */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Coluna no Quadro (Status)
                  </label>
                  <Select value={editStatusOptionId} onValueChange={setEditStatusOptionId}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUS_COLUMNS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cliente
                  </label>
                  <Select value={editClienteOptionId} onValueChange={setEditClienteOptionId}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Sem cliente definido" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem cliente definido</SelectItem>
                      {PROJECT_CLIENTES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Esteira
                  </label>
                  <Select value={editEsteiraOptionId} onValueChange={setEditEsteiraOptionId}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Sem esteira definida" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem esteira definida</SelectItem>
                      {PROJECT_ESTEIRAS.map((es) => (
                        <SelectItem key={es.id} value={es.id}>
                          {es.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Tipo de Demanda, Impedimento, Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tipo de Demanda
                  </label>
                  <Select
                    value={editTipoDemandaOptionId}
                    onValueChange={setEditTipoDemandaOptionId}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Não classificado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Não classificado</SelectItem>
                      {PROJECT_TIPOS_DEMANDA.map((td) => (
                        <SelectItem key={td.id} value={td.id}>
                          {td.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Impedimento
                  </label>
                  <Select
                    value={editImpedimentoOptionId}
                    onValueChange={setEditImpedimentoOptionId}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Nenhum impedimento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum impedimento</SelectItem>
                      {PROJECT_IMPEDIMENTOS.map((im) => (
                        <SelectItem key={im.id} value={im.id}>
                          {im.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Prioridade (Priority)
                  </label>
                  <Select value={editPriorityOptionId} onValueChange={setEditPriorityOptionId}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Padrão" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Padrão</SelectItem>
                      {PROJECT_PRIORITIES.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3: Size, Effort, Horas Gastas, Estimate */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Size
                  </label>
                  <Select value={editSizeOptionId} onValueChange={setEditSizeOptionId}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-</SelectItem>
                      {PROJECT_SIZES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Effort
                  </label>
                  <Select value={editEffortOptionId} onValueChange={setEditEffortOptionId}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-</SelectItem>
                      {PROJECT_EFFORTS.map((ef) => (
                        <SelectItem key={ef.id} value={ef.id}>
                          {ef.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Horas Gastas (GitHub)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={editHorasGastas}
                    onChange={(e) => setEditHorasGastas(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estimate (h)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editEstimate}
                    onChange={(e) => setEditEstimate(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Row 4: Datas & Prioridade Semanal */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Término Planejado
                  </label>
                  <input
                    type="date"
                    value={editTerminoPlanejado}
                    onChange={(e) => setEditTerminoPlanejado(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Próximo Follow-up
                  </label>
                  <input
                    type="date"
                    value={editProximoFollowUp}
                    onChange={(e) => setEditProximoFollowUp(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Prioridades Semanal
                  </label>
                  <input
                    type="text"
                    value={editPrioridadesSemanal}
                    onChange={(e) => setEditPrioridadesSemanal(e.target.value)}
                    placeholder="Ex: Prioridade S1"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Row 5: Usuários ZDT (Assignees) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Usuários Responsáveis no GitHub (Assignees)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  {PROJECT_ZDT_USERS.map((u) => {
                    const selected = editAssignees.includes(u.login);
                    return (
                      <button
                        key={u.login}
                        type="button"
                        onClick={() =>
                          toggleItemInList(editAssignees, u.login, setEditAssignees)
                        }
                        className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        @{u.login} ({u.name.split(' ')[0]})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 6: Tags / Labels */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tags / Labels do Repositório
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  {PROJECT_LABELS.map((lbl) => {
                    const selected = editLabels.includes(lbl);
                    return (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => toggleItemInList(editLabels, lbl, setEditLabels)}
                        className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 7: Descrição da Issue */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição Completa da Issue (Markdown)
                </label>
                <textarea
                  rows={4}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingCard(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {savingEdit
                      ? 'Sincronizando Campos...'
                      : 'Salvar Campos do Card'}
                  </span>
                </button>
              </div>

              {/* GitHub-Style Comment & Close Issue Section inside Modal */}
              <div className="pt-4 border-t border-slate-200">
                <IssueCommentAndClosePanel
                  issueNumber={editingCard.issueNumber}
                  issueTitle={editingCard.title}
                  currentColumnName={editingCard.statusColumn}
                  currentAuthorName={
                    PROJECT_ZDT_USERS.find(
                      (u) => u.login === (editingCard.assignees[0] || 'felipeolio')
                    )?.name || 'Felipe Olio'
                  }
                  currentAuthorHandle={editingCard.assignees[0] || 'felipeolio'}
                  busyAction={busyAction}
                  historyEntries={issueHistoryByNumber[editingCard.issueNumber] || []}
                  onConfirmCommentOrClose={async (params) => {
                    await onConfirmCommentOrCloseCard(editingCard, params);
                    setEditingCard((prev) =>
                      prev
                        ? {
                            ...prev,
                            statusOptionId: params.targetStatusOptionId,
                            statusColumn: params.targetStatusName,
                            state:
                              params.actionType === 'close_issue' ||
                              params.targetStatusName === 'Concluído'
                                ? 'CLOSED'
                                : 'OPEN',
                          }
                        : null
                    );
                  }}
                  variant="modal"
                />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Card Modal with Full Custom Fields */}
      {creatingInStatusOptionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden shadow-xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Novo Card no Quadro GitHub (
                  {PROJECT_STATUS_COLUMNS.find((c) => c.id === creatingInStatusOptionId)?.name})
                </h3>
                <p className="text-xs text-slate-500">
                  Cria a Issue em zdttech-copilot/governanca-zdt e vincula automaticamente aos Projects #3 e #4.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreatingInStatusOptionId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateSubmit}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título do Chamado / Card
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Tutora — #325900 — Ajuste de integração no módulo fiscal"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Coluna Inicial (Status)
                  </label>
                  <Select
                    value={creatingInStatusOptionId}
                    onValueChange={setCreatingInStatusOptionId}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUS_COLUMNS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cliente
                  </label>
                  <Select value={newClienteOptionId} onValueChange={setNewClienteOptionId}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_CLIENTES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Esteira
                  </label>
                  <Select value={newEsteiraOptionId} onValueChange={setNewEsteiraOptionId}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_ESTEIRAS.map((es) => (
                        <SelectItem key={es.id} value={es.id}>
                          {es.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tipo de Demanda
                  </label>
                  <Select
                    value={newTipoDemandaOptionId}
                    onValueChange={setNewTipoDemandaOptionId}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TIPOS_DEMANDA.map((td) => (
                        <SelectItem key={td.id} value={td.id}>
                          {td.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Prioridade
                  </label>
                  <Select value={newPriorityOptionId} onValueChange={setNewPriorityOptionId}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_PRIORITIES.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Impedimento (se houver)
                  </label>
                  <Select
                    value={newImpedimentoOptionId}
                    onValueChange={setNewImpedimentoOptionId}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Sem impedimento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem impedimento</SelectItem>
                      {PROJECT_IMPEDIMENTOS.map((im) => (
                        <SelectItem key={im.id} value={im.id}>
                          {im.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Size
                  </label>
                  <Select value={newSizeOptionId} onValueChange={setNewSizeOptionId}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_SIZES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Effort
                  </label>
                  <Select value={newEffortOptionId} onValueChange={setNewEffortOptionId}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_EFFORTS.map((ef) => (
                        <SelectItem key={ef.id} value={ef.id}>
                          {ef.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Término Planejado
                  </label>
                  <input
                    type="date"
                    value={newTerminoPlanejado}
                    onChange={(e) => setNewTerminoPlanejado(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Próximo Follow-up
                  </label>
                  <input
                    type="date"
                    value={newProximoFollowUp}
                    onChange={(e) => setNewProximoFollowUp(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Usuários Responsáveis (Assignees)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  {PROJECT_ZDT_USERS.map((u) => {
                    const selected = newAssignees.includes(u.login);
                    return (
                      <button
                        key={u.login}
                        type="button"
                        onClick={() =>
                          toggleItemInList(newAssignees, u.login, setNewAssignees)
                        }
                        className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        @{u.login}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tags / Labels
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  {PROJECT_LABELS.map((lbl) => {
                    const selected = newLabels.includes(lbl);
                    return (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => toggleItemInList(newLabels, lbl, setNewLabels)}
                        className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição do Chamado
                </label>
                <textarea
                  rows={3}
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCreatingInStatusOptionId(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingCard}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {creatingCard
                      ? 'Criando no GitHub Project...'
                      : 'Criar Card e Sincronizar com GitHub'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
