import { exec } from './exec';

const decode = (text: string) =>
  text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const TOKEN = /<(\/?)(dict|array)>|<key>([^<]*)<\/key>\s*<(string|date)>([^<]*)<\/\4>/g;

/**
 * Top-level string and date values of a plist, binary or XML. plutil's JSON output fails on
 * plists that hold dates or data, so this reads the XML form and skips nested dictionaries.
 */
export async function readPlist(file: string): Promise<Record<string, string> | null> {
  const { ok, stdout } = await exec('plutil', ['-convert', 'xml1', '-o', '-', file]);
  if (!ok) return null;
  const values: Record<string, string> = {};
  let depth = 0;
  for (const [, closing, container, key, , value] of stdout.matchAll(TOKEN)) {
    if (container) depth += closing ? -1 : 1;
    else if (depth === 1 && key !== undefined) values[decode(key)] = decode(value);
  }
  return values;
}
