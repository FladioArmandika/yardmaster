import type { Option, OptionsSource } from './schema';

/**
 * Parses the shorthand used by both the config file and description markers:
 * "branches", "tags", "file:path/to/options.json", or "a, b, c".
 */
export function parseOptionsShorthand(raw: string, match?: string): OptionsSource | null {
  const text = raw.trim();
  if (!text) return null;
  if (text === 'branches' || text === 'tags') return withMatch({ kind: text }, match);
  if (text.startsWith('file:')) {
    const path = text.slice('file:'.length).trim().replace(/^\/+/, '');
    return path ? withMatch({ kind: 'file', path }, match) : null;
  }
  const values = text
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return values.length ? { kind: 'static', values: values.map(toOption) } : null;
}

export function toOption(value: string): Option {
  return { label: value, value };
}

function withMatch<T extends OptionsSource>(source: T, match?: string): T {
  return match ? { ...source, match } : source;
}
