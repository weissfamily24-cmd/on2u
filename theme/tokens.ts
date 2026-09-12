// Einzige Quelle für Farben, Typo, Abstände. Siehe design/tokens.md.
export const colors = {
  bg: '#0c0c0c',
  surface: '#161412',
  surface2: '#1f1c19',
  line: '#2a2622',
  text: '#f0ece6',
  text2: '#b8b1a8',
  muted: '#7d766e',
  accent: '#c96a4a',      // Terrakotta — nur Scan-Button, primäre CTA, Herzen, aktive Pins
  accentSoft: '#c4ad8e',  // gedämpftes Gold — kursive Sätze, Warnungen
  ok: '#8fb08a',          // nur „Karte aktuell" und „Besuch bestätigt"
  water: '#1e2a30',
} as const;

export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  serifItalic: 'Lora_400Regular_Italic',
} as const;

export const sizes = {
  placeTitle: 24, screenTitle: 22, feedName: 20, section: 15,
  body: 14, meta: 13, secondary: 12, badge: 11,
} as const;

export const radius = { card: 14, button: 12, pill: 999 } as const;
export const space = { edge: 16, section: 24, inner: 12 } as const;
