// Feriados nacionais fixos do Brasil
const feriadosFixos = [
  { mes: 0, dia: 1 },   // Ano Novo
  { mes: 3, dia: 21 },  // Tiradentes
  { mes: 4, dia: 1 },   // Dia do Trabalho
  { mes: 8, dia: 7 },   // Independência do Brasil
  { mes: 9, dia: 12 },  // Nossa Senhora Aparecida
  { mes: 10, dia: 2 },  // Finados
  { mes: 10, dia: 15 }, // Proclamação da República
  { mes: 11, dia: 25 }  // Natal
];

// Feriados móveis de 2024-2030 (Carnaval, Sexta-feira Santa, Corpus Christi)
const feriadosMoveis = {
  2024: [
    { mes: 1, dia: 13 },  // Carnaval
    { mes: 2, dia: 29 },  // Sexta-feira Santa
    { mes: 4, dia: 30 }   // Corpus Christi
  ],
  2025: [
    { mes: 2, dia: 4 },   // Carnaval
    { mes: 3, dia: 18 },  // Sexta-feira Santa
    { mes: 5, dia: 19 }   // Corpus Christi
  ],
  2026: [
    { mes: 1, dia: 17 },  // Carnaval
    { mes: 3, dia: 3 },   // Sexta-feira Santa
    { mes: 5, dia: 4 }    // Corpus Christi
  ],
  2027: [
    { mes: 1, dia: 9 },   // Carnaval
    { mes: 2, dia: 26 },  // Sexta-feira Santa
    { mes: 4, dia: 27 }   // Corpus Christi
  ],
  2028: [
    { mes: 2, dia: 1 },   // Carnaval
    { mes: 3, dia: 14 },  // Sexta-feira Santa
    { mes: 5, dia: 15 }   // Corpus Christi
  ],
  2029: [
    { mes: 1, dia: 13 },  // Carnaval
    { mes: 2, dia: 30 },  // Sexta-feira Santa
    { mes: 4, dia: 31 }   // Corpus Christi
  ],
  2030: [
    { mes: 2, dia: 5 },   // Carnaval
    { mes: 2, dia: 19 },  // Sexta-feira Santa
    { mes: 4, dia: 20 }   // Corpus Christi
  ]
};

/**
 * Verifica se uma data é um feriado nacional brasileiro
 * @param {Date} date - Data a ser verificada
 * @returns {boolean} - Retorna true se for feriado
 */
export const isFeriado = (date) => {
  const mes = date.getMonth();
  const dia = date.getDate();
  const ano = date.getFullYear();

  // Verifica feriados fixos
  const isFeriadoFixo = feriadosFixos.some(
    feriado => feriado.mes === mes && feriado.dia === dia
  );

  if (isFeriadoFixo) {
    return true;
  }

  // Verifica feriados móveis
  const feriadosDoAno = feriadosMoveis[ano] || [];
  const isFeriadoMovel = feriadosDoAno.some(
    feriado => feriado.mes === mes && feriado.dia === dia
  );

  return isFeriadoMovel;
};

/**
 * Verifica se uma data é um dia útil (não é sábado, domingo ou feriado)
 * @param {Date} date - Data a ser verificada
 * @returns {boolean} - Retorna true se for dia útil
 */
export const isDiaUtil = (date) => {
  const diaDaSemana = date.getDay();

  // Verifica se é sábado (6) ou domingo (0)
  if (diaDaSemana === 0 || diaDaSemana === 6) {
    return false;
  }

  // Verifica se é feriado
  if (isFeriado(date)) {
    return false;
  }

  return true;
};

/**
 * Ajusta uma data para o próximo dia útil se cair em fim de semana ou feriado
 * @param {Date} date - Data original
 * @returns {Date} - Data ajustada para o próximo dia útil
 */
export const ajustarParaDiaUtil = (date) => {
  const dataAjustada = new Date(date);

  // Enquanto não for dia útil, avança para o próximo dia
  while (!isDiaUtil(dataAjustada)) {
    dataAjustada.setDate(dataAjustada.getDate() + 1);
  }

  return dataAjustada;
};

/**
 * Converte string de data DD/MM/YYYY para objeto Date
 * @param {string} dateString - Data no formato DD/MM/YYYY
 * @returns {Date} - Objeto Date
 */
export const parseDateString = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  const parts = dateString.split('/');
  if (parts.length !== 3) {
    return null;
  }

  const dia = parseInt(parts[0], 10);
  const mes = parseInt(parts[1], 10) - 1; // Mês começa em 0
  const ano = parseInt(parts[2], 10);

  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) {
    return null;
  }

  return new Date(ano, mes, dia);
};

/**
 * Converte objeto Date para string no formato DD/MM/YYYY
 * @param {Date} date - Objeto Date
 * @returns {string} - Data no formato DD/MM/YYYY
 */
export const formatDateString = (date) => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }

  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const ano = date.getFullYear();

  return `${dia}/${mes}/${ano}`;
};

/**
 * Ajusta uma data em formato string DD/MM/YYYY para o próximo dia útil
 * @param {string} dateString - Data no formato DD/MM/YYYY
 * @returns {string} - Data ajustada no formato DD/MM/YYYY
 */
export const ajustarDataParaDiaUtil = (dateString) => {
  const date = parseDateString(dateString);

  if (!date) {
    console.error('❌ Data inválida:', dateString);
    return dateString; // Retorna a data original se inválida
  }

  const dataOriginal = new Date(date);
  const dataAjustada = ajustarParaDiaUtil(date);

  // Loga apenas se a data foi alterada
  if (dataOriginal.getTime() !== dataAjustada.getTime()) {
    console.log(`📅 Data ajustada: ${formatDateString(dataOriginal)} → ${formatDateString(dataAjustada)}`);
  }

  return formatDateString(dataAjustada);
};
