import { useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';

interface AccountMenuProps {
  onSignedOut?: () => void;
}

const getInitial = (email?: string) => email?.trim().charAt(0).toUpperCase() || 'T';

export const AccountMenu = ({ onSignedOut }: AccountMenuProps) => {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const email = user?.email || 'Tài khoản StudyRAG';
  const avatarUrl = typeof user?.user_metadata?.avatar_url === 'string'
    ? user.user_metadata.avatar_url
    : '';

  const handleSignOut = async () => {
    setErrorMessage('');
    const result = await signOut();

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    onSignedOut?.();
    setIsOpen(false);
  };

  return (
    <div className="account-menu">
      <button
        className="account-menu__trigger"
        type="button"
        aria-expanded={isOpen}
        aria-controls="account-menu-actions"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="account-menu__avatar" aria-hidden="true">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : getInitial(user?.email)}
        </span>
        <span className="account-menu__email">{email}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {isOpen && (
        <div id="account-menu-actions" className="account-menu__panel">
          <div className="account-menu__identity">
            <span className="account-menu__avatar" aria-hidden="true">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : getInitial(user?.email)}
            </span>
            <span>{email}</span>
          </div>
          {errorMessage && <p className="account-menu__error" role="alert">{errorMessage}</p>}
          <button className="account-menu__sign-out" type="button" onClick={() => void handleSignOut()}>
            <LogOut size={16} aria-hidden="true" />
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
};
