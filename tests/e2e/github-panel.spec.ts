import { readFileSync } from 'node:fs';
import { expect, test } from './extension';

// GitHub's real "Run workflow" panel markup (Primer React Dialog), captured 2026-10-18.
const fixture = readFileSync('tests/fixtures/github-2026-10-18-dispatch.html', 'utf8');

test('works on the captured GitHub panel', async ({ context }) => {
  let posted: URLSearchParams | null = null;
  await context.route('https://github.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/actions/manual') && route.request().method() === 'POST') {
      posted = new URLSearchParams(route.request().postData() ?? '');
      return route.fulfill({ body: 'ok' });
    }
    if (url.pathname.endsWith('/refs')) return route.fulfill({ json: { refs: ['main', 'release/1.0'], cacheKey: 'x' } });
    if (url.pathname.includes('/raw/')) return route.fulfill({ status: 404 });
    return route.fulfill({ contentType: 'text/html', body: fixture });
  });

  const tab = await context.newPage();
  await tab.goto('https://github.com/o/r/actions/workflows/spike.yml');

  await expect(tab.locator('label[for="_r_h_"]')).toHaveText('Release notes');
  const notes = tab.locator('textarea[name="inputs[notes]"]');
  await notes.fill('a\nb');

  const target = tab.locator('#_r_n_');
  await expect(target).toHaveAttribute('role', 'combobox');
  await target.click();
  const option = tab.getByRole('option', { name: 'release/1.0' });
  await expect
    .poll(() =>
      option.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el;
      }),
    )
    .toBe(true);
  await option.click();
  await expect(target).toHaveValue('release/1.0');

  await tab.getByRole('button', { name: 'Run workflow' }).click();
  await expect.poll(() => posted?.get('inputs[notes]')).toBe('a\r\nb');
  expect(posted!.get('inputs[target]')).toBe('release/1.0');
  expect(posted!.get('branch')).toBe('main');
});
