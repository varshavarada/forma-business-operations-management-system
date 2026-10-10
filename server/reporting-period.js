const offset = 330 * 60000;
export const businessMonth = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(date);

// Calendar arithmetic is UTC-based, then shifted to Kolkata midnight (no DST).
export function sixMonthPeriod(month = businessMonth(new Date())) {
  const [year, number] = month.split('-').map(Number);
  const months = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(year, number - 6 + i, 1)).toISOString().slice(0, 7));
  return { months, from: new Date(Date.UTC(year, number - 6, 1) - offset), to: new Date(Date.UTC(year, number, 1) - offset) };
}

export function monthlyBuckets(rows, months) {
  const totals = new Map(rows.map(row => [row._id, row.total]));
  return months.map(month => ({ _id: month, total: totals.get(month) || 0 }));
}
