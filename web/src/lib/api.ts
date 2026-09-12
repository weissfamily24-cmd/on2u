// Typisierte Zugriffe auf Supabase, exakt nach docs/schema-contract.md.
// Tabellen: places, menu_items, menu_photos, qr_tokens, visits, reviews, menu_confirmations, videos.
// View: place_freshness. RPCs: submit_review, confirm_menu, create_qr_tokens, replace_menu.
// Edge Function: verify-qr. Buckets: videos, menu-photos.
import type { Session, User } from '@supabase/supabase-js';
import { ApiError, BACKEND_HINT, SUPABASE_ANON_KEY, SUPABASE_URL, requireClient, supabase } from './supabase';
import { MAX_PHOTO_MB, MAX_VIDEO_MB } from '../config';

/* ---------- Zeilen-Typen ---------- */
export type Currency = 'EUR' | 'ALL';
export type By = 'owner' | 'guest';

export interface PlaceRow {
  id: string; owner_id: string; name: string; category: string | null;
  lat: number; lng: number; address: string; caption: string | null; created_at: string;
}
export interface MenuItemRow {
  id: string; place_id: string; name: string; description: string | null;
  price_cents: number; currency: Currency; position: number; created_at: string;
}
export interface MenuPhotoRow { id: string; place_id: string; path: string; created_at: string }
export interface QrTokenRow { id: string; place_id: string; token: string; table_label: string; active: boolean; created_at: string }
export interface ReviewRow {
  id: string; visit_id: string; place_id: string; user_id: string;
  hearts: number; tags: string[]; video_path: string | null; created_at: string;
}
export interface VideoRow {
  id: string; place_id: string; by: By; user_id: string; review_id: string | null;
  path: string; caption: string | null; created_at: string;
}
export interface FreshnessRow {
  place_id: string; is_fresh: boolean; last_confirmed_at: string | null;
  confirmations_7d: number; mismatches_7d: number; owner_confirmed_7d: boolean;
  guest_confirmers_7d: number; avg_hearts: number | null; review_count: number;
}

export type PlaceWithFreshness = PlaceRow & { freshness: FreshnessRow | null };
export interface PlaceDetail extends PlaceWithFreshness {
  menu: MenuItemRow[]; photos: MenuPhotoRow[]; videos: VideoRow[]; reviews: ReviewRow[];
}
export interface FeedVideo extends VideoRow {
  url: string;
  place: Pick<PlaceRow, 'id' | 'name' | 'category' | 'lat' | 'lng' | 'caption'> | null;
  freshness: FreshnessRow | null;
}
export interface VerifyResult {
  visit_id: string; place_id: string | null; place_name: string | null; table_label: string | null;
  /** true bei 429: bestehender Besuch wird weiterverwendet */
  already: boolean;
}
export interface MenuItemInput { name: string; description?: string | null; price_cents: number; currency?: Currency }
export interface CreatePlaceInput { name: string; category: string; address: string; lat: number; lng: number; caption?: string | null }

/* ---------- Fehlertexte ---------- */
const NET = 'Gerade kein Netz. Nochmal versuchen.';
const GENERIC = 'Das hat nicht geklappt. Nochmal versuchen.';

/** Beliebigen Fehler in einen anzeigbaren deutschen Text übersetzen. */
export function toMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  const msg = typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err ?? '');
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return NET;
  if (/row-level security|permission denied|403/i.test(msg)) return 'Keine Berechtigung.';
  if (/JWT|not authenticated|401/i.test(msg)) return 'Bitte melde dich an.';
  // Deutsche Texte aus `raise exception` direkt zeigen (erkennbar an Umlauten/Satzzeichen).
  if (/[äöüßÄÖÜ]|\.$/.test(msg) && !/[a-z]+_[a-z]+/.test(msg)) return msg;
  console.error(err);
  return GENERIC;
}

function fail(err: { message: string; code?: string } | null): never {
  throw new ApiError(toMessage(err));
}

/* ---------- Frische-Cache ---------- */
let placesCache: { at: number; rows: PlaceWithFreshness[] } | null = null;
const CACHE_MS = 60_000;

/** Nach Bewertung, Bestätigung, neuem Lokal: nächste Ladung holt frisch. */
export function invalidatePlaces(): void { placesCache = null; }

async function fetchFreshness(placeIds?: string[]): Promise<Map<string, FreshnessRow>> {
  const sb = requireClient();
  let q = sb.from('place_freshness').select('*');
  if (placeIds && placeIds.length) q = q.in('place_id', placeIds);
  const { data, error } = await q;
  if (error) fail(error);
  const map = new Map<string, FreshnessRow>();
  for (const r of (data ?? []) as FreshnessRow[]) {
    map.set(r.place_id, { ...r, avg_hearts: r.avg_hearts === null ? null : Number(r.avg_hearts) });
  }
  return map;
}

/* ---------- Lokale ---------- */
export async function listPlaces(force = false): Promise<PlaceWithFreshness[]> {
  if (!force && placesCache && Date.now() - placesCache.at < CACHE_MS) return placesCache.rows;
  const sb = requireClient();
  const [placesRes, fresh] = await Promise.all([
    sb.from('places').select('*').order('name'),
    fetchFreshness(),
  ]);
  if (placesRes.error) fail(placesRes.error);
  const rows = ((placesRes.data ?? []) as PlaceRow[]).map((p) => ({ ...p, freshness: fresh.get(p.id) ?? null }));
  placesCache = { at: Date.now(), rows };
  return rows;
}

export async function getPlace(id: string): Promise<PlaceDetail | null> {
  const sb = requireClient();
  const [place, fresh, menu, photos, videos, reviews] = await Promise.all([
    sb.from('places').select('*').eq('id', id).maybeSingle(),
    fetchFreshness([id]),
    sb.from('menu_items').select('*').eq('place_id', id).order('position').order('created_at'),
    sb.from('menu_photos').select('*').eq('place_id', id).order('created_at', { ascending: false }),
    sb.from('videos').select('*').eq('place_id', id).order('created_at', { ascending: false }).limit(20),
    sb.from('reviews').select('*').eq('place_id', id).order('created_at', { ascending: false }).limit(12),
  ]);
  if (place.error) fail(place.error);
  if (!place.data) return null;
  if (menu.error) fail(menu.error);
  return {
    ...(place.data as PlaceRow),
    freshness: fresh.get(id) ?? null,
    menu: (menu.data ?? []) as MenuItemRow[],
    photos: (photos.data ?? []) as MenuPhotoRow[],
    videos: (videos.data ?? []) as VideoRow[],
    reviews: (reviews.data ?? []) as ReviewRow[],
  };
}

/** Lokale des angemeldeten Inhabers (places.owner_id = auth.uid()). */
export async function listOwnPlaces(): Promise<PlaceWithFreshness[]> {
  const sb = requireClient();
  const user = await getUser();
  if (!user) return [];
  const { data, error } = await sb.from('places').select('*').eq('owner_id', user.id).order('created_at');
  if (error) fail(error);
  const rows = (data ?? []) as PlaceRow[];
  if (!rows.length) return [];
  const fresh = await fetchFreshness(rows.map((r) => r.id));
  return rows.map((p) => ({ ...p, freshness: fresh.get(p.id) ?? null }));
}

export async function createPlace(input: CreatePlaceInput): Promise<PlaceRow> {
  const sb = requireClient();
  const user = await getUser();
  if (!user) throw new ApiError('Bitte melde dich an.');
  const { data, error } = await sb
    .from('places')
    .insert({ ...input, caption: input.caption || null, owner_id: user.id })
    .select('*')
    .single();
  if (error) fail(error);
  invalidatePlaces();
  return data as PlaceRow;
}

/* ---------- Feed ---------- */
export async function listFeedVideos(limit = 40): Promise<FeedVideo[]> {
  const sb = requireClient();
  const { data, error } = await sb
    .from('videos')
    .select('*, places(id,name,category,lat,lng,caption)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) fail(error);
  type Joined = VideoRow & { places: FeedVideo['place'] };
  const rows = (data ?? []) as Joined[];
  const ids = [...new Set(rows.map((r) => r.place_id))];
  const fresh = ids.length ? await fetchFreshness(ids) : new Map<string, FreshnessRow>();
  return rows.map(({ places, ...v }) => ({
    ...v,
    place: places ?? null,
    freshness: fresh.get(v.place_id) ?? null,
    url: publicUrl('videos', v.path),
  }));
}

/* ---------- Storage ---------- */
export function publicUrl(bucket: 'videos' | 'menu-photos', path: string): string {
  if (!supabase) return '';
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

const VIDEO_EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };

function extOf(file: File, allowed?: Record<string, string>): string {
  if (allowed && allowed[file.type]) return allowed[file.type];
  const fromName = file.name.split('.').pop()?.toLowerCase() ?? '';
  return fromName && fromName.length <= 5 ? fromName : 'bin';
}

/** Upload mit echtem Fortschritt per XMLHttpRequest gegen die Storage-API. */
function uploadWithProgress(
  bucket: string, path: string, file: File, onProgress?: (ratio: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    getSession().then((session) => {
      const jwt = session?.access_token;
      if (!jwt) return reject(new ApiError('Bitte melde dich an.'));
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`);
      xhr.setRequestHeader('Authorization', `Bearer ${jwt}`);
      xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
      xhr.setRequestHeader('x-upsert', 'false');
      if (file.type) xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        let msg = 'Upload fehlgeschlagen.';
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
          if (xhr.status === 413 || /size|exceeded/i.test(body.message ?? '')) msg = `Datei zu groß.`;
          else if (/mime|type/i.test(body.message ?? '')) msg = 'Dateityp wird nicht unterstützt.';
          else if (xhr.status === 403) msg = 'Keine Berechtigung.';
        } catch { /* Text bleibt */ }
        reject(new ApiError(msg, xhr.status));
      };
      xhr.onerror = () => reject(new ApiError(NET));
      xhr.onabort = () => reject(new ApiError('Upload abgebrochen.'));
      xhr.send(file);
    }, reject);
  });
}

/** Video in den Bucket `videos` laden. Gibt den Pfad `{place_id}/{uuid}.{ext}` zurück. */
export async function uploadVideo(placeId: string, file: File, onProgress?: (ratio: number) => void): Promise<string> {
  if (!VIDEO_EXT[file.type] && !/\.(mp4|mov|webm)$/i.test(file.name)) throw new ApiError('Nur MP4, MOV oder WebM.');
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) throw new ApiError(`Video zu groß. Max. ${MAX_VIDEO_MB} MB.`);
  const path = `${placeId}/${crypto.randomUUID()}.${extOf(file, VIDEO_EXT)}`;
  await uploadWithProgress('videos', path, file, onProgress);
  return path;
}

/** Inhaber-Video: Upload + Zeile in `videos` (by='owner'). */
export async function addOwnerVideo(placeId: string, file: File, caption: string | null, onProgress?: (ratio: number) => void): Promise<VideoRow> {
  const sb = requireClient();
  const user = await getUser();
  if (!user) throw new ApiError('Bitte melde dich an.');
  const path = await uploadVideo(placeId, file, onProgress);
  const { data, error } = await sb
    .from('videos')
    .insert({ place_id: placeId, by: 'owner', user_id: user.id, path, caption: caption || null })
    .select('*')
    .single();
  if (error) fail(error);
  return data as VideoRow;
}

/** Foto der Speisekarte: Bucket `menu-photos` + Zeile in `menu_photos`. */
export async function uploadMenuPhoto(placeId: string, file: File, onProgress?: (ratio: number) => void): Promise<MenuPhotoRow> {
  const sb = requireClient();
  if (!file.type.startsWith('image/')) throw new ApiError('Bitte ein Foto wählen.');
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) throw new ApiError(`Foto zu groß. Max. ${MAX_PHOTO_MB} MB.`);
  const path = `${placeId}/${crypto.randomUUID()}.${extOf(file)}`;
  await uploadWithProgress('menu-photos', path, file, onProgress);
  const { data, error } = await sb.from('menu_photos').insert({ place_id: placeId, path }).select('*').single();
  if (error) fail(error);
  return data as MenuPhotoRow;
}

/* ---------- Scan & Bewertung ---------- */
export async function verifyQr(token: string): Promise<VerifyResult> {
  requireClient();
  const session = await getSession();
  if (!session) throw new ApiError('Bitte melde dich an, um zu bewerten.', 401);
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/verify-qr`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
  } catch {
    throw new ApiError(NET);
  }
  const body = (await res.json().catch(() => ({}))) as Partial<VerifyResult> & { error?: string };
  if (res.ok) {
    return {
      visit_id: body.visit_id!, place_id: body.place_id ?? null,
      place_name: body.place_name ?? null, table_label: body.table_label ?? null, already: false,
    };
  }
  if (res.status === 429 && body.visit_id) {
    return {
      visit_id: body.visit_id, place_id: body.place_id ?? null,
      place_name: body.place_name ?? null, table_label: body.table_label ?? null, already: true,
    };
  }
  throw new ApiError(body.error || GENERIC, res.status);
}

/** Besuch nachladen (z. B. nach 429 ohne Lokal-Daten). Still, wenn RLS es nicht erlaubt. */
export async function getVisitInfo(visitId: string): Promise<{ place_id: string; place_name: string | null; table_label: string | null } | null> {
  try {
    const sb = requireClient();
    const { data } = await sb.from('visits').select('place_id, table_label, places(name)').eq('id', visitId).maybeSingle();
    if (!data) return null;
    const d = data as unknown as { place_id: string; table_label: string | null; places: { name: string } | null };
    return { place_id: d.place_id, place_name: d.places?.name ?? null, table_label: d.table_label };
  } catch {
    return null;
  }
}

export interface SubmitReviewInput { visitId: string; hearts: number; pricesMatch: boolean; tags: string[]; videoPath?: string | null }

export async function submitReview(input: SubmitReviewInput): Promise<string> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('submit_review', {
    p_visit_id: input.visitId,
    p_hearts: input.hearts,
    p_prices_match: input.pricesMatch,
    p_tags: input.tags,
    p_video_path: input.videoPath ?? null,
  });
  if (error) fail(error);
  invalidatePlaces();
  return data as string;
}

/* ---------- Inhaber ---------- */
export async function confirmMenu(placeId: string): Promise<string> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('confirm_menu', { p_place_id: placeId });
  if (error) fail(error);
  invalidatePlaces();
  return data as string;
}

export async function createQrTokens(placeId: string, count: number): Promise<QrTokenRow[]> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('create_qr_tokens', { p_place_id: placeId, p_count: count });
  if (error) fail(error);
  return (data ?? []) as QrTokenRow[];
}

export async function listQrTokens(placeId: string): Promise<QrTokenRow[]> {
  const sb = requireClient();
  const { data, error } = await sb.from('qr_tokens').select('*').eq('place_id', placeId).eq('active', true).order('created_at');
  if (error) fail(error);
  return (data ?? []) as QrTokenRow[];
}

export async function replaceMenu(placeId: string, items: MenuItemInput[]): Promise<void> {
  const sb = requireClient();
  const payload = items.map((i) => ({
    name: i.name.trim(),
    description: i.description?.trim() || null,
    price_cents: Math.max(0, Math.round(i.price_cents)),
    currency: i.currency ?? 'EUR',
  }));
  const { error } = await sb.rpc('replace_menu', { p_place_id: placeId, p_items: payload });
  if (error) fail(error);
}

export async function listMenuItems(placeId: string): Promise<MenuItemRow[]> {
  const sb = requireClient();
  const { data, error } = await sb.from('menu_items').select('*').eq('place_id', placeId).order('position').order('created_at');
  if (error) fail(error);
  return (data ?? []) as MenuItemRow[];
}

export async function listMenuPhotos(placeId: string): Promise<MenuPhotoRow[]> {
  const sb = requireClient();
  const { data, error } = await sb.from('menu_photos').select('*').eq('place_id', placeId).order('created_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as MenuPhotoRow[];
}

/** Anzahl eigener Bewertungen (Profil-Statistik). */
export async function countOwnReviews(): Promise<number> {
  const sb = requireClient();
  const user = await getUser();
  if (!user) return 0;
  const { count, error } = await sb.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  if (error) return 0;
  return count ?? 0;
}

/* ---------- Auth ---------- */
export async function signInWithMagicLink(email: string, redirectTo: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } });
  if (error) {
    if (/rate|seconds/i.test(error.message)) throw new ApiError('Kurz warten, dann nochmal.');
    if (/invalid|email/i.test(error.message)) throw new ApiError('Das sieht nicht wie eine E-Mail-Adresse aus.');
    fail(error);
  }
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser(): Promise<User | null> {
  return (await getSession())?.user ?? null;
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export { ApiError, BACKEND_HINT };
