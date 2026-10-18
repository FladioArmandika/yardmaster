import { query } from './selectors';

export interface Repo {
  owner: string;
  repo: string;
}

const RESERVED_OWNERS = new Set([
  'orgs', 'settings', 'marketplace', 'notifications', 'explore', 'topics', 'sponsors', 'login', 'features', 'apps',
]);

export function repoFromPath(pathname: string): Repo | null {
  const [owner, repo] = pathname.split('/').filter(Boolean);
  if (!owner || !repo || RESERVED_OWNERS.has(owner)) return null;
  return { owner, repo };
}

export function isActionsPath(pathname: string): boolean {
  return pathname.split('/').filter(Boolean)[2] === 'actions';
}

/** ".github/workflows/deploy.yml" → "deploy.yml" */
export function workflowFileName(path: string): string {
  return path.split('/').pop() ?? path;
}

/** Finds the workflow file a dispatch form belongs to, as a path like ".github/workflows/x.yml". */
export function workflowPathForForm(form: HTMLFormElement): string | null {
  const field = query<HTMLInputElement>('dispatchWorkflowField', form);
  if (field?.value) return field.value;
  const details = form.closest('details');
  const url = details?.getAttribute('data-deferred-details-content-url');
  if (url) {
    const value = new URL(url, 'https://github.com').searchParams.get('workflow');
    if (value) return value;
  }
  const fromPath = location.pathname.match(/\/actions\/workflows\/([^/]+)$/);
  return fromPath?.[1] ? `.github/workflows/${decodeURIComponent(fromPath[1])}` : null;
}

/** The ref chosen in "Use workflow from". Config is read from the same ref. */
export function refForForm(form: HTMLFormElement): string {
  return query<HTMLInputElement>('dispatchRefField', form)?.value || 'HEAD';
}

/** "inputs[notes]" → "notes" */
export function inputIdFromName(name: string): string | null {
  return name.match(/^inputs\[(.+)\]$/)?.[1] ?? null;
}
