/** A small inline note from Yardmaster, placed after `anchor`. */
export function showNote(anchor: Element, text: string, kind: 'info' | 'warn' = 'warn'): HTMLElement {
  const note = document.createElement('p');
  note.className = `ym-note ym-note--${kind}`;
  note.dataset.ymOwned = 'note';
  note.textContent = `Yardmaster: ${text}`;
  anchor.after(note);
  return note;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
