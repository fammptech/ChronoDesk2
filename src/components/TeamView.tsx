import React, { useMemo, useState } from 'react';
import {
  UserPlus,
  Shield,
  ShieldCheck,
  UserCheck,
  Lock,
  LogIn,
  Pencil,
  Search,
  X,
  Check,
  SlidersHorizontal,
  KeyRound,
  Mail,
  GitBranch,
} from 'lucide-react';
import {
  AtendentePermissionRules,
  TeamMember,
  Ticket,
  UserAccessRole,
} from '../types';
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
  currentOperator: TeamMember;
  globalAtendenteRules: AtendentePermissionRules;
  onSelectOperator: (memberId: string) => void;
  onUpdateGlobalAtendenteRules: (nextRules: AtendentePermissionRules) => void;
  onCreateMember: (
    data: Omit<TeamMember, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onChangeMemberStatus: (memberId: string, status: TeamMember['status']) => Promise<void>;
  onChangeMemberPermissions: (
    memberId: string,
    updates: {
      name?: string;
      email?: string;
      password?: string;
      roleTitle?: string;
      githubHandle?: string;
      specialty?: string;
      hourlyCost?: number;
      status?: TeamMember['status'];
      accessRole?: UserAccessRole;
      restrictTimerToAssignedOnly?: boolean;
      defaultFilterMyCardsOnLogin?: boolean;
      allowViewAllTechniciansFilter?: boolean;
    }
  ) => Promise<void>;
  onApplyProfilePermissionsToAllAtendentes?: (rules: AtendentePermissionRules) => Promise<void>;
}

const MEMBER_STATUS_LABELS: Record<TeamMember['status'], string> = {
  disponivel: 'Disponível',
  em_atendimento: 'Em Atendimento',
  ausente: 'Ausente / Fora de Escala',
};

interface UserFormState {
  id?: string;
  name: string;
  email: string;
  password: string;
  githubHandle: string;
  roleTitle: string;
  specialty: string;
  hourlyCost: number;
  status: TeamMember['status'];
  accessRole: UserAccessRole;
  restrictTimerToAssignedOnly: boolean;
  defaultFilterMyCardsOnLogin: boolean;
  allowViewAllTechniciansFilter: boolean;
}

export const TeamView: React.FC<TeamViewProps> = ({
  teamMembers,
  tickets,
  currentOperator,
  globalAtendenteRules,
  onSelectOperator,
  onUpdateGlobalAtendenteRules,
  onCreateMember,
  onChangeMemberStatus,
  onChangeMemberPermissions,
  onApplyProfilePermissionsToAllAtendentes,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'todos' | 'admin' | 'atendente'>('todos');

  // Modal state for creating or editing a user's registration & permissions
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingMode, setEditingMode] = useState<'create' | 'edit'>('create');
  const [formState, setFormState] = useState<UserFormState>({
    name: '',
    email: '',
    password: '123456',
    githubHandle: '',
    roleTitle: 'Especialista Sustentação & Projetos ZDT',
    specialty: 'N1 / Atendimento / Sustentação / Desenvolvimento',
    hourlyCost: 160,
    status: 'disponivel',
    accessRole: 'atendente',
    restrictTimerToAssignedOnly: globalAtendenteRules.restrictTimerToAssignedOnly,
    defaultFilterMyCardsOnLogin: globalAtendenteRules.defaultFilterMyCardsOnLogin,
    allowViewAllTechniciansFilter: globalAtendenteRules.allowViewAllTechniciansFilter,
  });
  const [savingUser, setSavingUser] = useState(false);

  // Modal state for configuring permissions by profile (Atendente / Admin)
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [draftProfileRules, setDraftProfileRules] = useState<AtendentePermissionRules>(
    globalAtendenteRules
  );
  const [applyToExistingAtendentes, setApplyToExistingAtendentes] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const isCurrentAdmin = (currentOperator.accessRole || 'atendente') === 'admin';

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return teamMembers.filter((m) => {
      const role = m.accessRole || 'atendente';
      if (roleFilter !== 'todos' && role !== roleFilter) return false;
      if (!q) return true;
      const email = (m.email || `${m.githubHandle.toLowerCase()}@zdt.com.br`).toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.githubHandle.toLowerCase().includes(q) ||
        email.includes(q) ||
        m.roleTitle.toLowerCase().includes(q)
      );
    });
  }, [teamMembers, searchQuery, roleFilter]);

  const adminCount = useMemo(
    () => teamMembers.filter((m) => (m.accessRole || 'atendente') === 'admin').length,
    [teamMembers]
  );
  const atendenteCount = teamMembers.length - adminCount;

  const handleOpenCreateModal = () => {
    setEditingMode('create');
    setFormState({
      name: '',
      email: '',
      password: '123456',
      githubHandle: '',
      roleTitle: 'Especialista Sustentação & Projetos ZDT',
      specialty: 'N1 / Atendimento / Sustentação / Desenvolvimento',
      hourlyCost: 160,
      status: 'disponivel',
      accessRole: 'atendente',
      restrictTimerToAssignedOnly: globalAtendenteRules.restrictTimerToAssignedOnly,
      defaultFilterMyCardsOnLogin: globalAtendenteRules.defaultFilterMyCardsOnLogin,
      allowViewAllTechniciansFilter: globalAtendenteRules.allowViewAllTechniciansFilter,
    });
    setUserModalOpen(true);
  };

  const handleOpenEditModal = (member: TeamMember) => {
    const role = member.accessRole || 'atendente';
    setEditingMode('edit');
    setFormState({
      id: member.id,
      name: member.name,
      email: member.email || `${member.githubHandle.toLowerCase()}@zdt.com.br`,
      password: member.password || '123456',
      githubHandle: member.githubHandle,
      roleTitle: member.roleTitle,
      specialty: member.specialty,
      hourlyCost: member.hourlyCost,
      status: member.status,
      accessRole: role,
      restrictTimerToAssignedOnly:
        role === 'admin' ? false : (member.restrictTimerToAssignedOnly ?? true),
      defaultFilterMyCardsOnLogin:
        role === 'admin' ? false : (member.defaultFilterMyCardsOnLogin ?? true),
      allowViewAllTechniciansFilter:
        role === 'admin' ? true : (member.allowViewAllTechniciansFilter ?? true),
    });
    setUserModalOpen(true);
  };

  const handleChangeFormRole = (nextRole: UserAccessRole) => {
    if (nextRole === 'admin') {
      setFormState((prev) => ({
        ...prev,
        accessRole: 'admin',
        restrictTimerToAssignedOnly: false,
        defaultFilterMyCardsOnLogin: false,
        allowViewAllTechniciansFilter: true,
      }));
    } else {
      setFormState((prev) => ({
        ...prev,
        accessRole: 'atendente',
        restrictTimerToAssignedOnly: globalAtendenteRules.restrictTimerToAssignedOnly,
        defaultFilterMyCardsOnLogin: globalAtendenteRules.defaultFilterMyCardsOnLogin,
        allowViewAllTechniciansFilter: globalAtendenteRules.allowViewAllTechniciansFilter,
      }));
    }
  };

  const handleSaveUserModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.githubHandle.trim()) return;
    setSavingUser(true);
    try {
      const cleanHandle = formState.githubHandle.trim().replace(/^@/, '');
      const cleanEmail =
        formState.email.trim() || `${cleanHandle.toLowerCase()}@zdt.com.br`;

      if (editingMode === 'create') {
        await onCreateMember({
          name: formState.name.trim(),
          email: cleanEmail,
          password: formState.password.trim() || '123456',
          roleTitle: formState.roleTitle.trim(),
          githubHandle: cleanHandle,
          specialty: formState.specialty.trim(),
          hourlyCost: Number(formState.hourlyCost) || 160,
          status: formState.status,
          accessRole: formState.accessRole,
          restrictTimerToAssignedOnly:
            formState.accessRole === 'admin'
              ? false
              : formState.restrictTimerToAssignedOnly,
          defaultFilterMyCardsOnLogin:
            formState.accessRole === 'admin'
              ? false
              : formState.defaultFilterMyCardsOnLogin,
          allowViewAllTechniciansFilter:
            formState.accessRole === 'admin'
              ? true
              : formState.allowViewAllTechniciansFilter,
        });
      } else if (formState.id) {
        await onChangeMemberPermissions(formState.id, {
          name: formState.name.trim(),
          email: cleanEmail,
          password: formState.password.trim() || '123456',
          roleTitle: formState.roleTitle.trim(),
          githubHandle: cleanHandle,
          specialty: formState.specialty.trim(),
          hourlyCost: Number(formState.hourlyCost) || 160,
          status: formState.status,
          accessRole: formState.accessRole,
          restrictTimerToAssignedOnly:
            formState.accessRole === 'admin'
              ? false
              : formState.restrictTimerToAssignedOnly,
          defaultFilterMyCardsOnLogin:
            formState.accessRole === 'admin'
              ? false
              : formState.defaultFilterMyCardsOnLogin,
          allowViewAllTechniciansFilter:
            formState.accessRole === 'admin'
              ? true
              : formState.allowViewAllTechniciansFilter,
        });
      }
      setUserModalOpen(false);
    } finally {
      setSavingUser(false);
    }
  };

  const handleOpenProfileModal = () => {
    setDraftProfileRules(globalAtendenteRules);
    setApplyToExistingAtendentes(true);
    setProfileModalOpen(true);
  };

  const handleSaveProfileModal = async () => {
    setSavingProfile(true);
    try {
      onUpdateGlobalAtendenteRules(draftProfileRules);
      if (applyToExistingAtendentes && onApplyProfilePermissionsToAllAtendentes) {
        await onApplyProfilePermissionsToAllAtendentes(draftProfileRules);
      }
      setProfileModalOpen(false);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Shield className="w-4 h-4 text-slate-900" />
            <span>Gestão de Usuários & Controle de Acesso (RBAC)</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 font-display">
            Cadastro de Usuários
          </h2>
          <p className="text-sm text-slate-600">
            Clique em <strong>Alterar Cadastro</strong> em qualquer usuário para abrir a tela de
            edição e adicionar ou remover permissões individualmente ou por perfil.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleOpenProfileModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-700" />
            <span>Permissões por Perfil</span>
          </button>

          <button
            type="button"
            disabled={!isCurrentAdmin}
            onClick={handleOpenCreateModal}
            title={
              isCurrentAdmin
                ? 'Cadastrar novo usuário e definir suas permissões'
                : 'Apenas usuários com perfil Admin podem cadastrar novos usuários'
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Usuário</span>
          </button>
        </div>
      </div>

      {/* Warning banner when logged in as Atendente */}
      {!isCurrentAdmin && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Você está logado como <strong>Atendente (@{currentOperator.githubHandle})</strong>. Você
              pode consultar seu cadastro, mas apenas um usuário <strong>Admin</strong> pode alterar
              permissões ou cadastrar novos usuários.
            </span>
          </div>
          <span className="font-mono font-semibold text-amber-900 shrink-0">
            Modo Somente Leitura para Permissões
          </span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">Total de Usuários Cadastrados</div>
            <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
              {teamMembers.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-mono font-bold text-sm">
            ZDT
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">Perfil Admin (Acesso Full)</div>
            <div className="text-2xl font-bold text-slate-900 font-mono mt-1">{adminCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">
              Perfil Atendente (Permissões Ajustáveis)
            </div>
            <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
              {atendenteCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar + Clean Users Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar usuário por nome, @github ou e-mail..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-xl">
              {(
                [
                  { id: 'todos', label: `Todos (${teamMembers.length})` },
                  { id: 'admin', label: `Admin (${adminCount})` },
                  { id: 'atendente', label: `Atendente (${atendenteCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoleFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    roleFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3.5 px-5">Usuário</th>
                <th className="py-3.5 px-4">GitHub (@assignee) & Cargo</th>
                <th className="py-3.5 px-4">Perfil</th>
                <th className="py-3.5 px-4">Permissões no Cadastro</th>
                <th className="py-3.5 px-4">Status & Produção</th>
                <th className="py-3.5 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredMembers.map((member) => {
                const isAdmin = (member.accessRole || 'atendente') === 'admin';
                const isLoggedOperator = member.id === currentOperator.id;
                const memberEmail =
                  member.email || `${member.githubHandle.toLowerCase()}@zdt.com.br`;

                const memberTickets = tickets.filter(
                  (t) =>
                    t.githubAssignee.toLowerCase() === member.githubHandle.toLowerCase() ||
                    t.assigneeName.toLowerCase() === member.name.toLowerCase()
                );
                const workedSeconds = memberTickets.reduce(
                  (acc, t) => acc + t.totalSecondsWorked,
                  0
                );

                const pTimer = member.restrictTimerToAssignedOnly ?? true;
                const pLoginFilter = member.defaultFilterMyCardsOnLogin ?? true;
                const pViewAll = member.allowViewAllTechniciansFilter ?? true;
                const activeCount = [pTimer, pLoginFilter, pViewAll].filter(Boolean).length;

                return (
                  <tr
                    key={member.id}
                    className={`transition-colors ${
                      isLoggedOperator ? 'bg-emerald-50/30' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* User Name & Email */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                            isAdmin
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-800 border border-slate-300'
                          }`}
                        >
                          {member.name
                            .split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{member.name}</span>
                            {isLoggedOperator && (
                              <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                                Logado
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">{memberEmail}</div>
                        </div>
                      </div>
                    </td>

                    {/* GitHub Handle & Role Title */}
                    <td className="py-4 px-4">
                      <div className="font-mono text-xs font-semibold text-slate-900">
                        @{member.githubHandle}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {member.roleTitle}
                      </div>
                    </td>

                    {/* Access Profile */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Admin (Full)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold">
                          <UserCheck className="w-3.5 h-3.5 text-slate-600" />
                          <span>Atendente</span>
                        </span>
                      )}
                    </td>

                    {/* Permissions Summary */}
                    <td className="py-4 px-4">
                      {isAdmin ? (
                        <div className="text-xs text-slate-700">
                          <div className="font-semibold text-slate-900">
                            Acesso Full Irrestrito
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Inicia qualquer timer · Vê todos os técnicos · Administra sistema
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-900">
                            {activeCount} de 3 regras ativas neste usuário
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span
                              className={
                                pTimer
                                  ? 'text-emerald-800 font-medium'
                                  : 'text-slate-400 line-through'
                              }
                            >
                              • Timer só nos atribuídos
                            </span>
                            <span
                              className={
                                pLoginFilter
                                  ? 'text-emerald-800 font-medium'
                                  : 'text-slate-400 line-through'
                              }
                            >
                              • Filtro próprio ao logar
                            </span>
                            <span
                              className={
                                pViewAll
                                  ? 'text-emerald-800 font-medium'
                                  : 'text-slate-400 line-through'
                              }
                            >
                              • Pode filtrar todos
                            </span>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Status & Production */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="text-xs font-semibold text-slate-800">
                        {MEMBER_STATUS_LABELS[member.status]}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {memberTickets.length} cards · {formatDurationHms(workedSeconds)}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(member)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer shadow-2xs"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-700" />
                          <span>Alterar Cadastro</span>
                        </button>

                        {!isLoggedOperator && (
                          <button
                            type="button"
                            onClick={() => onSelectOperator(member.id)}
                            title="Entrar na sessão como este usuário"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>Logar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===========================================================================
          MODAL 1: TELA DE CADASTRO E PERMISSÕES DO USUÁRIO (CRIAR OU ALTERAR)
         =========================================================================== */}
      {userModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-user-title"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full overflow-hidden shadow-xl my-8">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 id="modal-user-title" className="text-base font-bold font-display">
                    {editingMode === 'create'
                      ? 'Novo Cadastro de Usuário & Permissões'
                      : `Cadastro & Permissões — ${formState.name}`}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Edite os dados cadastrais, escolha o perfil (<strong>Atendente</strong> ou{' '}
                    <strong>Admin</strong>) e adicione ou remova as permissões deste usuário.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserModal} className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
              {/* Step 1: User Registration Fields */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Dados Cadastrais e Credenciais de Login
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Campos sincronizados com GitHub & Neon
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!isCurrentAdmin}
                      value={formState.name}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Ex: Caio Rafael"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      GitHub Username (@assignee)
                    </label>
                    <div className="relative">
                      <GitBranch className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        disabled={!isCurrentAdmin}
                        value={formState.githubHandle}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, githubHandle: e.target.value }))
                        }
                        placeholder="Ex: caiorafaelzdt"
                        className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 font-mono disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      E-mail de Login
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        disabled={!isCurrentAdmin}
                        value={formState.email}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, email: e.target.value }))
                        }
                        placeholder="usuario@zdt.com.br"
                        className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 font-mono disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Senha de Login
                    </label>
                    <div className="relative">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        disabled={!isCurrentAdmin}
                        value={formState.password}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, password: e.target.value }))
                        }
                        placeholder="123456"
                        className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 font-mono disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cargo / Função
                    </label>
                    <input
                      type="text"
                      disabled={!isCurrentAdmin}
                      value={formState.roleTitle}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, roleTitle: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status Operacional
                    </label>
                    <Select
                      value={formState.status}
                      onValueChange={(val) => {
                        const nextStatus = val as TeamMember['status'];
                        setFormState((prev) => ({ ...prev, status: nextStatus }));
                        if (editingMode === 'edit' && formState.id) {
                          onChangeMemberStatus(formState.id, nextStatus);
                        }
                      }}
                    >
                      <SelectTrigger aria-label="Status operacional">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disponivel">Disponível</SelectItem>
                        <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                        <SelectItem value="ausente">Ausente / Fora de Escala</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Especialidade / Escopo
                    </label>
                    <input
                      type="text"
                      disabled={!isCurrentAdmin}
                      value={formState.specialty}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, specialty: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Custo/Hora (R$)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={2000}
                      disabled={!isCurrentAdmin}
                      value={formState.hourlyCost}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          hourlyCost: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 font-mono disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Profile & Individual Permissions Inside the User Registration */}
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      2. Perfil de Acesso & Permissões do Usuário
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Selecione o perfil para carregar o pacote de permissões padrão ou ative/inative
                      cada permissão individualmente abaixo.
                    </p>
                  </div>

                  {formState.accessRole === 'atendente' && isCurrentAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormState((prev) => ({
                          ...prev,
                          restrictTimerToAssignedOnly:
                            globalAtendenteRules.restrictTimerToAssignedOnly,
                          defaultFilterMyCardsOnLogin:
                            globalAtendenteRules.defaultFilterMyCardsOnLogin,
                          allowViewAllTechniciansFilter:
                            globalAtendenteRules.allowViewAllTechniciansFilter,
                        }))
                      }
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline cursor-pointer shrink-0"
                    >
                      Restaurar padrão do perfil Atendente
                    </button>
                  )}
                </div>

                {/* Role Selector */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold text-slate-900">
                      Perfil de Acesso Vinculado
                    </div>
                    <div className="text-xs text-slate-600">
                      Ao escolher um perfil, as permissões padrão daquele perfil são atribuídas a
                      este usuário.
                    </div>
                  </div>
                  <div className="w-full sm:w-72 shrink-0">
                    <Select
                      disabled={!isCurrentAdmin}
                      value={formState.accessRole}
                      onValueChange={(val) => handleChangeFormRole(val as UserAccessRole)}
                    >
                      <SelectTrigger aria-label="Perfil de acesso" className="bg-white">
                        <SelectValue placeholder="Selecione o perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="atendente">
                          Atendente (Permissões Configuráveis)
                        </SelectItem>
                        <SelectItem value="admin">
                          Admin (Acesso Full Total)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Permissions List inside User Registration */}
                {formState.accessRole === 'admin' ? (
                  <div className="p-5 rounded-xl bg-slate-900 text-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        <span>Perfil Admin Selecionado — Acesso Full Habilitado</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        FULL ACCESS
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Este usuário possui acesso irrestrito ao sistema: pode iniciar, pausar e
                      encerrar o timer em qualquer card (mesmo atribuído a outro técnico), visualizar
                      todos os cards de todas as empresas e gerenciar o cadastro e permissões de
                      todos os usuários.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Permission 1 */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            1. Iniciar Timer Apenas nos Cards Atribuídos ao Usuário
                          </span>
                          <span
                            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                              formState.restrictTimerToAssignedOnly
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {formState.restrictTimerToAssignedOnly ? 'ATIVA' : 'INATIVA'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          Quando <strong>Ativa</strong>, o atendente só pode iniciar a contagem do
                          timer em cards nos quais seu GitHub (
                          <code className="font-mono">
                            @{formState.githubHandle || 'handle'}
                          </code>
                          ) está atribuído. Quando <strong>Inativa</strong>, pode iniciar o timer em
                          qualquer card.
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={!isCurrentAdmin}
                          onClick={() =>
                            setFormState((prev) => ({
                              ...prev,
                              restrictTimerToAssignedOnly: true,
                            }))
                          }
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                            formState.restrictTimerToAssignedOnly
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Ativa
                        </button>
                        <button
                          type="button"
                          disabled={!isCurrentAdmin}
                          onClick={() =>
                            setFormState((prev) => ({
                              ...prev,
                              restrictTimerToAssignedOnly: false,
                            }))
                          }
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                            !formState.restrictTimerToAssignedOnly
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Inativa
                        </button>
                      </div>
                    </div>

                    {/* Permission 2 */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            2. Visualizar Apenas Meus Cards Filtrados por Padrão ao Logar
                          </span>
                          <span
                            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                              formState.defaultFilterMyCardsOnLogin
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {formState.defaultFilterMyCardsOnLogin ? 'ATIVA' : 'INATIVA'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          Quando <strong>Ativa</strong>, ao logar no sistema o filtro inicia
                          automaticamente em{' '}
                          <code className="font-mono">
                            Meus Cards (@{formState.githubHandle || 'handle'})
                          </code>
                          . Quando <strong>Inativa</strong>, inicia exibindo os cards de todos os
                          técnicos.
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={!isCurrentAdmin}
                          onClick={() =>
                            setFormState((prev) => ({
                              ...prev,
                              defaultFilterMyCardsOnLogin: true,
                            }))
                          }
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                            formState.defaultFilterMyCardsOnLogin
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Ativa
                        </button>
                        <button
                          type="button"
                          disabled={!isCurrentAdmin}
                          onClick={() =>
                            setFormState((prev) => ({
                              ...prev,
                              defaultFilterMyCardsOnLogin: false,
                            }))
                          }
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                            !formState.defaultFilterMyCardsOnLogin
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Inativa
                        </button>
                      </div>
                    </div>

                    {/* Permission 3 */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            3. Permitir Filtrar Cards de Todos os Técnicos
                          </span>
                          <span
                            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                              formState.allowViewAllTechniciansFilter
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {formState.allowViewAllTechniciansFilter ? 'ATIVA' : 'INATIVA'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          Quando <strong>Ativa</strong>, caso o atendente queira, ele pode trocar o
                          seletor de filtro para visualizar os cards de todos os técnicos. Quando{' '}
                          <strong>Inativa</strong>, ele visualiza exclusivamente seus próprios cards.
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={!isCurrentAdmin}
                          onClick={() =>
                            setFormState((prev) => ({
                              ...prev,
                              allowViewAllTechniciansFilter: true,
                            }))
                          }
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                            formState.allowViewAllTechniciansFilter
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Ativa
                        </button>
                        <button
                          type="button"
                          disabled={!isCurrentAdmin}
                          onClick={() =>
                            setFormState((prev) => ({
                              ...prev,
                              allowViewAllTechniciansFilter: false,
                            }))
                          }
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                            !formState.allowViewAllTechniciansFilter
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Inativa
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                {isCurrentAdmin && (
                  <button
                    type="submit"
                    disabled={savingUser}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>
                      {savingUser
                        ? 'Salvando...'
                        : editingMode === 'create'
                          ? 'Concluir Cadastro e Salvar Permissões'
                          : 'Salvar Alterações e Permissões'}
                    </span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===========================================================================
          MODAL 2: CONFIGURAÇÃO DE PERMISSÕES POR PERFIL (ATENDENTE & ADMIN)
         =========================================================================== */}
      {profileModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-profile-title"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full overflow-hidden shadow-xl my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 id="modal-profile-title" className="text-base font-bold font-display">
                    Permissões por Perfil (Atendente e Admin)
                  </h3>
                  <p className="text-xs text-slate-300">
                    Defina as permissões padrão do perfil <strong>Atendente</strong> como Ativas ou
                    Inativas e aplique ao perfil inteiro.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Admin Profile Box */}
              <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Perfil Admin</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Possui acesso full total (inicia timer em qualquer card, visualiza todos os
                    técnicos e gerencia usuários e permissões).
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">
                  ACESSO FULL
                </span>
              </div>

              {/* Atendente Profile Rules */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Permissões do Perfil Atendente ({atendenteCount} usuários neste perfil)
                </div>

                {/* Rule 1 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-slate-900">
                      1. Só pode iniciar o timer de um card ao qual está atribuído
                    </div>
                    <p className="text-xs text-slate-600">
                      Bloqueia o início do cronômetro em cards de outros técnicos.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={!isCurrentAdmin}
                      onClick={() =>
                        setDraftProfileRules((prev) => ({
                          ...prev,
                          restrictTimerToAssignedOnly: true,
                        }))
                      }
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50 ${
                        draftProfileRules.restrictTimerToAssignedOnly
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-300 text-slate-700'
                      }`}
                    >
                      Ativa
                    </button>
                    <button
                      type="button"
                      disabled={!isCurrentAdmin}
                      onClick={() =>
                        setDraftProfileRules((prev) => ({
                          ...prev,
                          restrictTimerToAssignedOnly: false,
                        }))
                      }
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50 ${
                        !draftProfileRules.restrictTimerToAssignedOnly
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-300 text-slate-700'
                      }`}
                    >
                      Inativa
                    </button>
                  </div>
                </div>

                {/* Rule 2 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-slate-900">
                      2. Ao logar, visualizar apenas os próprios cards filtrados por padrão
                    </div>
                    <p className="text-xs text-slate-600">
                      Filtra automaticamente a visão do quadro e tabela para o `@handle` do
                      atendente ao entrar.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={!isCurrentAdmin}
                      onClick={() =>
                        setDraftProfileRules((prev) => ({
                          ...prev,
                          defaultFilterMyCardsOnLogin: true,
                        }))
                      }
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50 ${
                        draftProfileRules.defaultFilterMyCardsOnLogin
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-300 text-slate-700'
                      }`}
                    >
                      Ativa
                    </button>
                    <button
                      type="button"
                      disabled={!isCurrentAdmin}
                      onClick={() =>
                        setDraftProfileRules((prev) => ({
                          ...prev,
                          defaultFilterMyCardsOnLogin: false,
                        }))
                      }
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50 ${
                        !draftProfileRules.defaultFilterMyCardsOnLogin
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-300 text-slate-700'
                      }`}
                    >
                      Inativa
                    </button>
                  </div>
                </div>

                {/* Rule 3 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-slate-900">
                      3. Permitir alterar o filtro para visualizar os cards de todos os técnicos
                    </div>
                    <p className="text-xs text-slate-600">
                      Habilita a opção &quot;Todos os Técnicos&quot; no seletor caso o atendente
                      queira consultar o quadro completo.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={!isCurrentAdmin}
                      onClick={() =>
                        setDraftProfileRules((prev) => ({
                          ...prev,
                          allowViewAllTechniciansFilter: true,
                        }))
                      }
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50 ${
                        draftProfileRules.allowViewAllTechniciansFilter
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-300 text-slate-700'
                      }`}
                    >
                      Ativa
                    </button>
                    <button
                      type="button"
                      disabled={!isCurrentAdmin}
                      onClick={() =>
                        setDraftProfileRules((prev) => ({
                          ...prev,
                          allowViewAllTechniciansFilter: false,
                        }))
                      }
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50 ${
                        !draftProfileRules.allowViewAllTechniciansFilter
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-300 text-slate-700'
                      }`}
                    >
                      Inativa
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 pt-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isCurrentAdmin}
                    checked={applyToExistingAtendentes}
                    onChange={(e) => setApplyToExistingAtendentes(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>
                    Aplicar estas permissões imediatamente no cadastro de todos os{' '}
                    <strong>{atendenteCount} usuários</strong> do perfil Atendente
                  </span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Fechar
                </button>
                {isCurrentAdmin && (
                  <button
                    type="button"
                    disabled={savingProfile}
                    onClick={handleSaveProfileModal}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Salvar Permissões do Perfil</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
