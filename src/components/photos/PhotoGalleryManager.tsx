import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Download,
  Calendar,
  Layers,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  X,
  FileCheck,
  Clock,
  Info,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import {
  ClientPhotoRecord,
  PhotoCategory,
  ConsentLGPDRecord,
  ClientData,
} from '../../types';
import {
  uploadClinicalPhoto,
  coordinatedDeletePhoto,
  fetchClientPhotosWithOfflineSupport,
} from '../../services/storageService';
import {
  saveConsentRecordToFirestore,
  fetchConsentRecordsByClient,
  revokeConsentInFirestore,
} from '../../services/firestoreData';

interface PhotoGalleryManagerProps {
  client: ClientData;
  professionalId: string;
  professionalName?: string;
  currentEvaluationId?: string;
  onPhotoSelectedForMicroscope?: (photo: ClientPhotoRecord) => void;
}

const CATEGORY_LABELS: Record<PhotoCategory, { label: string; color: string }> = {
  TRICOSCOPIA_COURO: { label: 'Tricoscopia Couro', color: 'text-cyan-400 bg-cyan-950/50 border-cyan-800/60' },
  TRICOSCOPIA_HASTE: { label: 'Tricoscopia Haste', color: 'text-emerald-400 bg-emerald-950/50 border-emerald-800/60' },
  PANORAMICA_CABELO: { label: 'Panorâmica', color: 'text-indigo-400 bg-indigo-950/50 border-indigo-800/60' },
  VISAGISMO_ROSTO: { label: 'Visagismo Face', color: 'text-[#f72585] bg-[#f72585]/10 border-[#f72585]/30' },
  TESTE_MECANICO: { label: 'Teste Mecânico', color: 'text-amber-400 bg-amber-950/50 border-amber-800/60' },
  OUTRA: { label: 'Outro Registro', color: 'text-slate-400 bg-slate-900 border-slate-700' },
};

export const PhotoGalleryManager: React.FC<PhotoGalleryManagerProps> = ({
  client,
  professionalId,
  professionalName = 'Profissional Responsável',
  currentEvaluationId,
  onPhotoSelectedForMicroscope,
}) => {
  const [photos, setPhotos] = useState<ClientPhotoRecord[]>([]);
  const [consents, setConsents] = useState<ConsentLGPDRecord[]>([]);
  const [activeCategory, setActiveCategory] = useState<PhotoCategory | 'TODAS'>('TODAS');
  const [isLoading, setIsLoading] = useState(true);

  // Modal de Inspeção em Alta Resolução
  const [inspectingPhoto, setInspectingPhoto] = useState<ClientPhotoRecord | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [viewOriginalMode, setViewOriginalMode] = useState<boolean>(false);

  // Modal / Gaveta de Consentimento LGPD
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [isRevokingConsent, setIsRevokingConsent] = useState(false);
  const [revocationReasonInput, setRevocationReasonInput] = useState('');
  const [consentForm, setConsentForm] = useState({
    prontuario: false,
    divulgacao: false,
    treinamentoIa: false,
  });

  // Estado de Upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedUploadCategory, setSelectedUploadCategory] = useState<PhotoCategory>('TRICOSCOPIA_COURO');
  const [notesInput, setNotesInput] = useState('');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Carrega fotos e consentimentos da cliente
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedPhotos, fetchedConsents] = await Promise.all([
        fetchClientPhotosWithOfflineSupport(client.id, professionalId),
        fetchConsentRecordsByClient(client.id, professionalId),
      ]);
      setPhotos(fetchedPhotos);
      setConsents(fetchedConsents);
    } catch (err) {
      console.error('[PhotoGalleryManager] Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (client.id && professionalId) {
      loadData();
    }
  }, [client.id, professionalId]);

  // Consentimento ativo mais recente
  const activeConsent = consents.find((c) => !c.revoked);

  // Submissão de Novo Consentimento LGPD (Sem presunção)
  const handleSaveConsent = async () => {
    if (!consentForm.prontuario && !consentForm.divulgacao && !consentForm.treinamentoIa) {
      alert('Selecione ao menos uma finalidade específica autorizada pela cliente.');
      return;
    }

    const newConsent: ConsentLGPDRecord = {
      id: `consent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      clientId: client.id,
      professionalId,
      professionalName,
      termVersion: '2026.1-TERMO-FOTOGRAFIA-TRICOLOGICA',
      grantedAt: new Date().toISOString(),
      prontuarioConsent: consentForm.prontuario,
      divulgacaoConsent: consentForm.divulgacao,
      treinamentoIaConsent: consentForm.treinamentoIa,
      revoked: false,
    };

    try {
      await saveConsentRecordToFirestore(newConsent, professionalId);
      setConsents((prev) => [newConsent, ...prev]);
      setIsConsentModalOpen(false);
    } catch (err) {
      console.error('[Consent] Erro ao gravar consentimento:', err);
      alert('Falha ao registrar consentimento no Firestore.');
    }
  };

  // Revogação de Consentimento LGPD
  const handleRevokeConsent = async (consentId: string) => {
    if (!revocationReasonInput.trim()) {
      alert('Informe o motivo da revogação formal.');
      return;
    }
    try {
      await revokeConsentInFirestore(consentId, professionalId, revocationReasonInput.trim());
      setConsents((prev) =>
        prev.map((c) =>
          c.id === consentId
            ? { ...c, revoked: true, revokedAt: new Date().toISOString(), revocationReason: revocationReasonInput }
            : c
        )
      );
      setIsRevokingConsent(false);
      setRevocationReasonInput('');
    } catch (err) {
      console.error('[Consent] Erro ao revogar consentimento:', err);
      alert('Falha ao registrar a revogação.');
    }
  };

  // Upload de Imagem
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Se a cliente não possui consentimento para prontuário, avisa a profissional
    if (!activeConsent?.prontuarioConsent) {
      const proceed = confirm(
        'Aviso LGPD: Não há termo formal assinado de uso de imagem para prontuário desta cliente. Deseja registrar o consentimento agora antes de salvar a fotografia?'
      );
      if (proceed) {
        setIsConsentModalOpen(true);
        return;
      }
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const uploadedRecord = await uploadClinicalPhoto({
        fileOrBlob: file,
        clientId: client.id,
        professionalId,
        category: selectedUploadCategory,
        evaluationId: currentEvaluationId,
        notes: notesInput.trim() || undefined,
        consentRecordId: activeConsent?.id,
        onProgress: (p) => setUploadProgress(p),
      });

      setPhotos((prev) => [uploadedRecord, ...prev]);
      setNotesInput('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('[PhotoGallery] Falha ao enviar foto:', err);
      alert('Não foi possível concluir o upload. A foto foi salva no armazenamento local para sincronização posterior.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Exclusão Coordenada
  const handleDeletePhoto = async (photo: ClientPhotoRecord) => {
    const confirmDelete = confirm(
      'Confirmação de Exclusão Coordenada:\n\nEsta fotografia e todos os seus arquivos associados (otimizado, miniatura e original) serão permanentemente removidos do Firebase Storage e do prontuário no Firestore.\n\nDeseja prosseguir?'
    );
    if (!confirmDelete) return;

    setIsDeletingId(photo.id);
    try {
      await coordinatedDeletePhoto(photo, professionalId);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      if (inspectingPhoto?.id === photo.id) {
        setInspectingPhoto(null);
      }
    } catch (err) {
      console.error('[PhotoGallery] Erro na exclusão coordenada:', err);
      alert('Falha durante a exclusão coordenada. A pendência foi registrada para reconciliação segura.');
    } finally {
      setIsDeletingId(null);
    }
  };

  const filteredPhotos = photos.filter((p) =>
    activeCategory === 'TODAS' ? true : p.category === activeCategory
  );

  return (
    <div className="space-y-6">
      {/* Header da Galeria com Status LGPD */}
      <div className="bg-[#0b101d] border border-[#1a2338] rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#f72585]/10 border border-[#f72585]/30 text-[#f72585] text-[11px] font-semibold uppercase tracking-wider mb-1">
            <Camera className="w-3 h-3" /> Acervo Fotográfico & Tricoscopia
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">
            Galeria Clínica de {client.name}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Preservação de qualidade clínica, comparativo evolutivo e rastreabilidade integral.
          </p>
        </div>

        {/* Emblema e Ação do Consentimento LGPD */}
        <div className="flex items-center gap-3">
          {activeConsent?.prontuarioConsent ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Termo LGPD Ativo ({activeConsent.termVersion})</span>
              <button
                onClick={() => setIsConsentModalOpen(true)}
                className="ml-2 text-[10px] underline text-emerald-400 hover:text-white"
              >
                Gerenciar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-950/50 border border-amber-800/60 text-amber-300 text-xs font-medium">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Sem Termo LGPD Ativo</span>
              <button
                onClick={() => setIsConsentModalOpen(true)}
                className="ml-2 px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-black font-semibold text-[10px]"
              >
                Registrar
              </button>
            </div>
          )}

          <button
            onClick={loadData}
            title="Atualizar acervo"
            className="p-2 rounded-xl bg-[#12192c] border border-[#1e273d] text-slate-300 hover:text-white hover:bg-[#1a233b] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Barra de Ações: Novo Upload e Seleção de Categoria */}
      <div className="bg-[#0b101d] border border-[#1a2338] rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-300 mr-1">Filtrar:</span>
            {(['TODAS', 'TRICOSCOPIA_COURO', 'TRICOSCOPIA_HASTE', 'PANORAMICA_CABELO', 'VISAGISMO_ROSTO', 'TESTE_MECANICO'] as const).map(
              (cat) => {
                const isSelected = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#18223c] border-[#f72585] text-white shadow-[0_0_10px_rgba(247,37,133,0.2)]'
                        : 'bg-[#080d1a] border-[#1a2338] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat === 'TODAS' ? 'Todas as Fotos' : CATEGORY_LABELS[cat].label}
                  </button>
                );
              }
            )}
          </div>

          {/* Botão de Upload */}
          <div className="flex items-center gap-2">
            <select
              value={selectedUploadCategory}
              onChange={(e) => setSelectedUploadCategory(e.target.value as PhotoCategory)}
              className="bg-[#080d1a] border border-[#1a2338] text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-[#f72585]"
            >
              <option value="TRICOSCOPIA_COURO">Tricoscopia Couro</option>
              <option value="TRICOSCOPIA_HASTE">Tricoscopia Haste</option>
              <option value="PANORAMICA_CABELO">Panorâmica Geral</option>
              <option value="VISAGISMO_ROSTO">Visagismo / Rosto</option>
              <option value="TESTE_MECANICO">Teste Mecânico</option>
              <option value="OUTRA">Outra</option>
            </select>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-4 py-2 rounded-xl bg-[#f72585] hover:bg-[#d91a70] text-white text-xs font-semibold shadow-lg shadow-[#f72585]/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{isUploading ? `Enviando (${uploadProgress}%)` : 'Anexar Imagem'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Campo Opcional de Notas ao Fazer Upload */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            placeholder="Observação rápida para a próxima foto (ex: óstios foliculares no vértex, escamação fina)..."
            className="w-full bg-[#080d1a] border border-[#1a2338] text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-[#f72585] placeholder:text-slate-500"
          />
        </div>

        {isUploading && (
          <div className="w-full bg-[#080d1a] h-2 rounded-full overflow-hidden border border-[#1a2338]">
            <div
              className="bg-[#f72585] h-full transition-all duration-300 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Grade de Fotos */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 text-sm">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#f72585] mb-2" />
          Carregando acervo de imagens da cliente...
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-[#1a2338] rounded-2xl bg-[#080d1a]/50 p-8 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#141c30] border border-[#1e273d] flex items-center justify-center mx-auto text-slate-500">
            <Camera className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-white">Nenhuma fotografia encontrada nesta categoria</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Utilize o botão acima para anexar registros de tricoscopia capilar ou microscopia digital.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPhotos.map((photo) => {
            const catBadge = CATEGORY_LABELS[photo.category] || CATEGORY_LABELS.OUTRA;
            const isDeleting = isDeletingId === photo.id;
            return (
              <div
                key={photo.id}
                className="group relative bg-[#0b101d] border border-[#1a2338] hover:border-[#f72585]/40 rounded-2xl overflow-hidden shadow-lg transition-all flex flex-col"
              >
                {/* Imagem Thumbnail com Overlay */}
                <div
                  className="relative aspect-square w-full bg-black cursor-pointer overflow-hidden"
                  onClick={() => {
                    setInspectingPhoto(photo);
                    setZoomLevel(1);
                    setViewOriginalMode(false);
                  }}
                >
                  <img
                    src={photo.thumbnailUrl || photo.downloadUrl}
                    alt={photo.notes || 'Registro capilar'}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Indicador de Status Offline / Nuvem */}
                  {photo.syncStatus === 'PENDING_UPLOAD' && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-500/90 text-black text-[10px] font-bold shadow">
                      Pendente de Nuvem
                    </div>
                  )}

                  {/* Botão de Lente / Zoom */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="p-2 rounded-xl bg-black/70 text-white border border-white/20 hover:scale-110 transition-transform">
                      <Maximize2 className="w-5 h-5" />
                    </span>
                  </div>

                  {/* Categoria Badge */}
                  <div className="absolute bottom-2 left-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${catBadge.color}`}>
                      {catBadge.label}
                    </span>
                  </div>
                </div>

                {/* Metadados do Card */}
                <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date(photo.takenAt || photo.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                      <span>{(photo.fileSizeBytes / 1024).toFixed(0)} KB</span>
                    </div>

                    {photo.notes && (
                      <p className="text-xs text-slate-200 line-clamp-2 mt-1 leading-snug">
                        {photo.notes}
                      </p>
                    )}
                  </div>

                  {/* Ações do Card */}
                  <div className="pt-2 border-t border-[#1a2338] flex items-center justify-between gap-2">
                    {onPhotoSelectedForMicroscope && (
                      <button
                        onClick={() => onPhotoSelectedForMicroscope(photo)}
                        className="text-[10px] font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        Vincular ao Exame
                      </button>
                    )}

                    <div className="flex items-center gap-1 ml-auto">
                      <a
                        href={photo.originalDownloadUrl || photo.downloadUrl}
                        download={`capilar_smart_${photo.id}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Baixar arquivo original bruto"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => handleDeletePhoto(photo)}
                        disabled={isDeleting}
                        title="Excluir do prontuário (Exclusão Coordenada)"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE INSPEÇÃO CLÍNICA EM ALTA RESOLUÇÃO COM ZOOM */}
      {/* ========================================================= */}
      {inspectingPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl h-[90vh] bg-[#0c111e] border border-[#1e273d] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
            {/* Topbar da Inspeção */}
            <div className="p-4 border-b border-[#1a2338] flex items-center justify-between gap-4 bg-[#080d1a]">
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${CATEGORY_LABELS[inspectingPhoto.category].color}`}>
                  {CATEGORY_LABELS[inspectingPhoto.category].label}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(inspectingPhoto.takenAt || inspectingPhoto.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>

              {/* Controles de Zoom e Alternância de Arquivo Original */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewOriginalMode(!viewOriginalMode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    viewOriginalMode
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                      : 'bg-[#12192c] border-[#1e273d] text-slate-300 hover:text-white'
                  }`}
                  title="Alternar entre versão WebP otimizada e o arquivo original não-comprimido"
                >
                  {viewOriginalMode ? 'Visualizando Arquivo Original Bruto' : 'Visualizando WebP Otimizado'}
                </button>

                <div className="flex items-center bg-[#12192c] border border-[#1e273d] rounded-xl p-1 gap-1">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
                    className="p-1 rounded text-slate-300 hover:text-white"
                    title="Diminuir Zoom"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono px-2 text-slate-300">{(zoomLevel * 100).toFixed(0)}%</span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(4, z + 0.5))}
                    className="p-1 rounded text-slate-300 hover:text-white"
                    title="Aumentar Zoom (até 400%)"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                <a
                  href={inspectingPhoto.originalDownloadUrl || inspectingPhoto.downloadUrl}
                  download={`original_${inspectingPhoto.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Original</span>
                </a>

                <button
                  onClick={() => setInspectingPhoto(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Fechar visualizador"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Área Central de Visualização */}
            <div className="flex-1 bg-black overflow-auto flex items-center justify-center p-4 relative">
              <img
                src={
                  viewOriginalMode && inspectingPhoto.originalDownloadUrl
                    ? inspectingPhoto.originalDownloadUrl
                    : inspectingPhoto.downloadUrl
                }
                alt="Inspeção clínica"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-out',
                }}
                className="max-h-full max-w-full object-contain select-none cursor-grab active:cursor-grabbing"
              />
            </div>

            {/* Rodapé de Achados e Metadados Técnicos */}
            <div className="p-4 border-t border-[#1a2338] bg-[#080d1a] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <p className="text-slate-300 font-medium">
                  {inspectingPhoto.notes || 'Sem observações adicionais gravadas na bancada.'}
                </p>
                <div className="flex items-center gap-4 text-[11px] text-slate-400">
                  <span>Resolução: {inspectingPhoto.width}x{inspectingPhoto.height}px</span>
                  <span>Tamanho Otimizado: {(inspectingPhoto.fileSizeBytes / 1024).toFixed(0)} KB</span>
                  {inspectingPhoto.originalSizeBytes && (
                    <span>Original Bruto: {(inspectingPhoto.originalSizeBytes / 1024).toFixed(0)} KB</span>
                  )}
                  <span>Fidelidade Clínica Preservada: {inspectingPhoto.isOriginalPreserved ? 'Sim' : 'Não'}</span>
                </div>
              </div>

              <button
                onClick={() => handleDeletePhoto(inspectingPhoto)}
                className="px-3 py-1.5 rounded-xl border border-rose-800 bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL COMPLETO DE CONSENTIMENTO LGPD (LEI 13.709/2018) */}
      {/* ========================================================= */}
      {isConsentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-[#0c1222] border border-[#1e293b] rounded-2xl shadow-2xl p-6 sm:p-8 text-slate-100 overflow-hidden space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-[#1e293b] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f72585]/15 border border-[#f72585]/30 flex items-center justify-center text-[#f72585]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Termo de Consentimento LGPD para Imagem e Tricoscopia
                  </h3>
                  <p className="text-xs text-slate-400">
                    Lei Geral de Proteção de Dados (Lei 13.709/2018) • Versão 2026.1
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConsentModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informações da Cliente e Profissional */}
            <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl p-4 text-xs space-y-1 text-slate-300">
              <p><strong>Titular dos Dados:</strong> {client.name} (ID: {client.id})</p>
              <p><strong>Profissional Responsável:</strong> {professionalName} (ID: {professionalId})</p>
              <p><strong>Classificação do Dado:</strong> Imagens de couro cabeludo, fibra capilar e face (Dado Pessoal Sensível à Saúde e Imagem).</p>
            </div>

            {/* 3 Finalidades Específicas Autônomas (Nenhum consentimento presumido) */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Finalidades Específicas de Tratamento (Autorizações Independentes):
              </h4>

              {/* Finalidade 1: Prontuário */}
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[#1e293b] bg-[#080d1a] hover:border-[#f72585]/40 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentForm.prontuario}
                  onChange={(e) => setConsentForm({ ...consentForm, prontuario: e.target.checked })}
                  className="mt-1 w-4 h-4 rounded border-slate-700 text-[#f72585] focus:ring-[#f72585] accent-[#f72585]"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-semibold text-white block">
                    1. Prontuário Clínico e Acompanhamento Terapêutico (Obrigatório para arquivamento)
                  </span>
                  <p className="text-slate-400 leading-relaxed">
                    Autorizo a captura, armazenamento no Firebase e uso exclusivo de fotografias de microscopia e tricoscopia para comparação do histórico de evolução capilar no prontuário.
                  </p>
                </div>
              </label>

              {/* Finalidade 2: Divulgação Técnico-Científica */}
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[#1e293b] bg-[#080d1a] hover:border-[#f72585]/40 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentForm.divulgacao}
                  onChange={(e) => setConsentForm({ ...consentForm, divulgacao: e.target.checked })}
                  className="mt-1 w-4 h-4 rounded border-slate-700 text-[#f72585] focus:ring-[#f72585] accent-[#f72585]"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-semibold text-white block">
                    2. Divulgação Técnico-Científica e Antes/Depois com Anonimização
                  </span>
                  <p className="text-slate-400 leading-relaxed">
                    Autorizo a utilização de fotos da fibra/couro em publicações de resultados ou estudos acadêmicos, desde que completamente desprovidas de dados identificadores de rosto e nome.
                  </p>
                </div>
              </label>

              {/* Finalidade 3: Calibração de Modelos de IA */}
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[#1e293b] bg-[#080d1a] hover:border-[#f72585]/40 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentForm.treinamentoIa}
                  onChange={(e) => setConsentForm({ ...consentForm, treinamentoIa: e.target.checked })}
                  className="mt-1 w-4 h-4 rounded border-slate-700 text-[#f72585] focus:ring-[#f72585] accent-[#f72585]"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-semibold text-white block">
                    3. Calibração e Validação de Algoritmos de Visão Computacional (IA)
                  </span>
                  <p className="text-slate-400 leading-relaxed">
                    Autorizo o processamento computacional anonimizado das tricoscopias para refinamento da precisão do motor de análise tricológica do sistema.
                  </p>
                </div>
              </label>
            </div>

            {/* Histórico de Revogação */}
            {activeConsent && !isRevokingConsent && (
              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Consentimento assinado em: {new Date(activeConsent.grantedAt).toLocaleString('pt-BR')}
                </span>
                <button
                  type="button"
                  onClick={() => setIsRevokingConsent(true)}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Revogar este Consentimento
                </button>
              </div>
            )}

            {isRevokingConsent && activeConsent && (
              <div className="p-4 rounded-xl border border-rose-900/60 bg-rose-950/30 space-y-3 text-xs">
                <span className="font-semibold text-rose-300 block">Revogação Formal do Termo</span>
                <input
                  type="text"
                  value={revocationReasonInput}
                  onChange={(e) => setRevocationReasonInput(e.target.value)}
                  placeholder="Motivo declarado pelo titular para revogação (ex: solicitação expressa da cliente)..."
                  className="w-full bg-[#080d1a] border border-rose-900/80 rounded-xl px-3 py-2 text-white outline-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setIsRevokingConsent(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleRevokeConsent(activeConsent.id)}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                  >
                    Confirmar Revogação
                  </button>
                </div>
              </div>
            )}

            {/* Ações do Modal */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e293b]">
              <button
                type="button"
                onClick={() => setIsConsentModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSaveConsent}
                className="px-5 py-2 rounded-xl bg-[#f72585] hover:bg-[#d91a70] text-white text-xs font-semibold shadow-lg shadow-[#f72585]/20 transition-all cursor-pointer"
              >
                Registrar Consentimento no Prontuário
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
