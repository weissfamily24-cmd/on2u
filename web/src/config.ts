// Einzige Stelle, an der der Arbeitstitel steht. Jeder UI-Text nutzt APP_NAME.
export const APP_NAME = 'ON2U Eats';
export const APP_TAGLINE = 'Echte Preise.';

// Testregion für Schritt 1. Startansicht der Karte und Default-Position neuer Lokale.
export const CITY = 'Bamberg';
export const CITY_CENTER: [number, number] = [49.8917, 10.8917];
export const CITY_RADIUS_KM = 30;

// Kategorien wie im Schema-Vertrag (places.category).
export const CATEGORIES = ['Fränkisch', 'Café', 'Italienisch', 'Bar', 'Imbiss'] as const;

// Tags für die Bewertung (reviews.tags).
export const TAGS = ['Freundlich', 'Schnell', 'Gutes Bier', 'Für Kinder', 'Draußen sitzen', 'Laut'] as const;

// Öffentliche URL der App. Steht im QR-Code ({APP_URL}/scan?t=TOKEN) und im Magic-Link-Redirect.
export const APP_URL: string =
  (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') || window.location.origin;

export const MAX_VIDEO_MB = 50;
export const MAX_PHOTO_MB = 10;
export const MAX_TABLES = 100;
