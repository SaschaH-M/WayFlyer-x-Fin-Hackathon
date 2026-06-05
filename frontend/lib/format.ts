const NF = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

export const gbp = (n: number) => NF.format(Math.round(n || 0));
export const gbpSigned = (n: number) => (n >= 0 ? "+" : "") + NF.format(Math.round(n || 0));
export const num = (n: number) => new Intl.NumberFormat("en-GB").format(Math.round(n || 0));

export const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const fmtMonth = (s: string) =>
  new Date(s + "-01").toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
