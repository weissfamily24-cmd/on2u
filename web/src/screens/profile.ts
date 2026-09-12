// Profil: Schalter „Ich als Gast / Mein Restaurant", Session, Anmelden/Abmelden, Inhaber-Bereich.
import { APP_NAME, CITY } from '../config';
import { countOwnReviews, getSession, onAuthChange, signOut } from '../lib/api';
import { BACKEND_HINT, backendConfigured } from '../lib/supabase';
import { likes, profileMode, savedPlaces, type ProfileMode } from '../lib/storage';
import type { Screen } from '../router';
import { $, $$, esc, icons, toast } from '../ui';
import { renderAuthPanel } from './auth';
import { renderOwnerArea } from './owner';

export function createProfileScreen(root: HTMLElement): Screen {
  root.innerHTML = `<div class="page narrow">
    <div class="sw" role="tablist"><button class="on" data-m="guest">Ich als Gast</button><button data-m="owner">Mein Restaurant</button></div>
    <div id="prof-guest"></div>
    <div id="prof-owner" class="hidden"></div>
    <div class="note">${esc(APP_NAME)} · Web v0.3 · ${esc(CITY)}</div>
  </div>`;

  const guestEl = $('#prof-guest', root);
  const ownerEl = $('#prof-owner', root);
  let mode: ProfileMode = profileMode.get();
  let visible = false;

  function setMode(m: ProfileMode) {
    mode = m;
    profileMode.set(m);
    $$('.sw button', root).forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.m === m));
    guestEl.classList.toggle('hidden', m !== 'guest');
    ownerEl.classList.toggle('hidden', m !== 'owner');
    void render();
  }

  async function renderGuest() {
    const session = backendConfigured ? await getSession() : null;
    const email = session?.user.email ?? '';
    guestEl.innerHTML = `
      <h1>Du</h1><div class="sub">${session ? esc(email) : `${esc(CITY)} · kein Konto nötig`}</div>
      <div class="stats">
        <div class="stat"><b id="st-reviews">–</b><span>Bewertungen</span></div>
        <div class="stat"><b>${savedPlaces.all().length}</b><span>Gespeichert</span></div>
        <div class="stat"><b>${likes.all().length}</b><span>Herzen</span></div>
      </div>
      <div class="sec"><h3>Konto</h3><div id="account"></div></div>
      <div class="sec"><h3>Einstellungen</h3>
        <button class="row" id="lang"><span class="ic">${icons.globe}</span><span class="t"><b>Sprache</b><span>Deutsch · English und Shqip folgen</span></span><span class="chev">›</span></button>
        <button class="row" id="reset"><span class="ic">${icons.trash}</span><span class="t"><b>Lokale Daten löschen</b><span>Gespeicherte Lokale und Herzen auf diesem Gerät</span></span><span class="chev">›</span></button>
      </div>`;

    const account = $('#account', guestEl);
    if (session) {
      account.innerHTML = `<button class="row" id="logout"><span class="ic">${icons.logout}</span><span class="t"><b>Abmelden</b><span>${esc(email)}</span></span><span class="chev">›</span></button>`;
      $('#logout', account).onclick = async () => { await signOut(); toast('Abgemeldet'); void render(); };
      countOwnReviews().then((n) => { const el = guestEl.querySelector('#st-reviews'); if (el) el.textContent = String(n); });
    } else {
      $('#st-reviews', guestEl).textContent = '0';
      renderAuthPanel(account, {
        title: 'Anmelden',
        text: backendConfigured ? 'Nur fürs Bewerten am Tisch. Karte und Lokale gehen ohne Konto.' : BACKEND_HINT,
        returnPath: '/profile',
      });
    }
    $('#lang', guestEl).onclick = () => toast('Deutsch · English und Shqip folgen');
    $('#reset', guestEl).onclick = () => {
      if (confirm('Gespeicherte Lokale und Herzen auf diesem Gerät löschen?')) {
        savedPlaces.clear();
        likes.clear();
        toast('Gelöscht');
        void render();
      }
    };
  }

  async function render() {
    if (!visible) return;
    if (mode === 'guest') await renderGuest();
    else await renderOwnerArea(ownerEl);
  }

  $$('.sw button', root).forEach((b) => { b.onclick = () => setMode((b as HTMLElement).dataset.m as ProfileMode); });

  // Nach dem Magic Link (oder Abmelden im anderen Tab) neu zeichnen.
  onAuthChange(() => { if (visible) void render(); });

  return {
    enter() {
      visible = true;
      setMode(mode);
    },
    leave() { visible = false; },
  };
}
