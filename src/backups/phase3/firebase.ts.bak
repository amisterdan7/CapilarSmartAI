import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export interface FirebaseConfigStatus {
  isConfigured: boolean;
  projectId: string | null;
  missingKeys: string[];
}

const getEnvVar = (key: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta?.env?.[key]) {
      return import.meta.env[key];
    }
  } catch {
    // ignore
  }
  try {
    if (typeof process !== 'undefined' && process?.env?.[key]) {
      return process.env[key] as string;
    }
  } catch {
    // ignore
  }
  return '';
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID'),
  measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID'),
};


export const getFirebaseConfigStatus = (): FirebaseConfigStatus => {
  const missingKeys: string[] = [];
  if (!firebaseConfig.apiKey) missingKeys.push('VITE_FIREBASE_API_KEY');
  if (!firebaseConfig.authDomain) missingKeys.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (!firebaseConfig.projectId) missingKeys.push('VITE_FIREBASE_PROJECT_ID');
  if (!firebaseConfig.appId) missingKeys.push('VITE_FIREBASE_APP_ID');

  const isConfigured = missingKeys.length === 0;

  return {
    isConfigured,
    projectId: firebaseConfig.projectId || null,
    missingKeys,
  };
};

export const isFirebaseConfigured = (): boolean => {
  return getFirebaseConfigStatus().isConfigured;
};

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

const status = getFirebaseConfigStatus();

if (status.isConfigured) {
  try {
    appInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance);
    storageInstance = getStorage(appInstance);
  } catch (error) {
    console.error('[Firebase] Erro ao inicializar SDK:', error);
  }
} else {
  // Informa com clareza a indisponibilidade sem simular autenticação nem criar dados fictícios
  console.warn(
    `[Firebase] Ambiente de nuvem não configurado. Chaves ausentes: ${status.missingKeys.join(', ')}. ` +
    'O aplicativo operará estritamente no modo local e não apresentará dados locais como dados de nuvem.'
  );
}

export const app = appInstance;
export const auth = authInstance;
export const db = dbInstance;
export const storage = storageInstance;

export const requireAuth = (): Auth => {
  if (!authInstance) {
    throw new Error(
      'Firebase Authentication indisponível: variáveis de ambiente não configuradas no frontend.'
    );
  }
  return authInstance;
};

export const requireDb = (): Firestore => {
  if (!dbInstance) {
    throw new Error(
      'Cloud Firestore indisponível: variáveis de ambiente não configuradas no frontend.'
    );
  }
  return dbInstance;
};

export const requireStorage = (): FirebaseStorage => {
  if (!storageInstance) {
    throw new Error(
      'Firebase Storage indisponível: variáveis de ambiente não configuradas no frontend.'
    );
  }
  return storageInstance;
};

export enum FirestoreErrorCode {
  PERMISSION_DENIED = 'permission-denied',
  NOT_FOUND = 'not-found',
  ALREADY_EXISTS = 'already-exists',
  UNAUTHENTICATED = 'unauthenticated',
  RESOURCE_EXHAUSTED = 'resource-exhausted',
}

export interface SecurityErrorContext {
  operation: 'create' | 'read' | 'update' | 'delete' | 'list';
  collection: string;
  documentId?: string;
}

export const handleFirestoreError = (
  error: unknown,
  context: SecurityErrorContext
): Error => {
  const err = error as { code?: string; message?: string };
  const baseMsg = `[Firestore ${context.operation.toUpperCase()} /${context.collection}${context.documentId ? '/' + context.documentId : ''}]`;

  if (err?.code === FirestoreErrorCode.PERMISSION_DENIED) {
    return new Error(`${baseMsg} Acesso negado: você não tem permissão para esta operação ou o registro pertence a outra profissional.`);
  }
  if (err?.code === FirestoreErrorCode.UNAUTHENTICATED) {
    return new Error(`${baseMsg} Sessão não autenticada: faça login para acessar os recursos da nuvem.`);
  }
  return new Error(`${baseMsg} ${err?.message || 'Erro inesperado no banco de dados.'}`);
};
