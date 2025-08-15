const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { google } = require('googleapis');

// Variáveis de ambiente
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const GOOGLE_DRIVE_KEY_FILE = process.env.GOOGLE_DRIVE_KEY_FILE;
const FOLDER_ID_DEFAULT = process.env.GOOGLE_DRIVE_FOLDER_ID;
const FOLDER_ID_IMAGES = process.env.GOOGLE_DRIVE_FOLDER_ID_IMAGES;
const FOLDER_ID_VIDEOS = process.env.GOOGLE_DRIVE_FOLDER_ID_VIDEOS;

/* ========================================================================
 * 1) uploadMedia: Faz download de uma mídia do WhatsApp e envia ao Drive
 * ======================================================================== */
exports.uploadMedia = async (mediaId, mimeType) => {
  try {
    console.log('[uploadMedia] Iniciando upload. mediaId:', mediaId, 'mimeType:', mimeType);

    // 1. Obter URL da mídia no WhatsApp
    const mediaUrl = await getMediaUrlFromWhatsApp(mediaId);
    console.log('[uploadMedia] mediaUrl obtida:', mediaUrl);

    // 2. Baixar o arquivo para local temporário
    const filePath = await downloadMediaFile(mediaUrl, mimeType, mediaId);
    console.log('[uploadMedia] Arquivo baixado em:', filePath);

    // 3. Determina a pasta do Drive
    let targetFolderId = FOLDER_ID_DEFAULT;
    if (mimeType.startsWith('image/')) {
      targetFolderId = FOLDER_ID_IMAGES;
    } else if (mimeType.startsWith('video/')) {
      targetFolderId = FOLDER_ID_VIDEOS;
    }

    // 4. Autentica no Drive
    const auth = new google.auth.GoogleAuth({
      keyFile: GOOGLE_DRIVE_KEY_FILE,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });

    // 5. Faz o upload
    const fileMetadata = {
      name: path.basename(filePath),
      parents: [targetFolderId],
    };
    const media = {
      mimeType,
      body: fs.createReadStream(filePath),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id',
    });

    const fileId = response.data.id;
    const driveLink = `https://drive.google.com/file/d/${fileId}/view`;
    console.log('[uploadMedia] Upload concluído. fileId:', fileId);

    // 6. Apaga o arquivo local
    fs.unlinkSync(filePath);

    return driveLink;
  } catch (error) {
    console.error('[uploadMedia] Erro ao enviar mídia p/ Drive:', error.message);
    throw error;
  }
};

/* =============================================================================
 * 3) downloadFile: Baixa um arquivo do Drive (por ID) e retorna em Buffer
 * ============================================================================= */
exports.downloadFile = async (fileId) => {
  try {
    console.log('[downloadFile] Iniciando download do arquivo:', fileId);

    // Autenticação no Google Drive
    const auth = new google.auth.GoogleAuth({
      keyFile: GOOGLE_DRIVE_KEY_FILE,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });

    // Verifica se o arquivo existe e obtém metadados
    console.log('[downloadFile] Verificando metadados do arquivo...');
    const fileMetadata = await drive.files.get({
      fileId,
      fields: 'id,name,parents',
    });

    console.log('[downloadFile] Metadados do arquivo:', fileMetadata.data);

    // Baixa o conteúdo do arquivo
    console.log('[downloadFile] Baixando conteúdo do arquivo...');
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    const buffer = Buffer.from(response.data);
    console.log('[downloadFile] Download concluído. Tamanho do Buffer:', buffer.length);
    return buffer;
  } catch (error) {
    console.error('[downloadFile] Erro ao baixar arquivo do Drive:', error.message);
    throw error;
  }
};

/* =============================================================================
 * 4) getLatestPdfInFolder: Retorna o PDF mais recente de uma pasta do Drive
 * ============================================================================= */
exports.getLatestPdfInFolder = async (folderId) => {
  try {
    if (!folderId) {
      console.error('[getLatestPdfInFolder] Nenhuma pasta foi definida para buscar PDFs!');
      return null;
    }

    console.log('[getLatestPdfInFolder] Buscando PDFs na pasta:', folderId);

    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_DRIVE_KEY_FILE,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });

    // Filtrar apenas PDFs na pasta correta e ordenar por data
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/pdf'`,
      orderBy: 'createdTime desc'
    });

    const files = res.data.files;
    if (!files || files.length === 0) {
      console.log('[getLatestPdfInFolder] Nenhum PDF encontrado.');
      return null;
    }

    const { id, name } = files[0];
    console.log('[getLatestPdfInFolder] Arquivo mais recente encontrado:', name, id);
    return { fileId: id, fileName: name };
  } catch (error) {
    console.error('[getLatestPdfInFolder] Erro ao listar arquivos:', error.message);
    throw error;
  }
};

/* =============================================================================
 * FUNÇÕES INTERNAS PARA WHATSAPP (getMediaUrlFromWhatsApp e downloadMediaFile)
 * ============================================================================= */
async function getMediaUrlFromWhatsApp(mediaId) {
  try {
    console.log('[getMediaUrlFromWhatsApp] mediaId:', mediaId);
    const response = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    });
    return response.data.url;
  } catch (error) {
    console.error('[getMediaUrlFromWhatsApp] Erro ao buscar URL da mídia:', error.message);
    throw new Error('Failed to retrieve media URL from WhatsApp');
  }
}

async function downloadMediaFile(mediaUrl, mimeType, mediaId) {
  try {
    console.log('[downloadMediaFile] Baixando mídia:', mediaUrl, mimeType);
    const extension = mimeType.split('/')[1] || 'media';
    const fileName = `${mediaId}.${extension}`;
    const filePath = path.join(__dirname, '../downloads', fileName);

    const response = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    });

    fs.writeFileSync(filePath, response.data);
    console.log('[downloadMediaFile] Arquivo salvo em:', filePath);
    return filePath;
  } catch (error) {
    console.error('[downloadMediaFile] Erro ao baixar mídia do WhatsApp:', error.message);
    throw new Error('Failed to download media file from WhatsApp');
  }
}

/* =============================================================================
 * appendToSheet: Adiciona dados a uma planilha do Google Sheets
 * ============================================================================= */
async function appendToSheet(rows) {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_DRIVE_KEY_FILE,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets'
      ]
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // ID da planilha do Google Sheets
    const spreadsheetId = '1-lvZIzXLn5n5dLocOvLqEE814bHYmmcS6nKEhvJ3CbU';

    // Intervalo da planilha (ex: "Sheet1!B1")
    const range = 'DB!B1';

    // Realiza a adição dos dados
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });

    console.log('[appendToSheet] Dados adicionados à planilha:', result.data.updates);
    return result.data.updates;
  } catch (error) {
    console.error('[appendToSheet] Erro ao adicionar dados à planilha:', error.message);
    throw error;
  }
}

// Exporta a função appendToSheet
exports.appendToSheet = appendToSheet;