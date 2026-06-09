// Indian Rupee formatting helpers
const FMT = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const FMT_SHORT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function inr(n) {
  if (n == null || isNaN(n)) return "₹0";
  return FMT.format(Math.round(+n));
}
export function inrShort(n) {
  if (n == null || isNaN(n)) return "0";
  return FMT_SHORT.format(Math.round(+n));
}

// Compact lakhs/crores for big numbers - graceful fallback to full INR if small
export function inrCompact(n) {
  if (n == null || isNaN(n)) return "₹0";
  const abs = Math.abs(+n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(abs >= 1e8 ? 1 : 2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(abs >= 1e6 ? 1 : 2)} L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  return inr(n);
}
