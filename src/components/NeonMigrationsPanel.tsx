import React, { useEffect, useState } from 'react';
import {
  Copy,
  Check,
  Database,
  Play,
  BookOpen,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { NEON_MIGRATION_0001_SQL } from '../neonMigrations';

interface NeonHealthResult {
  connected: boolean;
  configured: boolean;
  host: string | null;
  database: string | null;
  dbUser?: string;
  latencyMs: number;
  tables: string[];
  counts: {
    companies?: number;
    teamMembers?: number;
    tickets?: number;
    sessions?: number;
    auditLogs?: number;
  };
  message: string;
}

interface NeonMigrationsPanelProps {
  onRunMigrations: () => Promise<void>;
  runningMigration: boolean;
}

export const NeonMigrationsPanel: React.FC<NeonMigrationsPanelProps> = ({
  onRunMigrations,
  runningMigration,
}) => {
  const [copied, setCopied] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [health, setHealth] = useState<NeonHealthResult | null>(null);

  const handleCheckHealth = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch('/api/neon/health', { cache: 'no-store' });
      const text = await res.text();
      if (text && !text.trim().startsWith('<')) {
        setHealth(JSON.parse(text) as NeonHealthResult);
      }
    } catch {
      // ignore network error
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    handleCheckHealth();
  }, []);

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(NEON_MIGRATION_0001_SQL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <Database className="w-4 h-4" />
            <span>Neon.com Serverless PostgreSQL · Migrations & Configuração</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 font-display">
            Banco de Dados Neon.com — Script de Migration (`0001_neon_initial_schema.sql`) e Tutorial
          </h3>
          <p className="text-xs text-slate-500">
            Estrutura relacional PostgreSQL completa para empresas, técnicos, chamados, sessões de
            atendimento, auditoria, relatórios, histórico de movimentações e parametrização de
            horas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={checkingHealth}
            onClick={handleCheckHealth}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingHealth ? 'animate-spin' : ''}`} />
            <span>{checkingHealth ? 'Testando Neon...' : 'Testar Conexão Neon.com'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopySql}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>SQL Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar SQL da Migration</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={runningMigration}
            onClick={async () => {
              await onRunMigrations();
              await handleCheckHealth();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>
              {runningMigration
                ? 'Aplicando Migration...'
                : 'Executar Migration (/api/neon/migrate)'}
            </span>
          </button>
        </div>
      </div>

      {/* Live Connection Verification Card */}
      {health && (
        <div
          className={`p-4 rounded-lg border text-xs space-y-2.5 ${
            health.connected
              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
              : 'bg-amber-50/80 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold">
              {health.connected ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>
                Status da Integração Neon.com:{' '}
                {health.connected
                  ? 'CONECTADO E ATIVO (PostgreSQL Remoto)'
                  : health.configured
                  ? 'VARIÁVEL CONFIGURADA (Verifique credenciais/SSL)'
                  : 'AGUARDANDO VARIÁVEL NEON_DATABASE_URL (Persistência Local Ativa)'}
              </span>
            </div>
            {health.host && (
              <span className="font-mono text-[11px] bg-white/80 px-2 py-0.5 rounded border border-slate-300">
                Host: {health.host} · DB: {health.database || 'neondb'} · {health.latencyMs}ms
              </span>
            )}
          </div>

          <p className="text-xs leading-relaxed">{health.message}</p>

          <div className="flex flex-wrap items-center gap-4 pt-1 font-mono text-[11px]">
            <span>
              Empresas: <strong>{health.counts?.companies ?? 0}</strong>
            </span>
            <span>
              Equipe: <strong>{health.counts?.teamMembers ?? 0}</strong>
            </span>
            <span>
              Chamados/Cards: <strong>{health.counts?.tickets ?? 0}</strong>
            </span>
            <span>
              Sessões de Tempo: <strong>{health.counts?.sessions ?? 0}</strong>
            </span>
            <span>
              Logs de Auditoria: <strong>{health.counts?.auditLogs ?? 0}</strong>
            </span>
            {health.tables && health.tables.length > 0 && (
              <span>
                Tabelas no Neon ({health.tables.length}):{' '}
                <strong>{health.tables.join(', ')}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Step-by-step Tutorial */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-slate-700" />
              <span>Passo a Passo no Console do Neon.com</span>
            </h4>
            <a
              href="https://console.neon.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 underline underline-offset-2"
            >
              <span>Abrir console.neon.tech</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <ol className="text-xs text-slate-700 space-y-2 list-decimal list-inside leading-relaxed">
            <li>
              Na barra lateral esquerda do Neon (logo abaixo do seletor do projeto{' '}
              <strong>ChronoDesk / production</strong> e acima de <em>Overview</em>), clique no
              botão verde <strong>🔗 Connect</strong>.
            </li>
            <li>
              Na janela <strong>Connect to your database</strong> que se abrirá:
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-slate-600">
                <li>
                  Verifique os seletores no topo: Branch (<strong>production</strong>), Database (
                  <strong>neondb</strong>) e Role (<strong>neondb_owner</strong>).
                </li>
                <li>
                  Deixe a chave <strong>Connection pooling</strong> ativada (ela adiciona{' '}
                  <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">
                    -pooler
                  </code>{' '}
                  ao endereço automaticamente).
                </li>
                <li>
                  Clique em <strong>Copy snippet</strong> (ou no ícone de copiar na caixa da URL{' '}
                  <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">
                    postgresql://neondb_owner:...@ep-...neon.tech/neondb?sslmode=require
                  </code>
                  ).
                </li>
              </ul>
            </li>
            <li>
              Configure a variável de ambiente{' '}
              <code className="font-mono font-bold bg-white px-1 py-0.5 rounded border border-slate-200">
                NEON_DATABASE_URL
              </code>{' '}
              nas configurações do ambiente com essa URL copiada.
            </li>
            <li>
              No <strong>SQL Editor</strong> (onde você já colou a migration), clique no botão
              branco <strong>▷ Run</strong> logo abaixo do editor de código para criar todas as
              tabelas no banco <code className="font-mono">neondb</code>.
            </li>
          </ol>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Tabelas Provisionadas na Migration (`0001_neon_initial_schema.sql`)
          </h4>
          <ul className="text-xs text-slate-700 space-y-1.5 font-mono">
            <li>
              • <strong>companies</strong> — Clientes/Empresas ZDT (Tutora, AMPM, GoCase, Braveo,
              MDR)
            </li>
            <li>
              • <strong>team_members</strong> — Técnicos, especialidades, handles GitHub e status
            </li>
            <li>
              • <strong>tickets</strong> — Cards/Issues sincronizados e segundos acumulados
            </li>
            <li>
              • <strong>attendance_sessions</strong> — Turnos cronometrados com início/fim e notas
            </li>
            <li>
              • <strong>audit_logs</strong> — Trilha de auditoria imutável de eventos
            </li>
            <li>
              • <strong>reports</strong> — Relatórios gerenciais salvos
            </li>
            <li>
              • <strong>issue_history</strong> — Histórico de comentários Markdown e mudanças de
              coluna
            </li>
            <li>
              • <strong>work_hours_settings</strong> — Regras de hora normal (08h-18h), hora extra e
              limite de técnicos
            </li>
          </ul>
        </div>
      </div>

      {/* SQL Block */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono font-semibold text-slate-700">
            migrations/0001_neon_initial_schema.sql
          </span>
          <span>PostgreSQL 15/16/17 · Neon Serverless</span>
        </div>
        <pre className="p-4 bg-slate-950 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto max-h-96 leading-relaxed border border-slate-800">
          <code>{NEON_MIGRATION_0001_SQL}</code>
        </pre>
      </div>
    </div>
  );
};
