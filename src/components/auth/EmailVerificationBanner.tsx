import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const EmailVerificationBanner: React.FC = () => {
  const { currentUser, isEmailVerified, refreshVerification, resendVerification } = useAuth();
  const [cooldown, setCooldown] = useState<number>(0);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Timer de cooldown de 60 segundos
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  if (!currentUser || isEmailVerified) {
    return null;
  }

  const handleRefresh = async () => {
    setIsChecking(true);
    setFeedback(null);
    try {
      const verified = await refreshVerification();
      if (verified) {
        setFeedback({ type: 'success', message: 'E-mail confirmado com sucesso!' });
      } else {
        setFeedback({
          type: 'error',
          message: 'E-mail ainda não confirmado. Clique no link que enviamos para sua caixa de entrada.',
        });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao verificar status. Tente novamente.' });
    } finally {
      setIsChecking(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isSending) return;
    setIsSending(true);
    setFeedback(null);
    try {
      await resendVerification();
      setCooldown(60);
      setFeedback({
        type: 'success',
        message: 'Novo link enviado! Verifique sua caixa de entrada e a pasta de spam.',
      });
    } catch {
      setFeedback({ type: 'error', message: 'Não foi possível reenviar agora. Tente mais tarde.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Aviso de verificação de e-mail"
      className="no-print bg-[#13192c]/90 border-b border-[#293757] px-4 py-2.5 backdrop-blur-md transition-all text-xs text-slate-300"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="w-7 h-7 rounded-lg bg-[#f72585]/15 border border-[#f72585]/30 flex items-center justify-center shrink-0">
            <Mail className="w-3.5 h-3.5 text-[#f72585]" />
          </div>
          <div>
            <p className="font-semibold text-slate-100 flex items-center gap-1.5 flex-wrap">
              <span>Confirmação de e-mail pendente</span>
              <span className="text-[11px] font-normal text-slate-400">
                ({currentUser.email})
              </span>
            </p>
            <p className="text-[11px] text-slate-400">
              Confirme seu endereço para garantir a posse e recuperação da sua conta profissional.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {feedback && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded flex items-center gap-1 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3 h-3 text-rose-400" />
              )}
              {feedback.message}
            </span>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isChecking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c2438] hover:bg-[#25324d] text-slate-200 border border-[#2e3e60] transition-colors cursor-pointer text-xs disabled:opacity-50"
            title="Verificar se você já clicou no link recebido"
          >
            <RefreshCw className={`w-3 h-3 text-[#f72585] ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Verificando...' : 'Já confirmei'}</span>
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || isSending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#e01e84]/20 to-[#f72585]/20 hover:from-[#e01e84]/30 hover:to-[#f72585]/30 text-[#f72585] border border-[#f72585]/40 transition-colors cursor-pointer text-xs disabled:opacity-50"
            title="Enviar novo e-mail com link de confirmação"
          >
            <Send className="w-3 h-3" />
            <span>
              {cooldown > 0 ? `Reenviar em ${cooldown}s` : isSending ? 'Enviando...' : 'Reenviar link'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
