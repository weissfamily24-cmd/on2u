// Gespeichert: Ids aus localStorage, Daten aus der API.
import { listPlaces, toMessage } from '../lib/api';
import { BACKEND_HINT, BACKEND_HINT_SUB, backendConfigured } from '../lib/supabase';
import { savedPlaces } from '../lib/storage';
import type { Screen } from '../router';
import { $, emptyHtml, esc, icons, isFresh, loadingHtml, whenLabel } from '../ui';

export function createSavedScreen(root: HTMLElement): Screen {
  root.innerHTML = `<div class="page narrow"><h1>Gespeichert</h1><div class="sub">Deine Lokale, auch ohne Netz</div><div id="saved-list"></div></div>`;
  const list = $('#saved-list', root);

  async function render() {
    const ids = savedPlaces.all();
    if (!ids.length) {
      list.innerHTML = emptyHtml('Noch nichts gespeichert.', 'Tippe auf der Karte oder im Feed auf „Merken".');
      return;
    }
    if (!backendConfigured) { list.innerHTML = emptyHtml(BACKEND_HINT, BACKEND_HINT_SUB); return; }
    list.innerHTML = loadingHtml();
    try {
      const places = await listPlaces();
      const rows = ids.map((id) => places.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
      list.innerHTML = rows.length
        ? rows.map((p) => `<button class="row" data-p="${esc(p.id)}"><span class="ic ${isFresh(p.freshness) ? 'fresh' : ''}">${icons.heart}</span><span class="t"><b>${esc(p.name)}</b><span>${esc(p.category ?? '')} · ${esc(whenLabel(p.freshness?.last_confirmed_at))}</span></span><span class="chev">›</span></button>`).join('')
        : emptyHtml('Deine gespeicherten Lokale gibt es nicht mehr.');
    } catch (e) {
      list.innerHTML = emptyHtml(toMessage(e), 'Gerade kein Netz? Deine Liste bleibt auf dem Gerät.');
    }
  }

  return { enter() { void render(); } };
}
