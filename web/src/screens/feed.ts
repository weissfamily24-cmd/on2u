// Feed: vertikaler Snap-Feed aus `videos` (öffentliche URLs), Herz lokal, Merken, Route.
import { CITY } from '../config';
import { listFeedVideos, toMessage, type FeedVideo } from '../lib/api';
import { BACKEND_HINT, BACKEND_HINT_SUB, backendConfigured } from '../lib/supabase';
import { likes, savedPlaces } from '../lib/storage';
import type { Screen } from '../router';
import { $, $$, badge, esc, icons, ratingLabel, routeUrl, toast, whenLabel } from '../ui';

export function createFeedScreen(root: HTMLElement): Screen {
  root.innerHTML = `<div class="feedtop"><span>Folge ich</span><b>${esc(CITY)}</b><span>Beliebt</span></div><div class="feed" id="feed"></div>`;
  const feedEl = $('#feed', root);
  let videos: FeedVideo[] = [];
  let loadedAt = 0;
  let observer: IntersectionObserver | null = null;

  const statePost = (text: string, sub?: string) =>
    `<article class="post state"><div class="v">${icons.play}</div><div class="empty" style="position:relative">${esc(text)}${sub ? `<em>${esc(sub)}</em>` : ''}</div></article>`;

  function render() {
    if (!backendConfigured) { feedEl.innerHTML = statePost(BACKEND_HINT, BACKEND_HINT_SUB); return; }
    if (!videos.length) {
      feedEl.innerHTML = statePost('Noch keine Videos.', 'Scann am Tisch und nimm das erste auf.');
      return;
    }
    feedEl.innerHTML = videos.map((v) => {
      const p = v.place;
      const liked = likes.has(v.id);
      const saved = p ? savedPlaces.has(p.id) : false;
      const name = p?.name ?? 'Lokal';
      return `<article class="post" data-vid="${esc(v.id)}">
        <div class="v">${icons.play}<video src="${esc(v.url)}" playsinline loop muted preload="metadata" data-video></video></div>
        <div class="acts">
          <button class="act like ${liked ? 'liked' : ''}" data-like="${esc(v.id)}" aria-label="Herz">${icons.heart}<span>${liked ? 'Gefällt dir' : 'Herz'}</span></button>
          ${p ? `<button class="act" data-save="${esc(p.id)}">${icons.save}<span>${saved ? 'Gemerkt' : 'Merken'}</span></button>` : ''}
          ${p ? `<a class="act" href="${routeUrl(p.lat, p.lng)}" target="_blank" rel="noopener">${icons.route}<span>Route</span></a>` : ''}
          <button class="act" data-sound aria-label="Ton">${icons.video}<span>Ton</span></button>
        </div>
        <div class="info">
          <div class="who"><span class="av"></span>${esc(name)} · ${v.by === 'owner' ? 'Inhaber' : 'Gast'}</div>
          ${p ? `<button class="name" data-p="${esc(p.id)}">${esc(name)}</button>` : `<div class="name">${esc(name)}</div>`}
          <div class="sub">${esc(p?.category ?? '')} · ♥ ${ratingLabel(v.freshness)}</div>
          ${v.caption || p?.caption ? `<div class="cap">${esc(v.caption || p?.caption)}</div>` : ''}
          <div class="badges">${badge(v.freshness)}<span class="badge">${esc(whenLabel(v.freshness?.last_confirmed_at))}</span></div>
        </div>
      </article>`;
    }).join('');
    observe();
  }

  // Nur das sichtbare Video läuft.
  function observe() {
    observer?.disconnect();
    observer = new IntersectionObserver((entries) => {
      for (const en of entries) {
        const vid = (en.target as HTMLElement).querySelector<HTMLVideoElement>('video[data-video]');
        if (!vid) continue;
        if (en.isIntersecting && en.intersectionRatio >= 0.6) vid.play().catch(() => { /* Autoplay geblockt */ });
        else vid.pause();
      }
    }, { root: feedEl, threshold: [0.6] });
    $$('.post', feedEl).forEach((p) => observer!.observe(p));
  }

  function pauseAll() {
    $$<HTMLVideoElement>('video[data-video]', feedEl).forEach((v) => v.pause());
  }

  async function load(force = false) {
    if (!backendConfigured) { render(); return; }
    if (!force && videos.length && Date.now() - loadedAt < 60_000) { render(); return; }
    if (!videos.length) feedEl.innerHTML = statePost('Lädt …');
    try {
      videos = await listFeedVideos();
      loadedAt = Date.now();
      render();
    } catch (e) {
      feedEl.innerHTML = statePost(toMessage(e), 'Runterziehen geht noch nicht — Tab nochmal öffnen.');
    }
  }

  feedEl.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const like = t.closest<HTMLElement>('[data-like]');
    if (like) {
      const on = likes.toggle(like.dataset.like!);
      like.classList.toggle('liked', on);
      like.querySelector('span')!.textContent = on ? 'Gefällt dir' : 'Herz';
      return;
    }
    const save = t.closest<HTMLElement>('[data-save]');
    if (save) {
      const on = savedPlaces.toggle(save.dataset.save!);
      toast(on ? 'Gemerkt' : 'Entfernt');
      $$<HTMLElement>(`[data-save="${save.dataset.save}"] span`, feedEl).forEach((s) => { s.textContent = on ? 'Gemerkt' : 'Merken'; });
      return;
    }
    const sound = t.closest<HTMLElement>('[data-sound]');
    if (sound) {
      const vid = sound.closest('.post')?.querySelector<HTMLVideoElement>('video');
      if (vid) { vid.muted = !vid.muted; sound.querySelector('span')!.textContent = vid.muted ? 'Ton' : 'Ton an'; }
      return;
    }
    const frame = t.closest<HTMLElement>('.v');
    if (frame) {
      const vid = frame.querySelector<HTMLVideoElement>('video');
      if (vid) { if (vid.paused) vid.play().catch(() => {}); else vid.pause(); }
    }
  });

  return {
    enter() { void load(); },
    leave() { pauseAll(); },
  };
}
