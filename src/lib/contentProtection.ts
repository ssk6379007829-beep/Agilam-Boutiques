// Deters casual saving of catalogue imagery. Pairs with the CSS rules in
// index.css (user-drag:none, touch-callout:none). This is a deterrent only —
// DevTools and screenshots still work — but it blocks the common
// right-click-save and drag-out paths.
//
// Copy and cut are NOT intercepted (2026-08-31). They used to be, alongside a
// `user-select:none` on <body>, and the pair made the seller and admin consoles
// hostile to work in: an order id, a payment reference, a UTR, a customer's
// email or an error string could be read on screen but never copied, because
// none of those are inputs. It cost real work and deterred nobody who could
// press Ctrl+U. Selection and copy now behave the way they do on any page.
//
// Form fields stay fully usable, as they always were: typing, selecting and
// copy/paste inside inputs/textareas/contenteditable, including the right-click
// menu that carries "Paste".

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.closest) return false;
  return !!el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
}

export function installContentProtection(): void {
  if (typeof document === 'undefined') return;

  // Right-click / long-press context menu — except inside form fields, where
  // it is the paste menu.
  document.addEventListener('contextmenu', (e) => {
    if (!isEditable(e.target)) e.preventDefault();
  });

  // Dragging images (or any element) out of the page.
  document.addEventListener('dragstart', (e) => {
    if (!isEditable(e.target)) e.preventDefault();
  });
}
