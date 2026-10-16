/** Native-like focus and keyboard geometry, without changing workout state. */
export function initializeInputModality() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  let frame = 0;
  root.dataset.inputModality = 'pointer';

  function updateViewport() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const height = viewport?.height ?? window.innerHeight;
      const top = viewport?.offsetTop ?? 0;
      const inset = Math.max(0, window.innerHeight - height - top);
      const active = document.activeElement;
      const editable = active instanceof HTMLElement && active.matches('input:not([type="checkbox"]):not([type="radio"]),textarea,[contenteditable="true"]');
      const keyboard = editable && inset > 120 && window.matchMedia('(pointer: coarse)').matches;
      root.style.setProperty('--app-visible-height', `${height}px`);
      root.style.setProperty('--app-visible-top', `${top}px`);
      root.style.setProperty('--app-keyboard-inset', `${inset}px`);
      root.dataset.keyboardOpen = keyboard ? 'true' : 'false';
      if (!keyboard || !(active instanceof HTMLElement) || active.closest('[role="dialog"], [role="alertdialog"]')) return;
      const exercise = active.closest('.focused-exercise');
      if (!exercise) return;
      const field = active.getBoundingClientRect();
      const completion = exercise.querySelector('.focused-complete-set')?.getBoundingClientRect();
      const safeTop = parseFloat(getComputedStyle(root).getPropertyValue('--app-safe-area-top')) || 0;
      const visibleTop = top + Math.max(16, safeTop);
      const visibleBottom = top + height - 16;
      let first = field.top, last = field.bottom;
      // Keep the current input and completion action together when they fit.
      if (completion && Math.max(field.bottom, completion.bottom) - Math.min(field.top, completion.top) < visibleBottom - visibleTop) {
        first = Math.min(field.top, completion.top); last = Math.max(field.bottom, completion.bottom);
      }
      if (last > visibleBottom) window.scrollBy({ top: last - visibleBottom, behavior: 'instant' });
      else if (first < visibleTop) window.scrollBy({ top: first - visibleTop, behavior: 'instant' });
    });
  }
  const pointer = () => { root.dataset.inputModality = 'pointer'; };
  const keyboard = (event: KeyboardEvent) => {
    if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) root.dataset.inputModality = 'keyboard';
    if (event.key === 'Enter' && root.dataset.keyboardOpen === 'true' && event.target instanceof HTMLInputElement && event.target.closest('.focused-set-controls')) {
      event.preventDefault(); event.target.blur();
    }
  };
  const focus = (event: FocusEvent) => {
    if (event.target instanceof HTMLInputElement && event.target.closest('.focused-set-controls')) event.target.enterKeyHint = 'done';
    updateViewport();
  };
  window.addEventListener('pointerdown', pointer, true);
  window.addEventListener('keydown', keyboard, true);
  window.addEventListener('resize', updateViewport);
  viewport?.addEventListener('resize', updateViewport);
  viewport?.addEventListener('scroll', updateViewport);
  document.addEventListener('focusin', focus);
  document.addEventListener('focusout', updateViewport);
  updateViewport();
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('pointerdown', pointer, true);
    window.removeEventListener('keydown', keyboard, true);
    window.removeEventListener('resize', updateViewport);
    viewport?.removeEventListener('resize', updateViewport);
    viewport?.removeEventListener('scroll', updateViewport);
    document.removeEventListener('focusin', focus);
    document.removeEventListener('focusout', updateViewport);
  };
}
