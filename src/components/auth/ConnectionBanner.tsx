import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, CheckCircle2 } from 'lucide-react';

interface ConnectionBannerProps {
  isOnline: boolean;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ isOnline }) => {
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowReconnected(false);
    } else if (wasOffline) {
      // Retornou a ficar online após ter ficado offline
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="no-print bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-amber-200 text-xs flex items-center justify-between gap-3 backdrop-blur-sm transition-all"
      >
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span className="font-medium">
              Você está temporariamente sem conexão com a internet. O aplicativo continua em operação local com total segurança.
            </span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 font-medium hidden sm:inline">
            Modo Offline Seguro
          </span>
        </div>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="no-print bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-2 text-emerald-200 text-xs flex items-center justify-between gap-3 backdrop-blur-sm animate-fade-in transition-all"
      >
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">
              Conexão com a internet restabelecida!
            </span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 font-medium hidden sm:inline">
            <Wifi className="w-3 h-3 inline mr-1 text-emerald-400" /> Online
          </span>
        </div>
      </div>
    );
  }

  return null;
};
