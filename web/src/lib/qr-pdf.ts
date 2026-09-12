// QR-Karten als A4-PDF: vier Karten pro Seite, je Tisch ein Token.
// pdf-lib fürs Dokument, `qrcode` für das QR-Bild (PNG als Data-URL).
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import { APP_NAME, APP_URL } from '../config';

export interface QrCard { token: string; table_label: string }

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 28;
const COLS = 2;
const ROWS = 2;

const INK = rgb(0.05, 0.05, 0.05);
const MUTED = rgb(0.45, 0.43, 0.41);
const LINE = rgb(0.8, 0.78, 0.75);
const ACCENT = rgb(0.788, 0.416, 0.29); // Terrakotta #c96a4a

export function qrUrl(token: string): string {
  return `${APP_URL}/scan?t=${encodeURIComponent(token)}`;
}

/** Text zeichnen; Zeichen außerhalb von WinAnsi werden notfalls entfernt. */
function drawCentered(page: PDFPage, font: PDFFont, text: string, size: number, cx: number, y: number, color = INK, maxWidth?: number) {
  let t = text;
  try { font.encodeText(t); } catch { t = t.normalize('NFD').replace(/[^\x20-\x7E]/g, ''); }
  if (maxWidth) {
    while (t.length > 2 && font.widthOfTextAtSize(t, size) > maxWidth) t = t.slice(0, -2).trimEnd() + '…';
    try { font.encodeText(t); } catch { t = t.replace('…', '...'); }
  }
  const w = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: cx - w / 2, y, size, font, color });
}

export async function buildQrPdf(placeName: string, cards: QrCard[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${APP_NAME} – QR-Codes ${placeName}`);
  pdf.setProducer(APP_NAME);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const cardW = (A4.w - MARGIN * (COLS + 1)) / COLS;
  const cardH = (A4.h - MARGIN * (ROWS + 1)) / ROWS;
  const perPage = COLS * ROWS;

  for (let i = 0; i < cards.length; i++) {
    const slot = i % perPage;
    const page = slot === 0 ? pdf.addPage([A4.w, A4.h]) : pdf.getPage(pdf.getPageCount() - 1);
    const col = slot % COLS;
    const row = Math.floor(slot / COLS);
    const x = MARGIN + col * (cardW + MARGIN);
    const y = A4.h - MARGIN - (row + 1) * cardH - row * MARGIN;
    const cx = x + cardW / 2;

    // Schnittkante
    page.drawRectangle({ x, y, width: cardW, height: cardH, borderColor: LINE, borderWidth: 0.75, borderDashArray: [3, 3] });

    // Kopf: App-Name + Terrakotta-Linie
    drawCentered(page, bold, APP_NAME.toUpperCase(), 11, cx, y + cardH - 34, INK);
    page.drawLine({ start: { x: cx - 16, y: y + cardH - 42 }, end: { x: cx + 16, y: y + cardH - 42 }, thickness: 1.5, color: ACCENT });

    // Lokal + Tisch
    drawCentered(page, bold, placeName, 16, cx, y + cardH - 70, INK, cardW - 32);
    drawCentered(page, bold, cards[i].table_label, 26, cx, y + cardH - 104, INK, cardW - 32);

    // QR
    const qrSize = Math.min(cardW - 70, 190);
    const png = await QRCode.toDataURL(qrUrl(cards[i].token), {
      width: 512, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0c0c0c', light: '#ffffff' },
    });
    const img = await pdf.embedPng(png);
    page.drawImage(img, { x: cx - qrSize / 2, y: y + cardH - 120 - qrSize, width: qrSize, height: qrSize });

    // Fuß
    drawCentered(page, regular, 'Scannen, bewerten, Preise bestätigen.', 10.5, cx, y + 52, INK);
    drawCentered(page, italic, 'So wissen alle, dass du wirklich da warst.', 9.5, cx, y + 37, MUTED);
    drawCentered(page, regular, APP_URL.replace(/^https?:\/\//, ''), 8, cx, y + 20, MUTED);
  }

  return pdf.save();
}

/** PDF als Download anbieten. */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function pdfFilename(placeName: string): string {
  const slug = placeName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'lokal';
  return `qr-${slug}.pdf`;
}
