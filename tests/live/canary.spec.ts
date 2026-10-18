import { writeFileSync, mkdirSync } from 'node:fs';
import { selectors } from '../../src/github/selectors';
import { expect, test } from '../e2e/extension';

// Loads real github.com pages, signed out, to catch GitHub markup changes before users do.
// The dispatch panel needs a signed-in user with write access, so only the sidebar is checked live;
// the panel is covered by the captured fixture in tests/e2e.

/** A public repo with deploy--prod.yml and deploy--staging.yml. */
const sandbox = process.env.CANARY_REPO || 'FladioArmandika/yardmaster-sandbox';
/** A busy public repo, to check the selectors against a sidebar Yardmaster doesn't control. */
const busy = process.env.CANARY_BUSY_REPO || 'actions/runner';

test.afterEach(async ({ context }, info) => {
  if (info.status === info.expectedStatus) return;
  // Save the markup so a selector fix can start from what GitHub actually served.
  mkdirSync('test-results/snapshots', { recursive: true });
  for (const [i, page] of context.pages().entries()) {
    writeFileSync(`test-results/snapshots/${info.title.replace(/\W+/g, '-')}-${i}.html`, await page.content());
  }
});

test('sidebar selectors still match GitHub', async ({ context }) => {
  const tab = await context.newPage();
  const res = await tab.goto(`https://github.com/${busy}/actions`);
  expect(res?.status(), `${busy}/actions should load signed out`).toBe(200);

  const found = await tab.evaluate((s) => {
    const first = (list: readonly string[], root: ParentNode = document) =>
      list.map((q) => root.querySelector(q)).find(Boolean) ?? null;
    const list = first(s.sidebarGroupList);
    const links = list ? s.sidebarLink.flatMap((q) => [...list.querySelectorAll(q)]) : [];
    return {
      list: !!list,
      links: links.length,
      // Folders rely on each link being a direct child of an <li> in the list.
      direct: links.filter((a) => a.parentElement?.tagName === 'LI' && a.parentElement.parentElement === list).length,
    };
  }, selectors);

  expect(found.list, 'sidebarGroupList should match the workflow list').toBe(true);
  expect(found.links, 'sidebarLink should match workflow links').toBeGreaterThan(0);
  expect(found.direct, 'workflow links should sit directly in list items').toBe(found.links);
});

test('folders render on the live sandbox', async ({ context }) => {
  const tab = await context.newPage();
  const res = await tab.goto(`https://github.com/${sandbox}/actions`);
  expect(res?.status(), `${sandbox}/actions should be public`).toBe(200);

  const folder = tab.getByRole('button', { name: /^deploy folder, \d+ workflows$/ });
  await expect(folder).toBeVisible({ timeout: 15_000 });
  const prod = tab.locator('a[href$="/deploy--prod.yml"]');
  expect((await folder.boundingBox())!.y).toBeLessThan((await prod.boundingBox())!.y);
  await folder.click();
  await expect(prod).toBeHidden();
});
