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
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 sm:w-5 sm:h-5 2xl:w-6 2xl:h-6 3xl:w-7 3xl:h-7 4xl:w-8 4xl:h-8"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 sm:w-5 sm:h-5 2xl:w-6 2xl:h-6 3xl:w-7 3xl:h-7 4xl:w-8 4xl:h-8"
      aria-hidden="true"
    >
      <path d="M2 12s3.8-7 10-7c2.4 0 4.6 1.1 6.4 2.8M22 12s-3.8 7-10 7c-2.4 0-4.6-1.1-6.4-2.8" />
      <path d="M10 10a3 3 0 0 0 4 4" />
      <line x1="20" y1="4" x2="4" y2="20" />
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
    <div
      className="min-h-[100dvh] w-full flex items-center justify-center relative overflow-hidden select-none"
      style={{ backgroundColor: 'rgb(255, 255, 255)' }}
    >
      {/* Top-left curved corner accent matching login 22 reference */}
      <svg
        className="pointer-events-none absolute top-0 left-0 w-28 h-28 xs:w-32 xs:h-32 sm:w-64 sm:h-64 lg:w-80 lg:h-80 2xl:w-96 2xl:h-96"
        viewBox="0 0 360 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Outer thin teal arc swoosh */}
        <path
          d="M 278 0 C 232 94 128 202 0 264"
          stroke="rgb(20, 204, 179)"
          strokeWidth="2"
          fill="none"
        />
        {/* Vibrant teal mid ribbon */}
        <path d="M 0 0 L 218 0 C 176 74 96 154 0 206 Z" fill="rgb(20, 204, 179)" />
        {/* Deep plum corner wedge */}
        <path d="M 0 0 L 138 0 C 102 52 54 102 0 134 Z" fill="rgb(73, 18, 66)" />
      </svg>

      {/* Bottom-right curved corner accent matching login 22 reference */}
      <svg
        className="pointer-events-none absolute bottom-0 right-0 w-28 h-28 xs:w-32 xs:h-32 sm:w-72 sm:h-72 lg:w-96 lg:h-96 2xl:w-[440px] 2xl:h-[440px]"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Thin delicate teal arc */}
        <path
          d="M 88 400 C 138 296 266 196 400 136"
          stroke="rgb(20, 204, 179)"
          strokeWidth="2"
          fill="none"
        />
        {/* Vibrant teal lower-right wave */}
        <path d="M 400 400 L 146 400 C 206 324 304 246 400 206 Z" fill="rgb(20, 204, 179)" />
        {/* Deep plum corner wedge */}
        <path d="M 400 400 L 222 400 C 272 348 338 300 400 272 Z" fill="rgb(73, 18, 66)" />
      </svg>

      {/* Main Centered Two-Column Split Layout */}
      <div className="relative z-10 w-full max-w-6xl 2xl:max-w-7xl 3xl:max-w-[1600px] mx-auto px-5 sm:px-10 lg:px-14 pt-10 pb-16 sm:py-12 flex flex-col lg:flex-row items-center justify-center gap-8 sm:gap-10 lg:gap-12 2xl:gap-16">
        {/* LEFT COLUMN: Official MaxR Teamspace Logo + Collaboration Illustration */}
        <div className="flex-1 w-full flex flex-col items-center justify-center text-center gap-3 sm:gap-5">
          <img
            src="/maxr-teamspace-logo-4k.png"
            srcSet="/maxr-teamspace-logo.png 1x, /maxr-teamspace-logo-4k.png 2x"
            alt="MaxR Teamspace"
            className="w-[210px] xs:w-[240px] sm:w-[300px] lg:w-[340px] 2xl:w-[400px] 3xl:w-[460px] h-auto object-contain select-none"
            draggable={false}
          />
          <img
            src="/login-illustration.png"
            alt="MaxR Teamspace team collaboration illustration"
            className="w-full max-w-[340px] sm:max-w-[440px] lg:max-w-[500px] 2xl:max-w-[580px] 3xl:max-w-[660px] h-auto object-contain select-none"
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

        {/* RIGHT COLUMN: Clean Borderless Sign In Form directly on white canvas */}
        <div className="flex-1 w-full max-w-[420px] sm:max-w-[440px] 2xl:max-w-[500px] flex flex-col items-center">
          <h1
            className="font-display text-3xl xs:text-[34px] sm:text-[40px] 2xl:text-5xl font-extrabold tracking-tight text-center"
            style={{ color: 'rgb(15, 23, 21)' }}
          >
            Sign In
          </h1>

          {/* Teal Rounded Accent Underline */}
          <div
            aria-hidden="true"
            className="w-20 sm:w-24 h-1.5 rounded-full mt-2.5 mb-4"
            style={{ backgroundColor: 'rgb(20, 204, 179)' }}
          />

          <p
            className="text-sm sm:text-[15px] 2xl:text-lg font-medium mb-7 sm:mb-8 text-center"
            style={{ color: 'rgb(31, 41, 39)' }}
          >
            Access your MaxR Teamspace account
          </p>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="w-full mb-5 p-3.5 rounded-2xl text-sm font-medium text-center"
              style={{
                background: 'rgb(254, 242, 242)',
                border: '1px solid rgb(254, 202, 202)',
                color: 'rgb(185, 28, 28)',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
            {/* Email or Username Pill Field */}
            <div className="relative">
              <span
                className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none"
                style={{ color: 'rgb(19, 32, 30)' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                  aria-hidden="true"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <polyline points="2,4 12,13 22,4" />
                </svg>
              </span>
              <input
                id="login-email"
                type="text"
                placeholder="Email or Username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                aria-label="Email or Username"
                className="w-full text-sm sm:text-[15px] 2xl:text-base rounded-full outline-none transition-all pl-12 sm:pl-14 pr-5 h-12 sm:h-[54px] 2xl:h-[58px] placeholder:text-slate-500"
                style={{
                  border: '1.5px solid rgb(203, 213, 225)',
                  color: 'rgb(19, 32, 30)',
                  backgroundColor: 'rgb(255, 255, 255)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgb(20, 204, 179)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20, 204, 179, 0.16)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgb(203, 213, 225)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Password Pill Field */}
            <div className="relative">
              <span
                className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none"
                style={{ color: 'rgb(19, 32, 30)' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
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
                className="w-full text-sm sm:text-[15px] 2xl:text-base rounded-full outline-none transition-all pl-12 sm:pl-14 pr-14 h-12 sm:h-[54px] 2xl:h-[58px] placeholder:text-slate-500"
                style={{
                  border: '1.5px solid rgb(203, 213, 225)',
                  color: 'rgb(19, 32, 30)',
                  backgroundColor: 'rgb(255, 255, 255)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgb(20, 204, 179)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20, 204, 179, 0.16)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgb(203, 213, 225)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer min-w-[44px] min-h-[44px] rounded-full transition-colors"
                style={{ color: 'rgb(19, 32, 30)' }}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>

            {/* Remember me & Forgot password? */}
            <div className="flex items-center justify-between px-1 mt-0.5">
              <label
                className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm font-bold select-none min-h-[44px]"
                style={{ color: 'rgb(19, 32, 30)' }}
              >
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
                  className="flex items-center justify-center w-[18px] h-[18px] rounded-[4px] transition-all cursor-pointer shrink-0"
                  style={{
                    backgroundColor: rememberMe ? 'rgb(20, 204, 179)' : 'rgb(255, 255, 255)',
                    border: rememberMe
                      ? '2px solid rgb(20, 204, 179)'
                      : '2px solid rgb(30, 41, 59)',
                  }}
                >
                  {rememberMe && (
                    <svg
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-3 h-3"
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

              <button
                type="button"
                onClick={() => {
                  setError('Password reset instructions will be sent to your administrator.');
                }}
                className="font-bold text-xs sm:text-sm hover:underline cursor-pointer bg-transparent border-0 min-h-[44px] px-1"
                style={{ color: 'rgb(92, 29, 104)' }}
              >
                Forgot password?
              </button>
            </div>

            {/* Primary Pill Sign In Button (dark bold text + arrow on vibrant mint teal) */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 w-full flex items-center justify-center gap-2.5 font-extrabold text-base sm:text-lg 2xl:text-xl rounded-full cursor-pointer transition-all disabled:opacity-70 h-12 sm:h-[54px] 2xl:h-[58px]"
              style={{
                backgroundColor: 'rgb(24, 212, 186)',
                color: 'rgb(11, 20, 18)',
                boxShadow: '0 8px 20px rgba(20, 204, 179, 0.25)',
                fontFamily: 'Outfit, Inter, sans-serif',
              }}
              onMouseOver={(e) => {
                if (!isLoading) e.currentTarget.style.backgroundColor = 'rgb(16, 194, 170)';
              }}
              onMouseOut={(e) => {
                if (!isLoading) e.currentTarget.style.backgroundColor = 'rgb(24, 212, 186)';
              }}
            >
              {isLoading ? (
                <span
                  className="w-5 h-5 border-2 rounded-full animate-spin"
                  style={{
                    borderColor: 'rgba(11, 20, 18, 0.25)',
                    borderTopColor: 'rgb(11, 20, 18)',
                  }}
                />
              ) : (
                <>
                  <span>Sign In</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5"
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
