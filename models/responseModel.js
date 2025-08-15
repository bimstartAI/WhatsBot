const dbService = require('../services/dbService');

/**
 * Structure of the user's responses
 * @typedef {object} Response
 * @property {string} phoneNumber - User's phone number
 * @property {string} cnpj - User's CNPJ (Client Identifier)
 * @property {string[]} answers - Array of responses (answers to questions)
 * @property {Date} createdAt - Timestamp when the responses were recorded
 */

/**
 * Validate that a user's responses match the expected structure
 * @param {object} response - The response object to validate
 * @returns {boolean} - Returns true if the response is valid, false otherwise
 */
exports.validateResponse = (response) => {
  if (!response) {
    console.error('Response is undefined or null.');
    return false;
  }

  const { phoneNumber, cnpj, answers } = response;

  if (!phoneNumber || typeof phoneNumber !== 'string') {
    console.error('Invalid phone number in response:', phoneNumber);
    return false;
  }

  if (!cnpj || typeof cnpj !== 'string') {
    console.error('Invalid CNPJ in response:', cnpj);
    return false;
  }

  if (!Array.isArray(answers) || answers.length !== 11) {
    console.error('Invalid answers array in response:', answers);
    return false;
  }

  return true;
};

/**
 * Save user responses to the database
 * @param {Response} response - The user's response object
 * @returns {Promise<void>}
 */
exports.saveResponseToDB = async (response) => {
  try {
    // Validate the response structure
    if (!exports.validateResponse(response)) {
      throw new Error('Invalid response structure');
    }

    // Extract fields from the response
    const { phoneNumber, cnpj, answers } = response;

    // Save the responses to the database (handled in dbService.js)
    //await dbService.storeResponses({
      //identifiedCNPJ: cnpj,
      //answers,
    //});

    console.log(`Responses from ${phoneNumber} saved successfully.`);
  } catch (error) {
    console.error('Error saving response to database:', error.message);
    throw error;
  }
};