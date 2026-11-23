export function SecuritySettingsSection() {
  return (
    <div
      className="p-5 sm:p-6 bg-surface border border-border rounded-card shadow-card space-y-4"
      data-testid="security-settings-section"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-text">Security & Authentication Policies</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Core security configurations are hardened and enforced by ADR D-05. These values are
            fixed at runtime to guarantee compliance.
          </p>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
          Enforced by ADR D-05
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        <div className="p-3.5 bg-surface-muted rounded-tile border border-border">
          <span className="text-xs text-text-subtle block">Password Hashing</span>
          <span className="text-sm font-semibold text-text block mt-0.5">Argon2id</span>
          <span className="text-[11px] text-text-muted mt-1 block">
            Memory-hard cryptographic hash
          </span>
        </div>

        <div className="p-3.5 bg-surface-muted rounded-tile border border-border">
          <span className="text-xs text-text-subtle block">Access Token Lifespan</span>
          <span className="text-sm font-semibold text-text block mt-0.5">15 Minutes</span>
          <span className="text-[11px] text-text-muted mt-1 block">
            Short-lived JWT in HttpOnly cookie
          </span>
        </div>

        <div className="p-3.5 bg-surface-muted rounded-tile border border-border">
          <span className="text-xs text-text-subtle block">Session Timeout</span>
          <span className="text-sm font-semibold text-text block mt-0.5">7 Days</span>
          <span className="text-[11px] text-text-muted mt-1 block">
            Revoked on employee deactivation
          </span>
        </div>

        <div className="p-3.5 bg-surface-muted rounded-tile border border-border">
          <span className="text-xs text-text-subtle block">Brute-Force Lockout</span>
          <span className="text-sm font-semibold text-text block mt-0.5">5 Failed Attempts</span>
          <span className="text-[11px] text-text-muted mt-1 block">
            15 min IP & account backoff lockout
          </span>
        </div>
      </div>
    </div>
  );
}
