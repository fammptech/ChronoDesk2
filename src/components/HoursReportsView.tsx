import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  Sliders,
  Users,
} from 'lucide-react';
import { AttendanceSession, Company, TeamMember, Ticket } from '../types';
import { MirroredBoardCard } from '../project3Schema';
import { formatDurationHms, formatHoursDecimal } from '../utils/formatters';
import {
  WorkHoursSettings,
  calculateFullHoursAndTechniciansReport,
} from '../utils/workHoursConfig';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface HoursReportsViewProps {
  companies: Company[];
  tickets: Ticket[];
  sessions: AttendanceSession[];
  boardCards: MirroredBoardCard[];
  teamMembers: TeamMember[];
  workHoursSettings: WorkHoursSettings;
  onChangeWorkHoursSettings: (next: WorkHoursSettings) => void;
  onOpenConfigTab: () => void;
}

export const HoursReportsView: React.FC<HoursReportsViewProps> = ({
  companies,
  tickets,
  sessions,
  boardCards,
  teamMembers,
  workHoursSettings,
  onChangeWorkHoursSettings,
  onOpenConfigTab,
}) => {
  const [filterCompanyCode, setFilterCompanyCode] = useState<string>('ALL');
  const [filterTechHandle, setFilterTechHandle] = useState<string>('ALL');
  const [reportSection, setReportSection] = useState<'all' | 'by_company' | 'by_tech' | 'matrix'>(
    'all'
  );

  const { companyReports, technicianReports, alerts } = useMemo(
    () =>
      calculateFullHoursAndTechniciansReport({
        companies,
        tickets,
        sessions,
        boardCards,
        teamMembers,
        settings: workHoursSettings,
      }),
    [companies, tickets, sessions, boardCards, teamMembers, workHoursSettings]
  );

  const filteredCompanyReports = useMemo(() => {
    return companyReports.filter((cr) => {
      if (filterCompanyCode !== 'ALL' && cr.company.code !== filterCompanyCode) {
        return false;
      }
      if (
        filterTechHandle !== 'ALL' &&
        !cr.technicians.some(
          (t) => t.githubHandle.toLowerCase() === filterTechHandle.toLowerCase()
        )
      ) {
        return false;
      }
      return true;
    });
  }, [companyReports, filterCompanyCode, filterTechHandle]);

  const filteredTechnicianReports = useMemo(() => {
    return technicianReports.filter((tr) => {
      if (
        filterTechHandle !== 'ALL' &&
        tr.githubHandle.toLowerCase() !== filterTechHandle.toLowerCase()
      ) {
        return false;
      }
      if (
        filterCompanyCode !== 'ALL' &&
        !tr.companiesServed.some((cs) => cs.companyCode === filterCompanyCode)
      ) {
        return false;
      }
      return true;
    });
  }, [technicianReports, filterCompanyCode, filterTechHandle]);

  const totalNormalSeconds = filteredCompanyReports.reduce((acc, c) => acc + c.normalSeconds, 0);
  const totalOvertimeSeconds = filteredCompanyReports.reduce(
    (acc, c) => acc + c.overtimeSeconds,
    0
  );
  const totalWorkedSeconds = filteredCompanyReports.reduce((acc, c) => acc + c.totalSeconds, 0);

  const handleExportCsv = () => {
    const headers = [
      'Tipo_Registro',
      'Empresa_Codigo',
      'Empresa_Nome',
      'Tecnico_Nome',
      'Tecnico_GitHub',
      'Qtd_Tecnicos_Empresa',
      'Limite_Max_Tecnicos',
      'Alerta_Excesso_Tecnicos',
      'Qtd_Chamados',
      'Issues_Vinculadas',
      'Horas_Normais_HMS',
      'Horas_Extras_HMS',
      'Horas_Totais_HMS',
      'Horas_Totais_Decimal',
    ];

    const rows: string[][] = [];

    for (const cr of filteredCompanyReports) {
      if (cr.technicians.length === 0) {
        rows.push([
          'EMPRESA_SEM_ALOCACAO',
          cr.company.code,
          `"${cr.company.name.replace(/"/g, '""')}"`,
          '-',
          '-',
          '0',
          String(cr.effectiveRule.maxTechnicians),
          'NAO',
          '0',
          '-',
          formatDurationHms(cr.normalSeconds),
          formatDurationHms(cr.overtimeSeconds),
          formatDurationHms(cr.totalSeconds),
          formatHoursDecimal(cr.totalSeconds),
        ]);
      } else {
        for (const tech of cr.technicians) {
          rows.push([
            'EMPRESA_X_TECNICO',
            cr.company.code,
            `"${cr.company.name.replace(/"/g, '""')}"`,
            `"${tech.technicianName.replace(/"/g, '""')}"`,
            `@${tech.githubHandle}`,
            String(cr.activeTechnicians.length),
            String(cr.effectiveRule.maxTechnicians),
            cr.exceedsTechLimit ? 'SIM_ALERTA' : 'NAO',
            String(tech.ticketCount),
            `"${tech.issueNumbers.map((n) => `#${n}`).join(' ')}"`,
            formatDurationHms(tech.normalSeconds),
            formatDurationHms(tech.overtimeSeconds),
            formatDurationHms(tech.totalSeconds),
            formatHoursDecimal(tech.totalSeconds),
          ]);
        }
      }
    }

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-horas-empresa-tecnico-${filterCompanyCode.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 font-display">
            Relatórios de Horas por Empresa e por Técnico
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Apuração detalhada de horas normais, horas extras e controle de alocação de técnicos por empresa cliente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenConfigTab}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Parametrizar Limites e Horários (Config)</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV (Empresa × Técnico)</span>
          </button>
        </div>
      </div>

      {/* Customizable Alert Banner for > N Technicians in a Single Company */}
      {alerts.length > 0 ? (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-300 rounded-xl p-5 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-950 font-display">
                  Alerta de Alocação: {alerts.length}{' '}
                  {alerts.length === 1
                    ? 'empresa ultrapassou'
                    : 'empresas ultrapassaram'}{' '}
                  o limite parametrizado de técnicos ativos (card Em andamento)!
                </h3>
                <p className="text-xs text-amber-900 mt-0.5">
                  Regra ativa: o técnico só é considerado ativo quando seu card está na coluna <strong>Em andamento</strong>. Alerta disparado acima de{' '}
                  <strong>{workHoursSettings.defaultMaxTechniciansPerCompany} técnicos em andamento</strong> na mesma empresa.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="text-xs font-semibold text-amber-950 whitespace-nowrap">
                Limite Padrão Global:
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={workHoursSettings.defaultMaxTechniciansPerCompany}
                onChange={(e) =>
                  onChangeWorkHoursSettings({
                    ...workHoursSettings,
                    defaultMaxTechniciansPerCompany: Math.max(1, Number(e.target.value) || 2),
                  })
                }
                className="w-16 px-2 py-1 text-xs font-mono font-bold bg-white border border-amber-400 rounded-lg text-slate-900 text-center"
              />
              <button
                type="button"
                onClick={onOpenConfigTab}
                className="px-3 py-1.5 text-xs font-semibold text-amber-950 bg-amber-200/80 hover:bg-amber-300/80 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Personalizar por Cliente
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {alerts.map((al) => (
              <div
                key={al.companyId}
                className="bg-white border border-amber-300 rounded-lg p-3.5 flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-900">{al.companyCode}</span>
                    <span className="text-xs text-slate-500"> · {al.companyName}</span>
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300 rounded">
                    {al.currentCount} técnicos em andamento (Limite máx: {al.maxAllowed})
                  </span>
                </div>

                <div className="text-xs text-slate-700">
                  <span className="font-semibold">Técnicos ativos (Em andamento): </span>
                  {al.technicians.map((t, idx) => (
                    <span key={t.githubHandle}>
                      {idx > 0 && ', '}
                      <strong className="font-mono text-slate-900">@{t.githubHandle}</strong> (
                      {t.technicianName} · {t.inProgressTicketCount}{' '}
                      {t.inProgressTicketCount === 1 ? 'card em andamento' : 'cards em andamento'}{' '}
                      {t.inProgressIssueNumbers.length > 0
                        ? `[${t.inProgressIssueNumbers.map((n) => `#${n}`).join(', ')}] · `
                        : '· '}
                      {formatDurationHms(t.totalSeconds)})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Controle de Técnicos Ativos (Em andamento) OK:</strong> Nenhuma empresa ultrapassou o limite parametrizado (alerta acima de{' '}
              <strong>{workHoursSettings.defaultMaxTechniciansPerCompany} técnicos com card Em andamento</strong> na mesma empresa).
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-slate-600">
              Alerta acima de (técnicos ativos/empresa):
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={workHoursSettings.defaultMaxTechniciansPerCompany}
              onChange={(e) =>
                onChangeWorkHoursSettings({
                  ...workHoursSettings,
                  defaultMaxTechniciansPerCompany: Math.max(1, Number(e.target.value) || 2),
                })
              }
              className="w-16 px-2 py-1 text-xs font-mono font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-center"
            />
            <div className="w-72">
              <Select
                value={workHoursSettings.techCountScope}
                onValueChange={(val) =>
                  onChangeWorkHoursSettings({
                    ...workHoursSettings,
                    techCountScope:
                      val === 'timer_running_only'
                        ? 'timer_running_only'
                        : val === 'all_assigned'
                        ? 'all_assigned'
                        : 'in_progress_only',
                  })
                }
              >
                <SelectTrigger className="h-8 bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress_only">
                    Apenas técnicos ativos (card Em andamento)
                  </SelectItem>
                  <SelectItem value="timer_running_only">
                    Apenas técnicos com cronômetro rodando agora
                  </SelectItem>
                  <SelectItem value="all_assigned">
                    Todos os técnicos alocados em cards da empresa
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Horas Totais (Filtro Atual)</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {formatDurationHms(totalWorkedSeconds)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono">
            {formatHoursDecimal(totalWorkedSeconds)} acumuladas
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Horas Normais Apuradas</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1.5">
            {formatDurationHms(totalNormalSeconds)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono">
            {formatHoursDecimal(totalNormalSeconds)} dentro da janela normal
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Horas Extras Apuradas</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 mt-1.5">
            {formatDurationHms(totalOvertimeSeconds)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono">
            {formatHoursDecimal(totalOvertimeSeconds)} fora do horário normal
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Empresas com Alerta de Técnicos</div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums mt-1.5 ${
              alerts.length > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {alerts.length} / {companies.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Limite padrão: máx. {workHoursSettings.defaultMaxTechniciansPerCompany} técnicos em andamento
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-64">
            <Select value={filterCompanyCode} onValueChange={setFilterCompanyCode}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue placeholder="Filtrar por empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  Empresa / Cliente: Todas ({companies.length})
                </SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.code}>
                    {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-64">
            <Select value={filterTechHandle} onValueChange={setFilterTechHandle}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue placeholder="Filtrar por técnico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  Técnico: Todos ({technicianReports.length})
                </SelectItem>
                {technicianReports.map((tr) => (
                  <SelectItem key={tr.githubHandle} value={tr.githubHandle}>
                    @{tr.githubHandle} — {tr.technicianName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {(
            [
              { id: 'all', label: 'Visão Completa' },
              { id: 'by_company', label: 'Por Empresa' },
              { id: 'by_tech', label: 'Por Técnico' },
              { id: 'matrix', label: 'Matriz Empresa × Técnico' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReportSection(tab.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                reportSection === tab.id
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1: Hours Report by Company */}
      {(reportSection === 'all' || reportSection === 'by_company') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-700" />
              <h3 className="text-base font-bold text-slate-900 font-display">
                Relatório de Horas e Alocação de Técnicos por Empresa ({filteredCompanyReports.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Considera técnico ativo para o alerta apenas quando possuir card em &ldquo;Em andamento&rdquo;
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Empresa / Cliente</th>
                  <th className="py-3 px-4">Técnicos na Empresa (Ativos em Andamento em destaque)</th>
                  <th className="py-3 px-4 text-center">Status Limite (Em Andamento)</th>
                  <th className="py-3 px-4 text-right">Horas Normais</th>
                  <th className="py-3 px-4 text-right">Horas Extras</th>
                  <th className="py-3 px-4 text-right">Horas Totais</th>
                  <th className="py-3 px-4 text-right">Franquia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredCompanyReports.map((cr) => {
                  const activeTechCount = cr.activeTechnicians.length;
                  const maxAllowed = cr.effectiveRule.maxTechnicians;
                  return (
                    <tr
                      key={cr.company.id}
                      className={`transition-colors ${
                        cr.exceedsTechLimit ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{cr.company.code}</div>
                        <div className="text-xs text-slate-500">
                          {cr.company.name} · Janela normal: {cr.effectiveRule.normalStart}–
                          {cr.effectiveRule.normalEnd}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {cr.technicians.length === 0 ? (
                          <span className="text-xs text-slate-400 italic">
                            Nenhum técnico alocado no momento
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {cr.technicians.map((t) => {
                              const isInProgress = t.inProgressTicketCount > 0;
                              return (
                                <span
                                  key={t.githubHandle}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded font-mono border ${
                                    isInProgress
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                                      : 'bg-slate-100 border-slate-200 text-slate-700'
                                  }`}
                                  title={`${t.technicianName} · ${t.inProgressTicketCount} em andamento / ${t.ticketCount} cards totais · ${formatDurationHms(t.totalSeconds)}`}
                                >
                                  <strong className="font-semibold">@{t.githubHandle}</strong>
                                  {isInProgress && (
                                    <span className="text-[10px] font-bold px-1 py-0.2 bg-emerald-200/80 text-emerald-900 rounded">
                                      Em andamento ({t.inProgressTicketCount})
                                    </span>
                                  )}
                                  <span className="text-slate-500">
                                    ({formatHoursDecimal(t.totalSeconds)})
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {cr.exceedsTechLimit ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-800 bg-rose-100 border border-rose-300 rounded-md">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>
                              ALERTA: {activeTechCount} / {maxAllowed} em andamento
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md">
                            <span>
                              {activeTechCount} / {maxAllowed} em andamento (OK)
                            </span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-800 whitespace-nowrap">
                        {formatDurationHms(cr.normalSeconds)} ({formatHoursDecimal(cr.normalSeconds)})
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                        <span
                          className={
                            cr.overtimeSeconds > 0
                              ? 'font-semibold text-amber-600'
                              : 'text-slate-600'
                          }
                        >
                          {formatDurationHms(cr.overtimeSeconds)} (
                          {formatHoursDecimal(cr.overtimeSeconds)})
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs font-bold text-slate-900 whitespace-nowrap">
                        {formatDurationHms(cr.totalSeconds)} ({formatHoursDecimal(cr.totalSeconds)})
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {cr.company.contractHours}h / mês
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 2: Hours Report by Technician */}
      {(reportSection === 'all' || reportSection === 'by_tech') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-700" />
              <h3 className="text-base font-bold text-slate-900 font-display">
                Relatório Consolidado de Horas por Técnico ({filteredTechnicianReports.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Horas normais, horas extras e distribuição de atendimento por empresa de cada técnico
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Técnico / Especialista</th>
                  <th className="py-3 px-4">Empresas Atendidas & Horas por Cliente</th>
                  <th className="py-3 px-4 text-right">Chamados</th>
                  <th className="py-3 px-4 text-right">Horas Normais</th>
                  <th className="py-3 px-4 text-right">Horas Extras</th>
                  <th className="py-3 px-4 text-right">Horas Totais Trabalhadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredTechnicianReports.map((tr) => (
                  <tr key={tr.githubHandle} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{tr.technicianName}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        @{tr.githubHandle} · {tr.roleTitle}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {tr.companiesServed.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">
                          Sem chamados ou horas registradas no filtro atual
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {tr.companiesServed.map((cs) => {
                            const companyHasAlert = alerts.some(
                              (a) => a.companyCode === cs.companyCode
                            );
                            return (
                              <span
                                key={cs.companyCode}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border font-mono ${
                                  companyHasAlert
                                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                                    : 'bg-slate-100 border-slate-200 text-slate-800'
                                }`}
                              >
                                <strong className="font-semibold">{cs.companyCode}:</strong>
                                <span>{formatDurationHms(cs.totalSeconds)}</span>
                                <span className="text-slate-500">
                                  ({cs.ticketCount} {cs.ticketCount === 1 ? 'card' : 'cards'})
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                      {tr.totalTickets} cards
                      {tr.activeTickets > 0 && (
                        <span className="ml-1.5 text-emerald-600 font-semibold">
                          ({tr.activeTickets} ativo)
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-800 whitespace-nowrap">
                      {formatDurationHms(tr.normalSeconds)} ({formatHoursDecimal(tr.normalSeconds)})
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                      <span
                        className={
                          tr.overtimeSeconds > 0
                            ? 'font-semibold text-amber-600'
                            : 'text-slate-600'
                        }
                      >
                        {formatDurationHms(tr.overtimeSeconds)} (
                        {formatHoursDecimal(tr.overtimeSeconds)})
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs font-bold text-slate-900 whitespace-nowrap">
                      ⏱ {formatDurationHms(tr.totalSeconds)} ({formatHoursDecimal(tr.totalSeconds)})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 3: Detailed Matrix (Company x Technician x Issues) */}
      {(reportSection === 'all' || reportSection === 'matrix') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-700" />
              <h3 className="text-base font-bold text-slate-900 font-display">
                Detalhamento Cruzado: Empresa × Técnico × Chamados
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Auditoria individualizada de cada técnico dentro de cada empresa cliente
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-4">Técnico</th>
                  <th className="py-3 px-4">Cards / Issues Vinculadas</th>
                  <th className="py-3 px-4 text-right">Horas Normais</th>
                  <th className="py-3 px-4 text-right">Horas Extras</th>
                  <th className="py-3 px-4 text-right">Horas Totais na Empresa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredCompanyReports.flatMap((cr) =>
                  cr.technicians.map((tech) => (
                    <tr
                      key={`${cr.company.id}_${tech.githubHandle}`}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900">{cr.company.code}</span>
                        <span className="text-xs text-slate-500 ml-1.5">({cr.company.name})</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-900">{tech.technicianName}</span>
                        <span className="text-xs font-mono text-slate-500 ml-1.5">
                          @{tech.githubHandle}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-700">
                        {tech.issueNumbers.length > 0
                          ? tech.issueNumbers.map((num) => `#${num}`).join(', ')
                          : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-800 whitespace-nowrap">
                        {formatDurationHms(tech.normalSeconds)} ({formatHoursDecimal(tech.normalSeconds)})
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                        <span
                          className={
                            tech.overtimeSeconds > 0
                              ? 'font-semibold text-amber-600'
                              : 'text-slate-600'
                          }
                        >
                          {formatDurationHms(tech.overtimeSeconds)} (
                          {formatHoursDecimal(tech.overtimeSeconds)})
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-bold text-slate-900 whitespace-nowrap">
                        {formatDurationHms(tech.totalSeconds)} ({formatHoursDecimal(tech.totalSeconds)})
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
