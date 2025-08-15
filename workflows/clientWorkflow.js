// clientWorkflow.js

const whatsappService = require('../services/whatsappService');
const dbService = require('../services/dbService');
const googleDriveService = require('../services/googleDriveService');
const trelloService = require('../services/trelloService');
const { sendEmail } = require('../services/emailService');

const { getLatestPdfInFolder, downloadFile } = require('../services/googleDriveService');
const userState = require('../models/userState'); // Para resetar estado

// ------------------------------------------------------
// Funções auxiliares de validação
// ------------------------------------------------------
function isValidEmail(str) {
  // Regex simples para validar e-mail (não é perfeito, mas cobre grande parte dos casos)
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(str.toLowerCase());
}

function isHourValid(str) {
  // Tenta extrair um número inteiro; se for 0-23, ok
  const hour = parseInt(str, 10);
  if (Number.isNaN(hour)) return false;
  return hour >= 0 && hour < 24;
}

// ------------------------------------------------------
// Função auxiliar para aguardar alguns milissegundos
// ------------------------------------------------------
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ------------------------------------------------------
// Lista de perguntas (índices 0-11)
// ----------------------------------------------------------------
const questions = [
  /* 0 */ "Por favor, informe seu e-mail de contato.",
  /* 1 */ "Qual o horário em que foi verificado o problema?",
  /* 2 */ "Por favor, informe o número de pontos de infiltração encontrados.",
  /* 3 */ "Identifique o local do ponto (eixos, ambiente, etc.).",
  /* 4 */ "É possível identificar o elemento que apresenta problema?",
  /* 5 */ "Esse elemento já apresentou problemas anteriormente? Se sim, quais?",
  /* 6 */ "Envie um *vídeo* curto (~20 s) do ponto de infiltração.",
  /* 7 */ "Envie *foto(s)* do ponto de infiltração. Após enviar todas, digite \"ok\".",
  /* 8 */ "Qual a descrição da *numeração* do adesivo em questão?",
  /* 9 */ "Deseja adicionar comentário adicional?",
  /*10 */ "Você quer adicionar outro ponto? (responda *sim* ou *não*)",
  /*11 */ "Nome completo do responsável pelo chamado."
];

// ------------------------------------------------------
// Inicia o fluxo (Chamado quando o usuário escolhe 'clientes')
// ------------------------------------------------------
exports.start = async (from, state) => {
  if (!state.selectedContract) {
    await whatsappService.sendMessage(from, 'Erro: Nenhum contrato selecionado');
    return;
  }

  // Reinicia/reseta as respostas e a flag de finalização
  state.answers = [];
  state.questionIndex = 0;
  state.occurrences = [];
  state.expectedPoints = null;   // novo
  state.isFinalizing = false; // flag para evitar finalização duplicada
  // Guarda o contrato selecionado como primeira "resposta"
  state.answers.push(state.selectedContract);

  // Pergunta inicial (idx 0)
  await whatsappService.sendMessage(from, questions[0]);
};

// ------------------------------------------------------
// Lida com cada mensagem do usuário dentro do fluxo
// ------------------------------------------------------
// clientWorkflow.js

exports.handleMessage = async (from, message, messageType, state) => {
  try {
    const idx = state.questionIndex;

    // ---------------------------------------------
    // Pergunta #2 – Número de pontos de infiltração
    // ---------------------------------------------
    if (idx === 2) {
      const n = parseInt((message.text?.body || '').trim(), 10);
      if (isNaN(n) || n <= 0) {
        await whatsappService.sendMessage(
          from, "Digite apenas o número de pontos de infiltração (ex.: 3)"
        );
        return;
      }
      state.expectedPoints = n;
      state.questionIndex++; // avança para #3
      
      // Envia a foto antes da pergunta 3
      const photoLink = state.selectedContract?.fotoLink;
      if (photoLink) {
        await whatsappService.sendImage(from, photoLink, 'Foto de referência para os eixos:');
      }
      
      await whatsappService.sendMessage(from, questions[state.questionIndex]);
      return;
    }

    // ---------------------------------------------
    // Pergunta #4 – "Elemento que apresenta problema?"
    // ---------------------------------------------
    if (idx === 4) {
      if (['não', 'nao'].includes(message.text?.body.toLowerCase())) {
        // Se a resposta for "não", pula para o vídeo (#6), ignorando a próxima pergunta.
        state.answers[4] = 'Não se aplica'; // Preenche a resposta #4
        state.answers[5] = 'Não se aplica'; // Preenche a resposta #5
        state.questionIndex = 6;            // pula diretamente para a pergunta #6 (vídeo)
        await whatsappService.sendMessage(from, questions[6]);
        return;
      }
    }

    // ---------------------------------------------
    // Pergunta #6 – Vídeo
    // ---------------------------------------------
    if (idx === 6 && messageType === 'video') {
      const mediaId = message.video?.id;
      const mimeType = message.video?.mime_type;
      if (!mediaId || !mimeType) {
        await whatsappService.sendMessage(from, 'Vídeo inválido. Reenvie, por favor.');
        return;
      }

      // Upload para Google Drive
      const videoLink = await googleDriveService.uploadMedia(mediaId, mimeType);
      state.answers[idx] = videoLink;

      // Passa para a próxima pergunta
      state.questionIndex++;
      await whatsappService.sendMessage(from, questions[state.questionIndex]);
      return;
    }

    // ---------------------------------------------
    // Pergunta #7 – Fotos
    // ---------------------------------------------
    if (idx === 7) {
      if (messageType === 'image') {
        const mediaId = message.image?.id;
        const mimeType = message.image?.mime_type;
        if (!mediaId || !mimeType) {
          await whatsappService.sendMessage(from, 'Imagem inválida. Reenvie, por favor.');
          return;
        }

        // Upload para Google Drive
        const imageLink = await googleDriveService.uploadMedia(mediaId, mimeType);

        // Salva cada imagem em um array
        state.answers[idx] = state.answers[idx] || [];
        state.answers[idx].push(imageLink);

        if (state.answers[idx].length === 1) {
          await whatsappService.sendMessage(from, 'Imagem recebida! Envie outra ou digite "ok" para continuar.');
        }
        return;
      }

      // Se o usuário digitar "ok", avança para a próxima pergunta
      if (messageType === 'text' && message.text?.body.toLowerCase() === 'ok') {
        state.questionIndex++;
        await whatsappService.sendMessage(from, questions[state.questionIndex]);
        return;
      }

      // Se ele mandar algo inválido enquanto esperamos mais imagens
      await whatsappService.sendMessage(from, 'Envie mais imagens ou digite "ok" para continuar.');
      return;
    }

    // ---------------------------------------------
    // Pergunta #8 – Descrição do adesivo
    // ---------------------------------------------
    if (idx === 8) {
      state.answers[idx] = message.text?.body.trim();
      state.questionIndex++;                       // avança para a próxima pergunta
      await whatsappService.sendMessage(from, questions[state.questionIndex]);
      return;
    }

    // ---------------------------------------------
    // Pergunta #9 – Comentário adicional
    // ---------------------------------------------
    if (idx === 9) {
      state.answers[idx] = message.text?.body.trim();
      state.questionIndex++;                       // avança para a próxima pergunta
      await whatsappService.sendMessage(from, questions[state.questionIndex]);
      return;
    }

    // ---------------------------------------------
    // Pergunta #10 – Adicionar outro ponto?
    // ---------------------------------------------
    if (idx === 10) {
      const choice = (message.text?.body || '').trim().toLowerCase();
    
      // guarda o ponto que acabamos de coletar (#2-#7)
      const currentPoint = {
        local:          state.answers[3],
        elemento:       state.answers[4],
        jaTeveProblema: state.answers[5],
        video:          state.answers[6],
        imagens:        state.answers[7],  // fotos vêm primeiro
        adesivo:        state.answers[8],  // depois a descrição
        comentario:     state.answers[9]
      };
      state.occurrences.push(currentPoint);
    
      if (['sim', 's', 'yes', '1'].includes(choice)) {
        // limpa slots #2-#7 para o próximo ponto
        state.answers[3] = state.answers[4] = state.answers[5] =
        state.answers[6] = state.answers[7] = state.answers[8] = state.answers[9] = null;
    
        state.questionIndex = 3;                     // volta para a pergunta #3 (local)
        await whatsappService.sendMessage(from, questions[3]);
        return;
      }
    
      if (['nao', 'não', 'n', 'no', '2'].includes(choice)) {
        state.questionIndex++;                       // avança para #11 (responsável)
        await whatsappService.sendMessage(from, questions[state.questionIndex]);
        return;
      }
    
      // resposta inválida → pergunta novamente
      await whatsappService.sendMessage(from,
        'Por favor, responda apenas "sim" ou "não". Deseja adicionar outro ponto?');
      return;
    }    

    // ---------------------------------------------
    // Se já estamos finalizando, ignore mensagens duplicadas
    // ---------------------------------------------
    if (state.isFinalizing) {
      console.log("Finalização já está em andamento. Ignorando mensagem duplicada.");
      return;
    }

    // ---------------------------------------------
    // Pergunta #6 => espera vídeo
    // ---------------------------------------------
    if (idx === 6 && messageType === 'video') {
      const mediaId = message.video?.id;
      const mimeType = message.video?.mime_type;
      if (!mediaId || !mimeType) {
        await whatsappService.sendMessage(from, 'Vídeo inválido. Reenvie, por favor.');
        return;
      }

      // Upload para Google Drive
      const videoLink = await googleDriveService.uploadMedia(mediaId, mimeType);
      state.answers[idx] = videoLink;

      // Passa para a próxima pergunta
      state.questionIndex++;
      await whatsappService.sendMessage(from, questions[state.questionIndex]);
      return;
    }

    // ---------------------------------------------
    // Para as demais perguntas, capturamos texto
    // ---------------------------------------------
    const msgBody = message.text?.body?.trim() || '';

    // ---------------------------------------------
    // 1) Validações específicas por pergunta
    // ---------------------------------------------
    if (idx === 0) {
      // "Forneça o endereço de e-mail para contato"
      if (!isValidEmail(msgBody)) {
        await whatsappService.sendMessage(from, 'O e-mail informado não parece válido. Tente novamente.');
        return; // Não avança para a próxima pergunta
      }
    }

    if (idx === 1) {
      // "Qual horário da verificação do problema?"
      if (!isHourValid(msgBody)) {
        await whatsappService.sendMessage(from, 'Por favor, insira um horário válido (ex: 8, 14, 23, etc).');
        return;
      }
    }

    if (idx === 4) {
      // "É possível avaliar qual elemento apresenta o problema? Se sim, qual?"
      if (['não', 'nao'].includes(msgBody.toLowerCase())) {
        state.answers[idx] = msgBody; // Salva a resposta
        state.answers[4] = 'Não se aplica'; // Preenche a resposta #4
        // Pula para a pergunta #6 (vídeo)
        state.questionIndex = 6;
        await whatsappService.sendMessage(from, questions[state.questionIndex]);
        return;
      }
    }

    // ---------------------------------------------
    // 2) Se passou na validação, salva a resposta
    // ---------------------------------------------
    state.answers[idx] = msgBody;

    // ---------------------------------------------
    // 3) Verifica se ainda há perguntas
    // ---------------------------------------------
    if (idx < questions.length - 1) {
      // Avança para a próxima pergunta
      state.questionIndex++;
      await whatsappService.sendMessage(from, questions[state.questionIndex]);
    } else {
      // ---------------------------------------------
      // Fluxo FINALIZADO (última pergunta respondida)
      // ---------------------------------------------
      // Aqui, para evitar duplicação, marcamos o estado como finalizando
      if (state.isFinalizing) {
        console.log("Finalização já está em andamento. Ignorando mensagem duplicada.");
        return;
      }
      state.isFinalizing = true;

      // 1) Salvar respostas no DB
      await dbService.storeResponses(state);

      // 2) Criar card no Trello
      const cnpj = state.identifiedCNPJ || 'Desconhecido';
      const company = await dbService.getClientByCNPJ(cnpj);

      // Formatar data
      const formatDate = (date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      };

      console.log (company);
      const currentDate = new Date();
      const formattedDate = formatDate(currentDate);
      const cardTitle = `Ocorrência ${company.nome} - ${formattedDate}`;
      const cardDesc = state.answers[2] || ''; // "local da ocorrência"
      const email = state.answers[0];
      const phone = from;

      await trelloService.createTrelloCard(cardTitle, cardDesc, email, phone);

      // 3) Aguarda a geração do PDF
      console.log("Start delay");
      
      // ✅ NOVA MENSAGEM AO USUÁRIO
      
      await whatsappService.sendMessage(
        from,
        "Sua solicitação foi cadastrada com sucesso, em breve será gerado um PDF e encaminhado por email. Muito obrigado!"
      );

      await delay(100000); // Aguarda 100 segundos
      console.log("Delay finished after 15 seconds");
      const latest = await getLatestPdfInFolder(process.env.GOOGLE_DRIVE_FOLDER_ID_PDFS);

      if (!latest) {
        await whatsappService.sendMessage(
          from,
          'Respostas registradas, mas nenhum PDF foi encontrado para envio.'
        );
      } else {
        // 4) Baixar o PDF
        const pdfBuffer = await downloadFile(latest.fileId);

        // 5) Enviar por e-mail
        const userEmail = state.answers[0]; // Pergunta #0 => E-mail
        if (userEmail) {
          await sendEmail({
            to: userEmail,
            cc: ['felipelopacinski@miriadsolutions.com', 'contato@miriadsolutions.com'],
            bcc: ['guilhermegiandoni@miriadsolutions.com'],
            subject: 'Confirmação de solicitação de atendimento a ocorrência',
            text: `Prezado(a),

            Segue em anexo a confirmação da abertura do chamado de atendimento a ocorrências.

            Em até 48 horas, nossa equipe entrará em contato para agendar o atendimento.

            Caso haja qualquer dúvida ou necessidade de informações adicionais, estamos à disposição para auxiliá-lo(a) no e-mail contato@miriadsolutions.com

            Atenciosamente,  
            Equipe Miriad Solutions`,
            attachments: [
              {
                filename: latest.fileName || 'Relatorio.pdf',
                content: pdfBuffer
              }
            ]
          });
        }
      }

      // 6) Mensagem final e reset do estado
      await whatsappService.sendMessage(
        from,
        'O PDF foi enviado por e-mail! Obrigado.'
      );

      userState.resetState(from);
    }
  } catch (error) {
    console.error('Erro em clientWorkflow.handleMessage:', error.message);
    await whatsappService.sendMessage(from, 'Ocorreu um erro ao processar suas respostas. Tente novamente.');
  }
};