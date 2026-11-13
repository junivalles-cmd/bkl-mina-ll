const usd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const dinero = (n: number) => usd.format(n);
export const horas = (n: number) => (Math.round(n * 10) / 10).toString();
