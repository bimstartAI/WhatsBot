// Middleware to authenticate incoming requests
exports.verifyAuthToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
  
    // Check if the Authorization header exists
    if (!authHeader) {
      console.warn('Missing Authorization header');
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
  
    // Extract the token from the Authorization header
    const token = authHeader.split(' ')[1];
  
    // Verify the token against your environment variable
    if (token !== process.env.WHATSAPP_TOKEN) {
      console.warn('Invalid token provided');
      return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }
  
    // Token is valid, proceed to the next middleware/controller
    next();
  };
