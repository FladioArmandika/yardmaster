import { readFileSync } from 'node:fs';
import { expect, test } from './extension';

const page = (name: string) => readFileSync(`tests/fixtures/${name}`, 'utf8');

test('upgrades the dispatch form and posts newlines', async ({ context }) => {
  let posted: URLSearchParams | null = null;
  await context.route('https://github.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/actions/manual') && route.request().method() === 'POST') {
      posted = new URLSearchParams(route.request().postData() ?? '');
      return route.fulfill({ body: 'ok' });
    }
    if (url.pathname.endsWith('/refs')) return route.fulfill({ json: { refs: ['main', 'release/1.0'] } });
    if (url.pathname.includes('/raw/')) return route.fulfill({ status: 404 });
    return route.fulfill({ contentType: 'text/html', body: page('dispatch-standin.html') });
  });

  const tab = await context.newPage();
  await tab.goto('https://github.com/o/r/actions/workflows/spike.yml');

  const notes = tab.locator('textarea[name="inputs[notes]"]');
  await expect(notes).toBeVisible();
  await expect(tab.getByText('Release notes')).toBeVisible();
  await notes.fill('line 1\nline 2');

  const target = tab.locator('#target');
  await expect(target).toHaveAttribute('role', 'combobox');
  await target.fill('rel');
  await tab.getByRole('option', { name: 'release/1.0' }).click();
  await expect(target).toHaveValue('release/1.0');

  await tab.getByRole('button', { name: 'Run workflow' }).click();
  await expect.poll(() => posted?.get('inputs[notes]')).toBe('line 1\r\nline 2');
  expect(posted!.get('inputs[target]')).toBe('release/1.0');
});
