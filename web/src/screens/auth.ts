// Anmeldung per Magic Link (signInWithOtp) und Rücksprung nach /auth/callback.
import { getSession, onAuthChange, signInWithMagicLink, toMessage } from '../lib/api';
import { BACKEND_HINT, BACKEND_HINT_SUB, backendConfigured } from '../lib/supabase';
import { returnTo } from '../lib/storage';
import { APP_URL } from '../config';
import { $, esc } from '../ui';

export interface AuthPanelOptions {
  title: string;
  text?: string;
  /** Pfad, zu dem nach dem Klick auf den Link zurückgesprungen wird. */
  returnPath: string;
  onSent?: (email: string) => void;
}

/** E-Mail-Feld + Button. Nach dem Senden: „Link geschickt. Schau in dein Postfach." */
export function renderAuthPanel(el: HTMLElement, opts: AuthPanelOptions): void {
  if (!backendConfigured) {
    el.innerHTML = `<div class="auth"><h2>${esc(opts.title)}</h2><p>${esc(BACKEND_HINT)} ${esc(BACKEND_HINT_SUB)}</p></div>`;
    return;
  }
  el.innerHTML = `<form class="auth" novalidate>
    <h2>${esc(opts.title)}</h2>
    ${opts.text ? `<p>${esc(opts.text)}</p>` : ''}
    <label class="field"><span>E-Mail</span><input class="in" type="email" name="email" autocomplete="email" inputmode="email" placeholder="du@beispiel.de" required></label>
    <div class="form-err hidden"></div>
    <div class="actions"><button class="btn pri full" type="submit">Link schicken</button></div>
    <div class="form-hint">Kein Passwort. Du bekommst einen Link per E-Mail.</div>
  </form>`;
  const form = $<HTMLFormElement>('form', el);
  const input = $<HTMLInputElement>('input', el);
  const err = $('.form-err', el);
  const btn = $<HTMLButtonElement>('button', el);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    err.classList.add('hidden');
    if (!email || !email.includes('@')) {
      err.textContent = 'Das sieht nicht wie eine E-Mail-Adresse aus.';
      err.classList.remove('hidden');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Schickt …';
    try {
      returnTo.set(opts.returnPath);
      await signInWithMagicLink(email, `${APP_URL}/auth/callback`);
      el.innerHTML = `<div class="auth"><h2>${esc(opts.title)}</h2><div class="sent">Link geschickt. Schau in dein Postfach.</div><p>${esc(email)} · Der Link öffnet die App und bringt dich hierher zurück.</p></div>`;
      opts.onSent?.(email);
    } catch (ex) {
      err.textContent = toMessage(ex);
      err.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Link schicken';
    }
  };
}

/**
 * /auth/callback: supabase-js liest die Session aus der URL (detectSessionInUrl).
 * Wir warten kurz darauf und geben den Pfad zurück, zu dem es weitergeht.
 */
export async function handleAuthCallback(): Promise<{ path: string; ok: boolean }> {
  const target = returnTo.get() || '/profile';
  if (!backendConfigured) return { path: '/profile', ok: false };
  const ok = await new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (v: boolean) => { if (!done) { done = true; off(); resolve(v); } };
    const off = onAuthChange((session) => { if (session) finish(true); });
    getSession().then((s) => { if (s) finish(true); });
    // Bei einem fehlerhaften Link (#error=…) nicht ewig warten.
    const hasError = /error=/.test(window.location.hash) || /error=/.test(window.location.search);
    setTimeout(() => finish(false), hasError ? 300 : 6000);
  });
  if (ok) returnTo.clear();
  return { path: ok ? target : '/profile', ok };
}
