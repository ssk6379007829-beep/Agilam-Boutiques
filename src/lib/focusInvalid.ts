/**
 * Move the user to the first thing they have to fix.
 *
 * A toast saying "please fix the highlighted fields" is no help on a form where
 * the offending input is below the fold — the seller is told they are blocked
 * but not by what. After a failed submit, call this: it finds the first control
 * the validator rejected, scrolls it into view and gives it focus, so the
 * caret lands in the box that needs typing.
 *
 * It keys off `aria-invalid`, which is what the FormKit primitives set, so a
 * caller never has to know how its own step or dialog is laid out. That also
 * means it stays correct when fields are reordered.
 *
 * `scope` narrows the search — pass a dialog's element when a modal form is
 * open, so this doesn't focus an invalid field on the page behind it.
 */
export function focusFirstInvalid(scope?: HTMLElement | null) {
  // A frame's delay lets React paint the new `aria-invalid` attributes first;
  // querying synchronously would search the pre-validation DOM.
  requestAnimationFrame(() => {
    const root: ParentNode = scope ?? document;
    const bad = root.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!bad) return;
    bad.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // The scroll above is the one that should win; focus() would otherwise jump
    // the field to the top of the viewport instead of centring it.
    bad.focus({ preventScroll: true });
  });
}
