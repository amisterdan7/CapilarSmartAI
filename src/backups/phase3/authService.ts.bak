/**
 * Serviço modular de Autenticação e Perfis Profissionais
 * Capilar Smart IA - Fase 1
 * 
 * Regras estritas:
 * - Validação exata dos campos permitidos em /professionals/{uid} (firestore.rules)
 * - Isolamento de sessão sem simulação de autenticação
 * - Auto-recuperação de perfis incompletos (Self-Healing)
 * - Avaliação de 4 critérios de senha em tempo real
 * - Sugestão não intrusiva de correção de domínio de e-mail
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  auth,
  db,
  requireAuth,
  requireDb,
  isFirebaseConfigured,
  handleFirestoreError,
} from './firebase';
import {
  ProfessionalProfile,
  PasswordCriteria,
  EmailTypoSuggestion,
} from '../types';

/**
 * Avalia os 4 critérios de segurança da senha
 */
export const evaluatePasswordCriteria = (password: string): PasswordCriteria => {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);

  return {
    minLength,
    hasUppercase,
    hasNumber,
    hasSpecialChar,
    isValid: minLength && hasUppercase && hasNumber && hasSpecialChar,
  };
};

/**
 * Mapeamento de erros comuns de digitação de domínios de e-mail no Brasil
 */
const DOMAIN_TYPO_MAP: Record<string, string> = {
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmai.co': 'gmail.com',
  'gemail.com': 'gmail.com',
  'gmaio.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmali.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'hormail.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'outlokk.com': 'outlook.com',
  'putlook.com': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yhaoo.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com.br': 'yahoo.com.br',
  'iclud.com': 'icloud.com',
  'icoud.com': 'icloud.com',
  'icloud.co': 'icloud.com',
};

/**
 * Detecta se o domínio informado possui sugestão de correção conhecida, sem alterar o valor original
 */
export const detectEmailTypo = (email: string): EmailTypoSuggestion => {
  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf('@');

  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return {
      originalDomain: '',
      suggestedDomain: '',
      suggestedEmail: '',
      hasSuggestion: false,
    };
  }

  const prefix = trimmed.substring(0, atIndex);
  const domain = trimmed.substring(atIndex + 1).toLowerCase();

  const suggestedDomain = DOMAIN_TYPO_MAP[domain];
  if (suggestedDomain && suggestedDomain !== domain) {
    return {
      originalDomain: domain,
      suggestedDomain,
      suggestedEmail: `${prefix}@${suggestedDomain}`,
      hasSuggestion: true,
    };
  }

  return {
    originalDomain: domain,
    suggestedDomain: '',
    suggestedEmail: '',
    hasSuggestion: false,
  };
};

export interface SignUpParams {
  email: string;
  password: string;
  name: string;
  clinicName?: string;
  phone?: string;
}

export interface SignInParams {
  email: string;
  password: string;
  rememberMe: boolean;
}

/**
 * Cadastro de nova profissional
 * Executa o fluxo:
 * 1. createUserWithEmailAndPassword
 * 2. Envio de e-mail de verificação (best-effort sem quebrar se falhar temporariamente)
 * 3. Criação do perfil em /professionals/{uid} respeitando fielmente as regras CEL do firestore.rules
 */
export const signUpProfessional = async ({
  email,
  password,
  name,
  clinicName,
  phone,
}: SignUpParams): Promise<{ user: User; profile: ProfessionalProfile }> => {
  const authInstance = requireAuth();
  const dbInstance = requireDb();

  // 1. Criar credenciais no Firebase Authentication
  const userCredential = await createUserWithEmailAndPassword(authInstance, email.trim(), password);
  const user = userCredential.user;

  // 2. Disparo do e-mail de verificação
  try {
    await sendEmailVerification(user);
  } catch (emailErr) {
    console.warn('[Auth] Não foi possível enviar e-mail de verificação imediatamente:', emailErr);
  }

  // 3. Montar perfil respeitando as regras estritas de firestore.rules:
  // Campos obrigatórios: ['uid', 'email', 'name', 'createdAt']
  // Campos permitidos: ['uid', 'email', 'name', 'clinicName', 'phone', 'role', 'createdAt', 'updatedAt']
  // role deve ser 'professional'
  const trimmedName = name.trim();
  const profileData: ProfessionalProfile = {
    uid: user.uid,
    email: user.email || email.trim(),
    name: trimmedName,
    role: 'professional',
    createdAt: new Date().toISOString(),
  };

  if (clinicName && clinicName.trim()) {
    profileData.clinicName = clinicName.trim();
  }
  if (phone && phone.trim()) {
    profileData.phone = phone.trim();
  }

  try {
    const profRef = doc(dbInstance, 'professionals', user.uid);
    await setDoc(profRef, profileData);
  } catch (dbErr) {
    console.error('[Auth] Erro ao gravar perfil pós-criação. O mecanismo de auto-recuperação permitirá completar na próxima sessão:', dbErr);
    throw handleFirestoreError(dbErr, {
      operation: 'create',
      collection: 'professionals',
      documentId: user.uid,
    });
  }

  return { user, profile: profileData };
};

/**
 * Autenticação de profissional existente com controle de persistência
 */
export const signInProfessional = async ({
  email,
  password,
  rememberMe,
}: SignInParams): Promise<User> => {
  const authInstance = requireAuth();

  // Configura persistência de acordo com a opção da profissional
  try {
    await setPersistence(
      authInstance,
      rememberMe ? browserLocalPersistence : browserSessionPersistence
    );
  } catch (persistErr) {
    console.warn('[Auth] Não foi possível configurar persistência explícita:', persistErr);
  }

  const userCredential = await signInWithEmailAndPassword(
    authInstance,
    email.trim(),
    password
  );

  return userCredential.user;
};

/**
 * Busca o documento do perfil da profissional em /professionals/{uid}
 */
export const fetchProfessionalProfile = async (
  uid: string
): Promise<ProfessionalProfile | null> => {
  const dbInstance = requireDb();
  try {
    const profRef = doc(dbInstance, 'professionals', uid);
    const snap = await getDoc(profRef);
    if (snap.exists()) {
      return snap.data() as ProfessionalProfile;
    }
    return null;
  } catch (err) {
    throw handleFirestoreError(err, {
      operation: 'read',
      collection: 'professionals',
      documentId: uid,
    });
  }
};

/**
 * Auto-recuperação (Self-Healing) para contas órfãs / incompletas
 * Se a conta foi criada no Auth mas o documento /professionals/{uid} falhou por queda de rede
 */
export const completeProfessionalProfile = async (
  user: User,
  params: { name: string; clinicName?: string; phone?: string }
): Promise<ProfessionalProfile> => {
  const dbInstance = requireDb();

  const profileData: ProfessionalProfile = {
    uid: user.uid,
    email: user.email || '',
    name: params.name.trim(),
    role: 'professional',
    createdAt: new Date().toISOString(),
  };

  if (params.clinicName && params.clinicName.trim()) {
    profileData.clinicName = params.clinicName.trim();
  }
  if (params.phone && params.phone.trim()) {
    profileData.phone = params.phone.trim();
  }

  try {
    const profRef = doc(dbInstance, 'professionals', user.uid);
    await setDoc(profRef, profileData);
    return profileData;
  } catch (err) {
    throw handleFirestoreError(err, {
      operation: 'create',
      collection: 'professionals',
      documentId: user.uid,
    });
  }
};

/**
 * Atualiza campos opcionais do perfil profissional
 */
export const updateProfessionalProfile = async (
  uid: string,
  params: { name?: string; clinicName?: string; phone?: string }
): Promise<void> => {
  const dbInstance = requireDb();
  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (params.name !== undefined) updates.name = params.name.trim();
  if (params.clinicName !== undefined) updates.clinicName = params.clinicName.trim();
  if (params.phone !== undefined) updates.phone = params.phone.trim();

  try {
    const profRef = doc(dbInstance, 'professionals', uid);
    await updateDoc(profRef, updates);
  } catch (err) {
    throw handleFirestoreError(err, {
      operation: 'update',
      collection: 'professionals',
      documentId: uid,
    });
  }
};

/**
 * Envia e-mail de recuperação de senha
 */
export const requestPasswordReset = async (email: string): Promise<void> => {
  const authInstance = requireAuth();
  await sendPasswordResetEmail(authInstance, email.trim());
};

/**
 * Reenvia e-mail de verificação para o usuário atual
 */
export const resendVerificationEmail = async (user: User): Promise<void> => {
  await sendEmailVerification(user);
};

/**
 * Recarrega os dados do usuário para verificar se o e-mail foi validado
 */
export const checkEmailVerification = async (user: User): Promise<boolean> => {
  await user.reload();
  return user.emailVerified;
};

/**
 * Encerra a sessão da profissional no Firebase
 */
export const signOutProfessional = async (): Promise<void> => {
  if (auth) {
    await firebaseSignOut(auth);
  }
};

/**
 * Traduz erros do Firebase Auth para mensagens amigáveis em português
 */
export const translateAuthError = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/invalid-email':
      return 'O formato do e-mail inserido é inválido.';
    case 'auth/user-disabled':
      return 'Esta conta de profissional foi desativada.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos. Verifique suas credenciais.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado. Tente entrar ou recupere sua senha.';
    case 'auth/weak-password':
      return 'A senha deve atender a todos os 4 requisitos de segurança.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas sem sucesso. Aguarde alguns instantes antes de tentar novamente.';
    case 'auth/network-request-failed':
      return 'Falha na conexão de rede. Verifique sua conexão com a internet.';
    case 'auth/requires-recent-login':
      return 'Esta operação requer autenticação recente. Faça login novamente.';
    default:
      return 'Ocorreu um erro no serviço de autenticação. Tente novamente.';
  }
};
