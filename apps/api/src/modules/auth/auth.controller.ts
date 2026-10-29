import { Request, Response } from 'express';
import { unauthorized } from '../../http/errors';
import { validated } from '../../http/validate';
import { AuthConfig } from './auth-config';
import { LoginLockedError, AuthService } from './auth.service';
import { changePasswordSchema, loginSchema } from './auth.schemas';
import { RequestMeta } from './auth.types';
import { sessionCookieOptions } from './authenticate';

export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly config: AuthConfig,
  ) {}

  private meta(req: Request): RequestMeta {
    return { ip: req.ip ?? 'unknown', requestId: req.id };
  }

  /** Reads the authenticated request; routes using this are always behind `authenticate`. */
  private current(req: Request) {
    if (!req.actor || !req.session) throw unauthorized();
    return { actor: req.actor, session: req.session };
  }

  login = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, { body: loginSchema });
    try {
      const { profile, session } = await this.service.login(body, this.meta(req));
      res.cookie(
        this.config.cookieName,
        session.token,
        sessionCookieOptions(this.config, session.maxAgeMs),
      );
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ data: { user: profile, csrfToken: session.csrfToken } });
    } catch (error) {
      if (error instanceof LoginLockedError)
        res.setHeader('Retry-After', String(error.retryAfterSeconds));
      throw error;
    }
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const { actor, session } = this.current(req);
    const profile = await this.service.me(actor.id);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ data: { user: profile, csrfToken: session.csrfToken } });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const { actor, session } = this.current(req);
    await this.service.logout(actor.id, session.tokenHash, actor.role, this.meta(req));
    res.clearCookie(this.config.cookieName, sessionCookieOptions(this.config));
    res.status(204).end();
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, { body: changePasswordSchema });
    const { actor, session } = this.current(req);
    await this.service.changePassword(actor.id, session.tokenHash, body, this.meta(req));
    res.status(204).end();
  };
}
