import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../../db/client';
import type { PlatformServices } from '../../../platform';
import { PasswordHasher, createArgon2Hasher } from '../../auth/password-hasher';
import { SessionRevoker } from '../deactivation/deactivation.types';
import { IOnboardingRepository, PgOnboardingRepository } from './onboarding.repository';
import { createOnboardingRouter } from './onboarding.routes';
import { OnboardingService } from './onboarding.service';

export * from './onboarding.repository';
export * from './onboarding.rules';
export * from './onboarding.schemas';
export * from './onboarding.service';
export * from './onboarding.types';

export function createOnboarding(options: {
  platform: Pick<PlatformServices, 'audit' | 'events' | 'notifications'>;
  authenticate: RequestHandler;
  sessions: SessionRevoker;
  repository?: IOnboardingRepository;
  hasher?: PasswordHasher;
  getPool?: () => Pool;
}): { router: Router; service: OnboardingService } {
  const repository = options.repository ?? new PgOnboardingRepository(options.getPool ?? getPool);
  const hasher = options.hasher ?? createArgon2Hasher();
  const service = new OnboardingService(repository, options.platform, hasher, options.sessions);

  return {
    router: createOnboardingRouter({ service, authenticate: options.authenticate }),
    service,
  };
}
