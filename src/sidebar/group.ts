import type { FoldersConfig } from '../config/schema';

export interface WorkflowEntry {
  /** File name, e.g. "deploy--prod.yml". */
  file: string;
}

export interface Folder<T extends WorkflowEntry> {
  name: string;
  items: T[];
}

/**
 * Groups workflows into folders, keeping GitHub's order inside each folder.
 * Workflows without a folder come back in `loose`, in their original order.
 */
export function groupWorkflows<T extends WorkflowEntry>(
  entries: T[],
  config: FoldersConfig,
): { folders: Folder<T>[]; loose: T[] } {
  const folders = new Map<string, T[]>();
  const loose: T[] = [];
  if (config.by === 'off') return { folders: [], loose: [...entries] };

  for (const entry of entries) {
    const name = config.by === 'map' ? folderFromMap(entry.file, config.map) : folderFromPrefix(entry.file, config.separator);
    if (name) folders.set(name, [...(folders.get(name) ?? []), entry]);
    else loose.push(entry);
  }

  // A prefix that only one workflow uses isn't worth a folder.
  if (config.by === 'prefix') {
    for (const [name, items] of folders) {
      if (items.length < 2) {
        folders.delete(name);
        loose.push(...items);
      }
    }
    loose.sort((a, b) => entries.indexOf(a) - entries.indexOf(b));
  }

  return {
    folders: [...folders].map(([name, items]) => ({ name, items })).sort((a, b) => a.name.localeCompare(b.name)),
    loose,
  };
}

export function folderFromPrefix(file: string, separator: string): string | null {
  const i = file.indexOf(separator);
  return i > 0 ? file.slice(0, i) : null;
}

export function folderFromMap(file: string, map: Record<string, string[]>): string | null {
  for (const [name, globs] of Object.entries(map)) {
    if (globs.some((g) => globToRegExp(g).test(file))) return name;
  }
  return null;
}

/** Supports `*` and `?` in file-name globs. */
export function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}
