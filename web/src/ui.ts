// Kleine UI-Helfer: DOM, Escaping, Toast, Icons, Labels. Kein Framework.
import { freshnessLabel, formatPrice as libFormatPrice } from '../../lib/data/freshness';
import type { Place } from '../../lib/data/types';
import { CITY } from './config';
import type { FreshnessRow } from './lib/api';

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Element fehlt: ${sel}`);
  return el;
};
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T[] =>
  [...root.querySelectorAll<T>(sel)];

/** HTML-Escaping für alles, was aus der Datenbank kommt. */
export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let toastTimer = 0;
export function toast(msg: string): void {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t?.classList.remove('on'), 2600);
}

/* ---------- Icons (Stroke-SVGs wie im Prototyp) ---------- */
export const HEART_PATH = '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z"/>';
export const icons = {
  heart: `<svg viewBox="0 0 24 24">${HEART_PATH}</svg>`,
  play: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  scan: '<svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/></svg>',
  route: '<svg viewBox="0 0 24 24"><path d="M3 11l18-8-8 18-2-8z"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
  video: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h5"/></svg>',
  qr: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM19 14h2M21 19v2M14 19h2v2"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  locate: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg>',
  logout: '<svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  feed: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M10 9l5 3-5 3z"/></svg>',
};

/* ---------- Labels ---------- */
/** „heute bestätigt", „vor 3 Tagen bestätigt" … aus lib/data/freshness (wiederverwendet). */
export function whenLabel(lastConfirmedAt: string | null | undefined): string {
  const confirmations = lastConfirmedAt
    ? [{ id: '', placeId: '', by: 'owner' as const, pricesMatch: true, createdAt: lastConfirmedAt }]
    : [];
  return freshnessLabel({ confirmations } as unknown as Place);
}

export const isFresh = (f: FreshnessRow | null | undefined): boolean => Boolean(f?.is_fresh);

export function badge(f: FreshnessRow | null | undefined): string {
  return isFresh(f) ? '<span class="badge fresh">Karte aktuell</span>' : '<span class="badge old">Karte ungeprüft</span>';
}

export function ratingLabel(f: FreshnessRow | null | undefined): string {
  if (!f || f.avg_hearts === null || f.review_count === 0) return '–';
  return Number(f.avg_hearts).toFixed(1).replace('.', ',');
}

export function formatPrice(cents: number, currency: 'EUR' | 'ALL' = 'EUR'): string {
  return libFormatPrice(cents, currency);
}

/** „vom Inhaber und 4 Gästen" — aus place_freshness. */
export function confirmedBy(f: FreshnessRow): string {
  const g = f.guest_confirmers_7d;
  const guests = g === 1 ? '1 Gast' : `${g} Gästen`;
  if (f.owner_confirmed_7d && g > 0) return `vom Inhaber und ${guests}`;
  if (f.owner_confirmed_7d) return 'vom Inhaber';
  if (g > 0) return `von ${guests}`;
  return '';
}

export const routeUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export function kmBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const x = ((bLat - aLat) * Math.PI) / 180;
  const y = ((bLng - aLng) * Math.PI) / 180;
  const h = Math.sin(x / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function distanceLabel(km: number): string {
  return km < 1 ? `${Math.round(km * 100) * 10} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

export function emptyHtml(text: string, sub?: string, tight = false): string {
  return `<div class="empty${tight ? ' tight' : ''}">${esc(text)}${sub ? `<em>${esc(sub)}</em>` : ''}</div>`;
}

export function loadingHtml(text = 'Lädt …'): string {
  return `<div class="empty tight">${esc(text)}</div>`;
}

export const cityLabel = CITY;

/** Preis-Eingabe „12,90" → Cent. null bei Unsinn. */
export function parsePriceToCents(s: string): number | null {
  const n = Number.parseFloat(s.replace(/\s|€/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
