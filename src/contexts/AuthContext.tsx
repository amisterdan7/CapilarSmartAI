/**
 * Contexto de Autenticação do Capilar Smart IA
 * Gerencia a sessão da profissional, perfil no Firestore, verificação de e-mail e status de rede
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../services/firebase';
import {
  signInProfessional,
  signUpProfessional,
  signOutProfessional,
  requestPasswordReset,
  completeProfessionalProfile,
  fetchProfessionalProfile,
  resendVerificationEmail,
  checkEmailVerification,
  translateAuthError,
  SignInParams,
  SignUpParams,
} from '../services/authService';
import { ProfessionalProfile } from '../types';

export interface AuthContextType {
  currentUser: User | null;
  profile: ProfessionalProfile | null;
  loading: boolean;
  isEmailVerified: boolean;
  isOnline: boolean;
  isFirebaseAvailable: boolean;
  needsProfileCompletion: boolean;
  authError: string | null;
  sessionEpoch: number;
  signIn: (params: SignInParams) => Promise<void>;
  signUp: (params: SignUpParams) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  completeProfile: (params: { name: string; clinicName?: string; phone?: string }) => Promise<void>;
  refreshVerification: () => Promise<boolean>;
  resendVerification: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState<number>(0);

  const isFirebaseAvailable = isFirebaseConfigured();

  // Monitoramento de conectividade de rede (Online / Offline)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitoramento do ciclo de vida da autenticação Firebase
  useEffect(() => {
    if (!isFirebaseAvailable || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsEmailVerified(user.emailVerified);
        try {
          const loadedProfile = await fetchProfessionalProfile(user.uid);
          if (loadedProfile) {
            setProfile(loadedProfile);
            setNeedsProfileCompletion(false);
          } else {
            // Conta de autenticação existe mas perfil no Firestore não foi encontrado (Self-Healing)
            setProfile(null);
            setNeedsProfileCompletion(true);
          }
        } catch (err) {
          console.warn('[AuthContext] Falha ao recuperar perfil inicial:', err);
          // Em caso de falha de conexão ou erro transitório, mantemos o estado seguro
        }
      } else {
        setProfile(null);
        setIsEmailVerified(false);
        setNeedsProfileCompletion(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isFirebaseAvailable]);

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  const signIn = useCallback(async (params: SignInParams) => {
    setAuthError(null);
    try {
      const user = await signInProfessional(params);
      setCurrentUser(user);
      setIsEmailVerified(user.emailVerified);

      const loadedProfile = await fetchProfessionalProfile(user.uid);
      if (loadedProfile) {
        setProfile(loadedProfile);
        setNeedsProfileCompletion(false);
      } else {
        setProfile(null);
        setNeedsProfileCompletion(true);
      }
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      const friendlyMsg = firebaseError?.code
        ? translateAuthError(firebaseError.code)
        : (firebaseError?.message || 'Falha ao autenticar.');
      setAuthError(friendlyMsg);
      throw err;
    }
  }, []);

  const signUp = useCallback(async (params: SignUpParams) => {
    setAuthError(null);
    try {
      const { user, profile: newProfile } = await signUpProfessional(params);
      setCurrentUser(user);
      setProfile(newProfile);
      setIsEmailVerified(user.emailVerified);
      setNeedsProfileCompletion(false);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      const friendlyMsg = firebaseError?.code
        ? translateAuthError(firebaseError.code)
        : (firebaseError?.message || 'Falha ao criar conta profissional.');
      setAuthError(friendlyMsg);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    try {
      await signOutProfessional();
      setCurrentUser(null);
      setProfile(null);
      setIsEmailVerified(false);
      setNeedsProfileCompletion(false);
      setSessionEpoch((prev) => prev + 1);
    } catch (err) {
      console.error('[AuthContext] Erro ao encerrar sessão:', err);
      throw err;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setAuthError(null);
    try {
      await requestPasswordReset(email);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      const friendlyMsg = firebaseError?.code
        ? translateAuthError(firebaseError.code)
        : 'Não foi possível enviar o e-mail de recuperação.';
      setAuthError(friendlyMsg);
      throw err;
    }
  }, []);

  const completeProfile = useCallback(
    async (params: { name: string; clinicName?: string; phone?: string }) => {
      if (!currentUser) throw new Error('Nenhuma usuária autenticada para completar perfil.');
      setAuthError(null);
      try {
        const completed = await completeProfessionalProfile(currentUser, params);
        setProfile(completed);
        setNeedsProfileCompletion(false);
      } catch (err: unknown) {
        const firebaseError = err as { message?: string };
        setAuthError(firebaseError?.message || 'Falha ao salvar dados do perfil.');
        throw err;
      }
    },
    [currentUser]
  );

  const refreshVerification = useCallback(async (): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const verified = await checkEmailVerification(currentUser);
      setIsEmailVerified(verified);
      return verified;
    } catch (err) {
      console.warn('[AuthContext] Erro ao verificar status de e-mail:', err);
      return false;
    }
  }, [currentUser]);

  const resendVerification = useCallback(async () => {
    if (!currentUser) return;
    try {
      await resendVerificationEmail(currentUser);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      const friendlyMsg = firebaseError?.code
        ? translateAuthError(firebaseError.code)
        : 'Não foi possível reenviar o e-mail.';
      setAuthError(friendlyMsg);
      throw err;
    }
  }, [currentUser]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profile,
        loading,
        isEmailVerified,
        isOnline,
        isFirebaseAvailable,
        needsProfileCompletion,
        authError,
        sessionEpoch,
        signIn,
        signUp,
        signOut,
        resetPassword,
        completeProfile,
        refreshVerification,
        resendVerification,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
