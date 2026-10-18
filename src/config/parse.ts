import { parse as parseYaml } from 'yaml';
import { parseOptionsShorthand, toOption } from './options-source';
import { emptyConfig, type InputConfig, type Option, type RepoConfig, type Warnings } from './schema';

const INPUT_KEYS = new Set(['multiline', 'rows', 'options', 'match', 'allowCustom']);

/** Reads `.github/dispatch-ui.yml`. Never throws: problems come back as warnings. */
export function parseRepoConfig(text: string): { config: RepoConfig; warnings: Warnings } {
  const config = emptyConfig();
  const warnings: Warnings = [];

  let doc: unknown;
  try {
    doc = parseYaml(text);
  } catch (e) {
    warnings.push(`dispatch-ui.yml is not valid YAML: ${(e as Error).message.split('\n')[0]}`);
    return { config, warnings };
  }
  if (doc == null) return { config, warnings };
  if (!isRecord(doc)) {
    warnings.push('dispatch-ui.yml should be a mapping at the top level');
    return { config, warnings };
  }

  if (doc.version !== undefined && doc.version !== 1) {
    warnings.push(`unsupported version ${String(doc.version)}, reading it as version 1`);
  }

  if (doc.workflows !== undefined) {
    if (!isRecord(doc.workflows)) warnings.push('`workflows` should be a mapping of file names');
    else {
      for (const [file, wf] of Object.entries(doc.workflows)) {
        const inputs = isRecord(wf) && isRecord(wf.inputs) ? wf.inputs : null;
        if (!inputs) {
          warnings.push(`workflows.${file} needs an \`inputs\` mapping`);
          continue;
        }
        const parsed: Record<string, InputConfig> = {};
        for (const [id, raw] of Object.entries(inputs)) {
          const input = parseInput(raw, `workflows.${file}.inputs.${id}`, warnings);
          if (input) parsed[id] = input;
        }
        config.workflows[file] = { inputs: parsed };
      }
    }
  }

  if (doc.folders !== undefined) parseFolders(doc.folders, config, warnings);

  for (const key of Object.keys(doc)) {
    if (!['version', 'workflows', 'folders'].includes(key)) warnings.push(`ignored unknown key \`${key}\``);
  }
  return { config, warnings };
}

function parseInput(raw: unknown, where: string, warnings: Warnings): InputConfig | null {
  if (!isRecord(raw)) {
    warnings.push(`${where} should be a mapping like { multiline: true }`);
    return null;
  }
  const out: InputConfig = {};
  for (const key of Object.keys(raw)) {
    if (!INPUT_KEYS.has(key)) warnings.push(`${where}: ignored unknown key \`${key}\``);
  }

  if (raw.multiline !== undefined) {
    if (typeof raw.multiline === 'boolean') out.multiline = raw.multiline;
    else warnings.push(`${where}.multiline should be true or false`);
  }
  if (raw.rows !== undefined) {
    if (Number.isInteger(raw.rows) && (raw.rows as number) > 0 && (raw.rows as number) <= 50) out.rows = raw.rows as number;
    else warnings.push(`${where}.rows should be a whole number from 1 to 50`);
  }
  if (raw.allowCustom !== undefined) {
    if (typeof raw.allowCustom === 'boolean') out.allowCustom = raw.allowCustom;
    else warnings.push(`${where}.allowCustom should be true or false`);
  }

  let match: string | undefined;
  if (raw.match !== undefined) {
    if (typeof raw.match === 'string' && isValidRegex(raw.match)) match = raw.match;
    else warnings.push(`${where}.match should be a valid regular expression`);
  }

  if (raw.options !== undefined) {
    if (typeof raw.options === 'string') {
      const source = parseOptionsShorthand(raw.options, match);
      if (source) out.options = source;
      else warnings.push(`${where}.options is empty`);
    } else if (Array.isArray(raw.options)) {
      const values = raw.options.map((v) => toOptionValue(v)).filter((v): v is Option => v !== null);
      if (values.length !== raw.options.length) warnings.push(`${where}.options has entries that are not text`);
      if (values.length) out.options = { kind: 'static', values };
    } else {
      warnings.push(`${where}.options should be branches, tags, file:<path> or a list`);
    }
  } else if (match) {
    warnings.push(`${where}.match has no effect without options`);
  }

  if (out.multiline && out.options) {
    warnings.push(`${where}: multiline and options can't be combined, using options`);
    delete out.multiline;
  }
  return out;
}

function parseFolders(raw: unknown, config: RepoConfig, warnings: Warnings): void {
  if (!isRecord(raw)) {
    warnings.push('`folders` should be a mapping');
    return;
  }
  const f = config.folders;
  if (raw.by !== undefined) {
    if (raw.by === 'prefix' || raw.by === 'map' || raw.by === 'off') f.by = raw.by;
    else warnings.push('folders.by should be prefix, map or off');
  }
  if (raw.separator !== undefined) {
    if (typeof raw.separator === 'string' && raw.separator.length > 0) f.separator = raw.separator;
    else warnings.push('folders.separator should be non-empty text');
  }
  if (raw.map !== undefined) {
    if (!isRecord(raw.map)) warnings.push('folders.map should map folder names to lists of file globs');
    else {
      for (const [folder, globs] of Object.entries(raw.map)) {
        const list = Array.isArray(globs) ? globs : [globs];
        const clean = list.filter((g): g is string => typeof g === 'string' && g.length > 0);
        if (clean.length !== list.length) warnings.push(`folders.map.${folder} should be a list of file globs`);
        if (clean.length) f.map[folder] = clean;
      }
    }
  }
}

function toOptionValue(v: unknown): Option | null {
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return toOption(String(v));
  if (isRecord(v) && typeof v.value === 'string') {
    return { value: v.value, label: typeof v.label === 'string' ? v.label : v.value };
  }
  return null;
}

export function isValidRegex(source: string): boolean {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
