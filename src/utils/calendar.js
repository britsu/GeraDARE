/**
 * Brazilian calendar utilities with Tocantins holidays and next business day calculation.
 */

// National & State of Tocantins fixed holidays
const FIXED_HOLIDAYS = [
  { month: 1, day: 1, name: 'Confraternização Universal' },
  { month: 4, day: 21, name: 'Tiradentes' },
  { month: 5, day: 1, name: 'Dia do Trabalho' },
  { month: 9, day: 7, name: 'Independência do Brasil' },
  { month: 9, day: 8, name: 'Padroeira do Tocantins (N. Sra. da Natividade)' },
  { month: 10, day: 5, name: 'Criação do Estado do Tocantins' },
  { month: 10, day: 12, name: 'Nossa Senhora Aparecida' },
  { month: 11, day: 2, name: 'Finados' },
  { month: 11, day: 15, name: 'Proclamação da República' },
  { month: 11, day: 20, name: 'Dia da Consciência Negra' },
  { month: 12, day: 25, name: 'Natal' }
];

/**
 * Calculates Easter Sunday for a given year using Meeus/Jones/Butcher algorithm.
 */
function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Gets mobile holidays (Carnival, Good Friday, Corpus Christi) for a given year.
 */
function getMobileHolidays(year) {
  const easter = getEasterSunday(year);

  // Carnival: 47 days before Easter
  const carnival = new Date(easter.getTime() - 47 * 24 * 60 * 60 * 1000);
  // Good Friday (Sexta-feira Santa): 2 days before Easter
  const goodFriday = new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000);
  // Corpus Christi: 60 days after Easter
  const corpusChristi = new Date(easter.getTime() + 60 * 24 * 60 * 60 * 1000);

  return [
    { month: carnival.getUTCMonth() + 1, day: carnival.getUTCDate(), name: 'Carnaval' },
    { month: goodFriday.getUTCMonth() + 1, day: goodFriday.getUTCDate(), name: 'Sexta-feira Santa' },
    { month: corpusChristi.getUTCMonth() + 1, day: corpusChristi.getUTCDate(), name: 'Corpus Christi' }
  ];
}

/**
 * Checks if a date is a holiday.
 */
function isHoliday(year, month, day) {
  const mobile = getMobileHolidays(year);
  const allHolidays = [...FIXED_HOLIDAYS, ...mobile];
  const found = allHolidays.find(h => h.month === month && h.day === day);
  return found || null;
}

/**
 * Parses DD/MM/AAAA string to year, month, day numbers.
 */
function parseBrazilianDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { day, month, year };
}

/**
 * Formats day, month, year to DD/MM/AAAA.
 */
function formatBrazilianDate(day, month, year) {
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${dd}/${mm}/${year}`;
}

/**
 * Checks if date is Saturday (6) or Sunday (0).
 */
function isWeekend(year, month, day) {
  const d = new Date(year, month - 1, day);
  const dayOfWeek = d.getDay();
  if (dayOfWeek === 0) return 'Domingo';
  if (dayOfWeek === 6) return 'Sábado';
  return null;
}

/**
 * Analyzes due date and returns check details, alert, and suggested next business day.
 */
function analyzeDueDate(dateStr) {
  const parsed = parseBrazilianDate(dateStr);
  if (!parsed) {
    return {
      isValid: false,
      error: 'Formato de data inválido. Use DD/MM/AAAA.'
    };
  }

  const { day, month, year } = parsed;
  const normalizedDateStr = formatBrazilianDate(day, month, year);

  const weekendName = isWeekend(year, month, day);
  const holiday = isHoliday(year, month, day);

  const isNonBusinessDay = !!(weekendName || holiday);

  let reason = [];
  if (weekendName) reason.push(weekendName);
  if (holiday) reason.push(`Feriado: ${holiday.name}`);

  let suggestedNextBusinessDay = null;
  if (isNonBusinessDay) {
    // Find next business day
    let curr = new Date(year, month - 1, day);
    while (true) {
      curr.setDate(curr.getDate() + 1);
      const cYear = curr.getFullYear();
      const cMonth = curr.getMonth() + 1;
      const cDay = curr.getDate();
      if (!isWeekend(cYear, cMonth, cDay) && !isHoliday(cYear, cMonth, cDay)) {
        suggestedNextBusinessDay = formatBrazilianDate(cDay, cMonth, cYear);
        break;
      }
    }
  }

  const competencia = calculateCompetence(normalizedDateStr);
  const competenceMonthYearFolder = competencia ? competencia.replace('/', '-') : `${String(month).padStart(2, '0')}-${year}`;
  const dueDateMonthYear = `${String(month).padStart(2, '0')}-${year}`;

  return {
    isValid: true,
    day,
    month,
    year,
    dateStr: normalizedDateStr,
    competencia,
    competenceMonthYearFolder,
    dueDateMonthYear,
    monthYearFolder: competenceMonthYearFolder, // Regra: a pasta deve ser sempre o mês da competência (ex: 08-2026)
    isNonBusinessDay,
    reason: reason.join(', '),
    suggestedNextBusinessDay,
    alert: isNonBusinessDay 
      ? `Atenção: A data informada (${normalizedDateStr}) cai em ${reason.join(', ')}. Sugestão de próximo dia útil: ${suggestedNextBusinessDay}. A data original será mantida a menos que você opte pela sugestão.`
      : null
  };
}

/**
 * Calculates the reference period / competence (MM/AAAA) based on due date.
 * Rule: Competence is always ONE MONTH BEFORE the due date month.
 * e.g., Due date in 09/2026 -> Competence is 08/2026.
 * e.g., Due date in 01/2027 -> Competence is 12/2026.
 */
function calculateCompetence(dueDateStr) {
  const parsed = parseBrazilianDate(dueDateStr);
  if (!parsed) return '';
  let month = parsed.month;
  let year = parsed.year;
  if (month === 1) {
    month = 12;
    year -= 1;
  } else {
    month -= 1;
  }
  return `${String(month).padStart(2, '0')}/${year}`;
}

module.exports = {
  parseBrazilianDate,
  formatBrazilianDate,
  analyzeDueDate,
  calculateCompetence,
  isHoliday,
  isWeekend
};
