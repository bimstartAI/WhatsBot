// middleware/rateLimiter.js

const rateLimit = require('express-rate-limit');

// Configure rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    status: 429,
    error: 'Too many requests, please try again later.',
  },
  headers: true,
});

module.exports = limiter;
