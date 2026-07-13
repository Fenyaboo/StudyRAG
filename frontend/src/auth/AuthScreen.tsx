import { FormEvent, useState } from 'react';
import { useAuth } from './AuthProvider';

type ScreenMode = 'signIn' | 'signUp' | 'reset';

const emailIsValid = (email: string) => /^\S+@\S+\.\S+$/.test(email);

const content: Record<ScreenMode, { heading: string; summary: string; submit: string }> = {
  signIn: {
    heading: 'Chào mừng trở lại',
    summary: 'Đăng nhập để tiếp tục không gian học tập riêng của bạn.',
    submit: 'Đăng nhập',
  },
  signUp: {
    heading: 'Tạo không gian học tập riêng',
    summary: 'Lưu tài liệu và cuộc học của bạn một cách riêng tư.',
    submit: 'Tạo tài khoản',
  },
  reset: {
    heading: 'Đặt lại mật khẩu',
    summary: 'Chúng tôi sẽ gửi liên kết đặt lại mật khẩu đến email của bạn.',
    submit: 'Gửi liên kết đặt lại',
  },
};

export const AuthScreen = () => {
  const { signIn, signUp, signInWithGoogle, resetPassword, resendConfirmation } = useAuth();
  const [mode, setMode] = useState<ScreenMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);

  const changeMode = (nextMode: ScreenMode) => {
    setMode(nextMode);
    setError('');
    setNotice('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!emailIsValid(email)) {
      setError('Hãy nhập một địa chỉ email hợp lệ.');
      return;
    }
    if (mode !== 'reset' && password.length < 6) {
      setError('Mật khẩu cần có ít nhất 6 ký tự.');
      return;
    }

    setPending(true);
    const result = mode === 'signIn'
      ? await signIn(email, password)
      : mode === 'signUp'
        ? await signUp(email, password)
        : await resetPassword(email);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setNotice('Tài khoản đã được tạo. Hãy kiểm tra email để xác nhận trước khi đăng nhập.');
      return;
    }
    if (mode === 'reset') setNotice('Đã gửi liên kết đặt lại mật khẩu. Hãy kiểm tra hộp thư của bạn.');
  };

  const resend = async () => {
    setError('');
    setPending(true);
    const result = await resendConfirmation(email);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNotice('Đã gửi lại email xác nhận.');
  };

  const signInGoogle = async () => {
    setError('');
    setPending(true);
    const result = await signInWithGoogle();
    setPending(false);
    if (result.error) setError(result.error);
  };

  const current = content[mode];
  const confirmationPending = mode === 'signUp' && notice.includes('xác nhận');

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <a className="auth-brand" href="/" aria-label="StudyRAG trang chủ">StudyRAG</a>
        <p className="auth-kicker">KHÔNG GIAN HỌC TẬP RIÊNG</p>
        <h1 id="auth-title">{current.heading}</h1>
        <p className="auth-summary">{current.summary}</p>

        <form className="auth-form" onSubmit={submit} noValidate>
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
            required
          />

          {mode !== 'reset' && (
            <>
              <label htmlFor="auth-password">Mật khẩu</label>
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={pending}
                minLength={6}
                required
              />
            </>
          )}

          {error && <p className="auth-alert auth-alert--error" role="alert">{error}</p>}
          {notice && <p className="auth-alert auth-alert--success" role="status">{notice}</p>}

          <button className="auth-submit" type="submit" disabled={pending}>
            {pending ? 'Đang xử lý…' : current.submit}
          </button>
        </form>

        {confirmationPending && (
          <button className="auth-text-button" type="button" onClick={resend} disabled={pending}>
            Gửi lại email xác nhận
          </button>
        )}

        {mode !== 'reset' && (
          <>
            <div className="auth-divider"><span>hoặc</span></div>
            <button className="auth-google" type="button" onClick={signInGoogle} disabled={pending}>
              Tiếp tục với Google
            </button>
          </>
        )}

        <div className="auth-links">
          {mode === 'signIn' && (
            <>
              <button type="button" onClick={() => changeMode('reset')}>Quên mật khẩu?</button>
              <button type="button" onClick={() => changeMode('signUp')}>Tạo tài khoản</button>
            </>
          )}
          {mode === 'signUp' && <button type="button" onClick={() => changeMode('signIn')}>Đã có tài khoản? Đăng nhập</button>}
          {mode === 'reset' && <button type="button" onClick={() => changeMode('signIn')}>Quay lại đăng nhập</button>}
        </div>
      </section>
    </main>
  );
};
