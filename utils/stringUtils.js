// utils/stringUtils.js
exports.cleanCNPJ = function (cnpj) {
    return cnpj.replace(/\D/g, ''); // Remove tudo que não for dígito
  };