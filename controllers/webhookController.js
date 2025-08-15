// controllers/webhookController.js

const messageController = require('./messageController');

exports.handleWebhook = async (req, res) => {
  const body = req.body;
  try {
    // Check if this is a valid message
    if (
      body.object &&
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from; 
      const messageType = message.type;

      if (messageType === 'interactive') {
        // user tapped on interactive list
        const interactiveReply = message.interactive;
        const selectedId = interactiveReply.list_reply?.id;
        if (selectedId) {
          await messageController.processMessage(from, { text: { body: selectedId } }, 'text');
        }
      } else {
        // normal text, image, video, etc.
        await messageController.processMessage(from, message, messageType);
      }

      res.sendStatus(200);
    } else {
      // Irrelevant event
      res.sendStatus(200);
    }
  } catch (error) {
    console.error('Error in handleWebhook:', error.message);
    res.sendStatus(500);
  }
};

exports.verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token && mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    // Minimal log
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
};
