import dotenv from 'dotenv';
import path from 'path';

// Load .env from root or apps/api if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  HOST: string;
  CORS_ORIGIN: string;
  DATABASE_URL: string;
  SESSION_SECRET: string;
  SESSION_MAX_AGE_MS: number;
  LOG_LEVEL: string;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`[Config Error] Missing required environment variable: ${key}`);
  }
  return value;
}

function parsePort(portStr: string | undefined, defaultPort = 4000): number {
  if (!portStr) {
    return defaultPort;
  }
  const parsed = parseInt(portStr, 10);
  if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`[Config Error] Invalid PORT environment variable: ${portStr}`);
  }
  return parsed;
}

export function loadAndValidateConfig(): EnvironmentConfig {
  const nodeEnv = (process.env.NODE_ENV || 'development') as EnvironmentConfig['NODE_ENV'];
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error(
      `[Config Error] Invalid NODE_ENV: ${nodeEnv}. Must be 'development', 'test', or 'production'.`,
    );
  }

  const port = parsePort(process.env.PORT || '4000');
  const host = process.env.HOST || '0.0.0.0';
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

  // In production, DATABASE_URL and SESSION_SECRET are strictly required
  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (nodeEnv === 'production') {
      throw new Error('[Config Error] DATABASE_URL is strictly required in production.');
    }
    databaseUrl = 'postgresql://postgres:postgres@localhost:5432/maxr_teamspace';
  }

  let sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    if (nodeEnv === 'production') {
      throw new Error('[Config Error] SESSION_SECRET is strictly required in production.');
    }
    sessionSecret = 'development-fallback-session-secret-min-32-chars-long';
  } else if (sessionSecret.length < 32 && nodeEnv === 'production') {
    throw new Error('[Config Error] SESSION_SECRET must be at least 32 characters in production.');
  }

  const sessionMaxAgeMs = parseInt(process.env.SESSION_MAX_AGE_MS || '86400000', 10);
  const logLevel = getEnvVar('LOG_LEVEL', 'info');

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    HOST: host,
    CORS_ORIGIN: corsOrigin,
    DATABASE_URL: databaseUrl,
    SESSION_SECRET: sessionSecret,
    SESSION_MAX_AGE_MS: sessionMaxAgeMs,
    LOG_LEVEL: logLevel,
  };
}

export const config = loadAndValidateConfig();
