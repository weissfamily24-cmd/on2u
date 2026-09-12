import type { Place, MenuConfirmation } from './types';

const DAY = 86_400_000;
export const FRESH_WINDOW_DAYS = 7;
export const MAX_MISMATCHES = 3;

/** Regel aus CLAUDE.md: ≥1 Bestätigung in 7 Tagen UND < 3 „Preise stimmen nicht" in 7 Tagen.
 *  Im Backend als SQL-View spiegeln; hier nur für Demo/Offline. */
export function isMenuFresh(confirmations: MenuConfirmation[], now = Date.now()): boolean {
  const recent = confirmations.filter(c => now - Date.parse(c.createdAt) <= FRESH_WINDOW_DAYS * DAY);
  if (recent.length === 0) return false;
  const mismatches = recent.filter(c => !c.pricesMatch).length;
  return mismatches < MAX_MISMATCHES;
}

export function freshnessLabel(place: Place, now = Date.now()): string {
  const last = place.confirmations
    .map(c => Date.parse(c.createdAt)).sort((a, b) => b - a)[0];
  if (!last) return 'noch nicht bestätigt';
  const days = Math.floor((now - last) / DAY);
  if (days === 0) return 'heute bestätigt';
  if (days === 1) return 'gestern bestätigt';
  if (days < 30) return `vor ${days} Tagen bestätigt`;
  const months = Math.floor(days / 30);
  return `vor ${months} ${months === 1 ? 'Monat' : 'Monaten'} bestätigt`;
}

export const formatPrice = (cents: number, currency: 'EUR' | 'ALL' = 'EUR') =>
  currency === 'EUR' ? `${(cents / 100).toFixed(2).replace('.', ',')} €` : `${cents / 100} L`;
