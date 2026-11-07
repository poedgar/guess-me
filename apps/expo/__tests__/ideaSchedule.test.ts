import { generateIdeaSchedule } from '../utils/ideaSchedule';

describe('generateIdeaSchedule', () => {
  it('returns an array of the same length as the input', () => {
    const ids = ['a', 'b', 'c', 'd'];
    expect(generateIdeaSchedule(ids)).toHaveLength(4);
  });

  it('contains exactly the same participant ids, no duplicates or omissions', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const schedule = generateIdeaSchedule(ids);
    expect(new Set(schedule)).toEqual(new Set(ids));
    expect(schedule).toHaveLength(ids.length);
  });

  it('does not mutate the input array', () => {
    const ids = ['a', 'b', 'c'];
    const copy = [...ids];
    generateIdeaSchedule(ids);
    expect(ids).toEqual(copy);
  });

  it('handles a single participant', () => {
    expect(generateIdeaSchedule(['solo'])).toEqual(['solo']);
  });

  it('handles an empty array', () => {
    expect(generateIdeaSchedule([])).toEqual([]);
  });
});
