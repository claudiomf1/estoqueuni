import winston from "winston";
import { config } from "../../config/index.js";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
    new winston.transports.File({
      filename: `${config.logging.filePath}/error.log`,
      level: "error",
    }),
    new winston.transports.File({
      filename: `${config.logging.filePath}/combined.log`,
    }),
  ],
});

export default logger;




















