/** GitHub rejects dispatch payloads over this many characters. */
export const PAYLOAD_LIMIT = 65_535;

export interface MultilineOptions {
  rows?: number;
}

/**
 * Replaces a text input with an auto-growing textarea.
 *
 * A text input can't hold newlines (browsers strip them from its value), so the
 * textarea takes over the input's `name` and `id`, and GitHub's own form submit
 * sends the textarea's value. The original input stays in place, hidden and
 * unnamed. Returns a function that puts everything back exactly as it was.
 */
export function makeMultiline(input: HTMLInputElement, opts: MultilineOptions = {}): () => void {
  const name = input.name;
  const id = input.id;
  const textarea = document.createElement('textarea');
  textarea.name = name;
  if (id) textarea.id = id;
  textarea.value = input.value;
  textarea.rows = opts.rows ?? 3;
  textarea.required = input.required;
  textarea.placeholder = input.placeholder;
  textarea.className = `${input.className} ym-textarea`.trim();
  for (const attr of ['aria-describedby', 'aria-label', 'aria-labelledby']) {
    const v = input.getAttribute(attr);
    if (v !== null) textarea.setAttribute(attr, v);
  }
  textarea.dataset.ymOwned = 'multiline';

  const counter = document.createElement('div');
  counter.className = 'ym-counter';
  counter.hidden = true;

  const controller = new AbortController();
  const { signal } = controller;
  const grow = () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
    const len = textarea.value.length;
    counter.hidden = len < PAYLOAD_LIMIT * 0.9;
    counter.textContent = `${len.toLocaleString()} / ${PAYLOAD_LIMIT.toLocaleString()} characters`;
    counter.classList.toggle('ym-counter--over', len > PAYLOAD_LIMIT);
  };
  textarea.addEventListener('input', grow, { signal });
  // Enter adds a line here, so Cmd/Ctrl+Enter submits like Enter does in a text field.
  textarea.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        textarea.form?.requestSubmit();
      }
    },
    { signal },
  );

  input.dataset.ymName = name;
  input.removeAttribute('name');
  if (id) input.removeAttribute('id');
  input.hidden = true;
  input.after(textarea, counter);
  grow();

  return () => {
    controller.abort();
    textarea.remove();
    counter.remove();
    input.name = name;
    if (id) input.id = id;
    input.hidden = false;
    delete input.dataset.ymName;
  };
}
