import { toSafeDate } from '../utils/dates';

const fakeTimestamp = (date: Date) => ({
  toDate: () => date,
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
});

describe('toSafeDate', () => {
  it('returns the same Date when given a Date object', () => {
    const d = new Date('2024-01-15T12:00:00Z');
    expect(toSafeDate(d)).toEqual(d);
  });

  it('converts a Firestore Timestamp to its Date', () => {
    const d = new Date('2024-06-01T09:00:00Z');
    expect(toSafeDate(fakeTimestamp(d) as any)).toEqual(d);
  });

  it('returns a current-ish Date when given null', () => {
    const before = Date.now();
    const result = toSafeDate(null);
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(Date.now() + 10);
  });

  it('returns a current-ish Date when given undefined', () => {
    const before = Date.now();
    const result = toSafeDate(undefined);
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(Date.now() + 10);
  });
});
