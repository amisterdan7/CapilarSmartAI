import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  Building2,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  CloudOff,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { evaluatePasswordCriteria, detectEmailTypo } from '../../services/authService';

export type AuthModalMode = 'login' | 'register' | 'forgot' | 'complete_profile';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthModalMode;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const {
    signIn,
    signUp,
    resetPassword,
    completeProfile,
    needsProfileCompletion,
    authError,
    clearError,
    isFirebaseAvailable,
  } = useAuth();

  const [mode, setMode] = useState<AuthModalMode>(initialMode);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [phone, setPhone] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Se o usuário precisa completar o perfil após login (Self-Healing)
  useEffect(() => {
    if (needsProfileCompletion) {
      setMode('complete_profile');
    }
  }, [needsProfileCompletion]);

  useEffect(() => {
    if (isOpen) {
      clearError();
      setSuccessMessage(null);
      if (!needsProfileCompletion) {
        setMode(initialMode);
      }
    }
  }, [isOpen, initialMode, needsProfileCompletion, clearError]);

  // Avaliação dos 4 critérios de senha em tempo real
  const passwordCriteria = useMemo(() => evaluatePasswordCriteria(password), [password]);

  // Sugestão não-automática para erros de digitação de e-mail
  const emailTypo = useMemo(() => detectEmailTypo(email), [email]);

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  if (!isOpen) return null;

  const handleApplyEmailSuggestion = () => {
    if (emailTypo.suggestedEmail) {
      setEmail(emailTypo.suggestedEmail);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);
    try {
      await signIn({ email, password, rememberMe });
      onClose();
    } catch {
      // Erro é tratado pelo contexto e exibido em authError
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!name.trim()) return;
    if (!passwordCriteria.isValid) return;
    if (!passwordsMatch) return;

    setIsSubmitting(true);
    try {
      await signUp({
        email,
        password,
        name,
        clinicName,
        phone,
      });
      setSuccessMessage('Conta profissional criada com sucesso! Enviamos um link para o seu e-mail.');
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch {
      // Erro exibido via authError
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);
    try {
      await resetPassword(email);
      setSuccessMessage('Instruções de recuperação foram enviadas para o seu e-mail.');
    } catch {
      // Erro exibido via authError
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await completeProfile({
        name,
        clinicName,
        phone,
      });
      setSuccessMessage('Perfil profissional configurado com sucesso!');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch {
      // Erro exibido via authError
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md bg-[#0a0f1d] border border-[#1e293b] rounded-2xl shadow-[0_0_50px_rgba(247,37,133,0.15)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header do Modal com gradiente de marca */}
        <div className="px-6 pt-6 pb-4 border-b border-[#182136] flex items-start justify-between bg-gradient-to-b from-[#111728] to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff007f] via-[#f72585] to-[#7209b7] p-[1.5px] shadow-[0_0_15px_rgba(247,37,133,0.4)] flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-[#0a0f1d] rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[#f72585]" />
              </div>
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                {mode === 'login' && 'Entrar na Conta'}
                {mode === 'register' && 'Criar Conta Profissional'}
                {mode === 'forgot' && 'Recuperar Senha'}
                {mode === 'complete_profile' && 'Completar Perfil'}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'login' && 'Acesso exclusivo aos seus dados e clientes'}
                {mode === 'register' && 'Sua bancada profissional individual'}
                {mode === 'forgot' && 'Enviaremos um link seguro para o seu e-mail'}
                {mode === 'complete_profile' && 'Finalize os dados da sua bancada para prosseguir'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#151c2e] transition-colors cursor-pointer"
            aria-label="Fechar janela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informação sobre indisponibilidade de variáveis de ambiente */}
        {!isFirebaseAvailable && (
          <div className="p-4 mx-6 mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
            <CloudOff className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-100">Serviço de Nuvem Não Configurado</p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-300/90">
                As credenciais do Firebase não estão ativas neste ambiente. O Capilar Smart IA funciona
                plenamente em Modo Demonstração Local com segurança em seu navegador.
              </p>
            </div>
          </div>
        )}

        {/* Tabs de navegação entre Login e Cadastro */}
        {isFirebaseAvailable && mode !== 'complete_profile' && (
          <div className="flex border-b border-[#182136] px-6 pt-2 bg-[#080c18]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                clearError();
              }}
              className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-all cursor-pointer ${
                mode === 'login'
                  ? 'border-[#f72585] text-[#f72585]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                clearError();
              }}
              className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-all cursor-pointer ${
                mode === 'register'
                  ? 'border-[#f72585] text-[#f72585]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Criar Conta
            </button>
          </div>
        )}

        {/* Mensagens de Sucesso ou Erro */}
        <div className="px-6 pt-4">
          {authError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{authError}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{successMessage}</span>
            </div>
          )}
        </div>

        {/* Conteúdo rolável dos formulários */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* MODO 1: LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  E-mail Profissional
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    disabled={!isFirebaseAvailable || isSubmitting}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="profissional@salao.com"
                    className="w-full pl-9 pr-3 py-2 bg-[#0f1527] border border-[#222f4d] focus:border-[#f72585] focus:ring-1 focus:ring-[#f72585] rounded-xl text-white text-xs placeholder:text-slate-500 outline-none transition-all disabled:opacity-50"
                  />
                </div>

                {/* Sugestão de digitação de e-mail */}
                {emailTypo.hasSuggestion && (
                  <div className="mt-1.5 flex items-center justify-between p-2 rounded-lg bg-[#141d33] border border-[#2a3a5f] text-[11px] text-slate-300">
                    <span className="truncate">
                      Você quis dizer <strong className="text-[#f72585]">{emailTypo.suggestedEmail}</strong>?
                    </span>
                    <button
                      type="button"
                      onClick={handleApplyEmailSuggestion}
                      className="ml-2 px-2 py-0.5 rounded bg-[#f72585]/20 hover:bg-[#f72585]/30 text-[#f72585] font-semibold transition-colors shrink-0 cursor-pointer"
                    >
                      Corrigir
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      clearError();
                    }}
                    className="text-[11px] text-[#f72585] hover:underline cursor-pointer"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={!isFirebaseAvailable || isSubmitting}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 bg-[#0f1527] border border-[#222f4d] focus:border-[#f72585] focus:ring-1 focus:ring-[#f72585] rounded-xl text-white text-xs placeholder:text-slate-500 outline-none transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Opção de persistência da sessão */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={!isFirebaseAvailable || isSubmitting}
                    className="w-4 h-4 rounded border-[#222f4d] bg-[#0f1527] text-[#f72585] focus:ring-0 focus:ring-offset-0 accent-[#f72585]"
                  />
                  <span>Lembrar-me neste dispositivo</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={!isFirebaseAvailable || isSubmitting || !email || !password}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#e01e84] to-[#f72585] text-white font-bold text-xs shadow-[0_0_20px_rgba(247,37,133,0.35)] hover:shadow-[0_0_28px_rgba(247,37,133,0.6)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Entrando na bancada...</span>
                ) : (
                  <>
                    <span>Entrar no Capilar Smart</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* MODO 2: CADASTRO */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome Completo da Profissional <span className="text-[#f72585]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    disabled={!isFirebaseAvailable || isSubmitting}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Patrícia Andrade"
                    className="w-full pl-9 pr-3 py-2 bg-[#0f1527] border border-[#222f4d] focus:border-[#f72585] focus:ring-1 focus:ring-[#f72585] rounded-xl text-white text-xs placeholder:text-slate-500 outline-none transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  E-mail Profissional <span className="text-[#f72585]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    disabled={!isFirebaseAvailable || isSubmitting}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="profissional@salao.com"
                    className="w-full pl-9 pr-3 py-2 bg-[#0f1527] border border-[#222f4d] focus:border-[#f72585] focus:ring-1 focus:ring-[#f72585] rounded-xl text-white text-xs placeholder:text-slate-500 outline-none transition-all disabled:opacity-50"
                  />
                </div>

                {emailTypo.hasSuggestion && (
                  <div className="mt-1.5 flex items-center justify-between p-2 rounded-lg bg-[#141d33] border border-[#2a3a5f] text-[11px] text-slate-300">
                    <span className="truncate">
                      Você quis dizer <strong className="text-[#f72585]">{emailTypo.suggestedEmail}</strong>?
                    </span>
                    <button
                      type="button"
                      onClick={handleApplyEmailSuggestion}
                      className="ml-2 px-2 py-0.5 rounded bg-[#f72585]/20 hover:bg-[#f72585]/30 text-[#f72585] font-semibold transition-colors shrink-0 cursor-pointer"
                    >
                      Corrigir
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Senha Segura <span className="text-[#f72585]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={!isFirebaseAvailable || isSubmitting}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 8 caracteres"
                    className="w-full pl-9 pr-10 py-2 bg-[#0f1527] border border-[#222f4d] focus:border-[#f72585] focus:ring-1 focus:ring-[#f72585] rounded-xl text-white text-xs placeholder:text-slate-500 outline-none transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* INDICADOR VISUAL DOS 4 CRITÉRIOS DE SENHA */}
                <div className="mt-2 p-2.5 rounded-xl bg-[#080d1a] border border-[#18233a] space-y-1.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Requisitos de Segurança da Senha
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        passwordCriteria.minLength ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {passwordCriteria.minLength ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>8+ caracteres</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        passwordCriteria.hasUppercase ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {passwordCriteria.hasUppercase ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>Letra maiúscula</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        passwordCriteria.hasNumber ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {passwordCriteria.hasNumber ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>Ao menos 1 número</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        passwordCriteria.hasSpecialChar ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {passwordCriteria.hasSpecialChar ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>Símbolo especial</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Confirmar Senha <span className="text-[#f72585]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={!isFirebaseAvailable || isSubmitting}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita sua senha"
                    className="w-full pl-9 pr-3 py-2 bg-[#0f1527] border border-[#222f4d] focus:border-[#f72585] focus:ring-1 focus:ring-[#f72585] rounded-xl text-white text-xs placeholder:text-slate-500 outline-none transition-all disabled:opacity-50"
                  />
                </div>
                {confirmPassword && !passwordsMatch && (
                  <p className="mt-1 text-[11px] text-rose-400">As senhas não coincidem.</p>
                )}
              </div>

              {/* Campos opcionais da bancada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nome do Salão/Clínica <span className="text-slate-500 text-[10px]">(opcional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      disabled={!isFirebaseAvailable || isSubmitting}
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      placeholder="Espaço Beleza"
                      className="w-full pl-9 pr-3 py-2 bg-[#0f1527] border border-[#222f4d] focus:border-[#f72585] focus:ring-1 focus:ring-[#f72585] rounded-xl text-white text-xs placeholder:text-slate-500 outline-none transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    WhatsApp Profissional <span className="text-slate-500 text-[10px]">(opcional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      disabled={!isFirebaseAvailable || isSubmitting}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full pl-9 pr-3 py-2 bg-[#0f1527] border border-[#222f4d] focus:border-[#f72585] focus:ring-1 focus:ring-[#f72585] rounded-xl text-white text-xs placeholder:text-slate-500 outline-none transition-all disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  !isFirebaseAvailable ||
                  isSubmitting ||
                  !name.trim() ||
                  !passwordCriteria.isValid ||
                  !passwordsMatch
                }
                className="w-full py-2.5 px-4 mt-2 rounded-xl bg-gradient-to-r from-[#e01e84] to-[#f72585] text-white font-bold text-xs shadow-[0_0_20px_rgba(247,37,133,0.35)] hover:shadow-[0_0_28px_rgba(247,37,133,0.6)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Criando conta e bancada...</span>
                ) : (
                  <>
                    <span>Criar Minha Bancada</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* MODO 3: ESQUECI MINHA SENHA */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Digite o endereço de e-mail associado à sua conta profissional. Enviaremos um link
                para que você redefina sua senha com segurança.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  E-mail Cadastrado
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    disabled={!isFirebaseAvailable || isSubmitting}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="profissional@salao.com"
                    className="w-full pl-9 pr-3 py-2 bg-[#0f1527] border border-[#222f4d] focus:border-[#f72585] focus:ring-1 focus:ring-[#f72585] rounded-xl text-white text-xs placeholder:text-slate-500 outline-none transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    clearError();
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#111728] hover:bg-[#182136] text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  Voltar ao Login
                </button>
                <button
                  type="submit"
                  disabled={!isFirebaseAvailable || isSubmitting || !email}
                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#e01e84] to-[#f72585] text-white font-bold text-xs shadow-[0_0_15px_rgba(247,37,133,0.35)] hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar Instruções'}
                </button>
              </div>
            </form>
          )}

          {/* MODO 4: COMPLETAR PERFIL (Self-Healing pós queda de conexão) */}
          {mode === 'complete_profile' && (
            <form onSubmit={handleCompleteProfileSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="leading-snug">
                  Sua conta de autenticação está ativa, mas precisamos registrar seus dados profissionais
                  para habilitar o acesso exclusivo à sua bancada.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Seu Nome Profissional <span className="text-[#f72585]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    disabled={isSubmitting}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Patrícia Andrade"
                    className="w-full pl-9 pr-3 py-2 bg-[#0f1527] border border-[#222f4d] focus:border-[#f72585] focus:ring-1 focus:ring-[#f72585] rounded-xl text-white text-xs placeholder:text-slate-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome do Salão/Clínica <span className="text-slate-500 text-[10px]">(opcional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    disabled={isSubmitting}
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="Espaço Capilar & Beleza"
                    className="w-full pl-9 pr-3 py-2 bg-[#0f1527] border border-[#222f4d] focus:border-[#f72585] focus:ring-1 focus:ring-[#f72585] rounded-xl text-white text-xs placeholder:text-slate-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Telefone / WhatsApp <span className="text-slate-500 text-[10px]">(opcional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    disabled={isSubmitting}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full pl-9 pr-3 py-2 bg-[#0f1527] border border-[#222f4d] focus:border-[#f72585] focus:ring-1 focus:ring-[#f72585] rounded-xl text-white text-xs placeholder:text-slate-500 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#e01e84] to-[#f72585] text-white font-bold text-xs shadow-[0_0_20px_rgba(247,37,133,0.35)] hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Salvando Perfil...' : 'Concluir Configuração'}
              </button>
            </form>
          )}
        </div>

        {/* Rodapé com garantia de privacidade e conformidade */}
        <div className="px-6 py-3 border-t border-[#182136] bg-[#070b16] flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#f72585]" />
            <span>Isolamento seguro de dados por profissional</span>
          </div>
          <span className="text-slate-500">Fase 1 • Auth</span>
        </div>
      </div>
    </div>
  );
};
