import type { FoldersConfig } from '../config/schema';
import { queryAll } from '../github/selectors';
import { groupWorkflows } from './group';

export interface FolderState {
  collapsed: Set<string>;
  onToggle(folder: string, collapsed: boolean): void;
}

interface Entry {
  file: string;
  li: HTMLLIElement;
}

const LOOSE_ORDER = 100_000;
let styleCounter = 0;

/**
 * Shows the sidebar's workflow list in collapsible folders.
 *
 * React owns the list, so its items are never moved or edited. Ordering and
 * collapsing are done with a generated stylesheet (`order` and `display`,
 * keyed on each link's href), and folder headers are extra list items placed
 * by `order`. Returns a function that removes all of it.
 */
export function applyFolders(list: HTMLUListElement, config: FoldersConfig, state: FolderState): () => void {
  const entries = workflowEntries(list);
  const { folders } = groupWorkflows(entries, config);
  if (!folders.length) return () => {};

  const id = `ym-folders-${++styleCounter}`;
  list.dataset.ymFolders = id;
  const style = document.createElement('style');
  style.dataset.ymOwned = 'folders';
  const headers: HTMLLIElement[] = [];

  const render = () => {
    const scope = `ul[data-ym-folders="${id}"]`;
    // Workflows outside any folder keep GitHub's order, after the folders.
    const rules = [
      `${scope} { display: flex; flex-direction: column; }`,
      `${scope} > li:not([data-ym-owned]) { order: ${LOOSE_ORDER}; }`,
    ];
    folders.forEach((folder, f) => {
      const base = (f + 1) * 1000;
      const collapsed = state.collapsed.has(folder.name);
      folder.items.forEach((item, i) => {
        const sel = `${scope} > li:has(> a[href$="/actions/workflows/${cssString(item.file)}"])`;
        rules.push(`${sel} { order: ${base + i + 1}; margin-left: 12px; }`);
        // A collapsed folder still shows the workflow you're looking at.
        if (collapsed) rules.push(`${sel}:not(:has(> a[aria-current="page"])) { display: none; }`);
      });
      const header = headers[f];
      if (header) {
        header.style.order = String(base);
        header.querySelector('button')!.setAttribute('aria-expanded', String(!collapsed));
      }
    });
    style.textContent = rules.join('\n');
  };

  folders.forEach((folder) => {
    const li = document.createElement('li');
    li.dataset.ymOwned = 'folder';
    li.className = 'ym-folder';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ym-folder-toggle';
    const chevron = document.createElement('span');
    chevron.className = 'ym-folder-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'ym-folder-name';
    name.textContent = folder.name;
    const count = document.createElement('span');
    count.className = 'ym-folder-count';
    count.textContent = String(folder.items.length);
    button.setAttribute('aria-label', `${folder.name} folder, ${folder.items.length} workflows`);
    button.append(chevron, name, count);
    button.addEventListener('click', () => {
      const collapsed = !state.collapsed.has(folder.name);
      if (collapsed) state.collapsed.add(folder.name);
      else state.collapsed.delete(folder.name);
      state.onToggle(folder.name, collapsed);
      render();
    });
    li.append(button);
    headers.push(li);
  });

  list.append(...headers);
  document.head.append(style);
  render();

  return () => {
    style.remove();
    headers.forEach((h) => h.remove());
    if (list.dataset.ymFolders === id) delete list.dataset.ymFolders;
  };
}

/** The workflow files listed in a sidebar list, in GitHub's order. */
export function workflowEntries(list: HTMLUListElement): Entry[] {
  const entries: Entry[] = [];
  for (const a of queryAll<HTMLAnchorElement>('sidebarLink', list)) {
    const li = a.parentElement;
    if (!(li instanceof HTMLLIElement) || li.parentElement !== list) continue;
    const file = decodeURIComponent(new URL(a.href, location.href).pathname.split('/').pop() ?? '');
    if (file) entries.push({ file, li });
  }
  return entries;
}

function cssString(s: string): string {
  return s.replace(/["\\]/g, '\\$&');
}
