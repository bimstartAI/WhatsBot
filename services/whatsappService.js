// services/whatsappService.js

const axios = require('axios');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v17.0';
const BASE_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${PHONE_NUMBER_ID}`;

/**
 * Envia uma mensagem de texto via WhatsApp.
 * @param {string} to - Número de telefone do destinatário.
 * @param {string} text - Texto da mensagem.
 */
exports.sendMessage = async (to, text) => {
  try {
    if (!to || !text) {
      throw new Error('Número do destinatário e texto da mensagem são obrigatórios.');
    }

    const url = `${BASE_URL}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      text: { body: text },
    };
    const headers = {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    };

    const response = await axios.post(url, payload, { headers });
    return response.data;
  } catch (error) {
    console.error('Erro ao enviar mensagem de texto:', error.response?.data || error.message);
    throw new Error('Falha ao enviar mensagem de texto.');
  }
};

/**
 * Envia uma imagem com legenda via WhatsApp.
 * @param {string} to - Número de telefone do destinatário.
 * @param {string} imageUrl - URL da imagem.
 * @param {string} caption - Legenda da imagem.
 */
exports.sendImage = async (to, imageUrl, caption) => {
  try {
    if (!to || !imageUrl) {
      throw new Error('Número do destinatário e URL da imagem são obrigatórios.');
    }

    // Valida se a URL é válida
    if (!isValidUrl(imageUrl)) {
      throw new Error('URL da imagem inválida.');
    }

    const url = `${BASE_URL}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: {
        link: imageUrl,
        caption: caption || '',
      },
    };

    const headers = {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    };

    const response = await axios.post(url, payload, { headers });
    return response.data;
  } catch (error) {
    console.error('Erro ao enviar imagem:', error.response?.data || error.message);
    throw new Error('Falha ao enviar imagem.');
  }
};

/**
 * Envia uma mensagem interativa (lista ou botões) via WhatsApp.
 * @param {string} to - Número de telefone do destinatário.
 * @param {object} interactiveContent - Conteúdo interativo (lista ou botões).
 */
exports.sendInteractiveMessage = async (to, interactiveContent) => {
  try {
    if (!to || !interactiveContent) {
      throw new Error('Número do destinatário e conteúdo interativo são obrigatórios.');
    }

    const url = `${BASE_URL}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to,
      ...interactiveContent,
    };

    const headers = {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    };

    const response = await axios.post(url, payload, { headers });
    return response.data;
  } catch (error) {
    console.error('Erro ao enviar mensagem interativa:', error.response?.data || error.message);
    throw new Error('Falha ao enviar mensagem interativa.');
  }
};

/**
 * Função auxiliar para validar URLs.
 * @param {string} url - URL a ser validada.
 * @returns {boolean} - Retorna true se a URL for válida, caso contrário, false.
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}