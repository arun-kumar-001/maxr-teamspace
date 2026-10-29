import { redact } from './redact';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export function parseLogLevel(value: string | undefined, fallback: LogLevel = 'info'): LogLevel {
  const v = (value ?? '').toLowerCase();
  return v in ORDER ? (v as LogLevel) : fallback;
}

export interface LoggerOptions {
  level?: LogLevel;
  /** Output sink; defaults to one JSON line per event on stdout. */
  write?: (line: string) => void;
  bindings?: Record<string, unknown>;
}

/**
 * Minimal structured JSON logger. Every field passes through `redact()`.
 * Kept behind the `Logger` interface so it can be swapped for pino without touching callers.
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? 'info';
  const write = options.write ?? ((line: string) => void process.stdout.write(`${line}\n`));
  const bindings = options.bindings ?? {};

  const log = (lvl: Exclude<LogLevel, 'silent'>, msg: string, fields?: Record<string, unknown>) => {
    if (ORDER[lvl] < ORDER[level]) {
      return;
    }
    const record = redact({ ...bindings, ...fields }) as Record<string, unknown>;
    // Reserved keys are written last so callers cannot override them.
    write(JSON.stringify({ ...record, time: new Date().toISOString(), level: lvl, msg }));
  };

  return {
    debug: (msg, fields) => log('debug', msg, fields),
    info: (msg, fields) => log('info', msg, fields),
    warn: (msg, fields) => log('warn', msg, fields),
    error: (msg, fields) => log('error', msg, fields),
    child: (extra) =>
      createLogger({ level, write, bindings: { ...bindings, ...(redact(extra) as object) } }),
  };
}

let defaultLogger: Logger | null = null;

/** Process-wide logger, configured from `LOG_LEVEL`. */
export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger({
      level: parseLogLevel(
        process.env.LOG_LEVEL,
        process.env.NODE_ENV === 'test' ? 'silent' : 'info',
      ),
    });
  }
  return defaultLogger;
}
