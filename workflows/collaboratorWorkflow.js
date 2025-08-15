const whatsappService = require('../services/whatsappService');

/**
 * Start the "Colaboradores" workflow
 * @param {string} from - The user's phone number
 * @param {object} state - The user's state
 */
exports.start = async (from, state) => {
  await whatsappService.sendMessage(from, 'O fluxo de "Atendimento interno" ainda está em desenvolvimento.');
};

/**
 * Handle messages within the "Colaboradores" workflow
 * @param {string} from - The user's phone number
 * @param {string} msgBody - The user's response
 * @param {object} state - The user's state
 */
exports.handleMessage = async (from, msgBody, state) => {
  await whatsappService.sendMessage(from, 'Ainda estamos implementando este fluxo. Por favor, tente novamente mais tarde.');
};