import { describe, expect, it } from 'vitest';
import { recentAllowed } from '../../src/config/merge';
import { parseRepoConfig } from '../../src/config/parse';
import { addToHistory, isSensitive, recentKey, RECENT_LIMIT, toHistory } from '../../src/recent/history';

describe('addToHistory', () => {
  it('puts the newest value first and drops duplicates', () => {
    const h = addToHistory({ v: ['1.0', '0.9'] }, { v: '0.9' });
    expect(h.v).toEqual(['0.9', '1.0']);
  });

  it('caps each input at the limit', () => {
    let h = {};
    for (let i = 0; i < RECENT_LIMIT + 5; i++) h = addToHistory(h, { v: String(i) });
    expect((h as Record<string, string[]>).v).toHaveLength(RECENT_LIMIT);
  });

  it('skips empty, multiline, very long and token-like values', () => {
    const h = addToHistory({}, { a: '  ', b: 'x\ny', c: 'z'.repeat(500), api_token: 'ghp_x', DB_PASSWORD: 'p', ok: ' v1 ' });
    expect(h).toEqual({ ok: ['v1'] });
  });
});

describe('isSensitive', () => {
  it.each(['token', 'GITHUB_TOKEN', 'secret_name', 'password', 'ssh_key', 'auth', 'otp_code'])('flags %s', (id) => {
    expect(isSensitive(id)).toBe(true);
  });
  it.each(['version', 'environment', 'target', 'notes'])('allows %s', (id) => {
    expect(isSensitive(id)).toBe(false);
  });
});

describe('toHistory', () => {
  it('ignores malformed storage', () => {
    expect(toHistory(null)).toEqual({});
    expect(toHistory(['x'])).toEqual({});
    expect(toHistory({ a: ['x', 1, null], b: 'nope' })).toEqual({ a: ['x'] });
  });
});

describe('recent config', () => {
  it('is on by default and can be turned off per input or per repo', () => {
    expect(recentAllowed(null, 'deploy.yml', 'v')).toBe(true);
    const perInput = parseRepoConfig('workflows:\n  deploy.yml:\n    inputs:\n      v: { recent: false }\n').config;
    expect(recentAllowed(perInput, 'deploy.yml', 'v')).toBe(false);
    expect(recentAllowed(perInput, 'deploy.yml', 'w')).toBe(true);
    const repo = parseRepoConfig('recent: false\n');
    expect(repo.warnings).toEqual([]);
    expect(recentAllowed(repo.config, 'deploy.yml', 'v')).toBe(false);
  });

  it('keys history by repo and workflow, case-insensitively', () => {
    expect(recentKey({ owner: 'O', repo: 'R' }, 'Deploy.yml')).toBe('recent:o/r:deploy.yml');
  });
});
