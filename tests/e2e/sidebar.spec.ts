import { readFileSync } from 'node:fs';
import { expect, test } from './extension';

const fixture = readFileSync('tests/fixtures/github-2026-10-18-dispatch.html', 'utf8');

test('groups the captured sidebar into folders and remembers collapse', async ({ context }) => {
  await context.route('https://github.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/raw/')) return route.fulfill({ status: 404 });
    if (url.pathname.endsWith('/refs')) return route.fulfill({ json: { refs: ['main'] } });
    return route.fulfill({ contentType: 'text/html', body: fixture });
  });
  const tab = await context.newPage();
  await tab.goto('https://github.com/o/r/actions/workflows/ci--lint.yml');

  const folder = tab.getByRole('button', { name: 'deploy folder, 2 workflows' });
  await expect(folder).toHaveAttribute('aria-expanded', 'true');
  const prod = tab.locator('a[href$="/deploy--prod.yml"]');
  const staging = tab.locator('a[href$="/deploy--staging.yml"]');
  const lint = tab.locator('a[href$="/ci--lint.yml"]');

  // Visual order: folder header, its workflows, then the rest.
  const top = async (l: typeof prod) => (await l.boundingBox())!.y;
  expect(await top(folder)).toBeLessThan(await top(prod));
  expect(await top(prod)).toBeLessThan(await top(staging));
  expect(await top(staging)).toBeLessThan(await top(lint));

  await folder.click();
  await expect(prod).toBeHidden();
  await expect(staging).toBeHidden();
  await expect(lint).toBeVisible();

  await tab.reload();
  await expect(tab.getByRole('button', { name: 'deploy folder, 2 workflows' })).toHaveAttribute('aria-expanded', 'false');
  await expect(prod).toBeHidden();
});
