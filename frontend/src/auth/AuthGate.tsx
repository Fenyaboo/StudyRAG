import { useEffect, type PropsWithChildren } from 'react';
import { AuthScreen } from './AuthScreen';
import { useAuth } from './AuthProvider';
import { hasVerifiedIdentity, rememberIntendedDestination } from './access';

export const AuthGate = ({ children }: PropsWithChildren) => {
  const { loading, user } = useAuth();

  const isAllowed = hasVerifiedIdentity(user);

  useEffect(() => {
    if (!loading && !isAllowed) rememberIntendedDestination();
  }, [isAllowed, loading]);

  if (loading) {
    return <div className="auth-loading" role="status">Đang khôi phục phiên đăng nhập…</div>;
  }

  if (!isAllowed) return <AuthScreen />;

  return <>{children}</>;
};
