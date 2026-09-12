// Einstieg: App-Shell, Tab-Bar, Router, Service Worker.
import 'leaflet/dist/leaflet.css';
import './styles/tokens.css';
import './styles/app.css';

import { APP_NAME, APP_TAGLINE } from './config';
import { lastTab, type TabName } from './lib/storage';
import { TAB_PATHS, isDesktop, navigate, onRoute, parseRoute, type Route, type RouteName, type Screen } from './router';
import { $, $$, esc, icons, toast } from './ui';
import { handleAuthCallback } from './screens/auth';
import { createMapScreen } from './screens/map';
import { createFeedScreen } from './screens/feed';
import { createPlaceScreen } from './screens/place';
import { createScanScreen } from './screens/scan';
import { createSavedScreen } from './screens/saved';
import { createProfileScreen } from './screens/profile';

document.title = APP_NAME;

const brand = APP_NAME.toUpperCase().split(' ').map(esc).join('<br>');

$('#app').innerHTML = `
  <div id="main">
    <section class="screen" id="s-map" aria-label="Karte"></section>
    <section class="screen" id="s-feed" aria-label="Feed"></section>
    <section class="screen rest" id="s-place" aria-label="Lokal"></section>
    <section class="screen" id="s-scan" aria-label="Scan"></section>
    <section class="screen" id="s-saved" aria-label="Gespeichert"></section>
    <section class="screen" id="s-prof" aria-label="Profil"></section>
  </div>
  <nav id="nav">
    <div class="brand">${brand}<em>${esc(APP_TAGLINE)}</em></div>
    <button class="tab" data-s="map">${icons.pin}Karte</button>
    <button class="tab" data-s="feed">${icons.feed}Feed</button>
    <button class="tab scan" data-s="scan"><span class="c">${icons.scan}</span>Scan</button>
    <button class="tab" data-s="saved">${icons.heart}Gespeichert</button>
    <button class="tab" data-s="prof">${icons.user}Profil</button>
  </nav>
  <div class="toast" id="toast"></div>`;

const sections: Record<Exclude<RouteName, 'auth'>, HTMLElement> = {
  map: $('#s-map'), feed: $('#s-feed'), place: $('#s-place'),
  scan: $('#s-scan'), saved: $('#s-saved'), prof: $('#s-prof'),
};

const screens: Record<Exclude<RouteName, 'auth'>, Screen> = {
  map: createMapScreen(sections.map),
  feed: createFeedScreen(sections.feed),
  place: createPlaceScreen(sections.place),
  scan: createScanScreen(sections.scan),
  saved: createSavedScreen(sections.saved),
  prof: createProfileScreen(sections.prof),
};

const active = new Set<Exclude<RouteName, 'auth'>>();

function highlightTab(tab: TabName) {
  $$('.tab').forEach((t) => t.classList.toggle('on', (t as HTMLElement).dataset.s === tab));
}

async function apply(route: Route) {
  if (route.name === 'auth') {
    const { path, ok } = await handleAuthCallback();
    if (!ok) toast('Anmeldung nicht geklappt. Link nochmal anfordern.');
    navigate(path, { replace: true });
    return;
  }

  const tab: TabName = route.name === 'place' ? lastTab.get() : route.name;
  if (route.name !== 'place') lastTab.set(route.name);
  highlightTab(tab);

  // Auf Tablet/Desktop bleibt die Karte unter dem Lokal-Panel sichtbar.
  const wanted = new Set<Exclude<RouteName, 'auth'>>([route.name]);
  if (route.name === 'place' && isDesktop()) wanted.add('map');

  for (const name of active) {
    if (!wanted.has(name)) {
      sections[name].classList.remove('on');
      screens[name].leave?.();
      active.delete(name);
    }
  }
  for (const name of wanted) {
    sections[name].classList.add('on');
    if (name === route.name || !active.has(name)) {
      active.add(name);
      try {
        await screens[name].enter(route);
      } catch (e) {
        console.error(e);
      }
    }
  }
}

onRoute((r) => { void apply(r); });

$$('.tab').forEach((t) => {
  t.addEventListener('click', () => navigate(TAB_PATHS[(t as HTMLElement).dataset.s as TabName]));
});

// Überall: [data-p="id"] öffnet das Lokal.
document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-p]');
  if (el?.dataset.p) navigate(`/place/${encodeURIComponent(el.dataset.p)}`);
});

window.addEventListener('resize', () => {
  // Beim Wechsel Handy ↔ Desktop die Karte unter dem Panel ein-/ausblenden.
  const r = parseRoute();
  if (r.name === 'place') void apply(r);
});

void apply(parseRoute());

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => { /* PWA optional */ });
}
