// Indian Rupee formatting helpers
const FMT = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const FMT_SHORT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function inr(n) {
  if (n == null || isNaN(n)) return "₹0";
  const val = Math.round(+n);
  if (val < 0) {
    return `(${FMT.format(Math.abs(val))})`;
  }
  return FMT.format(val);
}
export function inrShort(n) {
  if (n == null || isNaN(n)) return "0";
  const val = Math.round(+n);
  if (val < 0) {
    return `(${FMT_SHORT.format(Math.abs(val))})`;
  }
  return FMT_SHORT.format(val);
}

// Compact lakhs/crores for big numbers - graceful fallback to full INR if small
export function inrCompact(n) {
  if (n == null || isNaN(n)) return "₹0";
  const abs = Math.abs(+n);
  const isNegative = n < 0;
  let result = "";
  if (abs >= 1e7) {
    result = `₹${(abs / 1e7).toFixed(abs >= 1e8 ? 1 : 2)}Cr`;
  } else if (abs >= 1e5) {
    result = `₹${(abs / 1e5).toFixed(abs >= 1e6 ? 1 : 2)}L`;
  } else if (abs >= 1e3) {
    result = `₹${(abs / 1e3).toFixed(1)}K`;
  } else {
    result = FMT.format(Math.round(abs));
  }
  return isNegative ? `(${result})` : result;
}
