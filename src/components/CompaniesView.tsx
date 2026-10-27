import React, { useState } from 'react';
import { Plus, RefreshCw, Clock, Sliders, AlertTriangle } from 'lucide-react';
import { AttendanceSession, Company, TeamMember, Ticket } from '../types';
import { MirroredBoardCard } from '../project3Schema';
import { formatCurrencyBRL, formatDurationHms, formatHoursDecimal } from '../utils/formatters';
import {
  WorkHoursSettings,
  calculateCompanyHoursBreakdown,
} from '../utils/workHoursConfig';

interface CompaniesViewProps {
  companies: Company[];
  tickets: Ticket[];
  sessions: AttendanceSession[];
  boardCards?: MirroredBoardCard[];
  teamMembers?: TeamMember[];
  workHoursSettings: WorkHoursSettings;
  onOpenConfigTab?: () => void;
  onCreateCompany: (data: Omit<Company, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onQuickSyncCompany: (company: Company) => Promise<void>;
  syncingCompanyId: string | null;
}

export const CompaniesView: React.FC<CompaniesViewProps> = ({
  companies,
  tickets,
  sessions,
  boardCards = [],
  teamMembers = [],
  workHoursSettings,
  onOpenConfigTab,
  onCreateCompany,
  onQuickSyncCompany,
  syncingCompanyId,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [githubRepo, setGithubRepo] = useState('zdttech-copilot/governanca-zdt');
  const [slaHours, setSlaHours] = useState(4);
  const [hourlyRate, setHourlyRate] = useState(280);
  const [contractHours, setContractHours] = useState(80);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setSubmitting(true);
    try {
      await onCreateCompany({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        githubRepo: githubRepo.trim(),
        slaHours,
        hourlyRate,
        contractHours,
        status: 'active',
      });
      setName('');
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 font-display">
            Empresas & Contratos de Atendimento
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Gerencie as empresas clientes, repositórios GitHub vinculados, franquia de horas, horas consumidas e apuração de horas extras (padrão normal: {workHoursSettings.defaultNormalStart} às {workHoursSettings.defaultNormalEnd}).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {onOpenConfigTab && (
            <button
              type="button"
              onClick={onOpenConfigTab}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Parametrizar Horários e Limites na Aba Config</span>
            </button>
          )}
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            Total cadastrado: {companies.length} empresas
          </div>
        </div>
      </div>

      {/* High-density Companies Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Código / Empresa</th>
                <th className="py-3 px-4">Repositório GitHub</th>
                <th className="py-3 px-4 text-right">SLA</th>
                <th className="py-3 px-4 text-right">Franquia</th>
                <th className="py-3 px-4 text-right">Horas Consumidas</th>
                <th className="py-3 px-4 text-right">Horas Extras</th>
                <th className="py-3 px-4 text-right">Faturamento Apurado</th>
                <th className="py-3 px-4 text-right">Ação API</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {companies.map((comp) => {
                const companyTickets = tickets.filter(
                  (t) =>
                    t.companyId === comp.id ||
                    (t.companyName || '').toLowerCase() === comp.code.toLowerCase() ||
                    (t.companyName || '').toLowerCase() === comp.name.toLowerCase()
                );

                const {
                  totalSeconds,
                  overtimeSeconds,
                  effectiveRule,
                  activeTechnicians,
                  exceedsTechLimit,
                } = calculateCompanyHoursBreakdown({
                  company: comp,
                  tickets,
                  sessions,
                  boardCards,
                  teamMembers,
                  settings: workHoursSettings,
                });

                const billedAmount = (totalSeconds / 3600) * comp.hourlyRate;

                return (
                  <tr
                    key={comp.id}
                    className={`transition-colors ${
                      exceedsTechLimit ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{comp.code}</span>
                        {exceedsTechLimit ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-rose-800 bg-rose-100 border border-rose-300 rounded"
                            title={`Alerta: ${activeTechnicians.length} técnicos com card Em andamento na empresa (Limite máx: ${effectiveRule.maxTechnicians})`}
                          >
                            <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                            <span>
                              {activeTechnicians.length}/{effectiveRule.maxTechnicians} téc. em andamento
                            </span>
                          </span>
                        ) : (
                          <span
                            className="text-[11px] font-mono text-slate-500"
                            title="Técnicos com card Em andamento / Limite máximo configurado"
                          >
                            ({activeTechnicians.length}/{effectiveRule.maxTechnicians} em andamento)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {comp.name} · {companyTickets.length} chamados
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                      {comp.githubRepo}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {comp.slaHours}h
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {comp.contractHours}h / mês
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-900">
                      {formatDurationHms(totalSeconds)} ({formatHoursDecimal(totalSeconds)})
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs">
                      <div
                        className={`font-semibold inline-flex items-center justify-end gap-1 ${
                          overtimeSeconds > 0 ? 'text-amber-600' : 'text-slate-700'
                        }`}
                      >
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>
                          {formatDurationHms(overtimeSeconds)} ({formatHoursDecimal(overtimeSeconds)})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Normal: {effectiveRule.normalStart} às {effectiveRule.normalEnd}
                        {effectiveRule.useCustomSchedule ? ' (Personalizado)' : ' (Padrão)'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs font-semibold text-emerald-700">
                      {formatCurrencyBRL(billedAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        disabled={syncingCompanyId === comp.id}
                        onClick={() => onQuickSyncCompany(comp)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${syncingCompanyId === comp.id ? 'animate-spin' : ''}`}
                        />
                        <span>Sincronizar Issues</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-slate-500">
                    Nenhuma empresa cadastrada no momento. Utilize o formulário abaixo para cadastrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form to register a new Company */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
      >
        <h3 className="text-base font-bold text-slate-900 font-display">
          Cadastrar Nova Empresa Cliente
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Razão Social / Nome Fantasia
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Beta Logística S.A."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Sigla / Código
            </label>
            <input
              type="text"
              required
              maxLength={32}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex: BETA"
              className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Repositório GitHub
            </label>
            <input
              type="text"
              required
              maxLength={160}
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              placeholder="owner/repo"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Taxa / Hora (BRL)
            </label>
            <input
              type="number"
              min={0}
              max={10000}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              SLA (h) / Franquia (h)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                max={720}
                value={slaHours}
                onChange={(e) => setSlaHours(Number(e.target.value) || 4)}
                title="SLA em horas"
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
              />
              <input
                type="number"
                min={1}
                max={5000}
                value={contractHours}
                onChange={(e) => setContractHours(Number(e.target.value) || 40)}
                title="Franquia mensal em horas"
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{submitting ? 'Gravando no Banco...' : 'Cadastrar Empresa'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
