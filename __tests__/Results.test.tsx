import { render } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/components/themed-text', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { ThemedText: ({ children, ...props }: any) => React.createElement(Text, props, children) };
});

jest.mock('@/components/ui/HeaderLogo', () => ({ HeaderLogo: () => null }));
jest.mock('@/components/ui/PlayerAvatar', () => ({ PlayerAvatar: () => null }));
jest.mock('@/i18n', () => ({ t: (key: string) => key }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', setLocale: jest.fn() }),
}));

let mockCurrentGame: any = null;

jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({ currentGame: mockCurrentGame }),
}));

const ResultsScreen = require('../app/(tabs)/results').default;

function renderScreen() {
  return render(<ResultsScreen />);
}

describe('Results screen — no game', () => {
  beforeEach(() => { mockCurrentGame = null; });

  it('shows the no-results title when there is no game', () => {
    const { getByText } = renderScreen();
    expect(getByText(/results\.noResultsTitle/)).toBeTruthy();
  });

  it('shows the no-results message when there is no game', () => {
    const { getByText } = renderScreen();
    expect(getByText('results.noResultsMessage')).toBeTruthy();
  });

  it('does not show the leaderboard when there is no game', () => {
    const { queryByText } = renderScreen();
    expect(queryByText('results.leaderboardTitle')).toBeNull();
  });
});

describe('Results screen — game in waiting status', () => {
  beforeEach(() => {
    mockCurrentGame = {
      id: 'game1',
      status: 'waiting',
      participants: [{ userId: 'u1', userName: 'Alice', userEmail: 'a@t.com', joinedAt: new Date() }],
      scores: {},
      rounds: [],
    };
  });

  it('shows the no-results message when game is still waiting', () => {
    const { getByText } = renderScreen();
    expect(getByText(/results\.noResultsTitle/)).toBeTruthy();
  });

  it('does not show leaderboard when game is waiting', () => {
    const { queryByText } = renderScreen();
    expect(queryByText('results.leaderboardTitle')).toBeNull();
  });
});

describe('Results screen — active game leaderboard', () => {
  beforeEach(() => {
    mockCurrentGame = {
      id: 'game1',
      status: 'active',
      adminId: 'u1',
      participants: [
        { userId: 'u1', userName: 'Alice', userEmail: 'a@t.com', joinedAt: new Date(1000) },
        { userId: 'u2', userName: 'Bob',   userEmail: 'b@t.com', joinedAt: new Date(2000) },
        { userId: 'u3', userName: 'Carol', userEmail: 'c@t.com', joinedAt: new Date(3000) },
      ],
      scores: { u1: 10, u2: 5, u3: 20 },
      guessResults: { u1: { correctGuesses: 2 }, u2: { correctGuesses: 0 } },
      rounds: [],
    };
  });

  it('shows the leaderboard heading', () => {
    const { getByText } = renderScreen();
    expect(getByText(/results\.leaderboardTitle/)).toBeTruthy();
  });

  it('sorts participants by total points descending', () => {
    const { getAllByText } = renderScreen();
    // Carol: 20+0=20, Alice: 10+2=12, Bob: 5+0=5
    const names = getAllByText(/Alice|Bob|Carol/).map(n => n.props.children);
    const carolIdx = names.findIndex((n: any) => String(n).includes('Carol'));
    const aliceIdx = names.findIndex((n: any) => String(n).includes('Alice'));
    const bobIdx   = names.findIndex((n: any) => String(n).includes('Bob'));
    expect(carolIdx).toBeLessThan(aliceIdx);
    expect(aliceIdx).toBeLessThan(bobIdx);
  });

  it('shows gold medal for first place', () => {
    const { getByText } = renderScreen();
    expect(getByText(/🥇/)).toBeTruthy();
  });

  it('shows silver medal for second place', () => {
    const { getByText } = renderScreen();
    expect(getByText(/🥈/)).toBeTruthy();
  });

  it('shows bronze medal for third place', () => {
    const { getByText } = renderScreen();
    expect(getByText(/🥉/)).toBeTruthy();
  });

  it('shows guess points in parentheses when non-zero', () => {
    const { getByText } = renderScreen();
    // Alice has 2 guess points → shows "(2)"
    expect(getByText(/\(2\)/)).toBeTruthy();
  });

  it('does not show parenthesised guess points when zero', () => {
    const { queryByText } = renderScreen();
    // Bob has 0 guess points → no "(0)"
    expect(queryByText(/\(0\)/)).toBeNull();
  });

  it('does not show the no-results message', () => {
    const { queryByText } = renderScreen();
    expect(queryByText(/results\.noResultsTitle/)).toBeNull();
  });
});

describe('Results screen — round history', () => {
  const completedRound = {
    roundNumber: 1,
    targetUserId: 'u2',
    targetUserName: 'Bob',
    commentsVisible: true,
    pointsGiven: true,
    startedAt: new Date(500),
    comments: [
      { id: 'c1', text: 'Great player', authorId: 'u1', submittedAt: new Date(), points: 5 },
      { id: 'c2', text: 'Nice moves',  authorId: 'u3', submittedAt: new Date() },
    ],
  };

  const incompleteRound = {
    roundNumber: 2,
    targetUserId: 'u1',
    targetUserName: 'Alice',
    commentsVisible: false,
    pointsGiven: false,
    startedAt: new Date(5000),
    comments: [],
  };

  beforeEach(() => {
    mockCurrentGame = {
      id: 'game1',
      status: 'active',
      adminId: 'u1',
      participants: [
        { userId: 'u1', userName: 'Alice', userEmail: 'a@t.com', joinedAt: new Date(1000) },
        { userId: 'u2', userName: 'Bob',   userEmail: 'b@t.com', joinedAt: new Date(2000) },
      ],
      scores: { u1: 5, u2: 10 },
      rounds: [completedRound, incompleteRound],
    };
  });

  it('shows the round history heading for completed rounds', () => {
    const { getByText } = renderScreen();
    expect(getByText(/results\.roundHistoryTitle/)).toBeTruthy();
  });

  it('shows the target name for a completed round', () => {
    const { getByText } = renderScreen();
    expect(getByText(/results\.target.*Bob/)).toBeTruthy();
  });

  it('does not show the target of an incomplete round', () => {
    const { queryAllByText } = renderScreen();
    // "Alice" appears as a participant in leaderboard, but not as a round target in history
    const aliceInHeader = queryAllByText(/results\.target.*Alice|Alice.*results\.target/);
    expect(aliceInHeader).toHaveLength(0);
  });

  it('shows comment text for a completed round', () => {
    const { getByText } = renderScreen();
    expect(getByText(/"Great player"/)).toBeTruthy();
  });

  it('shows points for a comment that has been awarded points', () => {
    const { getByText } = renderScreen();
    expect(getByText(/\+5 pts/)).toBeTruthy();
  });

  it('shows no-comments text for rounds with empty comments', () => {
    mockCurrentGame = {
      ...mockCurrentGame,
      rounds: [{
        ...completedRound,
        comments: [],
      }],
    };
    const { getByText } = renderScreen();
    expect(getByText('results.noComments')).toBeTruthy();
  });
});
