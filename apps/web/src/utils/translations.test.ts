import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ERROR_MESSAGE_KEYS, localizeErrorMessage } from '@mirror/shared';
import en from '../../../../packages/shared/src/locales/en.json';
import uk from '../../../../packages/shared/src/locales/uk.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const enFlat = flatten(en as Tree);
const ukFlat = flatten(uk as Tree);
const fakeT = (key: string, options?: Record<string, unknown>) =>
  `${key}${options ? JSON.stringify(options) : ''}`;

describe('locale parity', () => {
  it('every English key has a Ukrainian translation', () => {
    const missing = Object.keys(enFlat).filter((k) => !(k in ukFlat));
    expect(missing).toEqual([]);
  });
});

describe('localizeErrorMessage', () => {
  it('maps a known error message to its key', () => {
    expect(localizeErrorMessage('Only the admin can start the game', fakeT)).toBe(
      'errors.adminOnlyStartGame',
    );
  });

  it('maps templated messages and passes their values', () => {
    expect(localizeErrorMessage('Not all players have submitted (3/5)', fakeT)).toBe(
      'errors.notAllSubmitted{"submitted":"3","total":"5"}',
    );
    expect(localizeErrorMessage("Group B hasn't finished submitting (1/2)", fakeT)).toBe(
      'errors.groupBNotFinished{"done":"1","total":"2"}',
    );
  });

  it('returns unknown messages unchanged', () => {
    expect(localizeErrorMessage('Не вдалося оновити налаштування.', fakeT)).toBe(
      'Не вдалося оновити налаштування.',
    );
  });

  it('every mapped key exists in both locales', () => {
    for (const key of Object.values(ERROR_MESSAGE_KEYS)) {
      expect(enFlat[key], key).toBeTruthy();
      expect(ukFlat[key], key).toBeTruthy();
    }
  });

  it('covers every error message GameContext throws (web and Expo)', () => {
    const root = path.resolve(__dirname, '../../../..');
    const files = ['apps/web/src/contexts/GameContext.tsx', 'apps/expo/contexts/GameContext.tsx'];
    // Developer-only errors that never reach a player.
    const ignored = new Set(['useGame must be used within a GameProvider']);
    const uncovered: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(path.join(root, file), 'utf8');
      for (const m of src.matchAll(/throw new Error\(\s*(["'`])((?:\\.|(?!\1).)*)\1\s*\)/g)) {
        const raw = m[2];
        if (ignored.has(raw)) continue;
        // Templated messages: substitute sample numbers for ${...}
        const sample = raw.replace(/\$\{[^}]+\}/g, '1');
        if (localizeErrorMessage(sample, fakeT) === sample) uncovered.push(`${file}: ${raw}`);
      }
    }
    expect(uncovered).toEqual([]);
  });
});
