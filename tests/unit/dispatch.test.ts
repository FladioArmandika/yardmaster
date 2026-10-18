import { beforeEach, describe, expect, it } from 'vitest';
import { makeCombobox } from '../../src/dispatch/combobox';
import { enhanceDispatchForm, enhanceDispatchInput } from '../../src/dispatch/enhance';
import { makeMultiline } from '../../src/dispatch/multiline';
import { clearFetchCache, type Fetcher } from '../../src/github/fetch';

// Mirrors the field structure GitHub rendered on 2026-10-18 (React side panel, generated ids).
const FORM = `
<div role="dialog" aria-label="Run workflow">
  <form id="workflow_dispatch_form" action="/o/r/actions/manual" method="post" aria-label="Run workflow">
    <input type="hidden" name="workflow" value=".github/workflows/spike.yml">
    <input type="hidden" name="branch" value="main">
    <input type="hidden" name="show_workflow_tip" value="">
    <fieldset><label for="_r_h_">Filter branches</label><input type="text" id="_r_h_"></fieldset>
    <div><label for="_r_m_">[multiline] Release notes</label><input type="text" id="_r_m_" name="inputs[notes]" value="first"><span>notes</span></div>
    <div><label for="_r_n_">[options: branches] Branch</label><input type="text" id="_r_n_" name="inputs[target]" value="main"><span>target</span></div>
    <div><label for="_r_s_">Service</label><input type="text" id="_r_s_" name="inputs[svc]"><span>svc</span></div>
    <div><label for="_r_p_">Plain</label><input type="text" id="_r_p_" name="inputs[plain]"><span>plain</span></div>
    <div><label for="_r_t_">Level</label><select id="_r_t_" name="inputs[level]"><option>low</option></select></div>
    <div><input type="hidden" name="inputs[dry_run]" value="false"><input type="checkbox" id="_r_u_" name="inputs[dry_run]" value="true"><label for="_r_u_">Dry run</label></div>
    <button type="submit">Run workflow</button>
  </form>
</div>`;

const form = () => document.querySelector('form')!;
const data = () => Object.fromEntries(new FormData(form()) as unknown as Iterable<[string, string]>);

function mockFetcher(files: Record<string, string>, refs: Record<string, string[]> = {}): Fetcher {
  return async (url) => {
    const u = new URL(url, 'https://github.com');
    if (u.pathname.includes('/raw/')) {
      const path = u.pathname.split('/raw/')[1]!.split('/').slice(1).join('/');
      return path in files ? new Response(files[path]) : new Response('', { status: 404 });
    }
    if (u.pathname.endsWith('/refs')) {
      const list = refs[u.searchParams.get('type')!];
      return list ? Response.json({ refs: list }) : new Response('', { status: 500 });
    }
    return new Response('', { status: 404 });
  };
}

beforeEach(() => {
  document.body.innerHTML = FORM;
  clearFetchCache();
});

describe('makeMultiline', () => {
  it('moves the name to a textarea so newlines are submitted', () => {
    const input = document.querySelector<HTMLInputElement>('#_r_m_')!;
    const restore = makeMultiline(input, { rows: 5 });
    const ta = document.querySelector('textarea')!;
    expect(ta.name).toBe('inputs[notes]');
    expect(ta.id).toBe('_r_m_');
    expect(ta.value).toBe('first');
    expect(ta.getAttribute('rows')).toBe('5');
    expect(input.hidden).toBe(true);
    ta.value = 'a\nb\n  c';
    expect(data()['inputs[notes]']).toBe('a\nb\n  c');
    expect(document.querySelector('label[for="_r_m_"]')!.ownerDocument.getElementById('_r_m_')).toBe(ta);

    restore();
    expect(document.querySelector('textarea')).toBeNull();
    expect(input.name).toBe('inputs[notes]');
    expect(input.id).toBe('_r_m_');
    expect(input.hidden).toBe(false);
    expect(data()['inputs[notes]']).toBe('first');
  });
});

describe('makeCombobox', () => {
  const opts = ['main', 'release/1.0', 'release/1.1'].map((v) => ({ label: v, value: v }));

  it('filters, picks with the keyboard and writes into GitHub\'s own input', () => {
    const input = document.querySelector<HTMLInputElement>('#_r_n_')!;
    makeCombobox(input, opts);
    input.dispatchEvent(new Event('focus'));
    const list = document.querySelector<HTMLElement>('[role="listbox"]')!;
    expect(list.hidden).toBe(false);
    expect(list.querySelectorAll('[role="option"]')).toHaveLength(3);

    input.value = 'rel';
    input.dispatchEvent(new Event('input'));
    expect([...list.querySelectorAll('[role="option"]')].map((li) => li.textContent)).toEqual(['release/1.0', 'release/1.1']);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(input.value).toBe('release/1.1');
    expect(data()['inputs[target]']).toBe('release/1.1');
    expect(list.hidden).toBe(true);
  });

  it('blocks values outside the list unless allowCustom', () => {
    const input = document.querySelector<HTMLInputElement>('#_r_n_')!;
    const restore = makeCombobox(input, opts);
    input.value = 'nope';
    input.dispatchEvent(new Event('input'));
    expect(input.validity.customError).toBe(true);
    restore();
    expect(input.validity.customError).toBe(false);
    expect(input.getAttribute('role')).toBeNull();
    expect(document.querySelector('[role="listbox"]')).toBeNull();

    makeCombobox(input, opts, { allowCustom: true });
    input.dispatchEvent(new Event('input'));
    expect(input.validity.customError).toBe(false);
  });
});

describe('enhanceDispatchForm', () => {
  it('applies markers and the repo file, and strips markers from labels', async () => {
    const fetcher = mockFetcher(
      {
        '.github/dispatch-ui.yml': 'workflows:\n  spike.yml:\n    inputs:\n      svc: { options: "file:.github/svc.json" }\n',
        '.github/svc.json': '["api", "web"]',
      },
      { branch: ['main', 'dev'] },
    );
    await enhanceDispatchForm(form(), { repo: { owner: 'o', repo: 'r' }, fetcher });

    expect(document.querySelector('textarea')!.name).toBe('inputs[notes]');
    expect(document.querySelector('label[for="_r_m_"]')!.textContent).toBe(' Release notes');
    expect(form().querySelector<HTMLInputElement>('#_r_h_')!.getAttribute('role')).toBeNull();
    expect(document.querySelector('#_r_n_')!.getAttribute('role')).toBe('combobox');
    expect(document.querySelector('#_r_s_')!.getAttribute('role')).toBe('combobox');
    expect(document.querySelector('#_r_p_')!.getAttribute('role')).toBeNull();
    expect(document.querySelector('.ym-note')).toBeNull();
    expect(document.querySelector<HTMLInputElement>('#_r_p_')!.dataset.ymState).toBe('skipped');
  });

  it('leaves the field untouched and shows a note when options fail', async () => {
    const fetcher = mockFetcher({}, {}); // refs endpoint errors
    await enhanceDispatchForm(form(), { repo: { owner: 'o', repo: 'r' }, fetcher });
    const target = document.querySelector<HTMLInputElement>('#_r_n_')!;
    expect(target.getAttribute('role')).toBeNull();
    expect(document.querySelector('label[for="_r_n_"]')!.textContent).toBe('[options: branches] Branch');
    expect(target.nextElementSibling!.textContent).toMatch(/^Yardmaster: couldn't list branches \(HTTP 500\)\. This is GitHub's normal field\.$/);
    // the multiline input still works
    expect(document.querySelector('textarea')!.name).toBe('inputs[notes]');
  });

  it('reports config warnings once and keeps going', async () => {
    const fetcher = mockFetcher({ '.github/dispatch-ui.yml': 'colour: red' }, { branch: ['main'] });
    await enhanceDispatchForm(form(), { repo: { owner: 'o', repo: 'r' }, fetcher });
    expect(document.querySelectorAll('.ym-note')).toHaveLength(1);
    expect(document.querySelector('.ym-note')!.textContent).toBe('Yardmaster: ignored unknown key `colour`');
  });

  it('enhances inputs GitHub swaps in after a branch change', async () => {
    const fetcher = mockFetcher({}, { branch: ['main'] });
    await enhanceDispatchForm(form(), { repo: { owner: 'o', repo: 'r' }, fetcher });
    const fresh = document.createElement('input');
    fresh.type = 'text';
    fresh.id = '_r_x_';
    fresh.name = 'inputs[notes2]';
    const wrap = document.createElement('div');
    wrap.append(Object.assign(document.createElement('label'), { htmlFor: '_r_x_', textContent: '[multiline] More' }), fresh);
    form().append(wrap);
    await enhanceDispatchInput(fresh, { repo: { owner: 'o', repo: 'r' }, fetcher });
    expect(wrap.querySelector('textarea')!.name).toBe('inputs[notes2]');
  });

  it('runs once per input', async () => {
    const fetcher = mockFetcher({}, { branch: ['main'] });
    await enhanceDispatchForm(form(), { repo: { owner: 'o', repo: 'r' }, fetcher });
    await enhanceDispatchForm(form(), { repo: { owner: 'o', repo: 'r' }, fetcher });
    expect(document.querySelectorAll('textarea')).toHaveLength(1);
  });
});
