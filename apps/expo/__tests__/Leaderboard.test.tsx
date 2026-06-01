import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@/i18n', () => ({ t: (key: string) => key }));
jest.mock('@/components/themed-text', () => ({
  ThemedText: ({ children, ...props }: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, props, children);
  },
}));
jest.mock('@/components/ui/PlayerAvatar', () => ({
  PlayerAvatar: () => null,
}));
jest.mock('@/constants/theme', () => ({
  Fonts: { sans: 'System' },
  GameColors: {
    cardBg: '#eee', goldTint: '#ffd', goldTintBorder: '#cc0',
    blueTint: '#def', blueTintBorder: '#9bd', green: '#0f0',
  },
}));

const { Leaderboard } = require('../components/game/Leaderboard');

const PARTICIPANTS = [
  { userId: 'u1', userName: 'Alice', joinedAt: new Date(1000) },
  { userId: 'u2', userName: 'Bob',   joinedAt: new Date(2000) },
];

const GAME = {
  participants: PARTICIPANTS,
  scores: { u1: 10, u2: 5 },
  guessResults: {},
  adminId: 'u1',
};

function renderLeaderboard() {
  return render(
    <Leaderboard
      game={GAME}
      user={{ uid: 'u2' }}
      joinIndexById={{ u1: 1, u2: 2 }}
      getDisplayName={(name: string) => name}
      locale="en"
      title="Leaderboard"
    />
  );
}

describe('Leaderboard — 7.4 list accessibility roles', () => {
  it('list container has accessibilityRole="list"', () => {
    const { UNSAFE_getAllByType } = renderLeaderboard();
    const { View } = require('react-native');
    const listViews = UNSAFE_getAllByType(View).filter(
      (v: any) => v.props.accessibilityRole === 'list'
    );
    expect(listViews.length).toBeGreaterThan(0);
  });

  it('each participant row has accessibilityRole="listitem"', () => {
    const { UNSAFE_getAllByType } = renderLeaderboard();
    const { View } = require('react-native');
    const listItems = UNSAFE_getAllByType(View).filter(
      (v: any) => v.props.accessibilityRole === 'listitem'
    );
    expect(listItems).toHaveLength(PARTICIPANTS.length);
  });
});
