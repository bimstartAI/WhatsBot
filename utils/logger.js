// utils/logger.js

const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'error', // Only log errors
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    // If you want to file-log only errors:
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
  ],
});

module.exports = logger;
