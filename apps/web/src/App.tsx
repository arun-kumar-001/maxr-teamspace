import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { TemplatePage } from './features/_template/pages/TemplatePage';
import { ComponentGalleryPage } from './components/ui/gallery/ComponentGalleryPage';
import { ROLES, Role, ROLE_DISPLAY_NAMES } from '@maxr/shared';

interface HealthStatus {
  status: string;
  service: string;
  environment: string;
  timestamp: string;
}

export const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<Role>(ROLES.ADMIN);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetch('/api/v1/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setHealth(data))
      .catch(() => setHealth(null));
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-surface-muted text-slate-900">
        {/* Navy Header Shell (AGENTS.md §8: --navy-950 #0A1429) */}
        <header className="bg-navy-950 text-white border-b border-navy-800 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Brand Logo Mark */}
              <div className="w-8 h-8 rounded bg-brand-red flex items-center justify-center font-bold text-white tracking-wider shadow-sm">
                M
              </div>
              <span className="font-semibold text-lg tracking-tight">MAXR Teamspace</span>
            </div>

            {/* Role View Switcher (Preview for 4 roles) */}
            <div className="hidden md:flex items-center gap-3">
              <span className="text-xs text-slate-400">View as Role:</span>
              <select
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value as Role)}
                className="bg-navy-900 text-slate-200 text-sm border border-navy-800 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {Object.values(ROLES).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_DISPLAY_NAMES[role]}
                  </option>
                ))}
              </select>
            </div>

            {/* Mobile Menu Toggle Button (Min 44x44px touch target) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded text-slate-300 hover:text-white hover:bg-navy-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              aria-label="Toggle navigation menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Drawer */}
          {isMobileMenuOpen && (
            <div className="md:hidden bg-navy-900 border-t border-navy-800 px-4 pt-3 pb-4 space-y-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-400">Current Role View:</span>
                <select
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value as Role)}
                  className="bg-navy-950 text-slate-200 text-sm border border-navy-800 rounded px-3 py-2"
                >
                  {Object.values(ROLES).map((role) => (
                    <option key={role} value={role}>
                      {ROLE_DISPLAY_NAMES[role]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </header>

        {/* Main Content Area */}
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Status Banner */}
          <div className="bg-surface rounded-lg border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-2">
              Repository Foundation Scaffold (TL-01)
            </h2>
            <p className="text-slate-600 text-sm mb-4">
              Monorepo established with strict TypeScript, layered backend API (`apps/api`), React
              frontend (`apps/web`), and shared contracts (`packages/shared`).
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center px-2.5 py-1 rounded bg-teal-500/10 text-teal-600 font-medium">
                Active Role: {ROLE_DISPLAY_NAMES[currentRole]}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-medium">
                Backend Status: {health ? `Online (${health.service})` : 'Offline / Standalone'}
              </span>
            </div>
          </div>

          {/* Navigation & Routes */}
          <nav className="flex gap-4 border-b border-slate-200 pb-3">
            <Link
              to="/"
              className="text-teal-600 font-semibold border-b-2 border-teal-500 pb-2 text-sm"
            >
              Template Demo
            </Link>
            <Link
              to="/components"
              className="text-slate-600 hover:text-teal-600 font-medium pb-2 text-sm"
            >
              UI Components (TL-09)
            </Link>
          </nav>

          <main>
            <Routes>
              <Route path="/" element={<TemplatePage />} />
              <Route path="/components" element={<ComponentGalleryPage />} />
            </Routes>
          </main>
        </div>

        {/* Footer */}
        <footer className="bg-surface border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
          MAXR Teamspace &copy; {new Date().getFullYear()} &middot; Internal Staff Management
          Platform
        </footer>
      </div>
    </BrowserRouter>
  );
};
