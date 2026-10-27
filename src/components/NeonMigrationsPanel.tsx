import React, { useState } from 'react';
import { Copy, Check, Database, Play, BookOpen, ExternalLink } from 'lucide-react';
import { NEON_MIGRATION_0001_SQL } from '../neonMigrations';

interface NeonMigrationsPanelProps {
  onRunMigrations: () => Promise<void>;
  runningMigration: boolean;
}

export const NeonMigrationsPanel: React.FC<NeonMigrationsPanelProps> = ({
  onRunMigrations,
  runningMigration,
}) => {
  const [copied, setCopied] = useState(false);

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
            onClick={onRunMigrations}
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
              Acesse <strong>console.neon.tech</strong>, crie um novo projeto (ex.:{' '}
              <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">
                chronodesk-zdt
              </code>
              ) na versão PostgreSQL 16 ou 17 e selecione a região mais próxima.
            </li>
            <li>
              No painel principal (<strong>Dashboard</strong> do projeto no Neon), clique em{' '}
              <strong>Connect</strong> e copie a <strong>Connection String</strong> (com{' '}
              <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">
                ?sslmode=require
              </code>
              ).
            </li>
            <li>
              Configure a variável de ambiente{' '}
              <code className="font-mono font-bold bg-white px-1 py-0.5 rounded border border-slate-200">
                NEON_DATABASE_URL
              </code>{' '}
              no seu ambiente/servidor com a Connection String copiada.
            </li>
            <li>
              No menu lateral do Neon Console, abra o <strong>SQL Editor</strong>, cole o conteúdo
              da migration <code className="font-mono">0001_neon_initial_schema.sql</code> abaixo e
              clique em <strong>Run</strong> (ou clique no botão{' '}
              <em>Executar Migration (/api/neon/migrate)</em> acima).
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
