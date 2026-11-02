# Launch Checklist (draft, issue #17)

Tick every item and record who and when. Items marked **[D-10]** need the Cantobo answers first.

## Before go-live
- [ ] #6 merged, so the API starts with `NODE_ENV=production` (see runbook section 0)
- [ ] Security checklist `docs/security/asvs-checklist.md`: no open item above "Planned" for launch scope; Technical Lead sign-off (#16)
- [ ] `npm audit` clean, secret scan clean, CI green on the release commit
- [ ] Production secrets generated, stored in a secret manager, not in the repo; development placeholders absent
- [ ] TLS certificate installed and auto-renewal tested; HSTS only after HTTPS is confirmed stable
- [ ] Backups running, **restore drill passed and recorded**, passphrase stored separately **[D-10 for offsite copy]**
- [ ] Monitoring and alerts live (runbook section 8) **[D-10]**
- [ ] Email provider configured (SMTP or SendGrid), SPF/DKIM set, test mail delivered
- [ ] File storage decision D-10 closed; storage adapter contract tests pass against the real provider
- [ ] Data retention and privacy decisions (D-25) approved by the business owner
- [ ] Admin account created through the documented procedure; MFA decision made
- [ ] Responsive audit at the 9 reference viewports on staging; E2E critical flows green (#62, #32, #48)
- [ ] Runbook reviewed by the Technical Lead; on-call contact named

## Go-live
- [ ] Backup taken, migrations applied, health green, one sign-in per role verified
- [ ] Rollback path rehearsed (runbook section 3)

## After
- [ ] First 48 h: review logs and audit entries daily; confirm backups and alerts fired as expected
