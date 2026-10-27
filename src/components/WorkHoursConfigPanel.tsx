import React from 'react';
import {
  Clock,
  RotateCcw,
  Check,
  Sliders,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { AttendanceSession, Company, TeamMember, Ticket } from '../types';
import { MirroredBoardCard } from '../project3Schema';
import { formatDurationHms, formatHoursDecimal } from '../utils/formatters';
import {
  WorkHoursSettings,
  ClientWorkHoursRule,
  calculateCompanyHoursBreakdown,
} from '../utils/workHoursConfig';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface WorkHoursConfigPanelProps {
  companies: Company[];
  tickets: Ticket[];
  sessions: AttendanceSession[];
  boardCards: MirroredBoardCard[];
  teamMembers: TeamMember[];
  settings: WorkHoursSettings;
  onChangeSettings: (next: WorkHoursSettings) => void;
  onSaveFeedback?: (message: string) => void;
}

export const WorkHoursConfigPanel: React.FC<WorkHoursConfigPanelProps> = ({
  companies,
  tickets,
  sessions,
  boardCards,
  teamMembers,
  settings,
  onChangeSettings,
  onSaveFeedback,
}) => {
  const handleGlobalChange = (patch: Partial<WorkHoursSettings>) => {
    onChangeSettings({
      ...settings,
      ...patch,
    });
  };

  const handleClientRuleChange = (
    clientCode: string,
    patch: Partial<ClientWorkHoursRule>
  ) => {
    const existing: ClientWorkHoursRule = settings.perClient[clientCode] || {
      clientCode,
      useCustomSchedule: false,
      normalStart: settings.defaultNormalStart || '08:00',
      normalEnd: settings.defaultNormalEnd || '18:00',
      weekendsAreOvertime: settings.defaultWeekendsAreOvertime,
      manualOvertimeHours: 0,
      useCustomTechLimit: false,
      maxTechnicians: settings.defaultMaxTechniciansPerCompany || 2,
      techAlertEnabled: settings.defaultTechAlertEnabled,
    };

    onChangeSettings({
      ...settings,
      perClient: {
        ...settings.perClient,
        [clientCode]: {
          ...existing,
          ...patch,
        },
      },
    });
  };

  const handleResetToDefaults = () => {
    const resetPerClient: Record<string, ClientWorkHoursRule> = {};
    for (const comp of companies) {
      const prev = settings.perClient[comp.code];
      resetPerClient[comp.code] = {
        clientCode: comp.code,
        useCustomSchedule: false,
        normalStart: '08:00',
        normalEnd: '18:00',
        weekendsAreOvertime: true,
        manualOvertimeHours: prev?.manualOvertimeHours || 0,
        useCustomTechLimit: false,
        maxTechnicians: 2,
        techAlertEnabled: true,
      };
    }
    onChangeSettings({
      defaultNormalStart: '08:00',
      defaultNormalEnd: '18:00',
      defaultWeekendsAreOvertime: true,
      defaultMaxTechniciansPerCompany: 2,
      defaultTechAlertEnabled: true,
      techCountScope: 'in_progress_only',
      perClient: resetPerClient,
    });
    onSaveFeedback?.(
      'Padrões restaurados: horário normal 08:00 às 18:00 e alerta acima de 2 técnicos ativos (card Em andamento) por empresa.'
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Sliders className="w-4 h-4 text-slate-800" />
            <span>Parametrização de Horário Comercial, Horas Extras e Limite de Técnicos</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 font-display">
            Regras de Hora Normal (08h às 18h), Horas Extras e Alerta de Técnicos por Cliente
          </h3>
          <p className="text-xs text-slate-500">
            Personalize globalmente ou por cliente a janela de <strong>Hora Normal</strong> (tudo fora dela conta como <strong>Hora Extra</strong>) e o <strong>limite máximo de técnicos por empresa</strong> (padrão: alerta quando houver mais de 2 técnicos na mesma empresa).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Padrões (08h–18h · Máx 2 Técnicos)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onSaveFeedback?.(
                'Parametrizações de horário normal, horas extras e alertas de técnicos por cliente salvas!'
              )
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Salvar Parametrização</span>
          </button>
        </div>
      </div>

      {/* Global Default Boxes: Normal Hours + Technician Alert */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Global Normal Hours Window */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-800" />
            <div className="text-xs font-bold text-slate-900">
              Janela Global Padrão de Hora Normal (08:00 às 18:00)
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Início Hora Normal
              </label>
              <input
                type="time"
                value={settings.defaultNormalStart}
                onChange={(e) =>
                  handleGlobalChange({ defaultNormalStart: e.target.value || '08:00' })
                }
                className="px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <span className="text-xs text-slate-400 mt-5">até</span>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Fim Hora Normal
              </label>
              <input
                type="time"
                value={settings.defaultNormalEnd}
                onChange={(e) =>
                  handleGlobalChange({ defaultNormalEnd: e.target.value || '18:00' })
                }
                className="px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.defaultWeekendsAreOvertime}
              onChange={(e) =>
                handleGlobalChange({ defaultWeekendsAreOvertime: e.target.checked })
              }
              className="rounded border-slate-300"
            />
            <span>Sábados e Domingos contam integralmente como Hora Extra</span>
          </label>
        </div>

        {/* Global Technician Allocation Alert Rule */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-800" />
              <div className="text-xs font-bold text-slate-900">
                Alerta de Limite de Técnicos por Empresa (Padrão: Máx. 2 Técnicos)
              </div>
            </div>
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.defaultTechAlertEnabled}
                onChange={(e) =>
                  handleGlobalChange({ defaultTechAlertEnabled: e.target.checked })
                }
                className="rounded border-slate-300"
              />
              <span>Alerta Ativo</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Máx. Técnicos por Empresa (Dispara alerta se maior que)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={settings.defaultMaxTechniciansPerCompany}
                onChange={(e) =>
                  handleGlobalChange({
                    defaultMaxTechniciansPerCompany: Math.max(1, Number(e.target.value) || 2),
                  })
                }
                className="w-28 px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div className="flex-1 min-w-[220px]">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Critério de Técnico Ativo para o Alerta
              </label>
              <Select
                value={settings.techCountScope}
                onValueChange={(val) =>
                  handleGlobalChange({
                    techCountScope:
                      val === 'timer_running_only'
                        ? 'timer_running_only'
                        : val === 'all_assigned'
                        ? 'all_assigned'
                        : 'in_progress_only',
                  })
                }
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress_only">
                    Apenas quando o card estiver Em andamento (Padrão)
                  </SelectItem>
                  <SelectItem value="timer_running_only">
                    Apenas quando o cronômetro do card estiver rodando
                  </SelectItem>
                  <SelectItem value="all_assigned">
                    Todos os técnicos com chamados vinculados na empresa
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Per-Client Customization Table */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-slate-900 font-display">
            Parametrização Personalizada por Cliente ({companies.length} clientes)
          </h4>
          <span className="text-xs text-slate-500">
            Personalize o horário normal, o ajuste de horas extras e o limite máximo de técnicos ativos (card Em andamento) para cada cliente
          </span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Modo de Horário</th>
                  <th className="py-3 px-4">Início Normal</th>
                  <th className="py-3 px-4">Fim Normal</th>
                  <th className="py-3 px-4">Fim de Semana Extra</th>
                  <th className="py-3 px-4 text-center">Limite Técnicos (Em Andamento)</th>
                  <th className="py-3 px-4 text-right">Ajuste Extra (h)</th>
                  <th className="py-3 px-4 text-right">Horas Consumidas</th>
                  <th className="py-3 px-4 text-right">Horas Extras</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {companies.map((comp) => {
                  const rawRule = settings.perClient[comp.code];
                  const isCustom = Boolean(rawRule?.useCustomSchedule);
                  const normalStart = isCustom
                    ? rawRule?.normalStart || settings.defaultNormalStart
                    : settings.defaultNormalStart;
                  const normalEnd = isCustom
                    ? rawRule?.normalEnd || settings.defaultNormalEnd
                    : settings.defaultNormalEnd;
                  const weekendsExtra = isCustom
                    ? Boolean(rawRule?.weekendsAreOvertime)
                    : settings.defaultWeekendsAreOvertime;
                  const manualExtraHours = Number(rawRule?.manualOvertimeHours) || 0;

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
                    settings,
                  });

                  return (
                    <tr
                      key={comp.id}
                      className={`transition-colors ${
                        exceedsTechLimit ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{comp.code}</div>
                        <div className="text-[11px] text-slate-500">{comp.name}</div>
                      </td>

                      <td className="py-3 px-4 min-w-[210px]">
                        <Select
                          value={isCustom ? 'custom' : 'default'}
                          onValueChange={(val) => {
                            const nextCustom = val === 'custom';
                            handleClientRuleChange(comp.code, {
                              useCustomSchedule: nextCustom,
                              normalStart:
                                rawRule?.normalStart || settings.defaultNormalStart || '08:00',
                              normalEnd:
                                rawRule?.normalEnd || settings.defaultNormalEnd || '18:00',
                              weekendsAreOvertime:
                                typeof rawRule?.weekendsAreOvertime === 'boolean'
                                  ? rawRule.weekendsAreOvertime
                                  : settings.defaultWeekendsAreOvertime,
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">
                              Padrão Global ({settings.defaultNormalStart}–{settings.defaultNormalEnd})
                            </SelectItem>
                            <SelectItem value="custom">Personalizado para {comp.code}</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="py-3 px-4">
                        <input
                          type="time"
                          value={normalStart}
                          onChange={(e) =>
                            handleClientRuleChange(comp.code, {
                              useCustomSchedule: true,
                              normalStart: e.target.value || '08:00',
                              normalEnd,
                            })
                          }
                          className="px-2.5 py-1 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </td>

                      <td className="py-3 px-4">
                        <input
                          type="time"
                          value={normalEnd}
                          onChange={(e) =>
                            handleClientRuleChange(comp.code, {
                              useCustomSchedule: true,
                              normalStart,
                              normalEnd: e.target.value || '18:00',
                            })
                          }
                          className="px-2.5 py-1 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </td>

                      <td className="py-3 px-4">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-slate-700">
                          <input
                            type="checkbox"
                            checked={weekendsExtra}
                            onChange={(e) =>
                              handleClientRuleChange(comp.code, {
                                useCustomSchedule: true,
                                normalStart,
                                normalEnd,
                                weekendsAreOvertime: e.target.checked,
                              })
                            }
                            className="rounded border-slate-300"
                          />
                          <span>Sáb/Dom Extra</span>
                        </label>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={effectiveRule.maxTechnicians}
                            onChange={(e) =>
                              handleClientRuleChange(comp.code, {
                                useCustomTechLimit: true,
                                maxTechnicians: Math.max(1, Number(e.target.value) || 2),
                                techAlertEnabled: effectiveRule.techAlertEnabled,
                              })
                            }
                            title={`Limite máximo de técnicos ativos (Em andamento) para ${comp.code}`}
                            className="w-14 px-2 py-1 text-center text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900"
                          />
                          <span
                            className={`px-2 py-0.5 text-[11px] font-mono rounded border ${
                              exceedsTechLimit
                                ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {exceedsTechLimit && (
                              <AlertTriangle className="w-3 h-3 inline mr-1 text-rose-600" />
                            )}
                            Em andamento: {activeTechnicians.length}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          value={manualExtraHours}
                          onChange={(e) =>
                            handleClientRuleChange(comp.code, {
                              manualOvertimeHours: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          title="Horas extras adicionais ou ajuste manual do cliente"
                          className="w-20 px-2 py-1 text-right text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatDurationHms(totalSeconds)} ({formatHoursDecimal(totalSeconds)})
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                        <span
                          className={`inline-flex items-center justify-end gap-1 ${
                            overtimeSeconds > 0 ? 'text-amber-600' : 'text-slate-700'
                          }`}
                        >
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>
                            {formatDurationHms(overtimeSeconds)} ({formatHoursDecimal(overtimeSeconds)})
                          </span>
                        </span>
                        <div className="text-[10px] font-normal text-slate-500">
                          Antes das {normalStart} ou após {normalEnd}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
