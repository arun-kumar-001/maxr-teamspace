import { useState, useRef, type ChangeEvent } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';

function IconUpload({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconTrash({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

interface AdminProfilePhotoSectionProps {
  onNotify?: (message: string) => void;
}

export function AdminProfilePhotoSection({ onNotify }: AdminProfilePhotoSectionProps) {
  const { user, updateUserAvatar } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, WEBP, or GIF).');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size exceeds 5MB limit. Please choose a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        updateUserAvatar?.(result);
        onNotify?.('Profile photo updated successfully!');
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read the selected image file. Please try again.');
    };
    reader.readAsDataURL(file);

    // Reset input value so re-selecting same file triggers onChange
    e.target.value = '';
  };

  const handleRemovePhoto = () => {
    setErrorMessage(null);
    updateUserAvatar?.(null);
    onNotify?.('Profile photo removed. Initial avatar restored.');
  };

  return (
    <div
      className="p-5 sm:p-6 bg-surface border border-border rounded-card shadow-card space-y-5"
      data-testid="admin-profile-photo-section"
    >
      <div>
        <h3 className="text-base font-semibold text-text">Administrator Profile Photo</h3>
        <p className="text-xs text-text-muted mt-0.5">
          Upload and manage your administrator avatar image. This photo appears in the top navigation header and floating sidebar.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center sm:items-center gap-5 pt-1">
        {/* Avatar Preview */}
        <div className="relative group shrink-0">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-tile-peach text-sidebar font-display font-bold text-2xl flex items-center justify-center border-2 border-border shadow-sm overflow-hidden">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-full h-full object-cover"
                data-testid="admin-avatar-preview"
              />
            ) : (
              <span data-testid="admin-avatar-initials">{user?.avatarInitials || 'AK'}</span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
              data-testid="admin-avatar-file-input"
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleChooseFile}
              className="flex items-center gap-1.5 shadow-xs"
              data-testid="admin-upload-photo-btn"
            >
              <IconUpload className="w-4 h-4" />
              <span>Upload Photo</span>
            </Button>

            {user?.avatarUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemovePhoto}
                className="flex items-center gap-1.5 text-rose-700 hover:bg-rose-50 border-rose-200"
                data-testid="admin-remove-photo-btn"
              >
                <IconTrash className="w-3.5 h-3.5" />
                <span>Remove Photo</span>
              </Button>
            )}
          </div>
          <p className="text-[11px] text-text-subtle">
            Recommended: Square image at least 256x256px. Max file size: 5MB (PNG, JPG, WEBP, GIF).
          </p>
        </div>
      </div>
    </div>
  );
}

