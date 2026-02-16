// Test file for game ID generation
import { generateGameId } from '../utils/gameIdGenerator';

console.log('Testing Ukrainian game ID generation:');
console.log('Generated IDs:');
for (let i = 0; i < 10; i++) {
  console.log(`${i + 1}. ${generateGameId()}`);
}

// Test word lists
import { ukrainianAdjectives, ukrainianNouns } from '../utils/gameIdGenerator';
console.log('\nAdjectives count:', ukrainianAdjectives.length);
console.log('Nouns count:', ukrainianNouns.length);
console.log('Total possible combinations:', ukrainianAdjectives.length * ukrainianNouns.length);
