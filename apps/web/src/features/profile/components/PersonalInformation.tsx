import { useState } from 'react';
import type { EmployeeProfile } from '../types';
import { PhoneEditor } from './PhoneEditor';

export interface PersonalInformationProps {
  profile: EmployeeProfile;
  phoneDraft: string;
  isEditingPhone: boolean;
  isSavingPhone: boolean;
  saveError: string | null;
  conflictWarning: string | null;
  onDraftChange: (value: string) => void;
  onStartEditPhone: () => void;
  onCancelEditPhone: () => void;
  onSavePhone: () => void;
}

export function PersonalInformation({
  profile,
  phoneDraft,
  isEditingPhone,
  isSavingPhone,
  saveError,
  conflictWarning,
  onDraftChange,
  onStartEditPhone,
  onCancelEditPhone,
  onSavePhone,
}: PersonalInformationProps) {
  const [nickName, setNickName] = useState(profile.firstName.toLowerCase());
  const [gender, setGender] = useState('female');
  const [country, setCountry] = useState('India');
  const [language, setLanguage] = useState('English');
  const [timeZone, setTimeZone] = useState('Asia/Kolkata');
  const [isEditingForm, setIsEditingForm] = useState(false);
  const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
  const [showAddEmailInput, setShowAddEmailInput] = useState(false);
  const [newEmailDraft, setNewEmailDraft] = useState('');

  const handleAddEmail = () => {
    if (newEmailDraft.trim() && !additionalEmails.includes(newEmailDraft.trim())) {
      setAdditionalEmails((prev) => [...prev, newEmailDraft.trim()]);
      setNewEmailDraft('');
      setShowAddEmailInput(false);
    }
  };

  return (
    <section
      className="bg-surface border border-border rounded-card p-6 shadow-card"
      aria-labelledby="personal-info-heading"
      data-testid="personal-info-card"
    >
      {/* Header bar with title and Edit / Save button matching Image 1 */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-soft text-primary-strong flex items-center justify-center">
            <svg
              className="w-4 h-4 stroke-current"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <h2 id="personal-info-heading" className="text-base font-semibold text-text">
              Personal Information
            </h2>
            <p className="text-xs text-text-muted">
              Your contact information on record. Phone is self-editable.
            </p>
          </div>
        </div>

        {profile.status !== 'deactivated' && (
          <button
            type="button"
            onClick={() => setIsEditingForm(!isEditingForm)}
            className="px-4 py-1.5 rounded-input text-xs font-semibold bg-primary text-text hover:bg-primary-strong hover:text-white transition-colors cursor-pointer shadow-xs"
            data-testid="edit-profile-btn"
          >
            {isEditingForm ? 'Save' : 'Edit'}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Row 1: Full Name & Nick Name (Image 1 Template) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="profile-full-name"
              className="block text-xs font-semibold text-text-subtle mb-1.5"
            >
              Full Name
            </label>
            <div className="p-2.5 bg-surface-muted border border-border rounded-input text-sm font-medium text-text">
              <span>{profile.firstName}</span> <span>{profile.lastName}</span>
            </div>
          </div>

          <div>
            <label
              htmlFor="profile-nick-name"
              className="block text-xs font-semibold text-text-subtle mb-1.5"
            >
              Nick Name
            </label>
            {isEditingForm ? (
              <input
                id="profile-nick-name"
                type="text"
                value={nickName}
                onChange={(e) => setNickName(e.target.value)}
                placeholder="Your Nick Name"
                className="w-full p-2.5 bg-surface border border-primary-strong/40 rounded-input text-sm font-medium text-text focus:ring-2 focus:ring-primary-strong/20 outline-none"
              />
            ) : (
              <div className="p-2.5 bg-surface-muted border border-border rounded-input text-sm font-medium text-text capitalize">
                {nickName || 'Your Nick Name'}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Gender & Country (Image 1 Template) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="profile-gender"
              className="block text-xs font-semibold text-text-subtle mb-1.5"
            >
              Gender
            </label>
            {isEditingForm ? (
              <select
                id="profile-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full p-2.5 bg-surface border border-border rounded-input text-sm font-medium text-text focus:ring-2 focus:ring-primary-strong/20 outline-none"
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non_binary">Non-binary</option>
                <option value="prefer_not">Prefer not to say</option>
              </select>
            ) : (
              <div className="p-2.5 bg-surface-muted border border-border rounded-input text-sm font-medium text-text capitalize">
                {gender === 'female'
                  ? 'Female'
                  : gender === 'male'
                    ? 'Male'
                    : 'Prefer not to say'}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="profile-country"
              className="block text-xs font-semibold text-text-subtle mb-1.5"
            >
              Country
            </label>
            {isEditingForm ? (
              <select
                id="profile-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full p-2.5 bg-surface border border-border rounded-input text-sm font-medium text-text focus:ring-2 focus:ring-primary-strong/20 outline-none"
              >
                <option value="India">India</option>
                <option value="United States">United States</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Canada">Canada</option>
                <option value="Singapore">Singapore</option>
                <option value="Australia">Australia</option>
                <option value="Germany">Germany</option>
              </select>
            ) : (
              <div className="p-2.5 bg-surface-muted border border-border rounded-input text-sm font-medium text-text">
                {country}
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Language & Time Zone (Image 1 Template) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="profile-language"
              className="block text-xs font-semibold text-text-subtle mb-1.5"
            >
              Language
            </label>
            {isEditingForm ? (
              <select
                id="profile-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full p-2.5 bg-surface border border-border rounded-input text-sm font-medium text-text focus:ring-2 focus:ring-primary-strong/20 outline-none"
              >
                <option value="English">English</option>
                <option value="Tamil">Tamil</option>
                <option value="Hindi">Hindi</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
              </select>
            ) : (
              <div className="p-2.5 bg-surface-muted border border-border rounded-input text-sm font-medium text-text">
                {language}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="profile-timezone"
              className="block text-xs font-semibold text-text-subtle mb-1.5"
            >
              Time Zone
            </label>
            {isEditingForm ? (
              <select
                id="profile-timezone"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="w-full p-2.5 bg-surface border border-border rounded-input text-sm font-medium text-text focus:ring-2 focus:ring-primary-strong/20 outline-none"
              >
                <option value="Asia/Kolkata">(GMT+05:30) Asia/Kolkata</option>
                <option value="UTC">(GMT+00:00) UTC</option>
                <option value="America/New_York">(GMT-05:00) Eastern Time (US & Canada)</option>
                <option value="America/Los_Angeles">(GMT-08:00) Pacific Time (US & Canada)</option>
              </select>
            ) : (
              <div className="p-2.5 bg-surface-muted border border-border rounded-input text-sm font-medium text-text">
                {timeZone === 'Asia/Kolkata'
                  ? '(GMT+05:30) Asia/Kolkata'
                  : timeZone === 'UTC'
                    ? '(GMT+00:00) UTC'
                    : timeZone}
              </div>
            )}
          </div>
        </div>

        {/* Section: My email Address (Image 1 Template) */}
        <div className="border-t border-border pt-4">
          <span className="block text-xs font-bold text-text mb-2.5">
            My email Address
          </span>

          <div className="space-y-2">
            {/* Primary Verified Email */}
            <div className="flex items-center justify-between p-3 bg-surface-muted/60 border border-border rounded-input">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-10 7L2 7" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text truncate">
                    {profile.email}
                  </p>
                  <p className="text-[11px] text-text-muted">Primary Work Email &middot; 1 month ago</p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Verified
              </span>
            </div>

            {/* Additional emails */}
            {additionalEmails.map((email, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-surface-muted/60 border border-border rounded-input"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-surface-muted text-text-muted flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <rect x="2" y="4" width="20" height="16" rx="2" strokeWidth="2" />
                      <path d="m22 7-10 7L2 7" strokeWidth="2" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-text truncate">{email}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setAdditionalEmails((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="text-xs text-rose-600 hover:text-rose-800"
                >
                  Remove
                </button>
              </div>
            ))}

            {/* Add Email Form or Button */}
            {showAddEmailInput ? (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="email"
                  value={newEmailDraft}
                  onChange={(e) => setNewEmailDraft(e.target.value)}
                  placeholder="e.g. alternate@example.com"
                  className="flex-1 p-2 bg-surface border border-border rounded-input text-xs outline-none focus:ring-2 focus:ring-primary-strong/20"
                />
                <button
                  type="button"
                  onClick={handleAddEmail}
                  className="px-3 py-2 bg-primary text-text text-xs font-semibold rounded-input hover:bg-primary-strong hover:text-white"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddEmailInput(false)}
                  className="px-2 py-2 text-xs text-text-muted hover:text-text"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddEmailInput(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-input text-xs font-semibold text-primary-deep bg-primary-soft hover:bg-primary-soft/80 border border-primary-strong/20 transition-colors"
                data-testid="add-email-address-btn"
              >
                <span>+</span> Add Email Address
              </button>
            )}
          </div>
        </div>

        {/* Phone Section (Editable with PhoneEditor) */}
        <div className="border-t border-border pt-4">
          <PhoneEditor
            currentPhone={profile.phone}
            phoneDraft={phoneDraft}
            isEditing={isEditingPhone}
            isSaving={isSavingPhone}
            isDeactivated={profile.status === 'deactivated'}
            saveError={saveError}
            conflictWarning={conflictWarning}
            onDraftChange={onDraftChange}
            onStartEdit={onStartEditPhone}
            onCancelEdit={onCancelEditPhone}
            onSave={onSavePhone}
          />
        </div>
      </div>
    </section>
  );
}
