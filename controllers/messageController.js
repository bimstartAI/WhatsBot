// controllers/messageController.js

const userState = require('../models/userState');
const whatsappService = require('../services/whatsappService');
const dbService = require('../services/dbService');
const clientWorkflow = require('../workflows/clientWorkflow');
const collaboratorWorkflow = require('../workflows/collaboratorWorkflow');
const { cleanCNPJ } = require('../utils/stringUtils');
const ESCAPE_COMMAND = 'sair';          // ← palavra-chave para reiniciar o fluxo

exports.processMessage = async (from, message, messageType) => {
  try {
    // 1) Garante que exista um estado para este usuário
    if (!userState.hasState(from)) {
      userState.initializeState(from);
    }
    const state = userState.getState(from);

    if (state.flowFinished) {
      console.log(`[processMessage] O fluxo do usuário ${from} já foi finalizado. Aguardando nova interação.`);
      return;
    }
    
    // 2) Atualiza o último momento de interação
    userState.updateLastInteraction(from);

    if (
      messageType === 'text' &&
      (message.text?.body || '').trim().toLowerCase() === ESCAPE_COMMAND
    ) {
      console.log(`[ESCAPE] Usuário ${from} digitou "${ESCAPE_COMMAND}". Resetando fluxo.`);

      // 1) Apaga o estado antigo e cria um novinho em folha
      userState.resetState(from);
      userState.initializeState(from);

      // 2) Envia o mesmo menu interativo de boas-vindas
      const interactiveMenu = {
        type: 'interactive',
        interactive: {
          type: 'list',
          header: { type: 'text', text: 'Seja bem-vindo à Miriad Solutions.' },
          body:   { text: 'Primeiramente, escolha sua opção de atendimento. Caso deseje cancelar ou reiniciar o atendimento, digite *Sair*' },
          footer: { text: 'Use o menu para navegação' },
          action: {
            button: 'Opções',
            sections: [{
              title: 'Atendimento',
              rows: [
                { id: 'clientes',      title: 'Clientes',      description: 'Atendimento ao cliente' },
                { id: 'colaboradores', title: 'Colaboradores', description: 'Atendimento interno' }
              ]
            }]
          }
        }
      };

      await whatsappService.sendInteractiveMessage(from, interactiveMenu);
      return;                              // nada mais a fazer nesta mensagem
    }

    // 3) Verifica se o usuário já foi cumprimentado
    if (!state.greeted) {
      state.greeted = true;

      const interactiveMenu = {
        type: 'interactive',
        interactive: {
          type: 'list',
          header: { type: 'text', text: 'Seja bem-vindo à Miriad Solutions.' },
          body:   { text: 'Primeiramente, escolha sua opção de atendimento. Caso deseje cancelar ou reiniciar o atendimento, digite *Sair*' },
          footer: { text: 'Use o menu para navegação' },
          action: {
            button: 'Opções',
            sections: [
              {
                title: 'Atendimento',
                rows: [
                  { id: 'clientes', title: 'Clientes', description: 'Atendimento ao cliente' },
                  { id: 'colaboradores', title: 'Colaboradores', description: 'Atendimento interno' }
                ]
              }
            ]
          }
        }
      };

      await whatsappService.sendInteractiveMessage(from, interactiveMenu);
      state.waitingForSelection = true;
      return;
    }

    // 4) Se está esperando a seleção do menu inicial
    if (state.waitingForSelection) {
      const msgBody = message.text?.body || '';
      switch (msgBody) {
        case 'clientes':
          await whatsappService.sendMessage(from, 'Por favor, digite o CNPJ para validação.');
          state.currentFlow = 'clientes';
          state.waitingForSelection = false;
          state.awaitingCNPJ = true;
          break;
        case 'colaboradores':
          await whatsappService.sendMessage(from, 'Você selecionou "Atendimento interno". Iniciando...');
          state.currentFlow = 'colaboradores';
          state.waitingForSelection = false;
          await collaboratorWorkflow.start(from, state);
          break;
        default:
          await whatsappService.sendMessage(from, 'Seleção inválida. Escolha uma das opções disponíveis.');
          break;
      }
      return;
    }

    // 5) Se aguardando CNPJ digitado
    if (state.awaitingCNPJ) {
      const cnpjTyped = cleanCNPJ(message.text?.body || '');
      console.log(`CNPJ digitado: ${cnpjTyped}`);

      try {
        // AGORA: esta função lê da planilha em vez de MySQL
        const clientRow = await dbService.getClientByCNPJ(cnpjTyped);
        console.log('Cliente encontrado:', clientRow);

        if (!clientRow) {
          await whatsappService.sendMessage(from, 'CNPJ não encontrado. Por favor, tente novamente.');
        } else {
          state.identifiedCNPJ = cnpjTyped;
          state.awaitingCNPJ = false;
          const companyName = clientRow.nome || 'sua empresa';

          await whatsappService.sendMessage(from, `Olá, bem-vindo(a), ${companyName}!`);

          // Buscar contratos ativos (também no Sheets)
          const activeContracts = await dbService.getActiveContractsByCNPJ(cnpjTyped);
          console.log('Contratos ativos encontrados:', activeContracts);

          if (!activeContracts || activeContracts.length === 0) {
            await whatsappService.sendMessage(from, `Nenhum contrato ativo encontrado para o CNPJ ${cnpjTyped}.`);
          } else if (activeContracts.length === 1) {
            state.selectedContract = activeContracts[0];
            await whatsappService.sendMessage(
              from,
              `Contrato único encontrado (${activeContracts[0].numero}). Iniciando fluxo...`
            );
            await clientWorkflow.start(from, state);
          } else {
            // Menu interativo para escolha do contrato
            const interactiveMenu = {
              type: 'interactive',
              interactive: {
                type: 'list',
                header: { type: 'text', text: 'Seleção de Contrato' },
                body: { text: 'Para qual contrato deseja fazer a solicitação?' },
                action: {
                  button: 'Contratos',
                  sections: [
                    {
                      title: 'Contratos Ativos',
                      rows: activeContracts.map((contract, index) => ({
                        id: `contract_${index}`,
                        title: `${contract.numero}`
                      }))
                    }
                  ]
                }
              }
            };

            await whatsappService.sendInteractiveMessage(from, interactiveMenu);
            state.awaitingContractSelection = true;
          }
        }
      } catch (error) {
        console.error('Erro ao buscar CNPJ:', error.message);
        await whatsappService.sendMessage(from, 'Ocorreu um erro ao processar sua solicitação. Tente novamente.');
      }
      return;
    }

    // 6) Se aguardando a seleção de um contrato
    if (state.awaitingContractSelection) {
      const msgBody = message.text?.body || '';
      const contractIndex = parseInt(msgBody.split('_')[1], 10);

      if (!isNaN(contractIndex)) {
        const activeContracts = await dbService.getActiveContractsByCNPJ(state.identifiedCNPJ);
        if (activeContracts && activeContracts[contractIndex]) {
          state.selectedContract = activeContracts[contractIndex];
          state.awaitingContractSelection = false;
          await whatsappService.sendMessage(
            from,
            `Contrato selecionado: ${state.selectedContract.numero}. Iniciando perguntas...`
          );
          await clientWorkflow.start(from, state);
        } else {
          await whatsappService.sendMessage(from, 'Seleção inválida. Por favor, escolha uma das opções disponíveis.');
        }
      } else {
        await whatsappService.sendMessage(from, 'Seleção inválida. Por favor, escolha uma das opções disponíveis.');
      }
      return;
    }

    // 7) Se já estiver em um fluxo (clientes ou colaboradores)
    if (state.currentFlow === 'clientes') {
      await clientWorkflow.handleMessage(from, message, messageType, state);
    } else if (state.currentFlow === 'colaboradores') {
      await collaboratorWorkflow.handleMessage(from, message.text?.body || '', state);
    } else {
      await whatsappService.sendMessage(from, 'Desculpe, não entendi. Pode repetir?');
    }
  } catch (error) {
    console.error('Error in processMessage:', error.message);
    await whatsappService.sendMessage(from, 'Ocorreu um erro ao processar sua mensagem. Tente novamente.');
  }
};
