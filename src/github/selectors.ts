/**
 * Every GitHub DOM selector Yardmaster relies on lives in this file.
 * Each entry is a list tried in order (current markup first, older markup after),
 * so a GitHub UI change is usually a one-line fix here.
 * The fixture tests exercise these against saved GitHub markup.
 */
export const selectors = {
  /**
   * The "Run workflow" form. Since 2026 it renders with React in a side-panel dialog
   * (verified 2026-10-18); before that it sat in a <details> dropdown. Both post to /actions/manual.
   */
  dispatchForm: ['form[action$="/actions/manual"]', 'form:has([name^="inputs["])'],
  /** The workflow file is named either on the form or on the details element's fragment URL. */
  dispatchWorkflowField: ['input[name="workflow"]'],
  /** Hidden field holding the "Use workflow from" branch. */
  dispatchRefField: ['input[name="branch"]', 'input[name="ref"]'],
  /** String inputs render as plain text fields named inputs[<id>]. */
  dispatchTextInputs: ['input[type="text"][name^="inputs["]', 'input:not([type])[name^="inputs["]'],

  /** Workflow links in the Actions sidebar (Primer React ActionList). */
  sidebarLink: [
    'a[class^="prc-ActionList-ActionListContent"][href*="/actions/workflows/"]',
    'a[class*="ActionListContent"][href*="/actions/workflows/"]',
  ],
  sidebarLabel: ['[class^="prc-ActionList-ItemLabel"]', '[class*="ItemLabel"]'],
} as const;

export type SelectorKey = keyof typeof selectors;

export function query<E extends Element = HTMLElement>(key: SelectorKey, root: ParentNode = document): E | null {
  for (const s of selectors[key]) {
    const el = safeQuery<E>(root, s);
    if (el) return el;
  }
  return null;
}

export function queryAll<E extends Element = HTMLElement>(key: SelectorKey, root: ParentNode = document): E[] {
  for (const s of selectors[key]) {
    const found = safeQueryAll<E>(root, s);
    if (found.length) return found;
  }
  return [];
}

/** All selectors for a key joined, for CSS-based observers. */
export function selectorList(key: SelectorKey): string {
  return selectors[key].join(', ');
}

function safeQuery<E extends Element>(root: ParentNode, s: string): E | null {
  try {
    return root.querySelector<E>(s);
  } catch {
    return null; // e.g. :has() in an engine without support
  }
}

function safeQueryAll<E extends Element>(root: ParentNode, s: string): E[] {
  try {
    return [...root.querySelectorAll<E>(s)];
  } catch {
    return [];
  }
}
