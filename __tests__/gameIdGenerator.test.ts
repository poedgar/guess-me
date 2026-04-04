import { generateGameId, ukrainianAdjectives, ukrainianNouns } from '../utils/gameIdGenerator';

describe('generateGameId', () => {
  it('returns a non-empty string', () => {
    const id = generateGameId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('contains exactly one space (adjective + noun)', () => {
    const id = generateGameId();
    const parts = id.split(' ');
    expect(parts).toHaveLength(2);
  });

  it('is all lowercase', () => {
    for (let i = 0; i < 20; i++) {
      const id = generateGameId();
      expect(id).toBe(id.toLowerCase());
    }
  });

  it('generates different IDs on repeated calls (not always the same)', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateGameId()));
    // With 100+ adjectives and 100+ nouns, 20 calls should not all be identical
    expect(ids.size).toBeGreaterThan(1);
  });

  it('adjective part is derived from ukrainianAdjectives', () => {
    const adjLower = ukrainianAdjectives.map(a => a.toLowerCase().replace(/\s+/g, '-'));
    for (let i = 0; i < 10; i++) {
      const [adj] = generateGameId().split(' ');
      expect(adjLower).toContain(adj);
    }
  });

  it('noun part is derived from ukrainianNouns', () => {
    const nounsLower = ukrainianNouns.map(n => n.toLowerCase().replace(/\s+/g, '-'));
    for (let i = 0; i < 10; i++) {
      const [, noun] = generateGameId().split(' ');
      expect(nounsLower).toContain(noun);
    }
  });

  it('ukrainianAdjectives is a non-empty array', () => {
    expect(Array.isArray(ukrainianAdjectives)).toBe(true);
    expect(ukrainianAdjectives.length).toBeGreaterThan(0);
  });

  it('ukrainianNouns is a non-empty array', () => {
    expect(Array.isArray(ukrainianNouns)).toBe(true);
    expect(ukrainianNouns.length).toBeGreaterThan(0);
  });
});
