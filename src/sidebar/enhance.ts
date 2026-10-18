import { parseRepoConfig } from '../config/parse';
import { CONFIG_PATH, DEFAULT_FOLDERS, type FoldersConfig } from '../config/schema';
import { fetchRepoFile, type Fetcher } from '../github/fetch';
import type { Repo } from '../github/page';
import { applyFolders, workflowEntries } from './folders';

export interface CollapseStore {
  get(key: string): Promise<string[]>;
  set(key: string, folders: string[]): Promise<void>;
}

export interface SidebarDeps {
  repo: Repo;
  store: CollapseStore;
  fetcher?: Fetcher;
}

/**
 * Groups one sidebar workflow list into folders and keeps it grouped when
 * React re-renders the list (new workflows loaded, pins changed, navigation).
 */
export async function enhanceSidebar(list: HTMLUListElement, { repo, store, fetcher }: SidebarDeps): Promise<void> {
  if (list.dataset.ymSidebar || !workflowEntries(list).length) return;
  list.dataset.ymSidebar = 'pending';

  const config = await loadFoldersConfig(repo, fetcher);
  if (config.by === 'off') return;
  const key = `collapsed:${repo.owner}/${repo.repo}`.toLowerCase();
  const collapsed = new Set(await store.get(key).catch(() => []));
  const state = {
    collapsed,
    onToggle: () => void store.set(key, [...collapsed]).catch(() => {}),
  };

  let undo = () => {};
  let signature = '';
  const apply = () => {
    const files = workflowEntries(list).map((e) => e.file).join('\n');
    if (files === signature) return;
    signature = files;
    undo();
    try {
      undo = applyFolders(list, config, state);
      list.dataset.ymSidebar = 'done';
    } catch (e) {
      undo = () => {};
      list.dataset.ymSidebar = 'failed';
      console.warn('[Yardmaster] folders', e);
    }
  };
  apply();

  // Our own header items don't change the workflow list, so the signature check ignores them.
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (list.isConnected) apply();
    });
  }).observe(list, { childList: true });
}

async function loadFoldersConfig(repo: Repo, fetcher?: Fetcher): Promise<FoldersConfig> {
  try {
    const text = await fetchRepoFile(repo, 'HEAD', CONFIG_PATH, fetcher);
    if (text !== null) return parseRepoConfig(text).config.folders;
  } catch {
    // Fall back to the filename-prefix convention.
  }
  return DEFAULT_FOLDERS;
}
