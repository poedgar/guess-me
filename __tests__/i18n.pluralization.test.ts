// TDD – 6.2: pluralization for point strings.
//
// "1 point" vs "2 points" must differ. Currently both produce "point(s)" because
// the locale strings are flat with %{points} interpolation.
//
// Fix: switch to i18n-js plural objects (one/other for English; one/few/many for
// Ukrainian) and register the Ukrainian pluralizer in i18n/index.ts.
//
// This file tests the REAL t() function — no i18n mock.

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

import { t } from '@/i18n';

// ─── English pluralization ─────────────────────────────────────────────────

describe('i18n pluralization — 6.2 English point strings', () => {
  it('confirmGivePoints: count=1 produces singular "1 point"', () => {
    const result = t('game.alerts.confirmGivePoints', { count: 1, locale: 'en' });
    expect(result).toBe('Are you sure you want to give 1 point?');
  });

  it('confirmGivePoints: count=2 produces plural "2 points"', () => {
    const result = t('game.alerts.confirmGivePoints', { count: 2, locale: 'en' });
    expect(result).toBe('Are you sure you want to give 2 points?');
  });

  it('pointsGivenToTarget: count=1 produces singular "1 point"', () => {
    const result = t('game.alerts.pointsGivenToTarget', { count: 1, locale: 'en', name: 'Bob' });
    expect(result).toBe('You gave 1 point to Bob!');
  });

  it('pointsGivenToTarget: count=2 produces plural "2 points"', () => {
    const result = t('game.alerts.pointsGivenToTarget', { count: 2, locale: 'en', name: 'Bob' });
    expect(result).toBe('You gave 2 points to Bob!');
  });
});

// ─── Ukrainian pluralization ───────────────────────────────────────────────

describe('i18n pluralization — 6.2 Ukrainian point strings', () => {
  it('confirmGivePoints: count=1 → один бал (one)', () => {
    const result = t('game.alerts.confirmGivePoints', { count: 1, locale: 'uk' });
    expect(result).toBe('Ви впевнені, що хочете надати 1 бал?');
  });

  it('confirmGivePoints: count=2 → два бали (few)', () => {
    const result = t('game.alerts.confirmGivePoints', { count: 2, locale: 'uk' });
    expect(result).toBe('Ви впевнені, що хочете надати 2 бали?');
  });

  it('confirmGivePoints: count=5 → п\'ять балів (many)', () => {
    const result = t('game.alerts.confirmGivePoints', { count: 5, locale: 'uk' });
    expect(result).toBe('Ви впевнені, що хочете надати 5 балів?');
  });

  it('pointsGivenToTarget: count=1 → один бал (one)', () => {
    const result = t('game.alerts.pointsGivenToTarget', { count: 1, locale: 'uk', name: 'Олена' });
    expect(result).toBe('Ви надали 1 бал гравцю Олена!');
  });

  it('pointsGivenToTarget: count=2 → два бали (few)', () => {
    const result = t('game.alerts.pointsGivenToTarget', { count: 2, locale: 'uk', name: 'Олена' });
    expect(result).toBe('Ви надали 2 бали гравцю Олена!');
  });
});

// ─── Locale parity — postGuessing keys ────────────────────────────────────

describe('i18n locale parity — 6.4 game.ui.postGuessing keys', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const en = require('../locales/en.json');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const uk = require('../locales/uk.json');

  const enKeys = Object.keys(en.game.ui.postGuessing) as string[];

  test.each(enKeys)('uk.json has game.ui.postGuessing.%s', (key) => {
    expect(uk.game.ui.postGuessing).toHaveProperty(key);
    expect(uk.game.ui.postGuessing[key]).toBeTruthy();
  });
});
