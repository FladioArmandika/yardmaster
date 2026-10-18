import { toOption } from '../config/options-source';
import { isRecord } from '../config/parse';
import type { Option, OptionsSource } from '../config/schema';

export interface ResolveContext {
  ref: string;
  listRefs(type: 'branch' | 'tag'): Promise<string[]>;
  readFile(ref: string, path: string): Promise<string | null>;
}

export const MAX_OPTIONS = 2000;

/** Turns an options source into a concrete list. Throws with a readable message on failure. */
export async function resolveOptions(source: OptionsSource, ctx: ResolveContext): Promise<Option[]> {
  let options: Option[];
  switch (source.kind) {
    case 'static':
      options = source.values;
      break;
    case 'branches':
    case 'tags':
      options = (await ctx.listRefs(source.kind === 'branches' ? 'branch' : 'tag')).map(toOption);
      break;
    case 'file': {
      const text = await ctx.readFile(ctx.ref, source.path);
      if (text === null) throw new Error(`${source.path} was not found at ${ctx.ref}`);
      options = parseOptionsFile(text, source.path);
      break;
    }
  }
  if ('match' in source && source.match) {
    const re = new RegExp(source.match);
    options = options.filter((o) => re.test(o.value));
  }
  return dedupe(options).slice(0, MAX_OPTIONS);
}

/** Accepts ["a", "b"] or [{ "label": "A", "value": "a" }]. */
export function parseOptionsFile(text: string, path: string): Option[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${path} is not valid JSON`);
  }
  if (!Array.isArray(data)) throw new Error(`${path} should be a JSON array`);
  return data.map((item, i) => {
    if (typeof item === 'string' || typeof item === 'number') return toOption(String(item));
    if (isRecord(item) && (typeof item.value === 'string' || typeof item.value === 'number')) {
      const value = String(item.value);
      return { value, label: typeof item.label === 'string' ? item.label : value };
    }
    throw new Error(`${path}: entry ${i + 1} should be text or { "label", "value" }`);
  });
}

function dedupe(options: Option[]): Option[] {
  const seen = new Set<string>();
  return options.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
}
