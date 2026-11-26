export interface Topic {
  titleKey: string;
  questionKey?: string;
  hintKeys?: string[];
}

export const TOPICS: Topic[] = [
  { titleKey: 'game.ui.topicsHints.topic1Title', questionKey: 'game.ui.topicsHints.topic1Question' },
  {
    titleKey: 'game.ui.topicsHints.topic2Title',
    hintKeys: ['game.ui.topicsHints.topic2HintA', 'game.ui.topicsHints.topic2HintB', 'game.ui.topicsHints.topic2HintC'],
  },
  {
    titleKey: 'game.ui.topicsHints.topic3Title',
    hintKeys: ['game.ui.topicsHints.topic3HintA', 'game.ui.topicsHints.topic3HintB', 'game.ui.topicsHints.topic3HintC'],
  },
  {
    titleKey: 'game.ui.topicsHints.topic4Title',
    hintKeys: ['game.ui.topicsHints.topic4HintA', 'game.ui.topicsHints.topic4HintB', 'game.ui.topicsHints.topic4HintC'],
  },
  {
    titleKey: 'game.ui.topicsHints.topic5Title',
    hintKeys: ['game.ui.topicsHints.topic5HintA', 'game.ui.topicsHints.topic5HintB', 'game.ui.topicsHints.topic5HintC'],
  },
];

export const HINT_LABELS = ['а', 'б', 'в'];
