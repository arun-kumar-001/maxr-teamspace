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
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Please enter your email.');
      return;
    }

    const success = await login(email, password);
    if (success) {
      if (onSuccess) onSuccess();
    } else {
      setError('Invalid credentials. Check your work email and password.');
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden select-none"
      style={{
        background:
          'linear-gradient(135deg, rgb(238, 252, 250) 0%, rgb(244, 253, 252) 35%, rgb(255, 255, 255) 70%, rgb(250, 253, 253) 100%)',
      }}
    >
      {/* ── VECTOR BACKGROUND WAVES (Infinitely sharp on 1080p, 1440p, 4K UHD, 8K) ── */}
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="topTeal1"
            x1="0"
            y1="0"
            x2="400"
            y2="350"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="rgb(84, 222, 206)" stopOpacity="0.95" />
            <stop offset="60%" stopColor="rgb(0, 201, 167)" stopOpacity="0.75" />
            <stop offset="100%" stopColor="rgb(168, 245, 236)" stopOpacity="0.1" />
          </linearGradient>

          <linearGradient
            id="topTeal2"
            x1="0"
            y1="0"
            x2="280"
            y2="420"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="rgb(155, 243, 234)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="rgb(84, 222, 206)" stopOpacity="0.25" />
          </linearGradient>

          <linearGradient
            id="bottomTeal"
            x1="0"
            y1="500"
            x2="450"
            y2="900"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="rgb(85, 205, 179)" stopOpacity="0.95" />
            <stop offset="50%" stopColor="rgb(13, 148, 136)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="rgb(168, 245, 236)" stopOpacity="0.15" />
          </linearGradient>

          <linearGradient
            id="bottomDeep"
            x1="0"
            y1="700"
            x2="350"
            y2="900"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="rgb(8, 11, 12)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="rgb(15, 40, 38)" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* Top-left swoosh layers */}
        <path d="M0 0 L320 0 C280 120 180 180 80 260 C20 310 0 360 0 400 Z" fill="url(#topTeal2)" />
        <path d="M0 0 L240 0 C200 90 120 160 50 240 C10 290 0 340 0 380 Z" fill="url(#topTeal1)" />
        <path
          d="M0 0 C60 60 140 100 220 110 C290 120 360 90 440 40 L440 0 Z"
          fill="rgba(195, 248, 243, 0.45)"
        />

        {/* Bottom-left layered waves */}
        <path
          d="M0 480 Q140 560 220 660 T360 840 Q400 875 460 900 L0 900 Z"
          fill="rgba(165, 243, 235, 0.35)"
        />

        <path
          d="M0 600 C100 640 180 720 250 800 C290 850 330 880 380 900 L0 900 Z"
          fill="url(#bottomTeal)"
        />

        <path
          d="M0 720 C60 740 120 780 170 830 C205 865 235 885 270 900 L0 900 Z"
          fill="url(#bottomDeep)"
        />
      </svg>

      {/* ── TWO-COLUMN MAIN CONTENT (Scales from mobile to 4K Ultrawide) ── */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between w-full max-w-6xl 2xl:max-w-7xl 3xl:max-w-[1700px] 4xl:max-w-[2200px] mx-auto px-6 sm:px-8 lg:px-12 2xl:px-16 3xl:px-24 4xl:px-32 py-8 sm:py-12 2xl:py-16 3xl:py-24 4xl:py-32 gap-10 sm:gap-14 lg:gap-16 2xl:gap-24 3xl:gap-32 4xl:gap-40">
        {/* LEFT COLUMN: MaxR Teamspace Brand Logo in Ultra-High-DPI 4K */}
        <div className="flex flex-col items-center lg:items-start lg:flex-1 text-center lg:text-left">
          <img
            src="/maxr-teamspace-logo-4k.png"
            srcSet="/maxr-teamspace-logo.png 1x, /maxr-teamspace-logo-4k.png 2x"
            alt="MaxR Teamspace"
            className="w-[280px] xs:w-[320px] sm:w-[380px] lg:w-[440px] 2xl:w-[560px] 3xl:w-[680px] 4xl:w-[840px] h-auto object-contain select-none drop-shadow-sm transition-all"
            draggable={false}
          />
        </div>

        {/* RIGHT COLUMN: The Login Card matching the reference design */}
        <div
          className="w-full max-w-[460px] sm:max-w-[480px] 2xl:max-w-[560px] 3xl:max-w-[640px] 4xl:max-w-[760px] lg:flex-none relative bg-white transition-all rounded-[32px] sm:rounded-[36px] 2xl:rounded-[44px] 3xl:rounded-[52px] 4xl:rounded-[60px] p-8 sm:p-12 2xl:p-14 3xl:p-16 4xl:p-20"
          style={{
            boxShadow: '0 20px 60px rgba(8, 11, 12, 0.06), 0 2px 10px rgba(85, 205, 179, 0.04)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
          }}
        >
          {/* Top-left dot matrix grid (5 cols x 3 rows = 15 dots) */}
          <div
            aria-hidden="true"
            className="absolute top-6 left-6 sm:top-8 sm:left-8 2xl:top-10 2xl:left-10 3xl:top-12 3xl:left-12 4xl:top-14 4xl:left-14 grid grid-cols-5 gap-2 sm:gap-2.5 2xl:gap-3 3xl:gap-3.5 4xl:gap-4 pointer-events-none"
          >
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 sm:w-2 sm:h-2 2xl:w-2.5 2xl:h-2.5 3xl:w-3 3xl:h-3 4xl:w-3.5 4xl:h-3.5 rounded-full"
                style={{ background: 'rgb(85, 205, 179)' }}
              />
            ))}
          </div>

          {/* Bottom-right dot matrix grid (5 cols x 3 rows = 15 dots) */}
          <div
            aria-hidden="true"
            className="absolute bottom-6 right-6 sm:bottom-8 sm:right-8 2xl:bottom-10 2xl:right-10 3xl:bottom-12 3xl:right-12 4xl:bottom-14 4xl:right-14 grid grid-cols-5 gap-2 sm:gap-2.5 2xl:gap-3 3xl:gap-3.5 4xl:gap-4 pointer-events-none"
          >
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 sm:w-2 sm:h-2 2xl:w-2.5 2xl:h-2.5 3xl:w-3 3xl:h-3 4xl:w-3.5 4xl:h-3.5 rounded-full"
                style={{ background: 'rgb(85, 205, 179)' }}
              />
            ))}
          </div>

          {/* Card Header (Centered) */}
          <h1
            className="font-display text-2xl xs:text-3xl sm:text-[34px] 2xl:text-4xl 3xl:text-5xl 4xl:text-6xl font-black tracking-tight mb-2 2xl:mb-3 text-center"
            style={{ color: 'rgb(8, 11, 12)', fontFamily: 'Outfit, Inter, sans-serif' }}
          >
            Welcome <span style={{ color: 'rgb(85, 205, 179)' }}>Back</span>
          </h1>
          <p
            className="text-sm sm:text-[15px] 2xl:text-lg 3xl:text-xl 4xl:text-2xl font-medium mb-7 sm:mb-8 2xl:mb-10 3xl:mb-12 4xl:mb-14 text-center"
            style={{ color: 'rgb(102, 112, 133)' }}
          >
            Sign in to MaxR Teamspace to continue
          </p>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="mb-5 2xl:mb-6 3xl:mb-8 p-3 2xl:p-4 rounded-xl 2xl:rounded-2xl text-sm 2xl:text-base 3xl:text-lg font-medium"
              style={{
                background: 'rgb(254, 242, 242)',
                border: '1px solid rgb(254, 202, 202)',
                color: 'rgb(185, 28, 28)',
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3.5 sm:gap-4 2xl:gap-5 3xl:gap-6 4xl:gap-8"
          >
            {/* Email input field with mail icon */}
            <div className="relative">
              <span
                className="absolute left-4 sm:left-4.5 2xl:left-5 3xl:left-6 4xl:left-7 top-1/2 -translate-y-1/2 flex items-center pointer-events-none"
                style={{ color: 'rgb(102, 112, 133)' }}
              >
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
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <polyline points="2,4 12,13 22,4" />
                </svg>
              </span>
              <input
                id="login-email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                aria-label="Work email"
                className="w-full text-sm sm:text-[15px] 2xl:text-lg 3xl:text-xl 4xl:text-2xl rounded-2xl sm:rounded-[20px] 2xl:rounded-[22px] 3xl:rounded-[26px] outline-none transition-all pl-12 sm:pl-13 2xl:pl-15 3xl:pl-17 4xl:pl-20 pr-4 2xl:pr-6 h-[52px] sm:h-[56px] 2xl:h-[64px] 3xl:h-[72px] 4xl:h-[82px]"
                style={{
                  border: '1.5px solid rgb(226, 232, 240)',
                  color: 'rgb(8, 11, 12)',
                  background: 'rgb(255, 255, 255)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgb(85, 205, 179)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(85, 205, 179, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgb(226, 232, 240)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Password input field with lock and eye icons */}
            <div className="relative">
              <span
                className="absolute left-4 sm:left-4.5 2xl:left-5 3xl:left-6 4xl:left-7 top-1/2 -translate-y-1/2 flex items-center pointer-events-none"
                style={{ color: 'rgb(102, 112, 133)' }}
              >
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
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-label="Password"
                className="w-full text-sm sm:text-[15px] 2xl:text-lg 3xl:text-xl 4xl:text-2xl rounded-2xl sm:rounded-[20px] 2xl:rounded-[22px] 3xl:rounded-[26px] outline-none transition-all pl-12 sm:pl-13 2xl:pl-15 3xl:pl-17 4xl:pl-20 pr-12 2xl:pr-14 3xl:pr-16 4xl:pr-20 h-[52px] sm:h-[56px] 2xl:h-[64px] 3xl:h-[72px] 4xl:h-[82px]"
                style={{
                  border: '1.5px solid rgb(226, 232, 240)',
                  color: 'rgb(8, 11, 12)',
                  background: 'rgb(255, 255, 255)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgb(85, 205, 179)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(85, 205, 179, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgb(226, 232, 240)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 2xl:right-4 3xl:right-5 4xl:right-6 top-1/2 -translate-y-1/2 p-1.5 flex items-center justify-center cursor-pointer min-w-[36px] min-h-[36px] 2xl:min-w-[44px] 2xl:min-h-[44px] transition-colors"
                style={{ color: 'rgb(102, 112, 133)' }}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>

            {/* Remember Me and Forgot Password row */}
            <div className="flex items-center justify-between mt-1 sm:mt-1.5">
              <label
                className="flex items-center gap-2 2xl:gap-3 cursor-pointer text-xs sm:text-[14px] 2xl:text-base 3xl:text-lg 4xl:text-xl font-bold select-none"
                style={{ color: 'rgb(8, 11, 12)' }}
              >
                <span
                  role="checkbox"
                  aria-checked={rememberMe}
                  tabIndex={0}
                  onClick={() => setRememberMe((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') setRememberMe((v) => !v);
                  }}
                  className="flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 2xl:w-6 2xl:h-6 3xl:w-7 3xl:h-7 4xl:w-8 4xl:h-8 rounded-[5px] sm:rounded-[6px] 2xl:rounded-[7px] transition-all cursor-pointer flex-shrink-0"
                  style={{
                    background: rememberMe ? 'rgb(85, 205, 179)' : 'rgb(255, 255, 255)',
                    border: rememberMe
                      ? '2px solid rgb(85, 205, 179)'
                      : '2px solid rgb(209, 213, 219)',
                  }}
                >
                  {rememberMe && (
                    <svg
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-2.5 h-2.5 sm:w-3 sm:h-3 2xl:w-3.5 2xl:h-3.5 3xl:w-4 3xl:h-4 4xl:w-5 4xl:h-5"
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
                className="font-bold text-xs sm:text-[14px] 2xl:text-base 3xl:text-lg 4xl:text-xl hover:underline cursor-pointer bg-transparent border-0 p-0 transition-colors"
                style={{ color: 'rgb(8, 11, 12)' }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = 'rgb(85, 205, 179)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = 'rgb(8, 11, 12)';
                }}
              >
                Forgot password?
              </button>
            </div>

            {/* Sign In Button with smooth rounded-full pill shape and arrow icon matching reference */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-3 sm:mt-4 2xl:mt-5 3xl:mt-6 w-full flex items-center justify-center gap-2.5 text-white font-bold text-sm sm:text-[16px] 2xl:text-xl 3xl:text-2xl 4xl:text-3xl rounded-full cursor-pointer transition-all disabled:opacity-70 h-[48px] sm:h-[52px] 2xl:h-[62px] 3xl:h-[70px] 4xl:h-[80px]"
              style={{
                background: 'rgb(85, 205, 179)',
                boxShadow: '0 8px 24px rgba(85, 205, 179, 0.45)',
                fontFamily: 'Outfit, Inter, sans-serif',
              }}
              onMouseOver={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'rgb(72, 192, 166)';
                  e.currentTarget.style.boxShadow = '0 10px 28px rgba(85, 205, 179, 0.55)';
                }
              }}
              onMouseOut={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'rgb(85, 205, 179)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(85, 205, 179, 0.45)';
                }
              }}
            >
              {isLoading ? (
                <span className="w-5 h-5 2xl:w-6 2xl:h-6 3xl:w-7 3xl:h-7 border-2 border-white/40 border-t-white rounded-full animate-spin" />
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
                    className="w-4 h-4 2xl:w-5 2xl:h-5 3xl:w-6 3xl:h-6 4xl:w-7 4xl:h-7"
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
