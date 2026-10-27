import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { TeamMember, Ticket } from '../types';
import { formatCurrencyBRL, formatDurationHms } from '../utils/formatters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface TeamViewProps {
  teamMembers: TeamMember[];
  tickets: Ticket[];
  onCreateMember: (data: Omit<TeamMember, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onChangeMemberStatus: (memberId: string, status: TeamMember['status']) => Promise<void>;
}

const MEMBER_STATUS_LABELS: Record<TeamMember['status'], string> = {
  disponivel: 'Disponível',
  em_atendimento: 'Em Atendimento',
  ausente: 'Ausente / Fora de Escala',
};

export const TeamView: React.FC<TeamViewProps> = ({
  teamMembers,
  tickets,
  onCreateMember,
  onChangeMemberStatus,
}) => {
  const [name, setName] = useState('');
  const [roleTitle, setRoleTitle] = useState('Engenheiro de Suporte N3');
  const [githubHandle, setGithubHandle] = useState('');
  const [specialty, setSpecialty] = useState('Backend, APIs & Webhooks');
  const [hourlyCost, setHourlyCost] = useState(160);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !githubHandle.trim()) return;
    setSubmitting(true);
    try {
      await onCreateMember({
        name: name.trim(),
        roleTitle: roleTitle.trim(),
        githubHandle: githubHandle.trim().replace(/^@/, ''),
        specialty: specialty.trim(),
        hourlyCost,
        status: 'disponivel',
      });
      setName('');
      setGithubHandle('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 font-display">
            Equipe Técnica & Usuários Atendentes
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Controle de especialistas vinculados aos Assignees do GitHub (ex: Felipe), horas apontadas e disponibilidade.
          </p>
        </div>
        <div className="text-xs text-slate-500 font-mono tabular-nums">
          Total na equipe: {teamMembers.length} especialistas
        </div>
      </div>

      {/* Team Members Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Especialista / Cargo</th>
                <th className="py-3 px-4">GitHub Assignee</th>
                <th className="py-3 px-4">Especialidade</th>
                <th className="py-3 px-4 text-right">Chamados Atribuídos</th>
                <th className="py-3 px-4 text-right">Horas Trabalhadas</th>
                <th className="py-3 px-4 text-right">Custo / Hora</th>
                <th className="py-3 px-4 text-right">Disponibilidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {teamMembers.map((member) => {
                const memberTickets = tickets.filter(
                  (t) =>
                    t.assigneeName.toLowerCase() === member.name.toLowerCase() ||
                    t.githubAssignee.toLowerCase() === member.githubHandle.toLowerCase()
                );
                const totalSeconds = memberTickets.reduce((acc, t) => acc + t.totalSecondsWorked, 0);

                return (
                  <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{member.name}</div>
                      <div className="text-xs text-slate-500">{member.roleTitle}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                      @{member.githubHandle}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">{member.specialty}</td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {memberTickets.length}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-900">
                      {formatDurationHms(totalSeconds)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {formatCurrencyBRL(member.hourlyCost)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-block w-48 text-left">
                        <Select
                          value={member.status}
                          onValueChange={(val) =>
                            onChangeMemberStatus(member.id, val as TeamMember['status'])
                          }
                        >
                          <SelectTrigger
                            aria-label={`Disponibilidade de ${member.name}`}
                            className="h-8 bg-white"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="disponivel">
                              {MEMBER_STATUS_LABELS.disponivel}
                            </SelectItem>
                            <SelectItem value="em_atendimento">
                              {MEMBER_STATUS_LABELS.em_atendimento}
                            </SelectItem>
                            <SelectItem value="ausente">
                              {MEMBER_STATUS_LABELS.ausente}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Team Member Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
      >
        <h3 className="text-base font-bold text-slate-900 font-display">
          Adicionar Especialista à Equipe
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nome do Responsável
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Rafael Mendes"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Cargo / Função
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              GitHub Username
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={githubHandle}
              onChange={(e) => setGithubHandle(e.target.value)}
              placeholder="ex: rafael-dev"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Especialidade
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Custo Hora (BRL)
            </label>
            <input
              type="number"
              min={0}
              max={10000}
              value={hourlyCost}
              onChange={(e) => setHourlyCost(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{submitting ? 'Salvando...' : 'Adicionar à Equipe'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
