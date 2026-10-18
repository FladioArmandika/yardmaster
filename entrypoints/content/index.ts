import { enhanceDispatchInput } from '@/src/dispatch/enhance';
import { isActionsPath, repoFromPath } from '@/src/github/page';
import { matches, selectorList } from '@/src/github/selectors';
import { toHistory, type RecentStore } from '@/src/recent/history';
import { recordSubmission } from '@/src/recent/record';
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
        if (repo) void enhanceDispatchInput(input, { repo, recent });
      },
      ctx.signal,
    );

    // Capture phase, so the values are read before GitHub's form handles the submit.
    document.addEventListener(
      'submit',
      (e) => {
        const form = e.target;
        if (!(form instanceof HTMLFormElement) || !isActionsPath(location.pathname)) return;
        if (!matches('dispatchForm', form)) return;
        const repo = repoFromPath(location.pathname);
        if (repo) void recordSubmission(form, repo, recent).catch(() => {});
      },
      { capture: true, signal: ctx.signal },
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

/** Past values of plain text inputs, per repository and workflow, in the browser's extension storage. */
const recent: RecentStore = {
  async get(key) {
    return toHistory((await browser.storage.local.get(key))[key]);
  },
  async set(key, history) {
    await browser.storage.local.set({ [key]: history });
  },
};
