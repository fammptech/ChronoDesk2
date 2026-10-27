import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  Send,
  ArrowRight,
  ChevronDown,
  Clock,
  Eye,
  Edit3,
  GitCommitHorizontal,
} from 'lucide-react';
import { PROJECT_STATUS_COLUMNS } from '../project3Schema';
import { IssueHistoryEntry } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export const ISSUE_CLOSE_MARKDOWN_TEMPLATE = `## Encerramento

**Solução aplicada:**

**Ambiente:**

**Data:**

**Evidência / Referência:**

**Validado por:**

**Observações:**`;

interface IssueCommentAndClosePanelProps {
  issueNumber: number;
  issueTitle: string;
  currentColumnName: string;
  currentAuthorName: string;
  currentAuthorHandle: string;
  busyAction: boolean;
  historyEntries: IssueHistoryEntry[];
  liveGitHubComments?: Array<{ id: string; author: string; createdAt: string; body: string }>;
  onConfirmCommentOrClose: (params: {
    actionType: 'comment_and_move' | 'close_issue';
    commentMarkdown: string;
    targetStatusOptionId: string;
    targetStatusName: string;
  }) => Promise<void>;
  variant?: 'cockpit' | 'modal';
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 text-xs font-mono bg-slate-100 text-slate-800 rounded border border-slate-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export function renderMarkdownBlock(markdown: string): React.ReactNode {
  const lines = (markdown || '').split('\n');
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-slate-700">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={i} className="h-1.5" />;
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h4
              key={i}
              className="text-sm font-bold tracking-tight text-slate-900 pt-1 pb-0.5 border-b border-slate-200"
            >
              {renderInlineMarkdown(trimmed.slice(3))}
            </h4>
          );
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h5 key={i} className="text-xs font-bold text-slate-900 pt-1">
              {renderInlineMarkdown(trimmed.slice(4))}
            </h5>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={i} className="flex items-start gap-2 pl-2">
              <span aria-hidden="true">•</span>
              <span>{renderInlineMarkdown(trimmed.slice(2))}</span>
            </div>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap break-words">
            {renderInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

export const IssueCommentAndClosePanel: React.FC<IssueCommentAndClosePanelProps> = ({
  issueNumber,
  issueTitle,
  currentColumnName,
  currentAuthorName,
  currentAuthorHandle,
  busyAction,
  historyEntries,
  liveGitHubComments = [],
  onConfirmCommentOrClose,
}) => {
  const [selectedAction, setSelectedAction] = useState<'comment_and_move' | 'close_issue'>(
    'comment_and_move'
  );
  const [commentText, setCommentText] = useState<string>('');
  const [selectedTargetColumnId, setSelectedTargetColumnId] = useState<string>('');
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  // Reset destination column selection when switching issues
  useEffect(() => {
    setSelectedTargetColumnId('');
    setValidationMessage(null);
    setDropdownOpen(false);
  }, [issueNumber]);

  const handleSelectAction = (nextAction: 'comment_and_move' | 'close_issue') => {
    setValidationMessage(null);
    setDropdownOpen(false);

    if (nextAction === 'close_issue') {
      setSelectedAction('close_issue');
      // Automatically insert the closing template ONLY when "Encerrar issue" is selected
      if (!commentText.trim()) {
        setCommentText(ISSUE_CLOSE_MARKDOWN_TEMPLATE);
      } else if (!commentText.includes('## Encerramento')) {
        setCommentText(`${commentText.trim()}\n\n${ISSUE_CLOSE_MARKDOWN_TEMPLATE}`);
      }
      // Automatically target "Concluído" (id: 98236657)
      setSelectedTargetColumnId('98236657');
    } else {
      setSelectedAction('comment_and_move');
      // Remove template if it was untouched when switching back to "Adicionar comentário"
      if (commentText.trim() === ISSUE_CLOSE_MARKDOWN_TEMPLATE.trim()) {
        setCommentText('');
      }
      // Require explicit destination column choice for "Adicionar comentário"
      setSelectedTargetColumnId('');
    }
  };

  const targetColObj = PROJECT_STATUS_COLUMNS.find((c) => c.id === selectedTargetColumnId);

  const canConfirm =
    selectedAction === 'close_issue'
      ? commentText.trim().length > 0
      : commentText.trim().length > 0 && Boolean(selectedTargetColumnId);

  const handleConfirm = async () => {
    setValidationMessage(null);

    if (!commentText.trim()) {
      setValidationMessage(
        selectedAction === 'close_issue'
          ? 'Preencha e confirme o comentário de encerramento antes de encerrar a issue.'
          : 'Escreva um comentário antes de confirmar.'
      );
      return;
    }

    if (selectedAction === 'comment_and_move' && !selectedTargetColumnId) {
      setValidationMessage(
        'Selecione para qual coluna a issue deverá ser movida antes de confirmar o comentário.'
      );
      return;
    }

    const finalOptionId =
      selectedAction === 'close_issue' ? '98236657' : selectedTargetColumnId;
    const finalColName =
      selectedAction === 'close_issue'
        ? 'Concluído'
        : targetColObj?.name || currentColumnName;

    setSubmitting(true);
    try {
      await onConfirmCommentOrClose({
        actionType: selectedAction,
        commentMarkdown: commentText,
        targetStatusOptionId: finalOptionId,
        targetStatusName: finalColName,
      });
      setCommentText('');
      setSelectedTargetColumnId('');
      setSelectedAction('comment_and_move');
      setEditorTab('write');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4 text-slate-900">
      {/* Header & GitHub-Style Action Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-slate-700 shrink-0" />
            <h3 className="text-sm font-bold font-display text-slate-900">
              Comentários e Encerramento da Issue #{issueNumber}
            </h3>
          </div>
          <p className="text-xs text-slate-600">
            Coluna atual: <strong className="font-semibold text-slate-900">{currentColumnName}</strong> · Escolha entre comentar com movimentação de coluna ou encerrar a issue com modelo padrão.
          </p>
        </div>

        {/* Two Action Radio/Segmented Buttons: Adicionar comentário | Encerrar issue */}
        <div
          role="group"
          aria-label="Escolher ação do comentário"
          className="inline-flex items-center gap-1 p-1 rounded-lg bg-white border border-slate-300"
        >
          <button
            type="button"
            onClick={() => handleSelectAction('comment_and_move')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedAction === 'comment_and_move'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Adicionar comentário</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectAction('close_issue')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedAction === 'close_issue'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Encerrar issue</span>
          </button>
        </div>
      </div>

      {/* Write / Preview Tabs + Markdown Textarea */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setEditorTab('write')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded cursor-pointer ${
                editorTab === 'write'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>Escrever (Markdown)</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorTab('preview')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded cursor-pointer ${
                editorTab === 'preview'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Visualizar Markdown</span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-500">
            {selectedAction === 'close_issue'
              ? 'Modo: Encerrar issue (Modelo de encerramento ativo)'
              : 'Modo: Adicionar comentário + Escolher coluna'}
          </span>
        </div>

        {editorTab === 'write' ? (
          <textarea
            rows={selectedAction === 'close_issue' ? 11 : 4}
            value={commentText}
            onChange={(e) => {
              setCommentText(e.target.value);
              if (validationMessage) setValidationMessage(null);
            }}
            placeholder={
              selectedAction === 'close_issue'
                ? 'Preencha o modelo de encerramento da issue...'
                : `Adicione um comentário em Markdown para a Issue #${issueNumber} (${issueTitle})...`
            }
            className="w-full px-3.5 py-2.5 text-xs font-mono rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
          />
        ) : (
          <div className="min-h-[110px] p-3.5 rounded-lg border border-slate-300 bg-white text-slate-900">
            {commentText.trim() ? (
              renderMarkdownBlock(commentText)
            ) : (
              <p className="text-xs text-slate-500 italic">
                Nenhum conteúdo em Markdown para pré-visualizar.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Conditional Destination Column Selector or Automatic Closure Target */}
      {selectedAction === 'comment_and_move' ? (
        <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-800 flex flex-wrap items-center gap-2">
                <span>Adicionar comentário e mover para:</span>
                <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
                  Obrigatório selecionar coluna
                </span>
              </label>
              {selectedTargetColumnId && (
                <span className="text-xs font-mono font-semibold text-emerald-700 block">
                  Movimentação selecionada: {currentColumnName} → {targetColObj?.name}
                </span>
              )}
            </div>

            <div className="w-full sm:w-72">
              <Select
                value={selectedTargetColumnId}
                onValueChange={(val) => {
                  setSelectedTargetColumnId(val);
                  if (validationMessage) setValidationMessage(null);
                }}
              >
                <SelectTrigger className="bg-slate-50 border-slate-300 text-slate-900">
                  <SelectValue placeholder="Selecione a coluna de destino..." />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUS_COLUMNS.map((col) => {
                    const isCurrent =
                      col.name.toLowerCase() === (currentColumnName || '').toLowerCase();
                    return (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name} {isCurrent ? '(coluna atual)' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PROJECT_STATUS_COLUMNS.map((col) => {
              const isSelected = selectedTargetColumnId === col.id;
              const isCurrent =
                col.name.toLowerCase() === (currentColumnName || '').toLowerCase();
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => {
                    setSelectedTargetColumnId(col.id);
                    if (validationMessage) setValidationMessage(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <span>{col.name}</span>
                  {isCurrent && (
                    <span className="text-[10px] opacity-75 font-mono">(atual)</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-950">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              Ao confirmar <strong>Encerrar issue</strong>: salva o comentário de encerramento, atualiza o status para <strong>Concluído/Encerrado</strong> e move automaticamente de{' '}
              <strong>{currentColumnName}</strong> para a coluna <strong>Concluído</strong>.
            </span>
          </div>
        </div>
      )}

      {validationMessage && (
        <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
          {validationMessage}
        </div>
      )}

      {/* Bottom Bar with GitHub-Style Split Action Button (Comment / Close issue) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="text-xs text-slate-600">
          Responsável pelo registro: <strong className="font-mono text-slate-900">@{currentAuthorHandle}</strong> ({currentAuthorName})
        </div>

        <div className="relative inline-flex items-stretch">
          {/* Primary Confirm Button */}
          <button
            type="button"
            disabled={busyAction || submitting || !canConfirm}
            onClick={handleConfirm}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-l-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
              selectedAction === 'close_issue'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {selectedAction === 'close_issue' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {submitting
                    ? 'Encerrando Issue...'
                    : 'Confirmar e Encerrar Issue (Mover para Concluído)'}
                </span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>
                  {submitting
                    ? 'Salvando e Movendo...'
                    : targetColObj
                    ? `Adicionar comentário e mover para "${targetColObj.name}"`
                    : 'Adicionar comentário (Selecione a coluna)'}
                </span>
              </>
            )}
          </button>

          {/* Split Dropdown Toggle (GitHub "Close issue / Comment" switcher) */}
          <button
            type="button"
            disabled={busyAction || submitting}
            onClick={() => setDropdownOpen((v) => !v)}
            aria-label="Alternar entre Adicionar comentário e Encerrar issue"
            className={`px-2.5 py-2 text-xs font-semibold text-white rounded-r-lg border-l border-white/20 transition-colors cursor-pointer ${
              selectedAction === 'close_issue'
                ? 'bg-emerald-700 hover:bg-emerald-800'
                : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 bottom-full mb-1.5 w-72 rounded-lg border border-slate-200 bg-white text-slate-900 shadow-lg z-30 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => handleSelectAction('comment_and_move')}
                className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 border-b border-slate-200 flex items-start gap-2.5 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900">Adicionar comentário</div>
                  <div className="text-[11px] text-slate-500">
                    Comenta na issue e move para a coluna selecionada sem encerrar automaticamente.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectAction('close_issue')}
                className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-start gap-2.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900">Encerrar issue (Close issue)</div>
                  <div className="text-[11px] text-slate-500">
                    Insere o modelo de encerramento, fecha a issue e move para &quot;Concluído&quot;.
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Issue Comment & Movement History Timeline */}
      <div className="pt-3 border-t border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-800 inline-flex items-center gap-1.5">
            <GitCommitHorizontal className="w-3.5 h-3.5 text-slate-600" />
            <span>
              Histórico de Comentários e Movimentações da Issue #{issueNumber} (
              {historyEntries.length + liveGitHubComments.length})
            </span>
          </span>
        </div>

        {historyEntries.length === 0 && liveGitHubComments.length === 0 ? (
          <p className="text-xs text-slate-500">
            Nenhuma movimentação com comentário registrada nesta sessão para a Issue #{issueNumber}.
          </p>
        ) : (
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {historyEntries.map((entry) => (
              <div
                key={entry.id}
                className="p-3 rounded-lg border border-slate-200 bg-white text-slate-800 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pb-1.5 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-900">
                      @{entry.authorHandle}
                    </span>
                    <span className="text-slate-600">({entry.authorName})</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                      <span>{entry.previousColumn}</span>
                      <ArrowRight className="w-3 h-3" />
                      <strong className="text-emerald-700">{entry.targetColumn}</strong>
                    </span>
                    {entry.closedIssue && (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-semibold text-emerald-800">
                        Issue Encerrada (Concluído/Encerrado)
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-slate-500 inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(entry.createdAtIso).toLocaleString('pt-BR')}
                  </span>
                </div>

                <div>{renderMarkdownBlock(entry.commentMarkdown)}</div>
              </div>
            ))}

            {liveGitHubComments.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-lg border border-slate-200 bg-white text-slate-800 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500 pb-1 border-b border-slate-100">
                  <span className="font-mono font-bold text-slate-900">@{c.author}</span>
                  <span className="font-mono">
                    {new Date(c.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div>{renderMarkdownBlock(c.body)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
