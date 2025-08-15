// models/userState.js

const userStates = {};
const crypto = require('node:crypto');

// Tempo de inatividade para resetar (15 minutos)
const INACTIVITY_TIMEOUT = 15 * 60 * 1000;

/**
 * Função que verifica periodicamente se há usuários inativos
 * e reseta o estado daqueles que ficaram sem interação por 15 min.
 */
function checkInactivity() {
  const now = Date.now();
  for (const user in userStates) {
    const state = userStates[user];
    // Se a diferença entre agora e a última interação for maior que 15 min, reset
    if (state.lastInteraction && (now - state.lastInteraction > INACTIVITY_TIMEOUT)) {
      console.log(`[checkInactivity] Resetando estado do usuário ${user} por inatividade.`);
      delete userStates[user];
    }
  }
}

// Roda a cada 1 minuto
setInterval(checkInactivity, 60 * 1000);

/**
 * Initialize user state
 */
exports.initializeState = (from) => {
  userStates[from] = {
    greeted: false,
    waitingForSelection: false,
    awaitingCNPJ: false,
    awaitingContractSelection: false,
    currentFlow: null,
    identifiedCNPJ: null,
    selectedContract: null,
    answers: [],
    conversationId: crypto.randomUUID(),
    questionIndex: null,
    lastInteraction: Date.now(),
    flowFinished: false // Novo campo para evitar reinício automático
  };
};

exports.hasState = (from) => {
  return Object.prototype.hasOwnProperty.call(userStates, from);
};

exports.getState = (from) => {
  return userStates[from];
};

exports.resetAllStates = () => {
  for (const user in userStates) {
    delete userStates[user];
  }
};

exports.resetState = (from) => {
  if (this.hasState(from)) {
    delete userStates[from];
    console.log(`[resetState] Estado do usuário ${from} reiniciado.`);
  }
};

/**
 * Atualiza o "lastInteraction" para a hora atual
 */
exports.updateLastInteraction = (from) => {
  if (this.hasState(from)) {
    userStates[from].lastInteraction = Date.now();
  }
};

// Arquivo de gerenciamento de estado (ex: userState.js)
function setGreetedState(userState, value) {
  console.log(`Alterando estado 'greeted' para: ${value}`);
  userState.greeted = value;
}

function setProcessingState(userState, value) {
  console.log(`Alterando estado 'isProcessing' para: ${value}`);
  userState.isProcessing = value;
}