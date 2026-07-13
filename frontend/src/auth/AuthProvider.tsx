import { type PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseSetupMessage } from '../services/supabase';

type AuthResult = {
  error: string | null;
  needsEmailConfirmation?: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  resendConfirmation: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
};

const unavailable = async (): Promise<AuthResult> => ({ error: supabaseSetupMessage });

const signedOutContext: AuthContextValue = {
  session: null,
  user: null,
  loading: false,
  signIn: unavailable,
  signUp: unavailable,
  signInWithGoogle: unavailable,
  resetPassword: unavailable,
  resendConfirmation: unavailable,
  signOut: unavailable,
};

const AuthContext = createContext<AuthContextValue>(signedOutContext);

const translateAuthError = (message: string) => {
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) return 'Email hoặc mật khẩu chưa đúng.';
  if (normalized.includes('email not confirmed')) return 'Email này chưa được xác nhận. Hãy kiểm tra hộp thư.';
  if (normalized.includes('user already registered')) return 'Email này đã được đăng ký. Hãy đăng nhập hoặc đặt lại mật khẩu.';
  if (normalized.includes('password should be at least')) return 'Mật khẩu cần có ít nhất 6 ký tự.';
  if (normalized.includes('rate limit')) return 'Bạn đã thử quá nhiều lần. Vui lòng đợi một lát rồi thử lại.';
  if (normalized.includes('network') || normalized.includes('fetch')) return 'Không thể kết nối đến dịch vụ đăng nhập. Vui lòng thử lại.';

  return 'Không thể hoàn tất yêu cầu đăng nhập. Vui lòng thử lại.';
};

const redirectTo = () => window.location.origin;

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setSession(error ? null : data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const run = async (operation: () => Promise<{ error: { message: string } | null }>): Promise<AuthResult> => {
      if (!supabase) return unavailable();
      const { error } = await operation();
      return { error: error ? translateAuthError(error.message) : null };
    };

    return {
      session,
      user: session?.user ?? null,
      loading,
      signIn: (email, password) => run(() => supabase!.auth.signInWithPassword({ email: email.trim(), password })),
      signUp: async (email, password) => {
        if (!supabase) return unavailable();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectTo() },
        });
        return {
          error: error ? translateAuthError(error.message) : null,
          needsEmailConfirmation: !error && !data.session,
        };
      },
      signInWithGoogle: () => run(() => supabase!.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectTo() },
      })),
      resetPassword: (email) => run(() => supabase!.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectTo(),
      })),
      resendConfirmation: (email) => run(() => supabase!.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: redirectTo() },
      })),
      signOut: () => run(() => supabase!.auth.signOut()),
    };
  }, [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
