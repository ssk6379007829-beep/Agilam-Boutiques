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
