// Kleiner Pfad-Router (History API). Pfade statt Hash, damit Deep-Links wie
// /scan?t=TOKEN und /auth/callback funktionieren.
import type { TabName } from './lib/storage';

export type RouteName = TabName | 'place' | 'auth';

export interface Route {
  name: RouteName;
  params: Record<string, string>;
  query: URLSearchParams;
  path: string;
}

export interface Screen {
  /** Wird beim Anzeigen aufgerufen (auch erneut, wenn die Route sich ändert). */
  enter(route: Route): void | Promise<void>;
  /** Wird beim Verlassen aufgerufen (Kamera aus, Videos pausieren …). */
  leave?(): void;
}

export const TAB_PATHS: Record<TabName, string> = {
  map: '/', feed: '/feed', scan: '/scan', saved: '/saved', prof: '/profile',
};

export function parseRoute(loc: { pathname: string; search: string } = window.location): Route {
  const path = loc.pathname.replace(/\/+$/, '') || '/';
  const query = new URLSearchParams(loc.search);
  const base = { params: {}, query, path: path + loc.search };
  if (path === '/') return { name: 'map', ...base };
  if (path === '/feed') return { name: 'feed', ...base };
  if (path === '/scan') return { name: 'scan', ...base };
  if (path === '/saved') return { name: 'saved', ...base };
  if (path === '/profile' || path === '/profil') return { name: 'prof', ...base };
  if (path === '/auth/callback') return { name: 'auth', ...base };
  const place = path.match(/^\/place\/([^/]+)$/);
  if (place) return { name: 'place', ...base, params: { id: decodeURIComponent(place[1]) } };
  return { name: 'map', ...base };
}

let handler: ((route: Route) => void) | null = null;

export function onRoute(fn: (route: Route) => void): void {
  handler = fn;
  window.addEventListener('popstate', () => handler?.(parseRoute()));
}

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const url = new URL(path, window.location.origin);
  const same = url.pathname + url.search === window.location.pathname + window.location.search;
  if (opts.replace || same) history.replaceState({ app: true }, '', url);
  else history.pushState({ app: true }, '', url);
  handler?.(parseRoute());
}

/** Zurück, wenn wir selbst hierher navigiert sind; sonst zum Fallback. */
export function goBack(fallback: string): void {
  if (history.state && (history.state as { app?: boolean }).app && history.length > 1) history.back();
  else navigate(fallback, { replace: true });
}

export const isDesktop = (): boolean => window.innerWidth >= 768;
