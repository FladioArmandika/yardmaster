import { enhanceDispatchInput } from '@/src/dispatch/enhance';
import { isActionsPath, repoFromPath } from '@/src/github/page';
import { selectorList } from '@/src/github/selectors';
import { enhanceSidebar, type CollapseStore } from '@/src/sidebar/enhance';
import { observe } from '@/src/util/observe';
import './style.css';

export default defineContentScript({
  // All of github.com, because GitHub navigates between pages without reloading.
  // Nothing runs outside a repository's Actions pages.
  matches: ['https://github.com/*'],
  runAt: 'document_idle',

  main(ctx) {
    // Watch inputs rather than forms: GitHub's React form swaps its inputs
    // when the "Use workflow from" branch changes.
    observe<HTMLInputElement>(
      selectorList('dispatchTextInputs'),
      (input) => {
        if (!isActionsPath(location.pathname)) return;
        const repo = repoFromPath(location.pathname);
        if (repo) void enhanceDispatchInput(input, { repo });
      },
      ctx.signal,
    );

    observe<HTMLUListElement>(
      selectorList('sidebarGroupList'),
      (list) => {
        if (!isActionsPath(location.pathname)) return;
        const repo = repoFromPath(location.pathname);
        if (repo) void enhanceSidebar(list, { repo, store });
      },
      ctx.signal,
    );
  },
});

/** Which folders are collapsed, per repository, in the browser's extension storage. */
const store: CollapseStore = {
  async get(key) {
    const value = (await browser.storage.local.get(key))[key];
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  },
  async set(key, folders) {
    await browser.storage.local.set({ [key]: folders });
  },
};
