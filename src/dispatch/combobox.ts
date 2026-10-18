import type { Option } from '../config/schema';

export interface ComboboxOptions {
  allowCustom?: boolean;
}

const VISIBLE_LIMIT = 100;
let counter = 0;

/**
 * Turns GitHub's own text input into a searchable dropdown. The input keeps its
 * `name`, so whatever ends up in it is what GitHub submits. Values outside the
 * list are blocked with native form validation unless `allowCustom` is set.
 * Returns a function that removes everything it added.
 */
export function makeCombobox(input: HTMLInputElement, options: Option[], opts: ComboboxOptions = {}): () => void {
  const listId = `ym-listbox-${++counter}`;
  const saved = ['role', 'aria-autocomplete', 'aria-expanded', 'aria-controls', 'aria-activedescendant', 'autocomplete'].map(
    (attr) => [attr, input.getAttribute(attr)] as const,
  );

  const anchor = document.createElement('div');
  anchor.className = 'ym-combobox-anchor';
  anchor.dataset.ymOwned = 'combobox';
  const list = document.createElement('ul');
  list.id = listId;
  list.className = 'ym-listbox';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  anchor.append(list);
  input.after(anchor);

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', listId);
  input.setAttribute('autocomplete', 'off');
  input.classList.add('ym-combobox');

  const values = new Set(options.map((o) => o.value));
  let shown: Option[] = [];
  let active = -1;

  const setValue = (value: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const validate = () => {
    if (opts.allowCustom || input.value === '' || values.has(input.value)) input.setCustomValidity('');
    else input.setCustomValidity('Pick one of the listed values.');
  };

  const render = () => {
    const q = input.value.trim().toLowerCase();
    const showAll = q === '' || values.has(input.value);
    const matches = showAll
      ? options
      : options.filter((o) => o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q));
    shown = matches.slice(0, VISIBLE_LIMIT);
    active = Math.min(active, shown.length - 1);
    list.replaceChildren(
      ...shown.map((o, i) => {
        const li = document.createElement('li');
        li.id = `${listId}-${i}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(o.value === input.value));
        li.className = 'ym-option';
        if (i === active) li.classList.add('ym-option--active');
        li.textContent = o.label;
        if (o.label !== o.value) {
          const v = document.createElement('span');
          v.className = 'ym-option-value';
          v.textContent = o.value;
          li.append(v);
        }
        return li;
      }),
    );
    if (matches.length > shown.length) {
      const more = document.createElement('li');
      more.className = 'ym-option-more';
      more.setAttribute('aria-hidden', 'true');
      more.textContent = `${matches.length - shown.length} more, keep typing to narrow down`;
      list.append(more);
    }
    if (!matches.length) {
      const none = document.createElement('li');
      none.className = 'ym-option-more';
      none.textContent = opts.allowCustom ? 'No match, your text will be used as is' : 'No match';
      list.append(none);
    }
    if (active >= 0) input.setAttribute('aria-activedescendant', `${listId}-${active}`);
    else input.removeAttribute('aria-activedescendant');
  };

  const open = () => {
    render();
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    list.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };
  const choose = (o: Option) => {
    setValue(o.value);
    validate();
    close();
  };

  const controller = new AbortController();
  const { signal } = controller;
  input.addEventListener('focus', open, { signal });
  input.addEventListener('click', open, { signal });
  input.addEventListener(
    'input',
    () => {
      active = -1;
      validate();
      if (list.hidden) open();
      else render();
    },
    { signal },
  );
  input.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (list.hidden) open();
        if (!shown.length) return;
        active = e.key === 'ArrowDown' ? (active + 1) % shown.length : (active - 1 + shown.length) % shown.length;
        render();
        list.querySelector('.ym-option--active')?.scrollIntoView?.({ block: 'nearest' });
      } else if (e.key === 'Enter' && !list.hidden && active >= 0) {
        e.preventDefault(); // pick the option instead of submitting the form
        const o = shown[active];
        if (o) choose(o);
      } else if (e.key === 'Escape' && !list.hidden) {
        e.preventDefault();
        e.stopPropagation(); // don't close GitHub's dropdown too
        close();
      } else if (e.key === 'Tab') {
        close();
      }
    },
    { signal },
  );
  input.addEventListener('blur', () => setTimeout(close, 120), { signal });
  // mousedown, not click: it fires before the input blurs.
  list.addEventListener(
    'mousedown',
    (e) => {
      const li = (e.target as Element).closest('li[role="option"]');
      if (!li) return;
      e.preventDefault();
      const o = shown[[...list.children].indexOf(li)];
      if (o) choose(o);
    },
    { signal },
  );
  validate();

  return () => {
    controller.abort();
    anchor.remove();
    input.classList.remove('ym-combobox');
    input.setCustomValidity('');
    for (const [attr, value] of saved) {
      if (value === null) input.removeAttribute(attr);
      else input.setAttribute(attr, value);
    }
  };
}
