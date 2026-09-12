// Scan: Kamera + QR → (Anmeldung) → verify-qr → Herzen, Preis-Frage, Tags, Video → submit_review → Danke.
import { TAGS } from '../config';
import { getSession, getVisitInfo, submitReview, toMessage, uploadVideo, verifyQr, type VerifyResult } from '../lib/api';
import { QrScanner, tokenFromText } from '../lib/qr';
import { BACKEND_HINT, BACKEND_HINT_SUB, backendConfigured } from '../lib/supabase';
import { pendingToken } from '../lib/storage';
import { navigate, type Route, type Screen } from '../router';
import { $, $$, esc, icons, toast } from '../ui';
import { renderAuthPanel } from './auth';

type Panel = 'cam' | 'auth' | 'busy' | 'rev' | 'done';

export function createScanScreen(root: HTMLElement): Screen {
  root.innerHTML = `
    <div class="scan" id="scan-cam"><div class="cam">
      <video id="cam" playsinline muted autoplay class="hidden"></video>
      <div class="frame"><i></i><i></i><i></i><i></i><span class="scanline"></span></div>
      <p>Scanne den QR-Code am Tisch.<br><em>So wissen alle, dass du wirklich da warst.</em></p>
      <div class="demo">
        <button class="btn sec2 full" id="cam-on">Kamera einschalten</button>
        <form class="manual hidden" id="manual"><input class="in" id="manual-in" placeholder="Code oder Link vom QR" autocomplete="off"><button class="btn sec2" type="submit">Weiter</button></form>
        <button class="linkbtn hint" id="manual-toggle" type="button">Code eintippen</button>
      </div>
    </div></div>

    <div class="rev hidden" id="scan-auth">
      <div class="top"><button id="auth-back" aria-label="Zurück">${icons.back}</button></div>
      <h1>Kurz anmelden</h1><div class="at">Nur fürs Bewerten. Ein Link per E-Mail, kein Passwort.</div>
      <div id="auth-panel"></div>
    </div>

    <div class="done hidden quiet" id="scan-busy"><div class="hb">${icons.heart}</div><h1 id="busy-h">Besuch wird bestätigt …</h1><p id="busy-p"></p><div class="progress hidden" id="busy-bar" style="width:220px"><i></i></div></div>

    <div class="rev hidden" id="scan-rev">
      <div class="top"><button id="rev-back" aria-label="Zurück">${icons.back}</button></div>
      <h1 id="rev-h">Wie war's?</h1><div class="at"><b>Besuch bestätigt</b> · <span id="rev-t"></span></div>
      <div class="q"><label>Deine Bewertung</label><div class="hearts" id="hearts">${[1, 2, 3, 4, 5].map((v) => `<button data-v="${v}" aria-label="${v} von 5">${icons.heart}</button>`).join('')}</div></div>
      <div class="q"><label>Stimmen die Preise mit der Karte in der App?</label><div class="yn" id="yn"><button data-v="1">Ja, alles stimmt</button><button data-v="0">Nein, etwas ist anders</button></div></div>
      <div class="q"><label>Was passt?</label><div class="tags" id="tags">${TAGS.map((t) => `<button class="tag" type="button">${esc(t)}</button>`).join('')}</div></div>
      <div class="q"><button class="vidbtn" id="vid" type="button"><span class="c">${icons.video}</span><span><b id="vid-b">Kurzes Video aufnehmen</b><span id="vid-s">Optional · max. 30 Sekunden · hilft anderen am meisten</span></span></button><input type="file" id="vidfile" accept="video/*" capture="environment" class="hidden"></div>
      <button class="btn pri full" style="margin-top:26px" id="rev-send">Bewertung senden</button>
    </div>

    <div class="done hidden" id="scan-done"><div class="hb">${icons.heart}</div><h1 id="done-h">Danke.</h1><p id="done-p">Deine Meinung macht die Karte für alle nach dir ehrlicher.</p><button class="btn sec2" id="done-map">Zurück zur Karte</button><button class="linkbtn hidden" id="done-place">Zum Lokal</button></div>`;

  const panels: Record<Panel, HTMLElement> = {
    cam: $('#scan-cam', root), auth: $('#scan-auth', root), busy: $('#scan-busy', root),
    rev: $('#scan-rev', root), done: $('#scan-done', root),
  };
  const video = $<HTMLVideoElement>('#cam', root);
  const camBtn = $<HTMLButtonElement>('#cam-on', root);
  const scanner = new QrScanner(video, (token) => void handleToken(token));

  let visit: VerifyResult | null = null;
  let rv = { hearts: 0, ok: null as boolean | null, tags: new Set<string>(), file: null as File | null };
  let sending = false;

  function setPanel(name: Panel) {
    (Object.keys(panels) as Panel[]).forEach((k) => panels[k].classList.toggle('hidden', k !== name));
    root.scrollTop = 0;
  }

  function busy(title: string, text = '', progress = false) {
    $('#busy-h', root).textContent = title;
    $('#busy-p', root).textContent = text;
    $('#busy-bar', root).classList.toggle('hidden', !progress);
    setProgress(0);
    setPanel('busy');
  }
  function setProgress(ratio: number) {
    $<HTMLElement>('#busy-bar i', root).style.width = `${Math.round(ratio * 100)}%`;
  }

  function done(title: string, text: string, quiet = false) {
    panels.done.classList.toggle('quiet', quiet);
    $('#done-h', root).textContent = title;
    $('#done-p', root).textContent = text;
    $('#done-place', root).classList.toggle('hidden', !visit?.place_id);
    setPanel('done');
  }

  async function startCamera() {
    video.classList.add('hidden');
    try {
      await scanner.start();
      video.classList.remove('hidden');
      camBtn.classList.add('hidden');
    } catch {
      camBtn.classList.remove('hidden');
      camBtn.textContent = 'Kamera einschalten';
    }
  }

  function resetReview() {
    rv = { hearts: 0, ok: null, tags: new Set(), file: null };
    $$('#hearts button, #yn button, .tag', root).forEach((b) => b.classList.remove('on'));
    $('#vid', root).classList.remove('has');
    $('#vid-b', root).textContent = 'Kurzes Video aufnehmen';
    $('#vid-s', root).textContent = 'Optional · max. 30 Sekunden · hilft anderen am meisten';
    $<HTMLInputElement>('#vidfile', root).value = '';
  }

  function showReview(v: VerifyResult) {
    visit = v;
    resetReview();
    $('#rev-h', root).textContent = v.place_name ? `Wie war's bei ${v.place_name}?` : "Wie war's?";
    const when = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    $('#rev-t', root).textContent = `${v.table_label ? v.table_label + ' · ' : ''}heute, ${when}${v.already ? ' · du warst gerade schon hier' : ''}`;
    setPanel('rev');
  }

  /** Token aus Kamera, URL oder Eingabe verarbeiten. */
  async function handleToken(token: string) {
    scanner.stop();
    if (!backendConfigured) { done(BACKEND_HINT, BACKEND_HINT_SUB, true); return; }
    const session = await getSession();
    if (!session) {
      pendingToken.set(token);
      renderAuthPanel($('#auth-panel', root), {
        title: 'Link per E-Mail',
        text: 'Danach geht es hier direkt weiter.',
        returnPath: '/scan',
      });
      setPanel('auth');
      return;
    }
    busy('Besuch wird bestätigt …');
    try {
      const v = await verifyQr(token);
      if (v.already && !v.place_name) {
        const info = await getVisitInfo(v.visit_id);
        if (info) { v.place_id = info.place_id; v.place_name = info.place_name; v.table_label = info.table_label; }
      }
      showReview(v);
    } catch (e) {
      visit = null;
      done('Das hat nicht geklappt.', toMessage(e), true);
      $('#done-map', root).textContent = 'Nochmal scannen';
    }
  }

  async function send() {
    if (sending || !visit) return;
    if (!rv.hearts) { toast('Ein Herz mindestens'); return; }
    if (rv.ok === null) { toast('Stimmen die Preise? Ja oder Nein'); return; }
    sending = true;
    try {
      let videoPath: string | null = null;
      if (rv.file) {
        if (!visit.place_id) throw new Error('Lokal unbekannt — Video geht gerade nicht.');
        busy('Video wird hochgeladen …', '0 %', true);
        videoPath = await uploadVideo(visit.place_id, rv.file, (r) => {
          setProgress(r);
          $('#busy-p', root).textContent = `${Math.round(r * 100)} %`;
        });
      }
      busy('Wird gesendet …');
      await submitReview({ visitId: visit.visit_id, hearts: rv.hearts, pricesMatch: rv.ok, tags: [...rv.tags], videoPath });
      $('#done-map', root).textContent = 'Zurück zur Karte';
      done('Danke.', 'Deine Meinung macht die Karte für alle nach dir ehrlicher.');
    } catch (e) {
      const msg = toMessage(e);
      if (/schon bewertet/i.test(msg)) {
        $('#done-map', root).textContent = 'Zurück zur Karte';
        done('Schon erledigt.', msg, true);
      } else {
        toast(msg);
        setPanel('rev');
      }
    } finally {
      sending = false;
    }
  }

  /* ---- Events ---- */
  camBtn.onclick = () => void startCamera();
  $('#manual-toggle', root).onclick = () => {
    const f = $('#manual', root);
    f.classList.toggle('hidden');
    if (!f.classList.contains('hidden')) $<HTMLInputElement>('#manual-in', root).focus();
  };
  $<HTMLFormElement>('#manual', root).onsubmit = (e) => {
    e.preventDefault();
    const token = tokenFromText($<HTMLInputElement>('#manual-in', root).value);
    if (!token) { toast('Code nicht erkannt. Näher ran oder das Licht am Tisch anmachen.'); return; }
    void handleToken(token);
  };
  $('#auth-back', root).onclick = () => { pendingToken.clear(); setPanel('cam'); void startCamera(); };
  $('#rev-back', root).onclick = () => { visit = null; setPanel('cam'); void startCamera(); };
  $$('#hearts button', root).forEach((b) => {
    b.onclick = () => {
      rv.hearts = Number(b.dataset.v);
      $$('#hearts button', root).forEach((x) => x.classList.toggle('on', Number(x.dataset.v) <= rv.hearts));
    };
  });
  $$('#yn button', root).forEach((b) => {
    b.onclick = () => {
      rv.ok = b.dataset.v === '1';
      $$('#yn button', root).forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    };
  });
  $$('.tag', root).forEach((b) => {
    b.onclick = () => {
      b.classList.toggle('on');
      const t = b.textContent ?? '';
      if (b.classList.contains('on')) rv.tags.add(t); else rv.tags.delete(t);
    };
  });
  const fileInput = $<HTMLInputElement>('#vidfile', root);
  $('#vid', root).onclick = () => fileInput.click();
  fileInput.onchange = () => {
    const f = fileInput.files?.[0] ?? null;
    rv.file = f;
    $('#vid', root).classList.toggle('has', Boolean(f));
    $('#vid-b', root).textContent = f ? 'Video ausgewählt' : 'Kurzes Video aufnehmen';
    $('#vid-s', root).textContent = f ? `${f.name} · ${(f.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB · wird mit der Bewertung hochgeladen` : 'Optional · max. 30 Sekunden · hilft anderen am meisten';
  };
  $('#rev-send', root).onclick = () => void send();
  $('#done-map', root).onclick = () => {
    if ($('#done-map', root).textContent === 'Nochmal scannen') { setPanel('cam'); void startCamera(); return; }
    navigate('/');
  };
  $('#done-place', root).onclick = () => { if (visit?.place_id) navigate(`/place/${visit.place_id}`); };

  return {
    enter(route: Route) {
      // Deep-Link /scan?t=TOKEN oder Token, der auf die Anmeldung gewartet hat.
      const fromUrl = route.query.get('t');
      const token = (fromUrl && tokenFromText(fromUrl)) || pendingToken.get();
      if (fromUrl) history.replaceState({ app: true }, '', '/scan');
      if (token) {
        pendingToken.clear();
        void handleToken(token);
        return;
      }
      if (panels.rev.classList.contains('hidden') && panels.busy.classList.contains('hidden')) {
        setPanel('cam');
        void startCamera();
      }
    },
    leave() {
      scanner.stop();
      video.classList.add('hidden');
      camBtn.classList.remove('hidden');
    },
  };
}
