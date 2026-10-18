export interface Option {
  label: string;
  value: string;
}

export type OptionsSource =
  | { kind: 'static'; values: Option[] }
  | { kind: 'branches'; match?: string }
  | { kind: 'tags'; match?: string }
  | { kind: 'file'; path: string; match?: string };

export interface InputConfig {
  multiline?: boolean;
  rows?: number;
  options?: OptionsSource;
  allowCustom?: boolean;
}

export interface WorkflowConfig {
  inputs: Record<string, InputConfig>;
}

export interface FoldersConfig {
  by: 'prefix' | 'map' | 'off';
  separator: string;
  map: Record<string, string[]>;
}

export interface RepoConfig {
  workflows: Record<string, WorkflowConfig>;
  folders: FoldersConfig;
}

/** Problems found while reading config. Shown inline, never thrown. */
export type Warnings = string[];

export const CONFIG_PATH = '.github/dispatch-ui.yml';

export const DEFAULT_FOLDERS: FoldersConfig = { by: 'prefix', separator: '--', map: {} };

export function emptyConfig(): RepoConfig {
  return { workflows: {}, folders: { ...DEFAULT_FOLDERS, map: {} } };
}
