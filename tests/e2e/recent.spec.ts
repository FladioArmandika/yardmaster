import { readFileSync } from 'node:fs';
import { expect, test } from './extension';

const fixture = readFileSync('tests/fixtures/dispatch-standin.html', 'utf8');

test('suggests values submitted before, but never token-like inputs', async ({ context }) => {
  await context.route('https://github.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/actions/manual')) return route.fulfill({ body: 'ok' });
    if (url.pathname.endsWith('/refs')) return route.fulfill({ json: { refs: ['main'] } });
    if (url.pathname.includes('/raw/')) return route.fulfill({ status: 404 });
    return route.fulfill({ contentType: 'text/html', body: fixture });
  });
  const tab = await context.newPage();
  await tab.goto('https://github.com/o/r/actions/workflows/spike.yml');

  // Nothing remembered yet: GitHub's plain field.
  const version = tab.locator('#_r_v_');
  await expect(tab.locator('textarea[name="inputs[notes]"]')).toBeVisible();
  await expect(version).not.toHaveAttribute('role', 'combobox');

  await version.fill('1.4.2');
  await tab.locator('#_r_k_').fill('ghp_secret');
  await Promise.all([tab.waitForURL('**/actions/manual'), tab.getByRole('button', { name: 'Run workflow' }).click()]);

  await tab.goto('https://github.com/o/r/actions/workflows/spike.yml');
  await expect(tab.locator('#_r_v_')).toHaveAttribute('role', 'combobox');
  await tab.locator('#_r_v_').click();
  await expect(tab.getByRole('option', { name: '1.4.2' })).toBeVisible();
  await tab.getByRole('option', { name: '1.4.2' }).click();
  await expect(tab.locator('#_r_v_')).toHaveValue('1.4.2');

  // Typing something new hides the list instead of showing "No match".
  await tab.locator('#_r_v_').fill('2.0.0');
  await expect(tab.getByRole('listbox')).toBeHidden();

  // The token was submitted too, but never stored, so it gets no suggestions.
  await expect(tab.locator('#_r_k_')).not.toHaveAttribute('role', 'combobox');
});
