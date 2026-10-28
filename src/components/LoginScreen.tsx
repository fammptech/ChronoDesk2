import React, { useState } from 'react';
import {
  Clock,
  Lock,
  Mail,
  ShieldCheck,
  UserCheck,
  Eye,
  EyeOff,
  LogIn,
  CheckCircle2,
  AlertCircle,
  GitBranch,
} from 'lucide-react';
import { AtendentePermissionRules, TeamMember } from '../types';

interface LoginScreenProps {
  teamMembers: TeamMember[];
  globalAtendenteRules: AtendentePermissionRules;
  onLoginSuccess: (member: TeamMember) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  teamMembers,
  globalAtendenteRules,
  onLoginSuccess,
}) => {
  const [identifier, setIdentifier] = useState('felipeolio@zdt.com.br');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<'todos' | 'admin' | 'atendente'>('todos');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanInput = identifier.trim().toLowerCase().replace(/^@/, '');
    if (!cleanInput) {
      setErrorMessage('Informe seu e-mail corporativo ou @usuário do GitHub.');
      return;
    }

    const matchedMember = teamMembers.find((m) => {
      const memberEmail = (m.email || `${m.githubHandle.toLowerCase()}@zdt.com.br`).toLowerCase();
      const memberHandle = m.githubHandle.toLowerCase();
      const memberName = m.name.toLowerCase();
      return (
        memberEmail === cleanInput ||
        memberHandle === cleanInput ||
        memberName === cleanInput
      );
    });

    if (!matchedMember) {
      setErrorMessage(
        'Usuário não encontrado. Verifique o e-mail ou @handle cadastrado ou selecione um perfil ao lado.'
      );
      return;
    }

    const expectedPassword = (matchedMember.password || '123456').trim();
    if (password.trim() !== expectedPassword) {
      setErrorMessage('Senha incorreta para este usuário. (Dica: senha padrão 123456)');
      return;
    }

    onLoginSuccess(matchedMember);
  };

  const handleSelectQuickUser = (member: TeamMember, autoSignIn = false) => {
    const memberEmail = member.email || `${member.githubHandle.toLowerCase()}@zdt.com.br`;
    const memberPass = member.password || '123456';
    setIdentifier(memberEmail);
    setPassword(memberPass);
    setErrorMessage(null);
    if (autoSignIn) {
      onLoginSuccess(member);
    }
  };

  const filteredMembers = teamMembers.filter((m) => {
    const role = m.accessRole || 'atendente';
    if (roleFilter === 'todos') return true;
    return role === roleFilter;
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col justify-between p-4 sm:p-8">
      {/* Top Bar Brand */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <Clock className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-slate-900 font-display">
                ChronoDesk
              </span>
              <span className="text-xs font-mono text-slate-500">v2.5 · Governança ZDT</span>
            </div>
            <p className="text-xs text-slate-500">
              Controle de Horas, Sustentação & Espelhamento GitHub Project #3 / #4
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
          <GitBranch className="w-3.5 h-3.5 text-slate-700" />
          <span>zdttech-copilot/governanca-zdt · Neon PostgreSQL</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-6xl w-full mx-auto my-auto py-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Credentials Form */}
          <div className="lg:col-span-5 p-6 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200">
            <div className="space-y-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                  Autenticação Operacional
                </div>
                <h1 className="text-2xl font-bold text-slate-900 font-display">
                  Entrar no Sistema
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Acesse com seu e-mail ou <code className="font-mono text-xs">@handle</code> do
                  GitHub. Suas permissões de <strong>Atendente</strong> ou <strong>Admin</strong>{' '}
                  serão aplicadas automaticamente.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    E-mail Corporativo ou GitHub Username (@handle)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Ex: felipeolio@zdt.com.br ou Bertrand-ZDT"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Senha de Acesso
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Padrão inicial: 123456
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label="Alternar visibilidade da senha"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Entrar no ChronoDesk</span>
                </button>
              </form>
            </div>

            {/* Profile Behavior Summary Box */}
            <div className="mt-8 pt-6 border-t border-slate-200 space-y-2.5 text-xs text-slate-600">
              <div className="font-semibold text-slate-900">
                Comportamento Automático no Login:
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-900 shrink-0 mt-0.5" />
                <span>
                  <strong>Admin:</strong> Acesso Full (inicia qualquer timer, vê todos os cards e
                  gerencia usuários e permissões).
                </span>
              </div>
              <div className="flex items-start gap-2">
                <UserCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Atendente:</strong> Entra filtrando seus próprios cards por padrão (e pode
                  filtrar todos os técnicos se permitido) e só inicia timer nos cards atribuídos a
                  ele.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Registered Users Directory for 1-Click Login */}
          <div className="lg:col-span-7 p-6 sm:p-10 bg-slate-50/70 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 font-display">
                    Acesso Rápido — Usuários Cadastrados ({teamMembers.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Clique em <strong>Entrar</strong> em qualquer usuário abaixo para logar
                    diretamente com o perfil e permissões dele.
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg self-start">
                  {(
                    [
                      { id: 'todos', label: 'Todos' },
                      { id: 'admin', label: 'Admin' },
                      { id: 'atendente', label: 'Atendentes' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setRoleFilter(tab.id)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {filteredMembers.map((member) => {
                  const isAdmin = (member.accessRole || 'atendente') === 'admin';
                  const memberEmail =
                    member.email || `${member.githubHandle.toLowerCase()}@zdt.com.br`;
                  const isSelected =
                    identifier.trim().toLowerCase() === memberEmail.toLowerCase() ||
                    identifier.trim().toLowerCase() === member.githubHandle.toLowerCase();

                  const restrictTimer =
                    !isAdmin &&
                    globalAtendenteRules.restrictTimerToAssignedOnly &&
                    (member.restrictTimerToAssignedOnly ?? true);
                  const defaultMyCards =
                    !isAdmin &&
                    globalAtendenteRules.defaultFilterMyCardsOnLogin &&
                    (member.defaultFilterMyCardsOnLogin ?? true);
                  const allowAllTechs =
                    isAdmin ||
                    (globalAtendenteRules.allowViewAllTechniciansFilter &&
                      (member.allowViewAllTechniciansFilter ?? true));

                  return (
                    <div
                      key={member.id}
                      onClick={() => handleSelectQuickUser(member, false)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'bg-white border-slate-900 ring-1 ring-slate-900 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-sm text-slate-900 leading-tight">
                              {member.name}
                            </div>
                            <div className="text-xs font-mono text-slate-500">
                              @{member.githubHandle}
                            </div>
                          </div>
                          <span
                            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${
                              isAdmin
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-100 text-slate-800 border-slate-300'
                            }`}
                          >
                            {isAdmin ? 'ADMIN' : 'ATENDENTE'}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 truncate">{memberEmail}</div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div className="text-[11px] text-slate-600 truncate">
                          {isAdmin ? (
                            <span className="text-slate-900 font-medium">Acesso Full Total</span>
                          ) : (
                            <span>
                              {[
                                restrictTimer ? 'Timer próprio' : 'Timer livre',
                                defaultMyCards ? 'Filtro próprio' : 'Filtro geral',
                                allowAllTechs ? 'Vê todos' : 'Só próprios',
                              ].join(' · ')}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectQuickUser(member, true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Entrar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>
                Para adicionar ou remover permissões de um usuário, acesse{' '}
                <strong>Cadastro de Usuários → Alterar Cadastro</strong>.
              </span>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-6xl w-full mx-auto text-center text-xs text-slate-400 py-2">
        ChronoDesk Governança ZDT · Controle de Acesso por Usuário e por Perfil (Admin / Atendente)
      </footer>
    </div>
  );
};
