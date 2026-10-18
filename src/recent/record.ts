import { inputIdFromName, workflowFileName, workflowPathForForm, type Repo } from '../github/page';
import { queryAll } from '../github/selectors';
import { addToHistory, recentKey, toHistory, type RecentStore } from './history';

/**
 * Remembers the single-line text values of a submitted "Run workflow" form.
 * Fields with options already have a list; multiline fields are textareas and not read here.
 */
export async function recordSubmission(form: HTMLFormElement, repo: Repo, store: RecentStore): Promise<void> {
  const workflowPath = workflowPathForForm(form);
  if (!workflowPath) return;
  const values: Record<string, string> = {};
  for (const input of queryAll<HTMLInputElement>('dispatchTextInputs', form)) {
    const id = inputIdFromName(input.name);
    if (!id || input.dataset.ymRecent === 'off' || input.dataset.ymState === 'options') continue;
    values[id] = input.value;
  }
  if (!Object.keys(values).length) return;
  const key = recentKey(repo, workflowFileName(workflowPath));
  await store.set(key, addToHistory(toHistory(await store.get(key)), values));
}
