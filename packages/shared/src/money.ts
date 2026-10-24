/**
 * Formats an amount in paise to a standardized Rupee string with two decimal places.
 * Example: 200 -> "₹2.00", 1250 -> "₹12.50"
 */
export function formatPaiseToRupees(paise: number): string {
  if (!Number.isFinite(paise)) {
    throw new Error('Paise must be a finite number');
  }
  const isNegative = paise < 0;
  const absPaise = Math.abs(Math.round(paise));
  const rupeesPart = Math.floor(absPaise / 100);
  const paisePart = (absPaise % 100).toString().padStart(2, '0');
  return `${isNegative ? '-' : ''}₹${rupeesPart}.${paisePart}`;
}

/**
 * Converts paise to a numeric Rupee value.
 */
export function paiseToRupeeNumber(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * Converts a rupee number or string to integer paise safely avoiding floating point artifacts.
 */
export function rupeesToPaise(rupees: number | string): number {
  const num = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (!Number.isFinite(num)) {
    throw new Error('Invalid rupee value');
  }
  return Math.round(num * 100);
}
