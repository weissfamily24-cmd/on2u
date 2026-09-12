// Karte: Leaflet + OSM (dunkel eingefärbt), Pins nach place_freshness, Suche, Chips, Standort, Bottom-Sheet.
import L from 'leaflet';
import { CATEGORIES, CITY, CITY_CENTER, CITY_RADIUS_KM } from '../config';
import { listPlaces, toMessage, type PlaceWithFreshness } from '../lib/api';
import { BACKEND_HINT, BACKEND_HINT_SUB, backendConfigured } from '../lib/supabase';
import { navigate, type Screen } from '../router';
import { $, $$, badge, distanceLabel, emptyHtml, esc, icons, isFresh, kmBetween, loadingHtml, ratingLabel, toast } from '../ui';

// Stilisierte Ersatzkarte, falls keine Kacheln geladen werden können (offline).
const SVGMAP = `<svg class="svgmap" viewBox="0 0 390 700" preserveAspectRatio="xMidYMid slice"><rect width="390" height="700" fill="#131110"/><path d="M-20 420C80 380 120 470 200 430S330 380 420 410" stroke="#1e2a30" stroke-width="26" fill="none"/><path d="M-20 470C90 440 140 520 220 480S340 430 420 460" stroke="#1e2a30" stroke-width="18" fill="none"/><g stroke="#221f1b" stroke-width="3" fill="none"><path d="M40 0L60 700"/><path d="M130 0L110 700"/><path d="M230 0L250 700"/><path d="M330 0L310 700"/><path d="M0 120L390 140"/><path d="M0 250L390 230"/><path d="M0 560L390 590"/></g></svg>`;

export function pinIcon(name: string, fresh: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="pinx ${fresh ? 'fresh' : 'gray'}"><div class="d"></div><div class="l">${esc(name)}</div></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export function darkTiles(): L.TileLayer {
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
}

export function createMapScreen(root: HTMLElement): Screen {
  root.innerHTML = `
    <div id="map"></div>
    <div class="topbar">
      <label class="search">${icons.search}<input id="q" type="search" placeholder="Restaurants und Bars in ${esc(CITY)}" autocomplete="off" aria-label="Suche"></label>
      <div class="chips" id="chips">
        <button class="chip on" data-f="">Alle</button>
        <button class="chip" data-f="fresh">Karte aktuell</button>
        ${CATEGORIES.map((c) => `<button class="chip" data-f="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
    </div>
    <button class="locate" id="locate" title="Mein Standort" aria-label="Mein Standort" style="top:calc(120px + var(--sat))">${icons.locate}</button>
    <div class="sheet"><div class="handle"></div><h2 id="sheet-h">${esc(CITY)}</h2><div class="cards" id="cards"></div></div>`;

  const cardsEl = $('#cards', root);
  const headEl = $('#sheet-h', root);
  let map: L.Map | null = null;
  let places: PlaceWithFreshness[] = [];
  const markers = new Map<string, L.Marker>();
  let me: { lat: number; lng: number } | null = null;
  let meMarker: L.CircleMarker | null = null;
  let filter = '';
  let query = '';
  let svgFallback = false;
  let loading = false;

  function initMap() {
    if (map) return;
    map = L.map($('#map', root), { zoomControl: false, attributionControl: true }).setView(CITY_CENTER, 15);
    map.attributionControl.setPrefix(''); // kein Leaflet-Logo; OSM-Hinweis bleibt (Lizenz)
    const tiles = darkTiles();
    tiles.on('tileerror', () => {
      if (!svgFallback) {
        svgFallback = true;
        tiles.remove();
        $('#map', root).insertAdjacentHTML('afterbegin', SVGMAP);
      }
    });
    tiles.addTo(map);
  }

  const dist = (p: PlaceWithFreshness) => (me ? kmBetween(me.lat, me.lng, p.lat, p.lng) : 0);
  const distLbl = (p: PlaceWithFreshness) => (me ? distanceLabel(dist(p)) : '');

  function visible(): PlaceWithFreshness[] {
    return places
      .filter((p) => filter === '' || (filter === 'fresh' ? isFresh(p.freshness) : p.category === filter))
      .filter((p) => query === '' || p.name.toLowerCase().includes(query) || (p.category ?? '').toLowerCase().includes(query))
      .sort((a, b) => dist(a) - dist(b));
  }

  function rebuildMarkers() {
    if (!map) return;
    markers.forEach((m) => m.remove());
    markers.clear();
    for (const p of places) {
      const m = L.marker([p.lat, p.lng], { icon: pinIcon(p.name, isFresh(p.freshness)), keyboard: false })
        .on('click', () => navigate(`/place/${encodeURIComponent(p.id)}`));
      markers.set(p.id, m);
    }
  }

  function renderCards() {
    const v = visible();
    const freshCount = v.filter((p) => isFresh(p.freshness)).length;
    headEl.innerHTML = `${me ? 'In deiner Nähe' : esc(CITY)} <small>${v.length} ${v.length === 1 ? 'Ort' : 'Orte'} · ${freshCount} mit aktueller Karte</small>`;
    if (!backendConfigured) {
      cardsEl.innerHTML = emptyHtml(BACKEND_HINT, BACKEND_HINT_SUB, true);
    } else if (loading && !places.length) {
      cardsEl.innerHTML = loadingHtml();
    } else if (!places.length) {
      cardsEl.innerHTML = emptyHtml('Noch kein Lokal in deiner Nähe eingetragen.', 'Kennst du eins? Schlag es vor.', true);
    } else if (!v.length) {
      cardsEl.innerHTML = emptyHtml('Nichts gefunden.', 'Kennst du ein Lokal, das fehlt? Sag uns Bescheid.', true);
    } else {
      cardsEl.innerHTML = v.map((p) => `<button class="card" data-p="${esc(p.id)}">
        <div class="img">${badge(p.freshness)}</div>
        <div class="b"><div class="n">${esc(p.name)}</div>
        <div class="m"><span>${esc(p.category ?? '')}${distLbl(p) ? ' · ' + distLbl(p) : ''}</span><span>♥ ${ratingLabel(p.freshness)}</span></div></div>
      </button>`).join('');
    }
    if (map) {
      const shown = new Set(v.map((p) => p.id));
      markers.forEach((m, id) => { if (shown.has(id)) m.addTo(map!); else m.remove(); });
    }
  }

  async function load(force = false) {
    if (!backendConfigured) { renderCards(); return; }
    loading = true;
    renderCards();
    try {
      places = await listPlaces(force);
      rebuildMarkers();
    } catch (e) {
      toast(toMessage(e));
      if (!places.length) {
        cardsEl.innerHTML = emptyHtml(toMessage(e), undefined, true);
        loading = false;
        return;
      }
    }
    loading = false;
    renderCards();
  }

  $('#chips', root).addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.chip');
    if (!c) return;
    $$('.chip', root).forEach((x) => x.classList.remove('on'));
    c.classList.add('on');
    filter = c.dataset.f ?? '';
    renderCards();
  });

  $<HTMLInputElement>('#q', root).addEventListener('input', (e) => {
    query = (e.target as HTMLInputElement).value.trim().toLowerCase();
    renderCards();
  });

  $('#locate', root).addEventListener('click', () => {
    if (!navigator.geolocation) { toast('Standort nicht verfügbar'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (map) {
          meMarker?.remove();
          meMarker = L.circleMarker([me.lat, me.lng], { radius: 7, color: '#0c0c0c', weight: 2, fillColor: '#f0ece6', fillOpacity: 1 }).addTo(map);
          if (kmBetween(me.lat, me.lng, CITY_CENTER[0], CITY_CENTER[1]) < CITY_RADIUS_KM) map.setView([me.lat, me.lng], 15);
          else toast(`Du bist nicht in ${CITY} — die Karte zeigt ${CITY}.`);
        }
        renderCards();
      },
      () => toast('Standort nicht freigegeben'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });

  window.addEventListener('resize', () => map?.invalidateSize());

  return {
    enter() {
      initMap();
      setTimeout(() => map?.invalidateSize(), 50);
      void load();
    },
  };
}
