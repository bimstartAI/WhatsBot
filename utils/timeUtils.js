// utils/timeUtils.js

exports.getTimeBasedGreeting = () => {
  const currentHour = new Date().getHours();
  if (currentHour >= 5 && currentHour < 12) {
    return "Olá, bom dia! Primeiramente, informe o CNPJ para o qual deseja atendimento.";
  } else if (currentHour >= 12 && currentHour < 18) {
    return "Olá, boa tarde! Primeiramente, informe o CNPJ para o qual deseja atendimento.";
  } else {
    return "Olá, boa noite! Primeiramente, informe o CNPJ para o qual deseja atendimento.";
  }
};
