// Lokaler Zustand auf dem Gerät (localStorage), immer mit try/catch.
const PREFIX = 'on2ueats:';

export function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function set(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* z. B. privater Modus — dann eben nicht gespeichert */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignorieren */
  }
}

/** Id-Menge (gespeicherte Lokale, Herzen im Feed). */
function idSet(key: string) {
  return {
    all(): string[] {
      return get<string[]>(key, []);
    },
    has(id: string): boolean {
      return this.all().includes(id);
    },
    /** Gibt zurück, ob die Id danach enthalten ist. */
    toggle(id: string): boolean {
      const s = new Set(this.all());
      const on = !s.has(id);
      if (on) s.add(id);
      else s.delete(id);
      set(key, [...s]);
      return on;
    },
    clear() {
      remove(key);
    },
  };
}

export const savedPlaces = idSet('saved');
export const likes = idSet('likes');

export type TabName = 'map' | 'feed' | 'scan' | 'saved' | 'prof';
export const lastTab = {
  get: (): TabName => get<TabName>('lastTab', 'map'),
  set: (t: TabName) => set('lastTab', t),
};

/** Pfad, zu dem nach dem Magic-Link zurückgesprungen wird. */
export const returnTo = {
  get: () => get<string | null>('returnTo', null),
  set: (path: string) => set('returnTo', path),
  clear: () => remove('returnTo'),
};

/** Gescannter Token, der auf die Anmeldung wartet. */
export const pendingToken = {
  get: () => get<string | null>('pendingToken', null),
  set: (t: string) => set('pendingToken', t),
  clear: () => remove('pendingToken'),
};

export type ProfileMode = 'guest' | 'owner';
export const profileMode = {
  get: (): ProfileMode => get<ProfileMode>('profileMode', 'guest'),
  set: (m: ProfileMode) => set('profileMode', m),
};
