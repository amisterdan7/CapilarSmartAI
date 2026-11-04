import React from 'react';
import { X, Camera } from 'lucide-react';
import { ClientData, ClientPhotoRecord } from '../../types';
import { PhotoGalleryManager } from '../photos/PhotoGalleryManager';

interface ModalGaleriaFotosProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientData | null;
  professionalId: string;
  professionalName?: string;
  currentEvaluationId?: string;
  onPhotoSelectedForMicroscope?: (photo: ClientPhotoRecord) => void;
}

export const ModalGaleriaFotos: React.FC<ModalGaleriaFotosProps> = ({
  isOpen,
  onClose,
  client,
  professionalId,
  professionalName,
  currentEvaluationId,
  onPhotoSelectedForMicroscope,
}) => {
  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-[#070b14] border border-[#1a2338] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Topbar do Modal */}
        <div className="p-4 px-6 border-b border-[#141c30] flex items-center justify-between gap-4 bg-[#050811]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f72585]/15 border border-[#f72585]/30 flex items-center justify-center text-[#f72585]">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Acervo de Fotografias e Tricoscopia Clínica
              </h2>
              <p className="text-xs text-slate-400">
                Cliente: <span className="text-white font-semibold">{client.name}</span> • Armazenamento Seguro Firebase Storage
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar galeria"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <PhotoGalleryManager
            client={client}
            professionalId={professionalId}
            professionalName={professionalName}
            currentEvaluationId={currentEvaluationId}
            onPhotoSelectedForMicroscope={(photo) => {
              onPhotoSelectedForMicroscope?.(photo);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
};
