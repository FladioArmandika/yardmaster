import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FOLDERS } from '../../src/config/schema';
import { applyFolders, workflowEntries } from '../../src/sidebar/folders';

const LIST = ['ci.yml', 'deploy--prod.yml', 'lint--js.yml', 'deploy--staging.yml']
  .map((f) => `<li><a class="prc-ActionList-ActionListContent-x" href="/o/r/actions/workflows/${f}">${f}</a></li>`)
  .join('');

function setup() {
  document.head.innerHTML = '';
  document.body.innerHTML = `<ul class="prc-ActionList-GroupList-x">${LIST}</ul>`;
  return document.querySelector('ul')!;
}

describe('applyFolders', () => {
  it('adds a header per folder without touching GitHub\'s items', () => {
    const list = setup();
    const before = [...list.children];
    const onToggle = vi.fn();
    const undo = applyFolders(list, DEFAULT_FOLDERS, { collapsed: new Set(), onToggle });

    expect(workflowEntries(list).map((e) => e.file)).toEqual(['ci.yml', 'deploy--prod.yml', 'lint--js.yml', 'deploy--staging.yml']);
    expect([...list.children].slice(0, 4)).toEqual(before);
    const header = list.querySelector<HTMLElement>('[data-ym-owned="folder"]')!;
    expect(header.textContent).toBe('deploy2');
    expect(header.style.order).toBe('1000');
    const css = document.querySelector('style[data-ym-owned]')!.textContent!;
    expect(css).toContain('a[href$="/actions/workflows/deploy--prod.yml"]) { order: 1001;');
    expect(css).toContain('a[href$="/actions/workflows/deploy--staging.yml"]) { order: 1002;');
    expect(css).not.toContain('display: none');

    header.querySelector('button')!.click();
    expect(onToggle).toHaveBeenCalledWith('deploy', true);
    expect(header.querySelector('button')!.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('style[data-ym-owned]')!.textContent).toContain(':not(:has(> a[aria-current="page"])) { display: none; }');

    undo();
    expect([...list.children]).toEqual(before);
    expect(document.querySelector('style[data-ym-owned]')).toBeNull();
    expect(list.dataset.ymFolders).toBeUndefined();
  });

  it('does nothing when no folder has two workflows', () => {
    const list = setup();
    applyFolders(list, { by: 'prefix', separator: '__', map: {} }, { collapsed: new Set(), onToggle: () => {} });
    expect(list.querySelector('[data-ym-owned]')).toBeNull();
  });
});
