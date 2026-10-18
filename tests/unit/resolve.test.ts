import { describe, expect, it, vi } from 'vitest';
import { parseOptionsFile, resolveOptions, type ResolveContext } from '../../src/options/resolve';

const ctx = (over: Partial<ResolveContext> = {}): ResolveContext => ({
  ref: 'main',
  listRefs: vi.fn(async (type) => (type === 'branch' ? ['main', 'release/1.0', 'release/1.1', 'main'] : ['v1', 'v2'])),
  readFile: vi.fn(async () => '["api", {"label": "Web app", "value": "web"}, 3]'),
  ...over,
});

describe('resolveOptions', () => {
  it('lists branches with a match filter and no duplicates', async () => {
    const c = ctx();
    expect(await resolveOptions({ kind: 'branches', match: '^release/' }, c)).toEqual([
      { label: 'release/1.0', value: 'release/1.0' },
      { label: 'release/1.1', value: 'release/1.1' },
    ]);
    expect((await resolveOptions({ kind: 'branches' }, c)).map((o) => o.value)).toEqual(['main', 'release/1.0', 'release/1.1']);
    expect(c.listRefs).toHaveBeenCalledWith('branch');
  });

  it('lists tags', async () => {
    expect((await resolveOptions({ kind: 'tags' }, ctx())).map((o) => o.value)).toEqual(['v1', 'v2']);
  });

  it('reads a JSON file at the selected ref', async () => {
    const c = ctx({ ref: 'release/1.0' });
    expect(await resolveOptions({ kind: 'file', path: '.github/svc.json' }, c)).toEqual([
      { label: 'api', value: 'api' },
      { label: 'Web app', value: 'web' },
      { label: '3', value: '3' },
    ]);
    expect(c.readFile).toHaveBeenCalledWith('release/1.0', '.github/svc.json');
  });

  it('explains missing or malformed files', async () => {
    await expect(resolveOptions({ kind: 'file', path: 'x.json' }, ctx({ readFile: async () => null }))).rejects.toThrow(
      'x.json was not found at main',
    );
    expect(() => parseOptionsFile('{', 'x.json')).toThrow('x.json is not valid JSON');
    expect(() => parseOptionsFile('{"a":1}', 'x.json')).toThrow('x.json should be a JSON array');
    expect(() => parseOptionsFile('[{"nope":1}]', 'x.json')).toThrow('x.json: entry 1 should be text');
  });
});
