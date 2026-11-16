import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';

export interface LoginPageProps {
  onSuccess?: () => void;
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email or username.');
      return;
    }

    const success = await login(email.trim(), password);
    if (success) {
      if (onSuccess) onSuccess();
    } else {
      setError('Invalid credentials. Check your email or username and password.');
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center relative overflow-hidden select-none bg-bg px-4 py-8 sm:px-8">
      {/* Subtle Admin Dashboard Mint/Teal Ambient Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-32 w-[460px] h-[460px] rounded-full bg-primary-deep/10 blur-3xl"
      />

      {/* Main Centered Two-Column Layout directly on Admin Dashboard background */}
      <div className="relative z-10 w-full max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-6 sm:py-10 flex flex-col lg:flex-row items-center justify-center gap-8 sm:gap-10 lg:gap-12">
        {/* LEFT COLUMN: Crisp Official MaxR Logo + Collaboration Illustration */}
        <div className="flex-1 w-full flex flex-col items-center justify-center text-center gap-4 sm:gap-5">
          <img
            src="/maxr.png"
            alt="MaxR Teamspace"
            className="w-[130px] sm:w-[155px] lg:w-[175px] h-auto object-contain select-none"
            draggable={false}
          />
          <img
            src="/login-illustration.png"
            alt="MaxR Teamspace team collaboration illustration"
            className="w-full max-w-[300px] sm:max-w-[380px] lg:max-w-[420px] h-auto object-contain select-none mix-blend-multiply"
            draggable={false}
          />
        </div>

        {/* CENTER VERTICAL TEAL DIVIDER WITH ROUNDED PILL BAR */}
        <div
          aria-hidden="true"
          className="hidden lg:flex flex-col items-center justify-center self-stretch py-4 relative"
        >
          <div
            className="w-[1.5px] flex-1"
            style={{ backgroundColor: 'rgba(20, 204, 179, 0.55)' }}
          />
          <div
            className="w-[5px] h-24 2xl:h-28 rounded-full -my-2 z-10"
            style={{ backgroundColor: 'rgb(20, 204, 179)' }}
          />
          <div
            className="w-[1.5px] flex-1"
            style={{ backgroundColor: 'rgba(20, 204, 179, 0.55)' }}
          />
        </div>

        {/* RIGHT COLUMN: Clean Industrial Standard Sign In Form */}
        <div className="flex-1 w-full max-w-[380px] sm:max-w-[400px] flex flex-col items-center">
          <h1 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight text-text text-center">
            Sign In
          </h1>

          {/* Teal Rounded Accent Underline */}
          <div aria-hidden="true" className="w-12 h-1 rounded-full mt-2 mb-3 bg-primary" />

          <p className="text-sm font-medium text-text-muted mb-6 text-center">
            Access your MaxR Teamspace account
          </p>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="w-full mb-4 px-3.5 py-2.5 rounded-control text-xs sm:text-sm font-medium text-center border border-danger/30 bg-danger/10 text-danger"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3.5">
            {/* Email or Username Field */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-text-muted">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                  aria-hidden="true"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </span>
              <input
                id="login-email"
                type="text"
                placeholder="Email or username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                aria-label="Email or Username"
                className="w-full h-11 rounded-control border border-border-strong bg-surface-raised pl-10 pr-4 text-sm text-text placeholder:text-sm placeholder:text-text-subtle outline-none transition-all focus:border-primary-strong focus:ring-2 focus:ring-primary-soft"
              />
            </div>

            {/* Password Field */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-text-muted">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-label="Password"
                className="w-full h-11 rounded-control border border-border-strong bg-surface-raised pl-10 pr-11 text-sm text-text placeholder:text-sm placeholder:text-text-subtle outline-none transition-all focus:border-primary-strong focus:ring-2 focus:ring-primary-soft"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer w-9 h-9 rounded-lg text-text-muted hover:text-text transition-colors"
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>

            {/* Remember me */}
            <div className="flex items-center px-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm font-medium text-text-muted select-none min-h-[36px]">
                <span
                  role="checkbox"
                  aria-checked={rememberMe}
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    setRememberMe((v) => !v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setRememberMe((v) => !v);
                    }
                  }}
                  className={`flex items-center justify-center w-4 h-4 rounded transition-all cursor-pointer shrink-0 border ${
                    rememberMe
                      ? 'bg-primary-deep border-primary-deep'
                      : 'bg-surface-raised border-border-strong'
                  }`}
                >
                  {rememberMe && (
                    <svg
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-2.5 h-2.5"
                      aria-hidden="true"
                    >
                      <polyline
                        points="2,6 4.5,9 10,3"
                        stroke="rgb(255, 255, 255)"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                Remember me
              </label>
            </div>

            {/* Primary Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 w-full h-11 flex items-center justify-center gap-2 font-semibold text-sm rounded-control bg-primary-deep hover:bg-primary-ink text-white shadow-primary cursor-pointer transition-all disabled:opacity-70"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                    aria-hidden="true"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
