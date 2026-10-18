import { parseMarkers } from '../config/markers';
import { resolveInputConfig } from '../config/merge';
import { parseRepoConfig } from '../config/parse';
import { CONFIG_PATH, type InputConfig, type RepoConfig } from '../config/schema';
import { fetchRefs, fetchRepoFile, type Fetcher } from '../github/fetch';
import { inputIdFromName, refForForm, workflowFileName, workflowPathForForm, type Repo } from '../github/page';
import { queryAll } from '../github/selectors';
import { resolveOptions, type ResolveContext } from '../options/resolve';
import { makeCombobox } from './combobox';
import { makeMultiline } from './multiline';
import { errorMessage, showNote } from './note';

export interface EnhanceDeps {
  repo: Repo;
  fetcher?: Fetcher;
}

const MARKER_TEXT = /\[(?:multiline|options)(?:\s*:\s*[^\]]*)?\]/gi;

/** Config warnings are shown once per form, not once per input. */
const warnedForms = new WeakMap<HTMLFormElement, Set<string>>();

/**
 * Upgrades one string input of the "Run workflow" form.
 *
 * GitHub renders the form with React and re-renders inputs when the
 * "Use workflow from" branch changes, so this works per input: each new
 * input element is enhanced on its own, reading config at the branch selected now.
 * Anything that fails is undone and GitHub's own field stays.
 */
export async function enhanceDispatchInput(input: HTMLInputElement, { repo, fetcher }: EnhanceDeps): Promise<void> {
  if (input.dataset.ymState) return;
  input.dataset.ymState = 'pending';

  const form = input.form;
  const id = inputIdFromName(input.name);
  const workflowPath = form && workflowPathForForm(form);
  if (!form || !id || !workflowPath) {
    input.dataset.ymState = 'skipped';
    return;
  }
  const ref = refForForm(form);
  const { config: repoConfig, warnings } = await loadRepoConfig(repo, ref, fetcher);

  const group = inputGroup(input, form);
  const markers = parseMarkers(group.textContent ?? '');
  warnOnce(form, [...warnings, ...markers.warnings.map((w) => `${id}: ${w}`)]);

  const config = resolveInputConfig(repoConfig, workflowFileName(workflowPath), id, markers.config);
  if (!config || !input.isConnected) {
    input.dataset.ymState = 'skipped';
    return;
  }

  const ctx: ResolveContext = {
    ref,
    listRefs: (type) => fetchRefs(repo, type, fetcher),
    readFile: (r, path) => fetchRepoFile(repo, r, path, fetcher),
  };
  const undo: Array<() => void> = [];
  try {
    undo.push(hideMarkers(group));
    undo.push(await apply(input, config, ctx));
    input.dataset.ymState = config.options ? 'options' : 'multiline';
  } catch (e) {
    for (const fn of undo.reverse()) fn();
    showNote(input, `${errorMessage(e)}. This is GitHub's normal field.`);
    input.dataset.ymState = 'failed';
  }
}

/** Enhances every string input in a form. */
export async function enhanceDispatchForm(form: HTMLFormElement, deps: EnhanceDeps): Promise<void> {
  await Promise.all(queryAll<HTMLInputElement>('dispatchTextInputs', form).map((input) => enhanceDispatchInput(input, deps)));
}

async function loadRepoConfig(
  repo: Repo,
  ref: string,
  fetcher?: Fetcher,
): Promise<{ config: RepoConfig | null; warnings: string[] }> {
  try {
    const text = await fetchRepoFile(repo, ref, CONFIG_PATH, fetcher);
    return text === null ? { config: null, warnings: [] } : parseRepoConfig(text);
  } catch (e) {
    return { config: null, warnings: [`couldn't read ${CONFIG_PATH} (${errorMessage(e)}), using description markers only`] };
  }
}

function warnOnce(form: HTMLFormElement, warnings: string[]): void {
  const seen = warnedForms.get(form) ?? new Set<string>();
  warnedForms.set(form, seen);
  const fresh = warnings.filter((w) => !seen.has(w));
  if (!fresh.length) return;
  fresh.forEach((w) => seen.add(w));
  const existing = form.querySelector<HTMLElement>(':scope > .ym-note--info');
  if (existing) existing.textContent += `; ${fresh.join('; ')}`;
  else showNote(form.firstElementChild ?? form, fresh.join('; '), 'info');
}

async function apply(input: HTMLInputElement, config: InputConfig, ctx: ResolveContext): Promise<() => void> {
  if (config.options) {
    const placeholder = input.placeholder;
    input.placeholder = 'Loading options…';
    try {
      const options = await resolveOptions(config.options, ctx);
      if (!options.length) throw new Error('the option list is empty');
      return makeCombobox(input, options, { allowCustom: config.allowCustom });
    } finally {
      input.placeholder = placeholder;
    }
  }
  return makeMultiline(input, { rows: config.rows });
}

/**
 * The largest ancestor of `input` that holds no other dispatch field: its label,
 * description and the input itself. Found by structure, so it doesn't depend on GitHub's class names.
 */
export function inputGroup(input: HTMLElement, form: HTMLFormElement): HTMLElement {
  let group: HTMLElement = input;
  while (group.parentElement && group.parentElement !== form) {
    const parent = group.parentElement;
    const fields = parent.querySelectorAll('[name^="inputs["]');
    if (fields.length > 1 || (fields.length === 1 && fields[0] !== input)) break;
    group = parent;
  }
  return group;
}

/** Removes marker text such as "[multiline]" from the visible label. Returns an undo. */
function hideMarkers(group: HTMLElement): () => void {
  const changed: Array<[Text, string]> = [];
  const walker = document.createTreeWalker(group, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const before = node.data;
    const after = before.replace(MARKER_TEXT, '').replace(/\s{2,}/g, ' ');
    if (after !== before) {
      changed.push([node, before]);
      node.data = after;
    }
  }
  return () => {
    for (const [node, before] of changed) node.data = before;
  };
}
