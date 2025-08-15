// dbService.js

const mysql = require('mysql2/promise');
const { google } = require('googleapis');
const { appendToSheet } = require('./googleDriveService');

// ======================================================================
// Se você AINDA quer armazenar algumas infos no MySQL, mantemos o pool:
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'guilherme',
  password: process.env.DB_PASS || '1123',
  database: process.env.DB_NAME || 'miriadclientes',
});

/**
 * Opcional: se você quiser converter links "drive.google.com/file/d/ID/view"
 * em links diretos "drive.google.com/uc?export=view&id=ID"
 */
function convertDriveLinkToDirect(originalLink) {
  if (!originalLink) return '';
  const match = originalLink.match(/\/d\/([^/]+)\//);
  if (!match) return originalLink;
  const fileId = match[1];
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/**
 * 1) getClientByCNPJ
 *    -> Agora consulta na planilha "DATABASE_PROJETOS!A:L" em vez do MySQL.
 *    -> Coluna A (índice 0) = CNPJ
 *    -> Supondo que coluna B (índice 1) é o nome do cliente
 */
exports.getClientByCNPJ = async (cnpj) => {
  try {
    console.log(`Buscando cliente com CNPJ: ${cnpj} na planilha (getClientByCNPJ)...`);

    // Autenticação no Google
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_DRIVE_KEY_FILE,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Parâmetros de planilha
    const spreadsheetId = '1-lvZIzXLn5n5dLocOvLqEE814bHYmmcS6nKEhvJ3CbU';
    const range = 'DATABASE_PROJETOS!A:L'; // Mesma aba que você já usa

    // Lê todos os valores da aba
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      console.log('Nenhum dado encontrado na planilha (getClientByCNPJ).');
      return null;
    }

    // Busca a primeira linha onde a coluna A (índice 0) coincide com o CNPJ procurado
    const foundRow = rows.find(row => row[0] === cnpj);
    if (!foundRow) {
      console.log(`CNPJ ${cnpj} não encontrado na planilha (getClientByCNPJ).`);
      return null;
    }

    // Se a coluna B (índice 1) tem o nome do cliente, pegamos essa info:
    const nomeCliente = foundRow[1] || 'Cliente';

    // Retorna objeto no mesmo formato que seu código atual espera
    return { nome: nomeCliente };
  } catch (error) {
    console.error('Erro ao buscar CNPJ na planilha (getClientByCNPJ):', error.message);
    throw new Error('Falha ao buscar dados do cliente na planilha.');
  }
};

/**
 * 2) getCompanyByCNPJ
 *    -> Se você usa essa função em outro local e quer também puxar da planilha,
 *       basta replicar a mesma lógica do getClientByCNPJ (ou removê-la se não usa).
 */
exports.getCompanyByCNPJ = async (cnpj) => {
  try {
    // Exatamente a mesma lógica que acima, mas devolvendo "nome" ou algo.
    // Se não usa esta função, pode remover.
    console.log(`Buscando nome da empresa (getCompanyByCNPJ) na planilha...`);

    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_DRIVE_KEY_FILE,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1-lvZIzXLn5n5dLocOvLqEE814bHYmmcS6nKEhvJ3CbU';
    const range = 'DATABASE_PROJETOS!A:K';

    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values;

    if (!rows || rows.length === 0) return 'Empresa Desconhecida';

    const foundRow = rows.find(row => row[0] === cnpj);
    if (!foundRow) return 'Empresa Desconhecida';

    return foundRow[1] || 'Empresa Desconhecida';
  } catch (error) {
    console.error('Erro ao buscar empresa na planilha (getCompanyByCNPJ):', error.message);
    throw new Error('Falha ao buscar o nome da empresa na planilha.');
  }
};

/**
 * 3) getActiveContractsByCNPJ
 *    -> Já estava lendo do Sheets, então mantemos como está.
 */
exports.getActiveContractsByCNPJ = async (cnpj) => {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_DRIVE_KEY_FILE,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets'
      ]
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1-lvZIzXLn5n5dLocOvLqEE814bHYmmcS6nKEhvJ3CbU';
    const range = 'DATABASE_PROJETOS!A:L';

    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('Nenhum dado encontrado na planilha (getActiveContractsByCNPJ).');
      return null;
    }

    // Helper para formatar data
    const formatDate = (dateString) => {
      if (!dateString) return 'Data Indisponível';
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR'); // dd/mm/aaaa
    };

    // Filtra linhas onde:
    //  Coluna A (índice 0) = CNPJ
    //  Coluna F (índice 5) = "ATIVO"
    const activeContracts = rows
      .filter(row => row[0] === cnpj && row[5] === 'ATIVO')
      .map(row => ({
        numero: row[8],                // Coluna I (índice 8)
        descricao: row[4],            // Coluna E (índice 4)
        data: formatDate(row[7]),     // Coluna H (índice 7)
        cnpj: row[0],                 // Coluna A (índice 0)
        status: row[5],               // Coluna F (índice 5)
        fotoLink: convertDriveLinkToDirect(row[9]) // Coluna J (índice 9)
      }));

    return activeContracts.length > 0 ? activeContracts : null;
  } catch (error) {
    console.error('Erro ao buscar contratos na planilha:', error.message);
    throw new Error('Falha ao buscar contratos ativos na planilha.');
  }
};

/**
 * 4) storeResponses
 *    -> Continua armazenando no MySQL (se você ainda quiser).
 *       E depois envia para Sheets (appendToSheet).
 */
exports.storeResponses = async (state) => {
  try {
    if (state.occurrences && state.occurrences.length) {
      for (const p of state.occurrences) {
        const rowData = [
          new Date().toISOString(),
          state.conversationId,
          state.expectedPoints ?? '',
          state.identifiedCNPJ || '',
          state.answers[0]  || '',    // e-mail
          state.answers[1]  || '',    // horário
          p.local       || '',
          p.elemento    || '',
          p.jaTeveProblema || '',
          p.video       || '',
          Array.isArray(p.imagens) ? p.imagens.join('; ') : (p.imagens || ''), // FOTOS agora antes
          p.adesivo     || '',    // ADESIVO depois
          p.comentario  || '',
          state.answers[11] || ''     // responsável
        ];
        await appendToSheet([rowData]);    // mesma função que você já usa
      }
      return;                              // nada mais a fazer
    }
    
    const query = `
      INSERT INTO responses 
        (cnpj, email, horario, local, elemento, jaTeveProblema, video, imagens, comentario, responsavel) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      cnpj,
      email,
      horario,
      local,
      elemento,
      jaTeveProblema,
      video,
      imagens,
      comentario,
      responsavel
    ];

    // Envia também para o Google Sheets
    const timestamp = new Date().toISOString();
    const rowData = [timestamp, ...values];

    console.log('[storeResponses] Enviando dados para Google Sheets...');
    await appendToSheet([rowData]);
    console.log('[storeResponses] Dados enviados à planilha.');

    //connection.release();
  } catch (error) {
    console.error('[storeResponses] Erro ao armazenar respostas:', error.message);
    throw error;
  }
};