/** Renders a DOM node (the premium bill card) to a PNG file, client-side —
 *  html2canvas/jspdf are dynamically imported so they don't bloat the main
 *  bundle for buyers who never touch seller billing. */
async function renderToCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas');
  return html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
}

export async function elementToPngFile(el: HTMLElement, filename: string): Promise<File> {
  const canvas = await renderToCanvas(el);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not generate the bill image'))), 'image/png'),
  );
  return new File([blob], filename, { type: 'image/png' });
}

export async function downloadBillPdf(el: HTMLElement, filename: string): Promise<void> {
  const canvas = await renderToCanvas(el);
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] });
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
}

/** Opens a blank tab synchronously, inside the click handler's user gesture,
 *  and shows a loading placeholder in it. Call this BEFORE any await in a
 *  share click-handler — browsers only allow window.open to bypass the popup
 *  blocker when it's called directly from a user gesture, and the bill image
 *  render (html2canvas) is async, so a window.open() issued after awaiting it
 *  gets silently blocked. Redirect the returned handle once the real URL is
 *  known (`tab.location.href = url`), which is allowed even after the await. */
export function openPendingWhatsAppTab(): Window | null {
  const win = window.open('', '_blank');
  try {
    win?.document.write(
      '<title>Preparing your bill…</title><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#FBF6F2;color:#8A7078;">Preparing your bill…</body>',
    );
  } catch {
    // Best-effort placeholder only — a blocked/null window is handled by the caller.
  }
  return win;
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

type ShareableNavigator = Navigator & { canShare?: (data?: ShareData) => boolean };

/** Shares the bill as an actual image (WhatsApp shows it as a photo, not a
 *  text message) via the Web Share API when the device/browser supports
 *  sharing files — the common case on mobile, which is how sellers use this.
 *  Falls back to downloading the PNG so it can be attached manually. */
export async function shareOrDownloadBillImage(
  el: HTMLElement,
  filename: string,
  shareText: string,
): Promise<'shared' | 'cancelled' | 'downloaded'> {
  const file = await elementToPngFile(el, filename);
  const nav = navigator as ShareableNavigator;
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: shareText });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
      // Fall through to download below.
    }
  }
  downloadFile(file);
  return 'downloaded';
}
