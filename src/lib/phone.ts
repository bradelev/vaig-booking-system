/** Strip country code 598 (Uruguay) prefix if present, keep digits only */
export function normalizePhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("598") && digits.length === 11) return digits.slice(3);
  return digits;
}
