import { describe, expect, it } from 'vitest';
import { globToRegExp, groupWorkflows } from '../../src/sidebar/group';

const e = (...files: string[]) => files.map((file) => ({ file }));

describe('groupWorkflows', () => {
  it('groups by prefix, keeping order and leaving single-use prefixes loose', () => {
    const r = groupWorkflows(e('ci.yml', 'deploy--prod.yml', 'lint--js.yml', 'deploy--staging.yml', 'build.yml'), {
      by: 'prefix',
      separator: '--',
      map: {},
    });
    expect(r.folders).toEqual([{ name: 'deploy', items: e('deploy--prod.yml', 'deploy--staging.yml') }]);
    expect(r.loose).toEqual(e('ci.yml', 'lint--js.yml', 'build.yml'));
  });

  it('groups by map with globs', () => {
    const r = groupWorkflows(e('deploy-a.yml', 'release.yml', 'ci-x.yml', 'other.yml'), {
      by: 'map',
      separator: '--',
      map: { Deploy: ['deploy-*.yml', 'release.yml'], CI: ['ci-?.yml'] },
    });
    expect(r.folders.map((f) => [f.name, f.items.map((i) => i.file)])).toEqual([
      ['CI', ['ci-x.yml']],
      ['Deploy', ['deploy-a.yml', 'release.yml']],
    ]);
    expect(r.loose).toEqual(e('other.yml'));
  });

  it('does nothing when off', () => {
    expect(groupWorkflows(e('a--b.yml', 'a--c.yml'), { by: 'off', separator: '--', map: {} }).folders).toEqual([]);
  });

  it('escapes regex characters in globs', () => {
    expect(globToRegExp('a.yml').test('axyml')).toBe(false);
  });
});
