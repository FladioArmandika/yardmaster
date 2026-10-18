import { describe, expect, it } from 'vitest';
import { parseMarkers } from '../../src/config/markers';
import { resolveInputConfig } from '../../src/config/merge';
import { parseRepoConfig } from '../../src/config/parse';

describe('parseRepoConfig', () => {
  it('reads inputs, option shorthands and folders', () => {
    const { config, warnings } = parseRepoConfig(`
version: 1
workflows:
  "*":
    inputs:
      notes: { multiline: true }
  deploy--prod.yml:
    inputs:
      notes:   { multiline: true, rows: 8 }
      ref:     { options: branches, match: "^release/" }
      tag:     { options: tags }
      service: { options: "file:.github/services.json" }
      region:  { options: [us-east-1, eu-west-1], allowCustom: true }
      size:    { options: "s, m, l" }
folders:
  by: map
  separator: "__"
  map:
    Deploy: ["deploy-*.yml", "release.yml"]
`);
    expect(warnings).toEqual([]);
    const inputs = config.workflows['deploy--prod.yml']!.inputs;
    expect(inputs.notes).toEqual({ multiline: true, rows: 8 });
    expect(inputs.ref).toEqual({ options: { kind: 'branches', match: '^release/' } });
    expect(inputs.tag).toEqual({ options: { kind: 'tags' } });
    expect(inputs.service).toEqual({ options: { kind: 'file', path: '.github/services.json' } });
    expect(inputs.region?.allowCustom).toBe(true);
    expect(inputs.region?.options).toEqual({
      kind: 'static',
      values: [{ label: 'us-east-1', value: 'us-east-1' }, { label: 'eu-west-1', value: 'eu-west-1' }],
    });
    expect(inputs.size?.options).toMatchObject({ kind: 'static', values: [{ value: 's' }, { value: 'm' }, { value: 'l' }] });
    expect(config.workflows['*']!.inputs.notes).toEqual({ multiline: true });
    expect(config.folders).toEqual({ by: 'map', separator: '__', map: { Deploy: ['deploy-*.yml', 'release.yml'] } });
  });

  it('accepts label/value objects in a static list', () => {
    const { config } = parseRepoConfig(`
workflows:
  a.yml:
    inputs:
      svc: { options: [{ label: "API (prod)", value: api }, web] }
`);
    expect(config.workflows['a.yml']!.inputs.svc?.options).toEqual({
      kind: 'static',
      values: [{ label: 'API (prod)', value: 'api' }, { label: 'web', value: 'web' }],
    });
  });

  it('turns bad input into warnings, never throws', () => {
    expect(parseRepoConfig('workflows: [').warnings[0]).toMatch(/not valid YAML/);
    expect(parseRepoConfig('- a').warnings).toEqual(['dispatch-ui.yml should be a mapping at the top level']);
    expect(parseRepoConfig('').warnings).toEqual([]);
    const { config, warnings } = parseRepoConfig(`
colour: red
workflows:
  a.yml:
    inputs:
      x: { multiline: "yes", rows: 0, bogus: 1 }
      y: { options: branches, match: "(" }
      z: { multiline: true, options: tags }
  b.yml: {}
folders: { by: tree }
`);
    expect(warnings).toEqual(
      expect.arrayContaining([
        'ignored unknown key `colour`',
        'workflows.a.yml.inputs.x: ignored unknown key `bogus`',
        'workflows.a.yml.inputs.x.multiline should be true or false',
        'workflows.a.yml.inputs.x.rows should be a whole number from 1 to 50',
        'workflows.a.yml.inputs.y.match should be a valid regular expression',
        "workflows.a.yml.inputs.z: multiline and options can't be combined, using options",
        'workflows.b.yml needs an `inputs` mapping',
        'folders.by should be prefix, map or off',
      ]),
    );
    expect(config.workflows['a.yml']!.inputs.z).toEqual({ options: { kind: 'tags' } });
    expect(config.folders.by).toBe('prefix');
  });
});

describe('parseMarkers', () => {
  it('reads markers and strips them from the description', () => {
    expect(parseMarkers('[multiline] Release notes')).toEqual({
      config: { multiline: true },
      cleaned: 'Release notes',
      warnings: [],
    });
    expect(parseMarkers('Branch to deploy [options: branches]').config).toEqual({ options: { kind: 'branches' } });
    expect(parseMarkers('[options: file:/.github/svc.json] Service').config).toEqual({
      options: { kind: 'file', path: '.github/svc.json' },
    });
    expect(parseMarkers('[Options: s, m , l]').config.options).toMatchObject({ kind: 'static', values: [{ value: 's' }, { value: 'm' }, { value: 'l' }] });
    expect(parseMarkers('[multiline: 10] Notes').config).toEqual({ multiline: true, rows: 10 });
  });

  it('ignores ordinary brackets and reports bad markers', () => {
    expect(parseMarkers('Use [square] brackets').config).toEqual({});
    expect(parseMarkers('[options] x').warnings).toEqual(['[options] needs a source, e.g. [options: branches]']);
    expect(parseMarkers('[multiline] [options: tags]').config).toEqual({ options: { kind: 'tags' } });
  });
});

describe('resolveInputConfig', () => {
  const { config } = parseRepoConfig(`
workflows:
  "*": { inputs: { notes: { multiline: true }, tag: { options: tags } } }
  deploy.yml: { inputs: { notes: { multiline: true, rows: 9 } } }
`);
  it('prefers the workflow entry, then markers, then "*" defaults', () => {
    expect(resolveInputConfig(config, 'deploy.yml', 'notes', { options: { kind: 'branches' } })).toEqual({ multiline: true, rows: 9 });
    expect(resolveInputConfig(config, 'other.yml', 'tag', { options: { kind: 'branches' } })).toEqual({ options: { kind: 'branches' } });
    expect(resolveInputConfig(config, 'other.yml', 'tag', {})).toEqual({ options: { kind: 'tags' } });
    expect(resolveInputConfig(null, 'x.yml', 'y', {})).toBeNull();
  });
});
