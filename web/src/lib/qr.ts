// QR-Erkennung: BarcodeDetector (Chrome/Android, neuere Safari), sonst jsQR auf einem Canvas.
// Der QR enthält `{APP_URL}/scan?t={token}`; wir lesen `t` aus der URL oder aus dem Kamera-Bild.
type JsQr = typeof import('jsqr').default;

interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> }
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** Token aus QR-Inhalt (URL mit ?t= oder roher Token). */
export function tokenFromText(text: string): string | null {
  const t = text.trim();
  try {
    const u = new URL(t);
    const q = u.searchParams.get('t');
    if (q && TOKEN_RE.test(q)) return q;
  } catch {
    /* kein URL-Format */
  }
  return TOKEN_RE.test(t) ? t : null;
}

/** Token aus der aktuellen Adresse (/scan?t=…). */
export function tokenFromLocation(search = window.location.search): string | null {
  const t = new URLSearchParams(search).get('t');
  return t && TOKEN_RE.test(t) ? t : null;
}

async function makeDetector(): Promise<BarcodeDetectorLike | null> {
  const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    if (Ctor.getSupportedFormats) {
      const formats = await Ctor.getSupportedFormats();
      if (!formats.includes('qr_code')) return null;
    }
    return new Ctor({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

export class QrScanner {
  private stream: MediaStream | null = null;
  private timer: number | null = null;
  private canvas = document.createElement('canvas');
  private busy = false;
  private stopped = true;
  private jsQr: JsQr | null = null;

  constructor(private video: HTMLVideoElement, private onToken: (token: string) => void) {}

  get running(): boolean { return !this.stopped; }

  /** Kamera starten. Wirft, wenn der Zugriff verweigert wurde. */
  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Keine Kamera verfügbar.');
    this.stop();
    this.stopped = false;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    if (this.stopped) { this.releaseStream(); return; }
    this.video.srcObject = this.stream;
    this.video.setAttribute('playsinline', '');
    this.video.muted = true;
    await this.video.play().catch(() => { /* Autoplay-Regeln; Bild kommt trotzdem */ });
    const detector = await makeDetector();
    // jsQR nur laden, wenn der Browser keinen BarcodeDetector hat.
    if (!detector && !this.jsQr) this.jsQr = (await import('jsqr')).default;
    if (this.stopped) return;
    const tick = async () => {
      if (this.stopped || this.busy) return;
      this.busy = true;
      try {
        const text = detector ? await this.detectNative(detector) : this.detectJsQr();
        const token = text ? tokenFromText(text) : null;
        if (token) {
          this.stop();
          this.onToken(token);
          return;
        }
      } catch {
        /* einzelnes Frame fehlgeschlagen — weiter */
      } finally {
        this.busy = false;
      }
    };
    this.timer = window.setInterval(tick, detector ? 250 : 180);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    this.releaseStream();
  }

  private releaseStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.video.srcObject) this.video.srcObject = null;
  }

  private async detectNative(detector: BarcodeDetectorLike): Promise<string | null> {
    if (this.video.readyState < 2) return null;
    const codes = await detector.detect(this.video);
    return codes[0]?.rawValue ?? null;
  }

  private detectJsQr(): string | null {
    const v = this.video;
    if (!this.jsQr || v.readyState < 2 || !v.videoWidth) return null;
    // Verkleinern, damit jsQR auf dem Handy flüssig bleibt.
    const scale = Math.min(1, 640 / v.videoWidth);
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const code = this.jsQr(img.data, w, h, { inversionAttempts: 'dontInvert' });
    return code?.data ?? null;
  }
}
