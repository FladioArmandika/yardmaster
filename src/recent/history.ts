import type { Repo } from '../github/page';

/** Past values per input id, newest first. */
export type InputHistory = Record<string, string[]>;

export interface RecentStore {
  get(key: string): Promise<InputHistory>;
  set(key: string, history: InputHistory): Promise<void>;
}

export const RECENT_LIMIT = 10;
/** Longer values are long-form text, not something you pick again from a list. */
export const RECENT_MAX_LENGTH = 200;

/** Input ids that may hold credentials. Their values are never stored. */
const SENSITIVE = /token|secret|passw|pwd|key|credential|auth|cookie|session|otp|private|cert/i;

export function isSensitive(inputId: string): boolean {
  return SENSITIVE.test(inputId);
}

export function recentKey(repo: Repo, workflowFile: string): string {
  return `recent:${repo.owner}/${repo.repo}:${workflowFile}`.toLowerCase();
}

/** Adds submitted values to the front of each input's history, deduped and capped. */
export function addToHistory(history: InputHistory, values: Record<string, string>): InputHistory {
  const next: InputHistory = { ...history };
  for (const [id, raw] of Object.entries(values)) {
    const value = raw.trim();
    if (!value || value.length > RECENT_MAX_LENGTH || /[\r\n]/.test(value) || isSensitive(id)) continue;
    next[id] = [value, ...(history[id] ?? []).filter((v) => v !== value)].slice(0, RECENT_LIMIT);
  }
  return next;
}

/** Reads a stored history defensively: storage can hold anything. */
export function toHistory(raw: unknown): InputHistory {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: InputHistory = {};
  for (const [id, list] of Object.entries(raw)) {
    if (Array.isArray(list)) out[id] = list.filter((v): v is string => typeof v === 'string').slice(0, RECENT_LIMIT);
  }
  return out;
}
