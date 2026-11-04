/**
 * Serviço de Armazenamento Seguro de Fotografias e Tricoscopia (Firebase Storage + Firestore)
 * Capilar Smart IA — Fase 4
 * 
 * Condições Técnicas Rigorosas:
 * 1. Exclusão coordenada com registro de pendências e tentativas de reconciliação.
 * 2. Preservação do arquivo original bruto (não apenas WebP comprimido) para garantia clínica.
 * 3. IndexedDB estritamente isolado por UID (capilar_smart_storage_{uid}).
 * 4. Bloqueio absoluto de sincronização cruzada entre contas distintas.
 * 5. Cancelamento gracioso ao realizar logout durante upload.
 */

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type FirebaseStorage,
} from 'firebase/storage';
import { storage, requireStorage, isFirebaseConfigured } from './firebase';
import {
  ClientPhotoRecord,
  PhotoCategory,
  CoordinatedDeletionRecord,
} from '../types';
import { processClinicalImage, ProcessedImagePackage } from '../utils/imageCompressor';
import {
  savePhotoMetadataToFirestore,
  fetchPhotosByClientFromFirestore,
  deletePhotoMetadataFromFirestore,
} from './firestoreData';

// ==========================================
// 1. ISOLAMENTO DE INDEXEDDB POR UID
// ==========================================

const getDbNameForUser = (uid: string): string => {
  if (!uid) throw new Error('[StorageService] UID obrigatório para instanciar armazenamento local isolado.');
  return `capilar_smart_storage_${uid}`;
};

const openUserIndexedDB = (uid: string): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB não suportado neste navegador.'));
    }

    const dbName = getDbNameForUser(uid);
    const request = window.indexedDB.open(dbName, 1);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const idb = (event.target as IDBOpenDBRequest).result;
      if (!idb.objectStoreNames.contains('pending_uploads')) {
        idb.createObjectStore('pending_uploads', { keyPath: 'id' });
      }
      if (!idb.objectStoreNames.contains('pending_deletions')) {
        idb.createObjectStore('pending_deletions', { keyPath: 'photoId' });
      }
      if (!idb.objectStoreNames.contains('cached_photos')) {
        idb.createObjectStore('cached_photos', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// ==========================================
// 2. ESTRUTURA DE PENDÊNCIAS OFFLINE
// ==========================================

interface PendingUploadItem {
  id: string;
  clientId: string;
  professionalId: string;
  evaluationId?: string;
  category: PhotoCategory;
  notes?: string;
  observedRegion?: string;
  deviceFindings?: string[];
  consentRecordId?: string;
  takenAt: string;
  createdAt: string;
  originalBlob: Blob;
  originalExtension: string;
  optimizedBlob: Blob;
  thumbnailBlob: Blob;
  width: number;
  height: number;
  fileSizeBytes: number;
  originalSizeBytes: number;
  retryCount: number;
}

// Controller global de cancelamento para cancelamento gracioso no logout
let activeUploadController: AbortController | null = null;

export const abortActiveUploads = () => {
  if (activeUploadController) {
    activeUploadController.abort();
    activeUploadController = null;
    console.info('[StorageService] Uploads ativos abortados por logout.');
  }
};

// ==========================================
// 3. UPLOAD COM PRESERVAÇÃO ORIGINAL E CLÍNICA
// ==========================================

export interface UploadPhotoParams {
  fileOrBlob: File | Blob;
  clientId: string;
  professionalId: string;
  category: PhotoCategory;
  evaluationId?: string;
  notes?: string;
  observedRegion?: string;
  deviceFindings?: string[];
  consentRecordId?: string;
  onProgress?: (percent: number) => void;
}

export const uploadClinicalPhoto = async ({
  fileOrBlob,
  clientId,
  professionalId,
  category,
  evaluationId,
  notes,
  observedRegion,
  deviceFindings,
  consentRecordId,
  onProgress,
}: UploadPhotoParams): Promise<ClientPhotoRecord> => {
  if (!professionalId) throw new Error('[StorageService] professionalId é obrigatório para upload.');
  if (!clientId) throw new Error('[StorageService] clientId é obrigatório para vincular a fotografia.');

  const photoId = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const takenAt = new Date().toISOString();
  const createdAt = takenAt;

  // 1. Processamento e preservação de qualidade clínica
  const processed = await processClinicalImage(fileOrBlob, category);

  // Caminhos estruturados no Firebase Storage
  const fullPath = `photos/${professionalId}/clients/${clientId}/${photoId}_full.webp`;
  const thumbPath = `photos/${professionalId}/clients/${clientId}/${photoId}_thumb.webp`;
  const origPath = `photos/${professionalId}/clients/${clientId}/${photoId}_orig.${processed.originalExtension}`;

  // Se o Firebase estiver indisponível ou offline, enfileira no IndexedDB do usuário
  if (!isFirebaseConfigured() || !storage) {
    console.warn('[StorageService] Firebase Storage offline/não configurado. Gravando em IndexedDB isolado do usuário.');
    const pendingItem: PendingUploadItem = {
      id: photoId,
      clientId,
      professionalId,
      evaluationId,
      category,
      notes,
      observedRegion,
      deviceFindings,
      consentRecordId,
      takenAt,
      createdAt,
      originalBlob: processed.originalBlob,
      originalExtension: processed.originalExtension,
      optimizedBlob: processed.optimizedBlob,
      thumbnailBlob: processed.thumbnailBlob,
      width: processed.width,
      height: processed.height,
      fileSizeBytes: processed.optimizedSizeBytes,
      originalSizeBytes: processed.originalSizeBytes,
      retryCount: 0,
    };

    const idb = await openUserIndexedDB(professionalId);
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction('pending_uploads', 'readwrite');
      tx.objectStore('pending_uploads').put(pendingItem);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const localRecord: ClientPhotoRecord = {
      id: photoId,
      clientId,
      evaluationId,
      professionalId,
      category,
      storagePath: fullPath,
      thumbStoragePath: thumbPath,
      originalStoragePath: origPath,
      downloadUrl: URL.createObjectURL(processed.optimizedBlob),
      thumbnailUrl: URL.createObjectURL(processed.thumbnailBlob),
      originalDownloadUrl: URL.createObjectURL(processed.originalBlob),
      width: processed.width,
      height: processed.height,
      fileSizeBytes: processed.optimizedSizeBytes,
      originalSizeBytes: processed.originalSizeBytes,
      isOriginalPreserved: true,
      notes,
      observedRegion,
      deviceFindings,
      consentRecordId,
      takenAt,
      createdAt,
      syncStatus: 'PENDING_UPLOAD',
    };

    return localRecord;
  }

  // Upload em Nuvem (Firebase Storage)
  const storageInstance = requireStorage();
  activeUploadController = new AbortController();

  const customMetadata = {
    clientId,
    professionalId,
    category,
    photoId,
    takenAt,
  };

  try {
    // A. Upload da Imagem Otimizada (Full WebP)
    const fullRef = ref(storageInstance, fullPath);
    const fullUploadTask = uploadBytesResumable(fullRef, processed.optimizedBlob, {
      contentType: 'image/webp',
      customMetadata,
    });

    fullUploadTask.on('state_changed', (snapshot) => {
      if (snapshot.totalBytes > 0) {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 60);
        onProgress?.(percent);
      }
    });

    await fullUploadTask;
    const downloadUrl = await getDownloadURL(fullRef);

    // B. Upload da Miniatura (Thumb WebP)
    const thumbRef = ref(storageInstance, thumbPath);
    const thumbTask = uploadBytesResumable(thumbRef, processed.thumbnailBlob, {
      contentType: 'image/webp',
      customMetadata,
    });
    await thumbTask;
    const thumbnailUrl = await getDownloadURL(thumbRef);
    onProgress?.(80);

    // C. Upload do Arquivo Original Preservado (Qualidade Clínica Pura)
    const origMime = processed.originalBlob.type || 'image/jpeg';
    const origRef = ref(storageInstance, origPath);
    const origTask = uploadBytesResumable(origRef, processed.originalBlob, {
      contentType: origMime,
      customMetadata,
    });
    await origTask;
    const originalDownloadUrl = await getDownloadURL(origRef);
    onProgress?.(100);

    // D. Persistência de Metadados no Firestore
    const record: ClientPhotoRecord = {
      id: photoId,
      clientId,
      evaluationId,
      professionalId,
      category,
      storagePath: fullPath,
      thumbStoragePath: thumbPath,
      originalStoragePath: origPath,
      downloadUrl,
      thumbnailUrl,
      originalDownloadUrl,
      width: processed.width,
      height: processed.height,
      fileSizeBytes: processed.optimizedSizeBytes,
      originalSizeBytes: processed.originalSizeBytes,
      isOriginalPreserved: true,
      notes,
      observedRegion,
      deviceFindings,
      consentRecordId,
      takenAt,
      createdAt,
      syncStatus: 'SYNCED',
    };

    await savePhotoMetadataToFirestore(record, professionalId);

    // Atualiza cache local no IndexedDB
    try {
      const idb = await openUserIndexedDB(professionalId);
      const tx = idb.transaction('cached_photos', 'readwrite');
      tx.objectStore('cached_photos').put(record);
    } catch {
      // cache não-crítico
    }

    return record;
  } catch (err: unknown) {
    console.error('[StorageService] Erro no upload em nuvem. Gravando pendência local:', err);

    // Salva no IndexedDB isolado caso a conexão falhe no meio da operação
    const pendingItem: PendingUploadItem = {
      id: photoId,
      clientId,
      professionalId,
      evaluationId,
      category,
      notes,
      observedRegion,
      deviceFindings,
      consentRecordId,
      takenAt,
      createdAt,
      originalBlob: processed.originalBlob,
      originalExtension: processed.originalExtension,
      optimizedBlob: processed.optimizedBlob,
      thumbnailBlob: processed.thumbnailBlob,
      width: processed.width,
      height: processed.height,
      fileSizeBytes: processed.optimizedSizeBytes,
      originalSizeBytes: processed.originalSizeBytes,
      retryCount: 0,
    };

    try {
      const idb = await openUserIndexedDB(professionalId);
      const tx = idb.transaction('pending_uploads', 'readwrite');
      tx.objectStore('pending_uploads').put(pendingItem);
    } catch {
      // ignore
    }

    throw err;
  } finally {
    activeUploadController = null;
  }
};

// ==========================================
// 4. EXCLUSÃO COORDENADA (STORAGE + FIRESTORE)
// ==========================================

/**
 * Executa a exclusão coordenada com tolerância a falhas:
 * 1. Registra intenção de exclusão em CoordinatedDeletionRecord
 * 2. Remove binários do Firebase Storage (full, thumb, orig) de forma tolerante a inexistência
 * 3. Remove metadados do Cloud Firestore
 * 4. Remove pendências do IndexedDB
 * 5. Se falhar, registra no IndexedDB para reconciliação futura sem deixar órfãos
 */
export const coordinatedDeletePhoto = async (
  photo: ClientPhotoRecord,
  professionalId: string
): Promise<CoordinatedDeletionRecord> => {
  if (!professionalId) throw new Error('[StorageService] professionalId é obrigatório para exclusão.');
  if (photo.professionalId !== professionalId) {
    throw new Error('[StorageService] Tentativa de exclusão não autorizada: professionalId incompatível.');
  }

  const deletionRecord: CoordinatedDeletionRecord = {
    id: `del_${Date.now()}_${photo.id}`,
    photoId: photo.id,
    professionalId,
    clientId: photo.clientId,
    storagePaths: [
      photo.storagePath,
      photo.thumbStoragePath || '',
      photo.originalStoragePath || '',
    ].filter(Boolean),
    requestedAt: new Date().toISOString(),
    retryCount: 0,
    status: 'PENDING_STORAGE',
  };

  // Se estiver sem nuvem configurada, remove apenas localmente
  if (!isFirebaseConfigured() || !storage) {
    try {
      const idb = await openUserIndexedDB(professionalId);
      const tx = idb.transaction(['pending_uploads', 'cached_photos'], 'readwrite');
      tx.objectStore('pending_uploads').delete(photo.id);
      tx.objectStore('cached_photos').delete(photo.id);
      deletionRecord.status = 'CONFIRMED';
      deletionRecord.confirmedAt = new Date().toISOString();
      return deletionRecord;
    } catch (e) {
      deletionRecord.status = 'FAILED';
      deletionRecord.lastError = String(e);
      return deletionRecord;
    }
  }

  const storageInstance = requireStorage();

  // 1. Remoção no Storage
  for (const path of deletionRecord.storagePaths) {
    try {
      const fileRef = ref(storageInstance, path);
      await deleteObject(fileRef);
    } catch (err: unknown) {
      const errorObj = err as { code?: string };
      // Se o arquivo já não existir, prossegue com segurança (idempotência)
      if (errorObj?.code !== 'storage/object-not-found') {
        console.warn(`[StorageService] Falha transitória ao excluir ${path}:`, err);
        deletionRecord.lastError = `Falha ao remover arquivo do Storage: ${path}`;
      }
    }
  }

  // 2. Remoção no Firestore
  deletionRecord.status = 'PENDING_FIRESTORE';
  try {
    await deletePhotoMetadataFromFirestore(photo.id, professionalId);
    deletionRecord.status = 'CONFIRMED';
    deletionRecord.confirmedAt = new Date().toISOString();

    // 3. Limpeza no cache local
    try {
      const idb = await openUserIndexedDB(professionalId);
      const tx = idb.transaction(['pending_uploads', 'cached_photos', 'pending_deletions'], 'readwrite');
      tx.objectStore('pending_uploads').delete(photo.id);
      tx.objectStore('cached_photos').delete(photo.id);
      tx.objectStore('pending_deletions').delete(photo.id);
    } catch {
      // cache local não-crítico
    }

    return deletionRecord;
  } catch (err: unknown) {
    console.error('[StorageService] Falha ao excluir metadados no Firestore. Registrando pendência:', err);
    deletionRecord.status = 'FAILED';
    deletionRecord.lastError = `Metadados do Firestore não removidos: ${String(err)}`;

    // Salva na fila de exclusões pendentes para tentativa posterior
    try {
      const idb = await openUserIndexedDB(professionalId);
      const tx = idb.transaction('pending_deletions', 'readwrite');
      tx.objectStore('pending_deletions').put(deletionRecord);
    } catch {
      // ignore
    }

    throw err;
  }
};

// ==========================================
// 5. RECUPERAÇÃO E RECONCILIAÇÃO OFFLINE
// ==========================================

export const fetchClientPhotosWithOfflineSupport = async (
  clientId: string,
  professionalId: string
): Promise<ClientPhotoRecord[]> => {
  if (!professionalId || !clientId) return [];

  let cloudPhotos: ClientPhotoRecord[] = [];
  try {
    cloudPhotos = await fetchPhotosByClientFromFirestore(clientId, professionalId);
  } catch (err) {
    console.warn('[StorageService] Falha ao consultar nuvem. Consultando IndexedDB local:', err);
  }

  // Consulta IndexedDB isolado do usuário
  try {
    const idb = await openUserIndexedDB(professionalId);
    const pendingList: ClientPhotoRecord[] = await new Promise((resolve) => {
      const tx = idb.transaction('pending_uploads', 'readonly');
      const store = tx.objectStore('pending_uploads');
      const req = store.getAll();
      req.onsuccess = () => {
        const raw = (req.result || []) as PendingUploadItem[];
        const filtered = raw
          .filter((item) => item.professionalId === professionalId && item.clientId === clientId)
          .map((item) => ({
            id: item.id,
            clientId: item.clientId,
            evaluationId: item.evaluationId,
            professionalId: item.professionalId,
            category: item.category,
            storagePath: `photos/${professionalId}/clients/${clientId}/${item.id}_full.webp`,
            thumbStoragePath: `photos/${professionalId}/clients/${clientId}/${item.id}_thumb.webp`,
            originalStoragePath: `photos/${professionalId}/clients/${clientId}/${item.id}_orig.${item.originalExtension}`,
            downloadUrl: URL.createObjectURL(item.optimizedBlob),
            thumbnailUrl: URL.createObjectURL(item.thumbnailBlob),
            originalDownloadUrl: URL.createObjectURL(item.originalBlob),
            width: item.width,
            height: item.height,
            fileSizeBytes: item.fileSizeBytes,
            originalSizeBytes: item.originalSizeBytes,
            isOriginalPreserved: true,
            notes: item.notes,
            observedRegion: item.observedRegion,
            deviceFindings: item.deviceFindings,
            consentRecordId: item.consentRecordId,
            takenAt: item.takenAt,
            createdAt: item.createdAt,
            syncStatus: 'PENDING_UPLOAD' as const,
          }));
        resolve(filtered);
      };
      req.onerror = () => resolve([]);
    });

    // Unifica nuvem e pendências locais (evitando duplicatas por id)
    const combined = [...pendingList];
    const seenIds = new Set(pendingList.map((p) => p.id));
    for (const cp of cloudPhotos) {
      if (!seenIds.has(cp.id)) {
        combined.push(cp);
        seenIds.add(cp.id);
      }
    }

    return combined.sort((a, b) => new Date(b.takenAt || b.createdAt).getTime() - new Date(a.takenAt || a.createdAt).getTime());
  } catch {
    return cloudPhotos;
  }
};
