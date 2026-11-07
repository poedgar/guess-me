import { describe, expect, it } from 'vitest';
import { getDisplayName } from './displayName';

describe('getDisplayName', () => {
  it('returns only the first name when showSurnames is false', () => {
    expect(getDisplayName('Olena Kovalenko', false)).toBe('Olena');
  });

  it('returns the full name when showSurnames is true', () => {
    expect(getDisplayName('Olena Kovalenko', true)).toBe('Olena Kovalenko');
  });
});
