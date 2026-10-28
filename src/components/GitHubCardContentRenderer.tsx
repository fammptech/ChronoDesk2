import React, { useCallback, useEffect, useState } from 'react';
import {
  FileText,
  MessageSquare,
  RefreshCw,
  ExternalLink,
  CheckSquare,
  Square,
  Clock,
  User,
} from 'lucide-react';

export interface LiveGitHubComment {
  id: string;
  author: string;
  authorAvatar?: string;
  createdAt: string;
  body: string;
  htmlUrl?: string;
}

export interface LiveGitHubIssueDetails {
  number: number;
  title: string;
  body: string;
  state: string;
  author: string;
  authorAvatar?: string;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  commentsCount: number;
}

interface GitHubCardContentRendererProps {
  repo: string;
  issueNumber: number;
  fallbackBody: string;
  fallbackAuthor?: string;
  fallbackUpdatedAt?: string;
  issueUrl?: string;
  onEditClick?: () => void;
}

export const FormattedGitHubMarkdown: React.FC<{ content: string }> = ({ content }) => {
  if (!content || !content.trim()) {
    return (
      <div className="py-6 text-center text-xs text-slate-400 italic">
        Nenhuma descrição detalhada cadastrada no corpo desta Issue no GitHub.
      </div>
    );
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code_${idx}`}
            className="my-2.5 p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed"
          >
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      return;
    }

    if (!trimmed) {
      elements.push(<div key={`sp_${idx}`} className="h-2" />);
      return;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h5
          key={`h3_${idx}`}
          className="text-sm font-bold text-slate-900 pt-2 pb-1 border-b border-slate-100"
        >
          {trimmed.slice(4)}
        </h5>
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <h4
          key={`h2_${idx}`}
          className="text-base font-bold text-slate-900 pt-3 pb-1 border-b border-slate-200"
        >
          {trimmed.slice(3)}
        </h4>
      );
      return;
    }

    if (trimmed.startsWith('# ')) {
      elements.push(
        <h3
          key={`h1_${idx}`}
          className="text-lg font-bold text-slate-900 pt-3 pb-1.5 border-b border-slate-200"
        >
          {trimmed.slice(2)}
        </h3>
      );
      return;
    }

    // Task list items: - [ ] or - [x]
    if (/^[-*]\s+\[[ xX]\]\s+/.test(trimmed)) {
      const isChecked = /^[-*]\s+\[[xX]\]\s+/.test(trimmed);
      const labelText = trimmed.replace(/^[-*]\s+\[[ xX]\]\s+/, '');
      elements.push(
        <div key={`chk_${idx}`} className="flex items-start gap-2 py-0.5 text-sm text-slate-800">
          {isChecked ? (
            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          )}
          <span className={isChecked ? 'line-through text-slate-500' : 'text-slate-800'}>
            {labelText}
          </span>
        </div>
      );
      return;
    }

    // Bullet list items
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={`li_${idx}`} className="flex items-start gap-2 py-0.5 pl-1 text-sm text-slate-800">
          <span className="text-slate-400 font-bold select-none">•</span>
          <span className="leading-relaxed">{trimmed.slice(2)}</span>
        </div>
      );
      return;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`bq_${idx}`}
          className="pl-3 border-l-3 border-slate-300 text-xs text-slate-600 italic my-1.5 py-0.5"
        >
          {trimmed.slice(2)}
        </blockquote>
      );
      return;
    }

    // Horizontal rule
    if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={`hr_${idx}`} className="my-3 border-slate-200" />);
      return;
    }

    // Standard paragraph line
    elements.push(
      <p key={`p_${idx}`} className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
        {rawLine}
      </p>
    );
  });

  if (inCodeBlock && codeLines.length > 0) {
    elements.push(
      <pre
        key="code_unclosed"
        className="my-2.5 p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed"
      >
        <code>{codeLines.join('\n')}</code>
      </pre>
    );
  }

  return <div className="space-y-1">{elements}</div>;
};

export const GitHubCardContentRenderer: React.FC<GitHubCardContentRendererProps> = ({
  repo,
  issueNumber,
  fallbackBody,
  fallbackAuthor = 'felipeolio',
  fallbackUpdatedAt,
  issueUrl,
  onEditClick,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [liveIssue, setLiveIssue] = useState<LiveGitHubIssueDetails | null>(null);
  const [comments, setComments] = useState<LiveGitHubComment[]>([]);

  const fetchFullGitHubContent = useCallback(async () => {
    if (!issueNumber) return;
    setLoading(true);
    try {
      const targetRepo = repo || 'zdttech-copilot/governanca-zdt';
      const res = await fetch(
        `/api/github/comments?repo=${encodeURIComponent(targetRepo)}&issueNumber=${issueNumber}`
      );
      const text = await res.text();
      if (!text || text.trim().startsWith('<')) return;
      const data = JSON.parse(text);
      if (data?.issue) {
        setLiveIssue(data.issue);
      }
      if (Array.isArray(data?.comments)) {
        setComments(data.comments);
      }
    } catch {
      // fallback to local card body
    } finally {
      setLoading(false);
    }
  }, [repo, issueNumber]);

  useEffect(() => {
    fetchFullGitHubContent();
  }, [fetchFullGitHubContent]);

  const effectiveBody =
    liveIssue && typeof liveIssue.body === 'string' && liveIssue.body.trim().length > 0
      ? liveIssue.body
      : fallbackBody;

  const effectiveAuthor = liveIssue?.author || fallbackAuthor;
  const effectiveDate = liveIssue?.updatedAt || liveIssue?.createdAt || fallbackUpdatedAt;

  return (
    <div className="space-y-5">
      {/* 1. Full Issue Body Box (GitHub Issue Description) */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <FileText className="w-3.5 h-3.5 text-slate-900" />
            <span className="font-bold text-slate-900">
              Conteúdo / Descrição do Card no GitHub
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-mono text-slate-600">
              <User className="w-3 h-3" />@{effectiveAuthor}
            </span>
            {effectiveDate && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <Clock className="w-3 h-3" />
                  {new Date(effectiveDate).toLocaleString('pt-BR')}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchFullGitHubContent}
              disabled={loading}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium cursor-pointer disabled:opacity-50"
              title="Recarregar corpo e comentários direto do GitHub"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Sincronizando...' : 'Atualizar do GitHub'}</span>
            </button>

            {onEditClick && (
              <button
                type="button"
                onClick={onEditClick}
                className="px-2.5 py-1 rounded-md bg-slate-900 text-white hover:bg-slate-800 font-semibold cursor-pointer"
              >
                Editar Conteúdo
              </button>
            )}
          </div>
        </div>

        <div className="p-5 bg-white">
          <FormattedGitHubMarkdown content={effectiveBody} />
        </div>
      </div>

      {/* 2. GitHub Issue Comments Timeline */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <MessageSquare className="w-3.5 h-3.5 text-slate-700" />
            <span>Comentários da Issue no GitHub ({comments.length})</span>
          </div>
          {issueUrl && (
            <a
              href={issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium underline underline-offset-2"
            >
              <span>Ver thread no GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
          {loading && comments.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Carregando comentários diretamente do GitHub...
            </div>
          ) : comments.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Nenhum comentário registrado nesta Issue no GitHub até o momento.
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="p-4 space-y-2 hover:bg-slate-50/50">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-bold text-slate-900">@{comment.author}</span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(comment.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="pl-1">
                  <FormattedGitHubMarkdown content={comment.body} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
