import { parseOptionsShorthand } from './options-source';
import type { InputConfig, Warnings } from './schema';

const MARKER = /\[(multiline|options)(?:\s*:\s*([^\]]*))?\]/gi;

/**
 * Reads markers like `[multiline]` or `[options: branches]` from an input's description.
 * Returns the config they describe and the description with the markers removed.
 */
export function parseMarkers(description: string): { config: InputConfig; cleaned: string; warnings: Warnings } {
  const config: InputConfig = {};
  const warnings: Warnings = [];

  for (const [, rawName = '', rawArg] of description.matchAll(MARKER)) {
    const name = rawName.toLowerCase();
    if (name === 'multiline') {
      config.multiline = true;
      const rows = rawArg?.trim();
      if (rows) {
        const n = Number(rows);
        if (Number.isInteger(n) && n > 0 && n <= 50) config.rows = n;
        else warnings.push(`[multiline: ${rows}] should give a row count from 1 to 50`);
      }
    } else {
      const source = rawArg ? parseOptionsShorthand(rawArg) : null;
      if (source) config.options = source;
      else warnings.push('[options] needs a source, e.g. [options: branches]');
    }
  }

  if (config.multiline && config.options) {
    warnings.push("[multiline] and [options] can't be combined, using options");
    delete config.multiline;
    delete config.rows;
  }

  const cleaned = description.replace(MARKER, '').replace(/\s{2,}/g, ' ').trim();
  return { config, cleaned, warnings };
}
