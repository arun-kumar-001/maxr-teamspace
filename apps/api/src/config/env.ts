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
  REDIS_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  SESSION_SECRET: string;
  SESSION_MAX_AGE_MS: number;
  LOG_LEVEL: string;
  STORAGE_DRIVER: 's3' | 'local';
  S3_ENDPOINT: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  EMAIL_FROM: string;
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

  const port = parsePort(process.env.PORT, 4000);
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

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parsePort(process.env.REDIS_PORT, 6379);

  const storageDriver = (process.env.STORAGE_DRIVER || 's3') as 's3' | 'local';
  const s3Endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
  const s3Bucket = process.env.S3_BUCKET || 'maxr-private-storage';
  const s3AccessKey = process.env.S3_ACCESS_KEY || 'minioadmin';
  const s3SecretKey = process.env.S3_SECRET_KEY || 'minioadmin';

  const smtpHost = process.env.SMTP_HOST || 'localhost';
  const smtpPort = parsePort(process.env.SMTP_PORT, 1025);
  const emailFrom = process.env.EMAIL_FROM || 'no-reply@maxr.internal';

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    HOST: host,
    CORS_ORIGIN: corsOrigin,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    REDIS_HOST: redisHost,
    REDIS_PORT: redisPort,
    SESSION_SECRET: sessionSecret,
    SESSION_MAX_AGE_MS: sessionMaxAgeMs,
    LOG_LEVEL: logLevel,
    STORAGE_DRIVER: storageDriver,
    S3_ENDPOINT: s3Endpoint,
    S3_BUCKET: s3Bucket,
    S3_ACCESS_KEY: s3AccessKey,
    S3_SECRET_KEY: s3SecretKey,
    SMTP_HOST: smtpHost,
    SMTP_PORT: smtpPort,
    EMAIL_FROM: emailFrom,
  };
}

export const config = loadAndValidateConfig();
