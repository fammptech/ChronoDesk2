import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { AttendanceSession, AuditLog } from '../types';
import { formatDateTimePtBr, formatDurationHms, formatHoursDecimal } from '../utils/formatters';

interface DatabaseAuditViewProps {
  sessions: AttendanceSession[];
  auditLogs: AuditLog[];
}

const SESSION_STATUS_TEXT: Record<AttendanceSession['sessionStatus'], string> = {
  em_andamento: 'Em Andamento',
  pausada: 'Pausada',
  finalizada: 'Finalizada',
};

export const DatabaseAuditView: React.FC<DatabaseAuditViewProps> = ({ sessions, auditLogs }) => {
  const [subTab, setSubTab] = useState<'sessions' | 'audit'>('sessions');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = sessions.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      String(s.issueNumber).includes(q) ||
      s.companyName.toLowerCase().includes(q) ||
      s.agentName.toLowerCase().includes(q) ||
      s.ticketTitle.toLowerCase().includes(q) ||
      s.notes.toLowerCase().includes(q)
    );
  });

  const filteredLogs = auditLogs.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      l.actorName.toLowerCase().includes(q) ||
      l.targetLabel.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q) ||
      l.origin.toLowerCase().includes(q)
    );
  });

  const totalWorkedSeconds = filteredSessions.reduce((acc, s) => acc + s.durationSeconds, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 font-display">
            Banco de Dados — Sessões de Atendimento, Horas & Auditoria
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Registros persistidos no Firestore para cada turno cronometrado, pausa, encerramento e evento de API/Webhook.
          </p>
        </div>

        {/* Interactive Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSubTab('sessions')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'sessions'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sessões & Horas ({sessions.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('audit')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'audit'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Trilha de Auditoria ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por chamado (#1234), empresa (XPTO), responsável (Felipe)..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-lg"
          />
        </div>
        {subTab === 'sessions' && (
          <div className="text-xs text-slate-600 font-mono tabular-nums">
            Soma das sessões filtradas: <strong>{formatDurationHms(totalWorkedSeconds)}</strong> ({formatHoursDecimal(totalWorkedSeconds)})
          </div>
        )}
      </div>

      {subTab === 'sessions' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Chamado</th>
                  <th className="py-3 px-4">Empresa · Responsável</th>
                  <th className="py-3 px-4">Início · Término</th>
                  <th className="py-3 px-4">Apontamento Técnico</th>
                  <th className="py-3 px-4">Estado da Sessão</th>
                  <th className="py-3 px-4 text-right">Duração Contabilizada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredSessions.map((sess) => (
                  <tr key={sess.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-semibold text-slate-900">
                        #{sess.issueNumber}
                      </div>
                      <div className="text-xs text-slate-500 max-w-xs truncate">
                        {sess.ticketTitle}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700">
                      <span className="font-semibold text-slate-900">{sess.companyName}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{sess.agentName}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-600">
                      <div>Início: {formatDateTimePtBr(sess.startedAtIso)}</div>
                      {sess.endedAtIso && <div>Fim: {formatDateTimePtBr(sess.endedAtIso)}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 max-w-sm">
                      {sess.notes || 'Sem observações adicionais'}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                      {SESSION_STATUS_TEXT[sess.sessionStatus]}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs font-bold text-slate-900">
                      {formatDurationHms(sess.durationSeconds)}
                    </td>
                  </tr>
                ))}
                {filteredSessions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-slate-500">
                      Nenhuma sessão de atendimento encontrada para o filtro selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Origem · Evento</th>
                  <th className="py-3 px-4">Ator</th>
                  <th className="py-3 px-4">Alvo</th>
                  <th className="py-3 px-4">Detalhes Auditados (Imutável)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      {formatDateTimePtBr(log.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                      <span className="font-semibold text-slate-900">{log.origin}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono text-slate-500">{log.eventType}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-800 whitespace-nowrap">
                      {log.actorName}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {log.targetLabel}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">{log.details}</td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                      Nenhum registro de auditoria encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
