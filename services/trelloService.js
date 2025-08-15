const axios = require('axios');

// Read Trello config from environment variables
const TRELLO_KEY = process.env.TRELLO_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const TRELLO_LIST_ID = process.env.TRELLO_LIST_ID;

/**
 * Create a Trello card in the specified list.
 *
 * @param {string} cardTitle - The title for the Trello card
 * @param {string} cardDesc - The description for the Trello card
 * @param {string} email - The requester's email
 * @param {string} phone - The requester's phone
 * @returns {Promise<Object>} - The created Trello card data
 * @throws {Error} - If the API request fails
 */
exports.createTrelloCard = async (cardTitle, cardDesc, email, phone) => {
  // Validate environment variables
  if (!TRELLO_KEY || !TRELLO_TOKEN || !TRELLO_LIST_ID) {
    throw new Error('Missing Trello configuration. Ensure TRELLO_KEY, TRELLO_TOKEN, and TRELLO_LIST_ID are set in your environment variables.');
  }

  try {
    const url = 'https://api.trello.com/1/cards';

    // Prepare query parameters for the Trello API
    const params = {
      key: TRELLO_KEY,
      token: TRELLO_TOKEN,
      idList: TRELLO_LIST_ID,
      name: cardTitle,  // The card's title
      desc: `${cardDesc}
      📧 E-mail do solicitante: ${email || 'Não informado'}
      📞 Telefone do solicitante: ${phone || 'Não informado'}`
    };

    // Send a POST request to Trello with the query params
    const response = await axios.post(url, null, { params });

    // Log success (optional)
    console.log('Trello card created successfully:', response.data);

    // Return the created card data (optional)
    return response.data;
  } catch (error) {
    // Log detailed error information
    console.error('Error creating Trello card:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    // Throw a more descriptive error
    throw new Error(`Failed to create Trello card: ${error.message}`);
  }
};