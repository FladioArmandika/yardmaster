import { parseMarkers } from '../config/markers';
import { resolveInputConfig } from '../config/merge';
import { parseRepoConfig } from '../config/parse';
import { CONFIG_PATH, type InputConfig, type RepoConfig } from '../config/schema';
import { fetchRefs, fetchRepoFile, type Fetcher } from '../github/fetch';
import { inputIdFromName, refForForm, workflowFileName, workflowPathForForm, type Repo } from '../github/page';
import { queryAll } from '../github/selectors';
import { resolveOptions } from '../options/resolve';
import { makeCombobox } from './combobox';
import { makeMultiline } from './multiline';
import { errorMessage, showNote } from './note';

export interface EnhanceDeps {
  repo: Repo;
  fetcher?: Fetcher;
}

const MARKER_TEXT = /\[(?:multiline|options)(?:\s*:\s*[^\]]*)?\]/gi;

/**
 * Upgrades the string inputs of one "Run workflow" form.
 * Every step is optional: anything that fails is undone and GitHub's own field stays.
 */
export async function enhanceDispatchForm(form: HTMLFormElement, { repo, fetcher }: EnhanceDeps): Promise<void> {
  if (form.dataset.ymState) return;
  form.dataset.ymState = 'pending';

  const inputs = queryAll<HTMLInputElement>('dispatchTextInputs', form);
  const workflowPath = workflowPathForForm(form);
  if (!inputs.length || !workflowPath) {
    form.dataset.ymState = 'skipped';
    return;
  }
  const workflowFile = workflowFileName(workflowPath);
  const ref = refForForm(form);
  const warnings: string[] = [];

  let repoConfig: RepoConfig | null = null;
  try {
    const text = await fetchRepoFile(repo, ref, CONFIG_PATH, fetcher);
    if (text !== null) {
      const parsed = parseRepoConfig(text);
      repoConfig = parsed.config;
      warnings.push(...parsed.warnings);
    }
  } catch (e) {
    warnings.push(`couldn't read ${CONFIG_PATH} (${errorMessage(e)}), using description markers only`);
  }

  const ctx = {
    ref,
    listRefs: (type: 'branch' | 'tag') => fetchRefs(repo, type, fetcher),
    readFile: (r: string, path: string) => fetchRepoFile(repo, r, path, fetcher),
  };

  await Promise.all(
    inputs.map(async (input) => {
      const id = inputIdFromName(input.name);
      if (!id) return;
      const group = inputGroup(input, form);
      const markers = parseMarkers(group.textContent ?? '');
      warnings.push(...markers.warnings.map((w) => `${id}: ${w}`));
      const config = resolveInputConfig(repoConfig, workflowFile, id, markers.config);
      if (!config) return;

      const undo: Array<() => void> = [];
      try {
        undo.push(hideMarkers(group));
        undo.push(await apply(input, config, ctx));
        input.dataset.ymEnhanced = config.options ? 'options' : 'multiline';
      } catch (e) {
        for (const fn of undo.reverse()) fn();
        showNote(input, `${errorMessage(e)}. This is GitHub's normal field.`);
      }
    }),
  );

  if (warnings.length) showNote(form.firstElementChild ?? form, warnings.join('; '), 'info');
  form.dataset.ymState = 'done';
}

async function apply(
  input: HTMLInputElement,
  config: InputConfig,
  ctx: Parameters<typeof resolveOptions>[1],
): Promise<() => void> {
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
