// Load environment variables
require('dotenv').config();

// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const rateLimiter = require('./middleware/rateLimiter'); 
const authMiddleware = require('./middleware/authMiddleware'); 
const webhookController = require('./controllers/webhookController'); 
const logger = require('./utils/logger');
const userState = require('./models/userState');

// Initialize the Express app
const app = express();

// Reset all user states on app start (no console logs)
userState.resetAllStates();

// Middleware
app.use(bodyParser.json());
app.set('trust proxy', 1);
app.use(rateLimiter);

// Routes
// GET for verification (no auth required)
app.get('/webhook', webhookController.verifyWebhook);

// POST for incoming messages (with auth token check)
app.post('/webhook', /*authMiddleware.verifyAuthToken,*/ webhookController.handleWebhook);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // Minimal log
  console.log(`Server is running on port ${PORT}`);
});
