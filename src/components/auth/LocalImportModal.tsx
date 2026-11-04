import React, { useState } from 'react';
import { Database, Sparkles, CheckCircle2, ShieldCheck, X, ArrowRight } from 'lucide-react';

interface LocalImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: {
    clients: number;
    evaluations: number;
    products: number;
  };
  userEmail?: string;
  onConfirmImport: () => Promise<void>;
  onDeclineImport: () => void;
}

export const LocalImportModal: React.FC<LocalImportModalProps> = ({
  isOpen,
  onClose,
  summary,
  userEmail,
  onConfirmImport,
  onDeclineImport,
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsImporting(true);
    try {
      await onConfirmImport();
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Erro na importação de dados locais:', err);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0c1222] border border-[#1e293b] rounded-2xl shadow-2xl p-6 sm:p-8 text-slate-100 overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#f72585]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f72585]/15 border border-[#f72585]/30 flex items-center justify-center text-[#f72585]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white tracking-tight">
                Registros Locais Encontrados
              </h3>
              <p className="text-xs text-slate-400">
                Sincronização opcional com sua conta em nuvem
              </p>
            </div>
          </div>
          <button
            onClick={onDeclineImport}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-base font-semibold text-white">Importação Concluída com Sucesso!</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Os registros foram vinculados com segurança ao seu perfil profissional no Firestore.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-slate-300 leading-relaxed">
              Identificamos dados salvos na memória deste dispositivo. Deseja importá-los para sua conta profissional{' '}
              {userEmail && <span className="font-semibold text-[#f72585]">({userEmail})</span>} ou prefere iniciar com a conta limpa?
            </p>

            {/* Contagem exata de registros */}
            <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl p-4 divide-y divide-[#1e293b]">
              <div className="flex items-center justify-between py-2 text-xs">
                <span className="text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#f72585]" />
                  Clientes Cadastrados
                </span>
                <span className="font-semibold text-white">{summary.clients} registro(s)</span>
              </div>
              <div className="flex items-center justify-between py-2 text-xs">
                <span className="text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  Avaliações Tricológicas
                </span>
                <span className="font-semibold text-white">{summary.evaluations} registro(s)</span>
              </div>
              <div className="flex items-center justify-between py-2 text-xs">
                <span className="text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Bancada de Cosmecêuticos
                </span>
                <span className="font-semibold text-white">{summary.products} item(ns)</span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Privacidade e Sigilo:</strong> Os registros locais nunca são enviados automaticamente. Se você optar por iniciar com a conta limpa, os dados locais permanecerão intactos no navegador para uso em modo anônimo.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onDeclineImport}
                disabled={isImporting}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-all"
              >
                Iniciar com Conta Limpa (Recomendado)
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={isImporting}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#f72585] hover:bg-[#d91a70] text-white text-xs font-semibold shadow-lg shadow-[#f72585]/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <span>Importar Registros</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
