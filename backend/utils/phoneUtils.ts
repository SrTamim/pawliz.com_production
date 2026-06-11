/**
 * Normalize a Bangladeshi phone number to 01XXXXXXXXX format.
 * Strips leading +88 or 88 prefixes.
 * e.g. "+8801712345678" → "01712345678"
 *      "8801712345678"  → "01712345678"
 *      "01712345678"    → "01712345678"
 */
export function normalizePhone(phone: string | null | undefined): string {
  const p = (phone || '').trim();
  if (/^\+88(01[3-9]\d{8})$/.test(p)) return p.slice(3);
  if (/^88(01[3-9]\d{8})$/.test(p)) return p.slice(2);
  return p;
}
