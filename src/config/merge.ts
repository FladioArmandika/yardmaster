import type { InputConfig, RepoConfig } from './schema';

/**
 * Picks the config for one input. Most specific wins:
 * the workflow's entry in dispatch-ui.yml, then description markers, then the "*" defaults.
 */
export function resolveInputConfig(
  repo: RepoConfig | null,
  workflowFile: string,
  inputId: string,
  markers: InputConfig,
): InputConfig | null {
  const fromWorkflow = repo?.workflows[workflowFile]?.inputs[inputId];
  const fromDefaults = repo?.workflows['*']?.inputs[inputId];
  const picked = fromWorkflow ?? (hasAny(markers) ? markers : fromDefaults);
  return picked && hasAny(picked) ? picked : null;
}

function hasAny(c: InputConfig): boolean {
  return Boolean(c.multiline || c.options);
}
