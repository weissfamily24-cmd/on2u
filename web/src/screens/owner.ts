// Inhaber: eigene Lokale, Onboarding in 4 Schritten (Lokal anlegen → Speisekarte → Prüfen → QR drucken),
// später Speisekarte aktualisieren/bestätigen, Video hochladen, QR erneut drucken.
import L from 'leaflet';
import { CATEGORIES, CITY_CENTER, MAX_TABLES } from '../config';
import {
  addOwnerVideo, confirmMenu, createPlace, createQrTokens, getSession, listMenuItems, listMenuPhotos, listOwnPlaces,
  listQrTokens, publicUrl, replaceMenu, toMessage, uploadMenuPhoto,
  type MenuItemInput, type MenuPhotoRow, type PlaceRow, type PlaceWithFreshness, type QrTokenRow,
} from '../lib/api';
import { BACKEND_HINT, BACKEND_HINT_SUB, backendConfigured } from '../lib/supabase';
import { $, $$, centsToInput, emptyHtml, esc, icons, isFresh, loadingHtml, parsePriceToCents, ratingLabel, toast, whenLabel } from '../ui';
import { renderAuthPanel } from './auth';
import { darkTiles, pinIcon } from './map';

const STEP_NAMES = ['Lokal', 'Speisekarte', 'Prüfen', 'QR drucken'];

interface ItemDraft { name: string; price: string; description: string }

let pickMap: L.Map | null = null;

function destroyPickMap() {
  pickMap?.remove();
  pickMap = null;
}

function stepsHtml(n: number): string {
  return `<div class="steps">${STEP_NAMES.map((_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}<span>Schritt ${n} von ${STEP_NAMES.length} · ${STEP_NAMES[n - 1]}</span></div>`;
}

function errBox(el: HTMLElement, msg: string | null) {
  const box = el.querySelector<HTMLElement>('.form-err');
  if (!box) return;
  box.textContent = msg ?? '';
  box.classList.toggle('hidden', !msg);
}

/* ---------- Einstieg ---------- */
export async function renderOwnerArea(el: HTMLElement): Promise<void> {
  destroyPickMap();
  if (!backendConfigured) {
    el.innerHTML = `<h1>Mein Restaurant</h1><div class="sub">Für dein Lokal brauchst du ein Konto.</div>${emptyHtml(BACKEND_HINT, BACKEND_HINT_SUB)}`;
    return;
  }
  const session = await getSession();
  if (!session) {
    el.innerHTML = `<h1>Mein Restaurant</h1><div class="sub">Für dein Lokal brauchst du ein Konto.</div><div id="owner-auth"></div>
      <div class="form-hint" style="margin-top:14px">Wer ein Lokal anlegt, ist dessen Inhaber. Speisekarte eintippen oder fotografieren, bestätigen, QR-Codes drucken — fertig in 2 Minuten.</div>`;
    renderAuthPanel($('#owner-auth', el), { title: 'Anmelden', text: 'Ein Link per E-Mail, kein Passwort.', returnPath: '/profile' });
    return;
  }
  await renderOwnerHome(el, session.user.email ?? '');
}

async function renderOwnerHome(el: HTMLElement, email: string) {
  destroyPickMap();
  el.innerHTML = `<h1>Mein Restaurant</h1><div class="sub">${esc(email)}</div><div id="own-list">${loadingHtml()}</div>
    <div class="actions"><button class="btn pri full" id="new-place">${icons.plus}Lokal anlegen</button></div>`;
  $('#new-place', el).onclick = () => startOnboarding(el);
  const list = $('#own-list', el);
  try {
    const places = await listOwnPlaces();
    list.innerHTML = places.length
      ? `<div class="sec"><h3>Deine Lokale</h3>${places.map((p) => `<button class="row" data-own="${esc(p.id)}"><span class="ic ${isFresh(p.freshness) ? 'fresh' : ''}">${isFresh(p.freshness) ? icons.check : icons.warn}</span><span class="t"><b>${esc(p.name)}</b><span>${esc(p.category ?? '')} · ${esc(whenLabel(p.freshness?.last_confirmed_at))}</span></span><span class="chev">›</span></button>`).join('')}</div>`
      : emptyHtml('Noch kein Lokal.', 'Leg dein erstes an — dauert 2 Minuten.');
    $$('[data-own]', list).forEach((b) => {
      b.onclick = () => {
        const p = places.find((x) => x.id === (b as HTMLElement).dataset.own);
        if (p) void renderOwnerPlace(el, p);
      };
    });
  } catch (e) {
    list.innerHTML = emptyHtml(toMessage(e));
  }
}

/* ---------- Verwaltung eines Lokals ---------- */
async function renderOwnerPlace(el: HTMLElement, p: PlaceWithFreshness) {
  destroyPickMap();
  const f = p.freshness;
  const fresh = isFresh(f);
  const days = f?.last_confirmed_at ? Math.floor((Date.now() - Date.parse(f.last_confirmed_at)) / 86_400_000) : null;
  el.innerHTML = `
    <button class="linkbtn" id="own-back">‹ Alle Lokale</button>
    <h1>${esc(p.name)}</h1><div class="sub">${esc(p.category ?? '')} · ${esc(p.address)}</div>
    <div class="stats">
      <div class="stat"><b>${f?.review_count ?? 0}</b><span>Bewertungen</span></div>
      <div class="stat"><b>${ratingLabel(f)}</b><span>♥ im Schnitt</span></div>
      <div class="stat"><b>${f?.confirmations_7d ?? 0}</b><span>Bestätigt, 7 Tage</span></div>
    </div>
    <div class="warn ${fresh ? 'ok' : ''}">${fresh
      ? `<b>Karte ${days === 0 ? 'heute' : days === 1 ? 'seit gestern' : `seit ${days} Tagen`} bestätigt.</b> Wenn du Preise änderst, bestätige die Karte neu, damit der grüne Punkt bleibt.${f && f.mismatches_7d > 0 ? ` <b>${f.mismatches_7d} ${f.mismatches_7d === 1 ? 'Gast meldet' : 'Gäste melden'} abweichende Preise.</b>` : ''}`
      : `<b>Karte ungeprüft.</b> Bestätige die Speisekarte, damit der grüne Punkt kommt.${f && f.mismatches_7d >= 3 ? ' Drei Gäste haben in dieser Woche abweichende Preise gemeldet — Karte prüfen und neu bestätigen.' : ''}`}</div>
    <div class="sec"><h3>Verwalten</h3>
      <button class="row" id="act-menu"><span class="ic">${icons.menu}</span><span class="t"><b>Speisekarte aktualisieren</b><span>Preise ändern, Foto hochladen, dann bestätigen</span></span><span class="chev">›</span></button>
      <button class="row" id="act-confirm"><span class="ic fresh">${icons.check}</span><span class="t"><b>Speisekarte bestätigen</b><span>Die Preise stimmen heute so</span></span><span class="chev">›</span></button>
      <button class="row" id="act-video"><span class="ic">${icons.video}</span><span class="t"><b>Video hochladen</b><span>Küche, Team, Tagesgericht</span></span><span class="chev">›</span></button>
      <button class="row" id="act-qr"><span class="ic">${icons.qr}</span><span class="t"><b>QR-Codes drucken</b><span>Für Tische und Eingang</span></span><span class="chev">›</span></button>
      <button class="row" data-p="${esc(p.id)}"><span class="ic">${icons.pin}</span><span class="t"><b>Wie Gäste es sehen</b><span>Öffentliche Ansicht</span></span><span class="chev">›</span></button>
    </div>
    <div id="own-sub"></div>`;
  const email = (await getSession())?.user.email ?? '';
  $('#own-back', el).onclick = () => void renderOwnerHome(el, email);
  const sub = $('#own-sub', el);
  const back = () => void refresh();
  const refresh = async () => {
    const fresh = (await listOwnPlaces()).find((x) => x.id === p.id);
    if (fresh) void renderOwnerPlace(el, fresh); else void renderOwnerHome(el, email);
  };
  $('#act-menu', el).onclick = () => void renderMenuStep(sub, p, { onDone: () => void renderConfirmStep(sub, p, { onDone: back }), onBack: back, title: 'Speisekarte aktualisieren' });
  $('#act-confirm', el).onclick = async () => {
    const btn = $<HTMLButtonElement>('#act-confirm', el);
    btn.disabled = true;
    try { await confirmMenu(p.id); toast('Bestätigt. Danke.'); await refresh(); }
    catch (e) { toast(toMessage(e)); btn.disabled = false; }
  };
  $('#act-video', el).onclick = () => renderVideoUpload(sub, p, back);
  $('#act-qr', el).onclick = () => void renderQrStep(sub, p, { onDone: back, onBack: back, title: 'QR-Codes drucken' });
}

/* ---------- Onboarding ---------- */
function startOnboarding(el: HTMLElement) {
  renderPlaceStep(el);
}

function renderPlaceStep(el: HTMLElement) {
  destroyPickMap();
  el.innerHTML = `
    <button class="linkbtn" id="ob-cancel">‹ Abbrechen</button>
    <h1>Lokal anlegen</h1>${stepsHtml(1)}
    <form id="place-form" novalidate>
      <label class="field"><span>Name</span><input class="in" name="name" required placeholder="z. B. Zur alten Fähre" autocomplete="organization"></label>
      <label class="field"><span>Art</span><select class="in" name="category">${CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join('')}<option>Sonstiges</option></select></label>
      <label class="field"><span>Adresse</span><input class="in" name="address" required placeholder="Straße und Hausnummer, Ort" autocomplete="street-address"></label>
      <label class="field"><span>Ein Satz über euch (optional)</span><input class="in" name="caption" maxlength="120" placeholder="z. B. Heute Schäufele mit Kloß, solange es reicht."></label>
      <div class="field"><span>Position auf der Karte</span><div class="form-hint" style="margin:0 0 8px">Pin an die Eingangstür ziehen oder auf die Karte tippen.</div><div class="pickmap" id="pickmap"></div><div class="coord" id="coord"></div></div>
      <div class="form-err hidden"></div>
      <div class="actions"><button class="btn pri full" type="submit">Weiter</button></div>
    </form>`;
  $('#ob-cancel', el).onclick = () => void renderOwnerArea(el);

  // Karte mit ziehbarem Pin. Start: Stadtmitte, dann eigener Standort, falls erlaubt.
  const mapEl = $('#pickmap', el);
  const coordEl = $('#coord', el);
  pickMap = L.map(mapEl, { zoomControl: true, attributionControl: true }).setView(CITY_CENTER, 15);
  pickMap.attributionControl.setPrefix('');
  darkTiles().addTo(pickMap);
  const marker = L.marker(CITY_CENTER, { icon: pinIcon('Hier', true), draggable: true, autoPan: true }).addTo(pickMap);
  const showCoord = () => { const ll = marker.getLatLng(); coordEl.textContent = `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`; };
  showCoord();
  marker.on('dragend', showCoord);
  pickMap.on('click', (e: L.LeafletMouseEvent) => { marker.setLatLng(e.latlng); showCoord(); });
  setTimeout(() => pickMap?.invalidateSize(), 50);
  navigator.geolocation?.getCurrentPosition(
    (pos) => {
      if (!pickMap) return;
      const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
      marker.setLatLng(ll);
      pickMap.setView(ll, 17);
      showCoord();
    },
    () => { /* ohne Standort bleibt die Stadtmitte */ },
    { timeout: 6000 },
  );

  const form = $<HTMLFormElement>('#place-form', el);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get('name') ?? '').trim();
    const address = String(fd.get('address') ?? '').trim();
    const category = String(fd.get('category') ?? '').trim();
    const caption = String(fd.get('caption') ?? '').trim();
    if (!name) return errBox(form, 'Wie heißt das Lokal?');
    if (!address) return errBox(form, 'Die Adresse fehlt.');
    errBox(form, null);
    const btn = $<HTMLButtonElement>('button[type=submit]', form);
    btn.disabled = true;
    btn.textContent = 'Speichert …';
    try {
      const ll = marker.getLatLng();
      const place = await createPlace({ name, address, category, caption: caption || null, lat: ll.lat, lng: ll.lng });
      destroyPickMap();
      void renderMenuStep(el, place, {
        onboarding: true,
        onDone: () => void renderConfirmStep(el, place, { onboarding: true, onDone: () => void renderQrStep(el, place, { onboarding: true, onDone: () => void renderOwnerArea(el) }) }),
        onBack: () => void renderOwnerArea(el),
      });
    } catch (ex) {
      errBox(form, toMessage(ex));
      btn.disabled = false;
      btn.textContent = 'Weiter';
    }
  };
}

interface StepOpts { onboarding?: boolean; onDone: () => void; onBack?: () => void; title?: string }

/* ---------- Schritt 2: Speisekarte ---------- */
async function renderMenuStep(el: HTMLElement, place: PlaceRow, opts: StepOpts) {
  destroyPickMap();
  el.innerHTML = `${opts.onBack ? `<button class="linkbtn" id="st-back">‹ Zurück</button>` : ''}
    <h1>${esc(opts.title ?? 'Speisekarte')}</h1>${opts.onboarding ? stepsHtml(2) : `<div class="sub">${esc(place.name)}</div>`}
    <div class="sec"><h3>Gerichte und Preise <span id="item-count"></span></h3><div class="items" id="items"></div>
      <div class="actions" style="margin-top:12px"><button class="btn sec2 full" id="add-item" type="button">${icons.plus}Gericht hinzufügen</button></div></div>
    <div class="sec"><h3>Oder: Karte fotografieren <span id="photo-count"></span></h3>
      <div class="form-hint">Ein Foto reicht fürs Erste. Gäste sehen es unter der Speisekarte.</div>
      <div class="photos" id="photos"></div>
      <button class="vidbtn" id="photo-btn" type="button"><span class="c">${icons.menu}</span><span><b>Foto aufnehmen oder wählen</b><span id="photo-s">JPG oder PNG · max. 10 MB</span></span></button>
      <input type="file" id="photo-file" accept="image/*" capture="environment" class="hidden">
      <div class="progress hidden" id="photo-bar"><i></i></div>
    </div>
    <div class="form-err hidden"></div>
    <div class="actions"><button class="btn pri full" id="menu-next">${opts.onboarding ? 'Weiter' : 'Speichern'}</button></div>`;

  if (opts.onBack) $('#st-back', el).onclick = opts.onBack;
  const itemsEl = $('#items', el);
  const photosEl = $('#photos', el);
  let drafts: ItemDraft[] = [];
  let photos: MenuPhotoRow[] = [];

  const renderItems = () => {
    if (!drafts.length) drafts.push({ name: '', price: '', description: '' });
    itemsEl.innerHTML = drafts.map((d, i) => `<div class="item" data-i="${i}">
      <input class="in" placeholder="Gericht, z. B. Schäufele mit Kloß" value="${esc(d.name)}" data-k="name" aria-label="Gericht">
      <input class="in" placeholder="0,00 €" inputmode="decimal" value="${esc(d.price)}" data-k="price" aria-label="Preis">
      <button class="x" type="button" data-rm="${i}" aria-label="Entfernen">×</button>
      <input class="in desc" placeholder="Kurz dazu (optional), z. B. Kruste, Biersoße" value="${esc(d.description)}" data-k="description" aria-label="Beschreibung">
    </div>`).join('');
    $('#item-count', el).textContent = `${drafts.filter((d) => d.name.trim()).length} ${drafts.filter((d) => d.name.trim()).length === 1 ? 'Eintrag' : 'Einträge'}`;
  };
  const renderPhotos = () => {
    photosEl.innerHTML = photos.map((ph) => `<img src="${esc(publicUrl('menu-photos', ph.path))}" alt="Foto der Speisekarte">`).join('');
    $('#photo-count', el).textContent = photos.length ? `${photos.length} ${photos.length === 1 ? 'Foto' : 'Fotos'}` : '';
  };

  itemsEl.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    const row = input.closest<HTMLElement>('.item');
    if (!row) return;
    const i = Number(row.dataset.i);
    const k = input.dataset.k as keyof ItemDraft;
    if (drafts[i]) drafts[i][k] = input.value;
  });
  itemsEl.addEventListener('click', (e) => {
    const rm = (e.target as HTMLElement).closest<HTMLElement>('[data-rm]');
    if (!rm) return;
    drafts.splice(Number(rm.dataset.rm), 1);
    renderItems();
  });
  $('#add-item', el).onclick = () => {
    drafts.push({ name: '', price: '', description: '' });
    renderItems();
    const inputs = $$<HTMLInputElement>('.item [data-k=name]', itemsEl);
    inputs[inputs.length - 1]?.focus();
  };

  const photoFile = $<HTMLInputElement>('#photo-file', el);
  const photoBar = $('#photo-bar', el);
  $('#photo-btn', el).onclick = () => photoFile.click();
  photoFile.onchange = async () => {
    const f = photoFile.files?.[0];
    if (!f) return;
    photoBar.classList.remove('hidden');
    $('#photo-s', el).textContent = 'Lädt hoch …';
    try {
      const row = await uploadMenuPhoto(place.id, f, (r) => { $<HTMLElement>('i', photoBar).style.width = `${Math.round(r * 100)}%`; });
      photos = [row, ...photos];
      renderPhotos();
      $('#photo-s', el).textContent = 'Noch ein Foto? JPG oder PNG · max. 10 MB';
    } catch (ex) {
      toast(toMessage(ex));
      $('#photo-s', el).textContent = 'JPG oder PNG · max. 10 MB';
    } finally {
      photoBar.classList.add('hidden');
      photoFile.value = '';
    }
  };

  // Bestehende Karte laden (beim Aktualisieren).
  try {
    const [items, existing] = await Promise.all([listMenuItems(place.id), listMenuPhotos(place.id)]);
    drafts = items.map((m) => ({ name: m.name, price: centsToInput(m.price_cents), description: m.description ?? '' }));
    photos = existing;
  } catch { /* leer starten */ }
  renderItems();
  renderPhotos();

  $('#menu-next', el).onclick = async () => {
    const filled = drafts.filter((d) => d.name.trim() || d.price.trim());
    const items: MenuItemInput[] = [];
    for (const d of filled) {
      if (!d.name.trim()) return errBox(el, 'Ein Gericht hat keinen Namen.');
      const cents = parsePriceToCents(d.price);
      if (cents === null) return errBox(el, `Preis bei „${d.name.trim()}" prüfen, z. B. 12,90.`);
      items.push({ name: d.name.trim(), description: d.description.trim() || null, price_cents: cents, currency: 'EUR' });
    }
    if (!items.length && !photos.length) return errBox(el, 'Trag mindestens ein Gericht ein oder lade ein Foto hoch.');
    errBox(el, null);
    const btn = $<HTMLButtonElement>('#menu-next', el);
    btn.disabled = true;
    try {
      await replaceMenu(place.id, items);
      opts.onDone();
    } catch (ex) {
      errBox(el, toMessage(ex));
      btn.disabled = false;
    }
  };
}

/* ---------- Schritt 3: Prüfen + bestätigen ---------- */
async function renderConfirmStep(el: HTMLElement, place: PlaceRow, opts: StepOpts) {
  destroyPickMap();
  el.innerHTML = `<h1>Prüfen</h1>${opts.onboarding ? stepsHtml(3) : `<div class="sub">${esc(place.name)}</div>`}<div id="summary">${loadingHtml()}</div>
    <div class="form-hint" style="margin-top:14px">Mit der Bestätigung sagst du: Diese Preise stimmen heute. Der grüne Punkt bleibt 7 Tage — Gäste verlängern ihn mit jedem „Ja".</div>
    <div class="form-err hidden"></div>
    <div class="actions"><button class="btn pri full" id="confirm">${icons.check}Speisekarte bestätigen</button>${opts.onboarding ? '<button class="linkbtn" id="skip">Später bestätigen</button>' : ''}</div>`;
  try {
    const [items, photos] = await Promise.all([listMenuItems(place.id), listMenuPhotos(place.id)]);
    $('#summary', el).innerHTML = `<div class="summary">
      <div class="kv"><span>Name</span><b>${esc(place.name)}</b></div>
      <div class="kv"><span>Art</span><b>${esc(place.category ?? '')}</b></div>
      <div class="kv"><span>Adresse</span><b>${esc(place.address)}</b></div>
      <div class="kv"><span>Gerichte</span><b>${items.length}</b></div>
      <div class="kv"><span>Fotos</span><b>${photos.length}</b></div></div>
      ${items.length ? `<div class="menu">${items.map((m) => `<div class="it"><div><div class="d">${esc(m.name)}</div>${m.description ? `<div class="s">${esc(m.description)}</div>` : ''}</div><div class="p">${esc(centsToInput(m.price_cents))} €</div></div>`).join('')}</div>` : ''}`;
  } catch (e) {
    $('#summary', el).innerHTML = emptyHtml(toMessage(e));
  }
  $('#confirm', el).onclick = async () => {
    const btn = $<HTMLButtonElement>('#confirm', el);
    btn.disabled = true;
    try {
      await confirmMenu(place.id);
      toast('Bestätigt. Danke.');
      opts.onDone();
    } catch (ex) {
      errBox(el, toMessage(ex));
      btn.disabled = false;
    }
  };
  const skip = el.querySelector<HTMLElement>('#skip');
  if (skip) skip.onclick = opts.onDone;
}

/* ---------- Schritt 4: QR drucken ---------- */
async function renderQrStep(el: HTMLElement, place: PlaceRow, opts: StepOpts) {
  destroyPickMap();
  el.innerHTML = `${opts.onBack ? `<button class="linkbtn" id="st-back">‹ Zurück</button>` : ''}
    <h1>${esc(opts.title ?? 'QR-Codes drucken')}</h1>${opts.onboarding ? stepsHtml(4) : `<div class="sub">${esc(place.name)}</div>`}
    <div class="form-hint">Jeder Tisch bekommt einen eigenen Code. A4, vier Karten pro Seite — ausschneiden, auf den Tisch.</div>
    <label class="field"><span>Wie viele Tische?</span><input class="in" id="tables" type="number" inputmode="numeric" min="1" max="${MAX_TABLES}" value="10"></label>
    <div id="existing"></div>
    <div class="form-err hidden"></div>
    <div class="actions">
      <button class="btn pri full" id="make-qr">${icons.qr}QR-Codes als PDF</button>
      <div class="pill-ok hidden" id="qr-ok">PDF erstellt. Ein Code pro Tisch.</div>
      <button class="btn sec2 full" id="finish">${opts.onboarding ? 'Fertig' : 'Zurück'}</button>
    </div>`;
  if (opts.onBack) $('#st-back', el).onclick = opts.onBack;
  $('#finish', el).onclick = opts.onDone;

  // Vorhandene Codes erneut drucken (ohne neue Tokens).
  let existing: QrTokenRow[] = [];
  try { existing = await listQrTokens(place.id); } catch { /* egal */ }
  if (existing.length) {
    $('#existing', el).innerHTML = `<button class="linkbtn" id="reprint">${existing.length} vorhandene Codes erneut drucken</button>`;
    $('#reprint', el).onclick = () => void makePdf(existing);
  }

  async function makePdf(tokens: QrTokenRow[]) {
    // pdf-lib + qrcode erst laden, wenn ein Inhaber wirklich druckt.
    const { buildQrPdf, downloadPdf, pdfFilename } = await import('../lib/qr-pdf');
    const bytes = await buildQrPdf(place.name, tokens.map((t) => ({ token: t.token, table_label: t.table_label })));
    downloadPdf(bytes, pdfFilename(place.name));
    $('#qr-ok', el).classList.remove('hidden');
  }

  $('#make-qr', el).onclick = async () => {
    const n = Number($<HTMLInputElement>('#tables', el).value);
    if (!Number.isInteger(n) || n < 1 || n > MAX_TABLES) return errBox(el, `Zwischen 1 und ${MAX_TABLES} Tischen.`);
    errBox(el, null);
    const btn = $<HTMLButtonElement>('#make-qr', el);
    btn.disabled = true;
    btn.textContent = 'Erzeugt …';
    try {
      const tokens = await createQrTokens(place.id, n);
      await makePdf(tokens);
      btn.textContent = 'Noch mehr Tische';
    } catch (ex) {
      errBox(el, toMessage(ex));
      btn.textContent = 'QR-Codes als PDF';
    } finally {
      btn.disabled = false;
    }
  };
}

/* ---------- Inhaber-Video ---------- */
function renderVideoUpload(el: HTMLElement, place: PlaceRow, onDone: () => void) {
  el.innerHTML = `<div class="sec"><h3>Video hochladen</h3>
    <div class="form-hint">MP4, MOV oder WebM · max. 50 MB · erscheint im Feed und beim Lokal.</div>
    <label class="field"><span>Ein Satz dazu (optional)</span><input class="in" id="vid-cap" maxlength="120" placeholder="z. B. Heute Schäufele mit Kloß, solange es reicht."></label>
    <button class="vidbtn" id="own-vid" type="button"><span class="c">${icons.video}</span><span><b id="own-vid-b">Video aufnehmen oder wählen</b><span id="own-vid-s">Küche, Team, Tagesgericht</span></span></button>
    <input type="file" id="own-vid-file" accept="video/*" capture="environment" class="hidden">
    <div class="progress hidden" id="own-bar"><i></i></div>
    <div class="form-err hidden"></div>
    <div class="actions"><button class="btn pri full" id="own-up" disabled>Hochladen</button><button class="linkbtn" id="own-cancel">Abbrechen</button></div></div>`;
  const file = $<HTMLInputElement>('#own-vid-file', el);
  const up = $<HTMLButtonElement>('#own-up', el);
  const bar = $('#own-bar', el);
  $('#own-vid', el).onclick = () => file.click();
  $('#own-cancel', el).onclick = onDone;
  file.onchange = () => {
    const f = file.files?.[0];
    up.disabled = !f;
    $('#own-vid-b', el).textContent = f ? f.name : 'Video aufnehmen oder wählen';
    $('#own-vid-s', el).textContent = f ? `${(f.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : 'Küche, Team, Tagesgericht';
    $('#own-vid', el).classList.toggle('has', Boolean(f));
  };
  up.onclick = async () => {
    const f = file.files?.[0];
    if (!f) return;
    up.disabled = true;
    bar.classList.remove('hidden');
    errBox(el, null);
    try {
      await addOwnerVideo(place.id, f, $<HTMLInputElement>('#vid-cap', el).value.trim() || null, (r) => {
        $<HTMLElement>('i', bar).style.width = `${Math.round(r * 100)}%`;
        up.textContent = `${Math.round(r * 100)} %`;
      });
      toast('Video ist online.');
      onDone();
    } catch (ex) {
      errBox(el, toMessage(ex));
      up.disabled = false;
      up.textContent = 'Hochladen';
      bar.classList.add('hidden');
    }
  };
}
