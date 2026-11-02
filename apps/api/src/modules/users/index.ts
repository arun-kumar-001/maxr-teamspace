import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../db/client';
import type { PlatformServices } from '../../platform';
import { IUsersRepository, PgUsersRepository } from './users.repository';
import { createPermissionsRouter, createRolesRouter, createUsersRouter } from './users.routes';
import { UsersService } from './users.service';

export function createUsers(options: {
  platform: Pick<PlatformServices, 'audit'>;
  authenticate: RequestHandler;
  repository?: IUsersRepository;
  getPool?: () => Pool;
}): { usersRouter: Router; rolesRouter: Router; permissionsRouter: Router } {
  const repository = options.repository ?? new PgUsersRepository(options.getPool ?? getPool);
  const service = new UsersService(repository, options.platform);
  return {
    usersRouter: createUsersRouter(service, options.authenticate),
    rolesRouter: createRolesRouter(service, options.authenticate),
    permissionsRouter: createPermissionsRouter(service, options.authenticate),
  };
}
