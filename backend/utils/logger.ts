import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';

const transports: winston.transport[] = [];

if (!isProduction) {
  transports.push(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
} else {
  // Resolved from cwd (or LOG_DIR) instead of __dirname so the compiled
  // dist/ build keeps writing to <app>/logs rather than dist/logs.
  const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    }),
  );
}

const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports,
});

// Shadows winston's Logger.stream() method with a morgan-compatible stream
// object — same instance-property override the JS version performed.
(logger as any).stream = {
  write: (message: string) => logger.info(message.trim()),
};

const typedLogger = logger as unknown as winston.Logger & {
  stream: { write: (message: string) => void };
};

export = typedLogger;
