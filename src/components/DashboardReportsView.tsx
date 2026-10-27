import React, { useState } from 'react';
import { Download, FileSpreadsheet, Trash2 } from 'lucide-react';
import { Company, Ticket, AttendanceSession, ReportRecord } from '../types';
import {
  formatCurrencyBRL,
  formatDateTimePtBr,
  formatDurationHms,
  formatHoursDecimal,
} from '../utils/formatters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface DashboardReportsViewProps {
  companies: Company[];
  tickets: Ticket[];
  sessions: AttendanceSession[];
  reports: ReportRecord[];
  onGenerateReport: (params: {
    title: string;
    companyFilter: string;
    periodLabel: string;
    totalTickets: number;
    totalSeconds: number;
    totalBilledAmount: number;
  }) => Promise<void>;
  onDeleteReport: (reportId: string) => Promise<void>;
}

export const DashboardReportsView: React.FC<DashboardReportsViewProps> = ({
  companies,
  tickets,
  sessions,
  reports,
  onGenerateReport,
  onDeleteReport,
}) => {
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string>('ALL');
  const [reportTitle, setReportTitle] = useState<string>('Fechamento Mensal de Horas & SLA');
  const [periodLabel, setPeriodLabel] = useState<string>('Outubro / 2026');
  const [generating, setGenerating] = useState(false);

  const filteredTickets =
    selectedCompanyCode === 'ALL'
      ? tickets
      : tickets.filter((t) => t.companyName === selectedCompanyCode);

  const totalSeconds = filteredTickets.reduce((acc, t) => acc + t.totalSecondsWorked, 0);

  const totalBilled = filteredTickets.reduce((acc, t) => {
    const comp = companies.find((c) => c.id === t.companyId || c.code === t.companyName);
    const rate = comp ? comp.hourlyRate : 260;
    return acc + (t.totalSecondsWorked / 3600) * rate;
  }, 0);

  const activeCount = filteredTickets.filter((t) => t.status === 'em_atendimento').length;
  const pausedCount = filteredTickets.filter((t) => t.status === 'pausado').length;
  const closedCount = filteredTickets.filter((t) => t.status === 'encerrado').length;

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const companyFilterText =
        selectedCompanyCode === 'ALL'
          ? 'Todas as Empresas'
          : `Empresa: ${selectedCompanyCode}`;
      await onGenerateReport({
        title: reportTitle.trim() || 'Relatório Consolidado',
        companyFilter: companyFilterText,
        periodLabel: periodLabel.trim() || 'Período Atual',
        totalTickets: filteredTickets.length,
        totalSeconds,
        totalBilledAmount: Number(totalBilled.toFixed(2)),
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Chamado_Issue',
      'Empresa',
      'Responsavel',
      'GitHub_Repo',
      'Status_Chamado',
      'Prioridade',
      'Segundos_Trabalhados',
      'Tempo_Formatado',
      'Titulo',
    ];
    const rows = filteredTickets.map((t) => [
      `#${t.issueNumber}`,
      t.companyName,
      t.assigneeName,
      t.githubRepo,
      t.status,
      t.priority,
      String(t.totalSecondsWorked),
      formatDurationHms(t.totalSecondsWorked),
      `"${t.title.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-chamados-${selectedCompanyCode.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 font-display">
            Dashboard Executivo & Relatórios Consolidados
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Indicadores de horas trabalhadas, faturamento por contrato, cumprimento de SLA e emissão de relatórios no banco.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Exportar Planilha CSV</span>
        </button>
      </div>

      {/* Full-width 4-column KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Horas Totais Apontadas</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {formatDurationHms(totalSeconds)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            Equivalente a {formatHoursDecimal(totalSeconds)} em {sessions.length} sessões
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Valor Técnico Apurado</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1.5">
            {formatCurrencyBRL(totalBilled)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Calculado pelos contratos de cada empresa
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Chamados em Atendimento / Pausados</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {activeCount} ativos · {pausedCount} pausados
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Sincronizados com Issues abertas no GitHub
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Chamados Encerrados</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {closedCount} / {filteredTickets.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Horas auditadas e prontas para faturamento
          </div>
        </div>
      </div>

      {/* Generator Form to persist a new ReportRecord in Firestore */}
      <form
        onSubmit={handleSaveReport}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900 font-display">
            Emitir e Arquivar Relatório no Banco de Dados
          </h3>
          <span className="text-xs text-slate-500">
            Grava um snapshot oficial na coleção <span className="font-mono">/reports</span> e registra auditoria
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Título do Relatório
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Filtrar por Empresa
            </label>
            <Select value={selectedCompanyCode} onValueChange={setSelectedCompanyCode}>
              <SelectTrigger className="w-full h-9.5 bg-white">
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as Empresas</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.code}>
                    {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Período de Referência
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{generating ? 'Emitindo Relatório...' : 'Gerar e Salvar Relatório'}</span>
          </button>
        </div>
      </form>

      {/* Saved Reports Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 font-display">
            Relatórios Arquivados no Banco de Dados ({reports.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Título do Relatório</th>
                <th className="py-3 px-4">Escopo · Período</th>
                <th className="py-3 px-4">Emitido Por · Data</th>
                <th className="py-3 px-4 text-right">Chamados</th>
                <th className="py-3 px-4 text-right">Horas Totais</th>
                <th className="py-3 px-4 text-right">Valor Apurado</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {reports.map((rep) => (
                <tr key={rep.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">{rep.title}</td>
                  <td className="py-3.5 px-4 text-xs text-slate-600">
                    <span>{rep.companyFilter}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{rep.periodLabel}</span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600 font-mono tabular-nums">
                    {rep.generatedBy} · {formatDateTimePtBr(rep.createdAt)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                    {rep.totalTickets}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-900">
                    {formatDurationHms(rep.totalSeconds)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs font-semibold text-emerald-700">
                    {formatCurrencyBRL(rep.totalBilledAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onDeleteReport(rep.id)}
                      className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 cursor-pointer"
                      title="Excluir relatório"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remover</span>
                    </button>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-500">
                    Nenhum relatório consolidado foi emitido ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
