import { beforeEach, describe, expect, it } from 'vitest';
import { makeCombobox } from '../../src/dispatch/combobox';
import { enhanceDispatchForm } from '../../src/dispatch/enhance';
import { makeMultiline } from '../../src/dispatch/multiline';
import { clearFetchCache, type Fetcher } from '../../src/github/fetch';

// A stand-in for GitHub's form until the real fixture from the spike replaces it.
const FORM = `
<details data-deferred-details-content-url="/o/r/actions/manual?workflow=.github%2Fworkflows%2Fspike.yml" open>
  <form action="/o/r/actions/manual" method="post">
    <input type="hidden" name="workflow" value=".github/workflows/spike.yml">
    <input type="hidden" name="ref" value="main">
    <div class="form-group"><label for="notes">[multiline] Release notes</label><input type="text" id="notes" name="inputs[notes]" value="first"></div>
    <div class="form-group"><label for="target">Branch [options: branches]</label><input type="text" id="target" name="inputs[target]" value="main"></div>
    <div class="form-group"><label for="svc">Service</label><input type="text" id="svc" name="inputs[svc]"></div>
    <div class="form-group"><label for="plain">Plain</label><input type="text" id="plain" name="inputs[plain]"></div>
    <div class="form-group"><label><input type="checkbox" name="inputs[dry]"> Dry run</label></div>
    <button type="submit">Run workflow</button>
  </form>
</details>`;

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
    const input = document.querySelector<HTMLInputElement>('#notes')!;
    const restore = makeMultiline(input, { rows: 5 });
    const ta = document.querySelector('textarea')!;
    expect(ta.name).toBe('inputs[notes]');
    expect(ta.id).toBe('notes');
    expect(ta.value).toBe('first');
    expect(ta.getAttribute('rows')).toBe('5');
    expect(input.hidden).toBe(true);
    ta.value = 'a\nb\n  c';
    expect(data()['inputs[notes]']).toBe('a\nb\n  c');
    expect(document.querySelector('label[for="notes"]')!.ownerDocument.getElementById('notes')).toBe(ta);

    restore();
    expect(document.querySelector('textarea')).toBeNull();
    expect(input.name).toBe('inputs[notes]');
    expect(input.id).toBe('notes');
    expect(input.hidden).toBe(false);
    expect(data()['inputs[notes]']).toBe('first');
  });
});

describe('makeCombobox', () => {
  const opts = ['main', 'release/1.0', 'release/1.1'].map((v) => ({ label: v, value: v }));

  it('filters, picks with the keyboard and writes into GitHub\'s own input', () => {
    const input = document.querySelector<HTMLInputElement>('#target')!;
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
    const input = document.querySelector<HTMLInputElement>('#target')!;
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
    expect(document.querySelector('label[for="notes"]')!.textContent).toBe(' Release notes');
    expect(document.querySelector('#target')!.getAttribute('role')).toBe('combobox');
    expect(document.querySelector('#svc')!.getAttribute('role')).toBe('combobox');
    expect(document.querySelector('#plain')!.getAttribute('role')).toBeNull();
    expect(document.querySelector('.ym-note')).toBeNull();
    expect(form().dataset.ymState).toBe('done');
  });

  it('leaves the field untouched and shows a note when options fail', async () => {
    const fetcher = mockFetcher({}, {}); // refs endpoint errors
    await enhanceDispatchForm(form(), { repo: { owner: 'o', repo: 'r' }, fetcher });
    const target = document.querySelector<HTMLInputElement>('#target')!;
    expect(target.getAttribute('role')).toBeNull();
    expect(document.querySelector('label[for="target"]')!.textContent).toBe('Branch [options: branches]');
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

  it('runs once per form', async () => {
    const fetcher = mockFetcher({}, { branch: ['main'] });
    await enhanceDispatchForm(form(), { repo: { owner: 'o', repo: 'r' }, fetcher });
    await enhanceDispatchForm(form(), { repo: { owner: 'o', repo: 'r' }, fetcher });
    expect(document.querySelectorAll('textarea')).toHaveLength(1);
  });
});
