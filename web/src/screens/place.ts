// Lokal: Hero (Video oder Platzhalter), Meta, Bestätigungs-Block aus place_freshness,
// Speisekarte mit Preisen und Fotos, CTAs, Gäste-Videos, Mini-Karte.
import L from 'leaflet';
import { CITY } from '../config';
import { getPlace, publicUrl, toMessage, type PlaceDetail } from '../lib/api';
import { BACKEND_HINT, BACKEND_HINT_SUB, backendConfigured } from '../lib/supabase';
import { lastTab, savedPlaces } from '../lib/storage';
import { TAB_PATHS, goBack, navigate, type Route, type Screen } from '../router';
import { $, confirmedBy, emptyHtml, esc, formatPrice, icons, isFresh, ratingLabel, routeUrl, toast, whenLabel } from '../ui';
import { darkTiles, pinIcon } from './map';

export function createPlaceScreen(root: HTMLElement): Screen {
  let miniMap: L.Map | null = null;
  let currentId: string | null = null;

  const backBtn = `<button class="back" id="pb" aria-label="Zurück">${icons.back}</button>`;
  const back = () => goBack(TAB_PATHS[lastTab.get()]);

  function destroyMini() {
    miniMap?.remove();
    miniMap = null;
  }

  function renderShell(inner: string) {
    root.innerHTML = `<div class="hero">${backBtn}<div class="play">${icons.play}</div></div><div class="body">${inner}</div>`;
    $('#pb', root).onclick = back;
  }

  function render(p: PlaceDetail) {
    const f = p.freshness;
    const fresh = isFresh(f);
    const hero = p.videos[0];
    const guestVideos = p.videos.filter((v) => v.by === 'guest');
    const who = f ? confirmedBy(f) : '';
    const freshText = fresh
      ? `${whenLabel(f?.last_confirmed_at)}${who ? ' · ' + who : ''}`
      : `${f?.last_confirmed_at ? whenLabel(f.last_confirmed_at) + ' · ' : ''}Preise können abweichen`;

    root.innerHTML = `
      <div class="hero">${backBtn}
        ${hero
          ? `<video src="${esc(publicUrl('videos', hero.path))}" controls playsinline preload="metadata" id="hero-video"></video>`
          : `<div class="play">${icons.play}</div>`}
      </div>
      <div class="body">
        <h1>${esc(p.name)}</h1>
        <div class="meta"><span class="rt">♥ ${ratingLabel(f)}</span><span>${esc(p.category ?? '')}</span>${f?.review_count ? `<span>${f.review_count} ${f.review_count === 1 ? 'Bewertung' : 'Bewertungen'}</span>` : ''}</div>
        ${p.caption ? `<div class="cap">${esc(p.caption)}</div>` : ''}
        <div class="fresh ${fresh ? '' : 'old'}"><span class="ico">${fresh ? icons.check : icons.warn}</span>
          <div><b>${fresh ? 'Speisekarte bestätigt' : 'Karte ungeprüft'}</b><span>${esc(freshText)}</span></div></div>

        <div class="sec"><h3>Speisekarte <span>${p.menu.length} ${p.menu.length === 1 ? 'Eintrag' : 'Einträge'}</span></h3>
          ${p.menu.length
            ? `<div class="menu">${p.menu.map((m) => `<div class="it"><div><div class="d">${esc(m.name)}</div>${m.description ? `<div class="s">${esc(m.description)}</div>` : ''}</div><div class="p">${esc(formatPrice(m.price_cents, m.currency))}</div></div>`).join('')}</div>`
            : `<div class="empty tight" style="text-align:left;padding:12px 0">Noch keine Karte eingetragen.</div>`}
          ${p.photos.length ? `<div class="photos">${p.photos.map((ph) => `<a href="${esc(publicUrl('menu-photos', ph.path))}" target="_blank" rel="noopener"><img src="${esc(publicUrl('menu-photos', ph.path))}" alt="Foto der Speisekarte" loading="lazy"></a>`).join('')}</div>` : ''}
        </div>

        <div class="cta2">
          <button class="btn pri" id="p-scan">${icons.scan}Am Tisch scannen</button>
          <a class="btn sec2" href="${routeUrl(p.lat, p.lng)}" target="_blank" rel="noopener">${icons.route}Route</a>
        </div>
        <button class="btn sec2 full" style="margin-top:10px" id="p-save">${savedPlaces.has(p.id) ? '♥ Gespeichert' : '♡ Merken'}</button>

        <div class="sec"><h3>Von Gästen <span>${guestVideos.length ? `${guestVideos.length} ${guestVideos.length === 1 ? 'Video' : 'Videos'}` : 'Noch keine'}</span></h3>
          <div class="guests">${guestVideos.length
            ? guestVideos.slice(0, 8).map((v) => `<button class="g" data-gv="${esc(publicUrl('videos', v.path))}"><div class="gv"><video src="${esc(publicUrl('videos', v.path))}" muted playsinline preload="metadata"></video><span class="badge fresh">Besuch bestätigt</span></div><div class="gn">Gast</div><div class="gt">${esc(whenLabel(v.created_at).replace(' bestätigt', ''))}</div></button>`).join('')
            : '<div class="empty tight" style="padding:12px 0;text-align:left">Sei die erste Person, die hier scannt.</div>'}</div>
        </div>

        <div class="sec"><h3>Wo</h3><div class="minimap" id="minimap"></div><div class="addr">${esc(p.address)}${p.address.includes(CITY) ? '' : `, ${esc(CITY)}`}</div></div>
      </div>`;

    $('#pb', root).onclick = back;
    $('#p-scan', root).onclick = () => navigate('/scan');
    $('#p-save', root).onclick = () => {
      const on = savedPlaces.toggle(p.id);
      $('#p-save', root).textContent = on ? '♥ Gespeichert' : '♡ Merken';
      toast(on ? 'Gemerkt' : 'Entfernt');
    };
    root.querySelectorAll<HTMLElement>('[data-gv]').forEach((g) => {
      g.onclick = () => {
        const heroEl = $('.hero', root);
        heroEl.innerHTML = `${backBtn}<video src="${esc(g.dataset.gv!)}" controls autoplay playsinline></video>`;
        $('#pb', root).onclick = back;
        root.scrollTop = 0;
      };
    });

    destroyMini();
    miniMap = L.map($('#minimap', root), {
      zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false,
      doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false,
    }).setView([p.lat, p.lng], 16);
    darkTiles().addTo(miniMap);
    L.marker([p.lat, p.lng], { icon: pinIcon(p.name, fresh), interactive: false }).addTo(miniMap);
    setTimeout(() => miniMap?.invalidateSize(), 50);
  }

  return {
    async enter(route: Route) {
      const id = route.params.id;
      if (!id) { back(); return; }
      root.scrollTop = 0;
      destroyMini();
      if (!backendConfigured) { renderShell(emptyHtml(BACKEND_HINT, BACKEND_HINT_SUB)); return; }
      if (currentId !== id) renderShell('<div class="empty tight">Lädt …</div>');
      currentId = id;
      try {
        const p = await getPlace(id);
        if (currentId !== id) return; // inzwischen woanders
        if (!p) { renderShell(emptyHtml('Dieses Lokal gibt es nicht mehr.')); return; }
        render(p);
      } catch (e) {
        renderShell(emptyHtml(toMessage(e)));
      }
    },
    leave() {
      destroyMini();
      root.querySelectorAll('video').forEach((v) => v.pause());
      currentId = null;
    },
  };
}
