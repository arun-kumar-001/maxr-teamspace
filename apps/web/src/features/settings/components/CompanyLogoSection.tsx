import { useState, useRef, type ChangeEvent } from 'react';
import { Button } from '../../../components/ui/Button';

function IconUpload({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconBuilding({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}

function IconRotateCcw({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

interface CompanyLogoSectionProps {
  companyName: string;
  logoUrl?: string | null;
  onUpdateLogo: (logo: string | null) => void;
  onNotify?: (msg: string) => void;
  disabled?: boolean;
}

export function CompanyLogoSection({
  companyName,
  logoUrl,
  onUpdateLogo,
  onNotify,
  disabled = false,
}: CompanyLogoSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, SVG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Logo file exceeds 5MB limit. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        onUpdateLogo(result);
        try {
          localStorage.setItem('maxr_company_logo', result);
          window.dispatchEvent(new Event('storage'));
        } catch {
          // fallback
        }
        onNotify?.('Company logo updated successfully!');
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read the selected file. Please try again.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleResetDefault = () => {
    setErrorMessage(null);
    onUpdateLogo(null);
    try {
      localStorage.removeItem('maxr_company_logo');
      window.dispatchEvent(new Event('storage'));
    } catch {
      // fallback
    }
    onNotify?.('Company logo reset to default brand symbol.');
  };

  const activeLogo = logoUrl || '/maxr-symbol.png';

  return (
    <div
      className="p-5 sm:p-6 bg-surface border border-border rounded-card shadow-card space-y-5"
      data-testid="company-logo-section"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-soft text-primary-deep flex items-center justify-center shrink-0">
              <IconBuilding className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-text font-display">Company Logo & Branding</h3>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Brand logo displayed on the floating navigation sidebar, authentication portal, and
            official employee payslips.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div
          className="p-3 text-xs bg-rose-50 text-rose-800 border border-rose-200 rounded-xl"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Left: Dual Preview (Normal & Dark Sidebar tile) */}
        <div className="flex flex-wrap items-center gap-5">
          {/* Main Logo Card */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-surface-raised border-2 border-border shadow-xs flex items-center justify-center p-2.5 overflow-hidden">
              <img
                src={activeLogo}
                alt={companyName || 'Company Logo'}
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-[11px] font-semibold text-text-muted">Live Logo</span>
          </div>

          {/* Sidebar Dark Teal Preview */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-36 h-20 sm:h-24 rounded-2xl bg-sidebar border border-sidebar-border shadow-xs flex items-center gap-2.5 px-3 py-2">
              <div className="w-8 h-8 rounded-lg bg-sidebar-raised flex items-center justify-center p-1 shrink-0">
                <img
                  src={activeLogo}
                  alt="Sidebar preview"
                  className="w-full h-full object-contain drop-shadow-xs"
                />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-sidebar-text truncate">
                  {companyName || 'MaxR'}
                </div>
                <div className="text-[9px] text-sidebar-muted truncate">Teamspace</div>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-text-muted">Sidebar Preview</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col gap-2.5 w-full md:w-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Upload Company Logo"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleChooseFile}
              disabled={disabled}
              className="flex items-center gap-2 min-h-[40px] px-4"
              data-testid="upload-company-logo-btn"
            >
              <IconUpload className="w-4 h-4" />
              <span>Upload New Logo</span>
            </Button>

            {logoUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetDefault}
                disabled={disabled}
                className="flex items-center gap-1.5 min-h-[40px] px-3 text-text-muted hover:text-text"
              >
                <IconRotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default</span>
              </Button>
            )}
          </div>

          <p className="text-[11px] text-text-subtle max-w-xs">
            Recommended: Transparent PNG or SVG at least 256x256px. Max file size: 5MB.
          </p>
        </div>
      </div>
    </div>
  );
}
