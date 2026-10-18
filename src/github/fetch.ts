import type { Repo } from './page';

/**
 * Same-origin reads with the user's existing github.com session.
 * No tokens, no api.github.com: these are the URLs GitHub's own pages use.
 */

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>;
  const value = load();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}

export function clearFetchCache(): void {
  cache.clear();
}

export class FetchError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

const base = ({ owner, repo }: Repo) => `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

/** A file's text at a ref, or null when it doesn't exist. */
export function fetchRepoFile(repo: Repo, ref: string, path: string, fetcher: Fetcher = fetch): Promise<string | null> {
  const url = `${base(repo)}/raw/${encodePath(ref)}/${encodePath(path)}`;
  return cached(url, async () => {
    const res = await fetcher(url, { credentials: 'same-origin' });
    if (res.status === 404) return null;
    if (!res.ok) throw new FetchError(`couldn't read ${path} (HTTP ${res.status})`, res.status);
    return res.text();
  });
}

/** Branch or tag names, using the endpoint GitHub's own branch picker uses. */
export function fetchRefs(repo: Repo, type: 'branch' | 'tag', fetcher: Fetcher = fetch): Promise<string[]> {
  const url = `${base(repo)}/refs?type=${type}`;
  return cached(url, async () => {
    const res = await fetcher(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!res.ok) throw new FetchError(`couldn't list ${type === 'branch' ? 'branches' : 'tags'} (HTTP ${res.status})`, res.status);
    const body: unknown = await res.json();
    const refs = (body as { refs?: unknown }).refs;
    if (!Array.isArray(refs)) throw new FetchError(`unexpected ${type} list format`);
    return refs.filter((r): r is string => typeof r === 'string');
  });
}
