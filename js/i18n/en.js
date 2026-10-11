// English: game names, rules and prompts. UI strings need no table here, since keys are English.
import { MOST_LIKELY, NEVER } from '../games/prompts.js';
import { defaults as kkDefaults } from '../games/kongens-kop.js';

export default {
  // English needs only a few overrides: Danish game words that have their own English names.
  strings: {
    'Snyd!': 'Liar!',
    '{a} called snyd on {b}': '{a} called liar on {b}',
    Meyer: 'Mia',
    'Lille-Meyer': 'Little Mia',
    'Pair {n}': 'Double {n}s',
    'Det eller derover': 'Same or higher',
    'Meyer costs double': 'Mia costs double',
    'Losing a lift on a Meyer costs 2 lives.': 'Losing a lift on a Mia costs 2 lives.',
    '3-2 is skål': '3-2 is cheers',
    'Only 3-2 is skål.': 'Only 3-2 is cheers.',
    'Skål is off.': 'Cheers is off.',
  },
  games: {
    snyd: { name: 'Liar’s Dice', tagline: 'Bluff about the dice on the whole table.' },
    meyer: { name: 'Mia', tagline: 'Two dice, one cup, and a lie that has to keep getting bigger.' },
    10000: { name: 'Farkle', tagline: 'Push your luck with five dice. Stop in time or lose it all.' },
    yatzy: { name: 'Yahtzee', tagline: 'The score sheet classic. Play at the same time or take turns.' },
    skib: { name: 'Ship, Captain and Crew', tagline: 'Find the ship (6), captain (5) and crew (4), then load the cargo.' },
    gris: { name: 'Pig', tagline: 'One die, one rule: a 1 loses the lot. First to 100.' },
    hestelob: { name: 'Horse Race', tagline: 'Bet sips on an ace and watch the horse race.' },
    'kongens-kop': { name: 'King’s Cup', tagline: 'Draw a card, follow its rule. Don’t draw the last king.' },
    bussen: { name: 'Ride the Bus', tagline: 'Four guesses, the pyramid, and one unlucky bus ride.' },
    'snyd-kort': { name: 'Cheat', tagline: 'Play cards face down and lie about them. Empty your hand first.' },
    sjavs: { name: 'Sjavs', tagline: 'The Faroese trick-taking classic. Two teams, the club queen on top.' },
    'mest-sandsynligt': { name: 'Most Likely To', tagline: 'Vote in secret: who’s most likely to…? Most votes drinks.' },
    'jeg-har-aldrig': { name: 'Never Have I Ever', tagline: 'Answer in secret, then the truth comes out.' },
  },
  rules: {
    snyd: (r, h) => ({
      goal: r.diceLoss === 'others' ? 'Get rid of your dice. The last player still holding dice loses.' : 'Keep your dice. The last player with dice wins.',
      steps: [
        `Everyone has ${r.dicePerPlayer} dice under a cup and looks only at their own.`,
        `Take turns bidding how many dice of one face there are on the <b>whole table</b>, e.g. “5 × ${h.die(4)}”. A bid must be more dice, or the same number with a higher face.`,
        r.onesWild ? `${h.die(1)} is wild and counts as whatever face is bid. Ones can’t be bid on their own.` : 'Ones are ordinary dice and can be bid like any other face.',
        r.trappe ? `<b>Trappe:</b> dice that run 1-2-3… with no gaps (all of yours) count as your number of dice + 1. A lone ${h.die(1)} counts as 2.` : null,
        r.tilStede ? '<b>Til stede:</b> wilds and trappes only count if at least one real die shows the bid face.' : null,
        'Instead of bidding, call <b>Snyd!</b> All dice are shown. If the bid holds, the caller loses the round; if not, the bidder does.',
        r.diceLoss === 'others' ? 'Everyone <b>except</b> the round’s loser drops a die. The loser starts the next round.' : 'The round’s loser drops a die and starts the next round.',
      ],
      end: r.diceLoss === 'others' ? 'Players with no dice are safe. The last one with dice buys the round.' : 'Players with no dice are out. The last one with dice wins.',
    }),
    meyer: (r, h) => ({
      goal: r.ending === 'firstOut' ? 'Don’t be the first to lose all your lives.' : 'Be the last one with lives left.',
      steps: [
        'Roll two dice under the cup. Only you look.',
        `Announce your roll, or lie. It must be ${r.equalAllowed ? '<b>the same or higher</b>' : '<b>higher</b>'} than the last announcement. Then the cup moves on.`,
        `Highest first: <b>Mia</b> (${h.die(2)}${h.die(1)}), <b>Little Mia</b> (${h.die(3)}${h.die(1)}), doubles from 6-6 down to 1-1, then high die first: 65, 64 … 32.`,
        `Don’t believe it? <b>Lift</b> the cup instead of rolling. If the roll is at least what was said, you lose a life; if not, the liar does.${r.meyerDouble ? ' A Mia costs 2 lives.' : ''}`,
        r.blindPass ? 'Out of lies? Roll and <b>pass blind</b> without looking, claiming the same roll as before.' : null,
        r.skaal ? `Roll ${h.die(3)}${h.die(2)} and you can call <b>Cheers!</b>: everyone drinks and a new round starts.` : null,
      ],
      end: r.ending === 'firstOut' ? `Everyone starts with ${r.lives} lives. The first player to run out loses.` : `Everyone starts with ${r.lives} lives. The last player with lives wins.`,
    }),
    10000: (r, h) => ({
      goal: `Be the first past ${h.n(r.target)} points.`,
      steps: [
        'Roll five dice. Set aside at least one scoring die, then roll the rest again or <b>bank</b> your points.',
        `Scores: ${h.die(1)} 100 · ${h.die(5)} 50 · three of a kind = face × 100 (three ${h.die(1)} = 1,000) · four of a kind 1,500 · five of a kind 2,000${r.straights ? ' · straight 2,000' : ''}${r.fullHouse ? ' · full house 2,500' : ''}. Combinations only count within one roll.`,
        'A roll with nothing that scores loses everything from that turn.',
        r.openingMin ? `You need ${h.n(r.openingMin)} in one turn to get on the board.` : null,
        r.hotDice ? 'When all five dice have scored, you may roll all five again (hot dice).' : null,
      ],
      end: 'When someone reaches the target, everyone else gets one last turn. Highest score wins.',
    }),
    yatzy: (r, h) => ({
      goal: 'Score the most points on your sheet.',
      steps: [
        `${r.mode === 'together' ? 'Everyone plays their own sheet at the same time.' : 'Players take turns.'} Each turn you get three rolls. Tap dice to hold them between rolls.`,
        'After rolling, write a score in one empty box. If nothing fits, you must write 0 somewhere.',
        'Ones to sixes: the sum of that face. 63 or more there gives a 50-point bonus.',
        'One pair, two pairs, three and four of a kind: the sum of those dice. Small straight (1-5) 15, large straight (2-6) 20, full house and chance: the sum of all dice. Yahtzee (five the same) 50.',
      ],
      end: 'When every sheet is full, the highest total wins.',
    }),
    skib: (r, h) => ({
      goal: 'Load the biggest cargo. The smallest cargo drinks.',
      steps: [
        `You get ${r.rolls} rolls with five dice. You need a ${h.die(6)} (ship), then a ${h.die(5)} (captain), then a ${h.die(4)} (crew), in that order. They’re set aside automatically.`,
        'With all three set aside, the other two dice are your <b>cargo</b>. Keep it, or use a roll you have left to try for more.',
        'No ship, captain and crew by your last roll means no cargo.',
      ],
      end: r.rounds > 1 ? `After ${r.rounds} rounds, whoever lost the most rounds buys.` : 'Smallest cargo buys.',
    }),
    gris: (r, h) => ({
      goal: `Be first to ${r.target} points.`,
      steps: r.twoDice
        ? ['Roll two dice as often as you like. Each roll adds to your turn total.', `One ${h.die(1)} loses the turn total. Two ${h.die(1)} wipe your whole score.`, 'Stop any time to bank your turn total.']
        : ['Roll the die as often as you like. Each roll adds to your turn total.', `A ${h.die(1)} loses everything from that turn.`, 'Stop any time to bank your turn total.'],
      end: `The first to reach ${r.target} wins.`,
    }),
    hestelob: (r, h) => ({
      goal: 'Bet on the ace that wins the race.',
      steps: [
        'The four aces are horses. Before the race, everyone bets sips on one of them.',
        'Cards are turned one at a time. Each card moves the ace of its suit one step forward.',
        `Beside the track lie ${r.trackLength} face-down cards. When every horse has passed one, it’s turned over and the horse of that suit steps back.`,
      ],
      end: `The first ace past the finish wins. Its backers hand out ${r.payout === 2 ? 'double ' : ''}their bet; everyone else drinks theirs.`,
    }),
    'kongens-kop': () => ({
      goal: 'Avoid drawing the fourth king.',
      steps: [
        'Take turns drawing a card. Everyone sees it, and its rule says who drinks.',
        'The rule for each card is in the house rules. The host can change them to your own before you start.',
        'Every king goes into the cup.',
      ],
      end: 'Whoever draws the fourth king drinks the cup.',
    }),
    bussen: (r) => ({
      goal: 'Don’t end up riding the bus.',
      steps: [
        `<b>Four questions.</b> In turn, everyone guesses: red or black · higher or lower than your first card · between or outside your first two · the suit. Each guess deals you the card. A wrong guess costs ${r.wrongCost === 'rising' ? '1, 2, 3 or 4 sips' : 'a sip'}. Equal counts as wrong; aces are high.`,
        `<b>The pyramid.</b> ${r.pyramidRows} rows of cards are turned one by one. Anyone holding the same rank lays it down and hands out sips: 1 per card on the bottom row, more for each row up.`,
        `<b>The bus.</b> Whoever has the most cards left rides: ${r.busLength} cards, higher or lower each time. A miss costs a sip per card reached and the ride starts over.`,
      ],
      end: 'The game ends when the rider gets off the bus.',
    }),
    'snyd-kort': (r) => ({
      goal: 'Be the first to get rid of all your cards.',
      steps: [
        `All cards are dealt. On your turn, play 1 to ${r.maxCards} cards face down and say they’re the rank that’s up: aces, then twos, threes … kings, and round again.`,
        'Lie if you have to. Anyone who doubts the last play can call <b>Cheat!</b> before the next player plays.',
        'An honest play: the caller takes the pile. A lie: the liar takes it.',
      ],
      end: 'The first player out of cards (without being caught) wins.',
    }),
    sjavs: (r) => ({
      goal: `Count your team down from ${r.rubber} to 0 first.`,
      steps: [
        'Four players in two teams; partners sit opposite (1st and 3rd to join against 2nd and 4th).',
        '32 cards, 8 each. <b>Q♣ Q♠ J♣ J♠ J♥ J♦</b> are always the top trumps, then A K Q 10 9 8 7 of the trump suit.',
        '<b>Bidding:</b> say how many trumps you’d have (5 or more) in your best suit. Longer wins; at equal length clubs wins. The best bid’s suit becomes trumps. If everyone passes, the cards are dealt again.',
        'Follow suit if you can (trumps count as their own suit), otherwise play anything. The highest trump wins, else the highest card of the suit led.',
        'Card points: A 11, 10 10, K 4, Q 3, J 2. The trump side needs 61 of 120. They score 2 for 61–89, 4 for 90+, 12 for all tricks (16 if one player takes them all); doubled with clubs as trumps. If they fail, the others get 4, or 8 if the trump side took 30 or less, and 16 if it took no tricks. 60–60 adds 2 to the next deal.',
      ],
      end: 'Points are subtracted from the scoring team. First team to 0 wins the rubber.',
    }),
    'mest-sandsynligt': (r) => ({
      goal: 'Find out what your friends really think of you.',
      steps: [
        'A prompt appears: “Who is most likely to …?”',
        `Everyone votes in secret on their own phone${r.selfVote ? '' : ' (not for yourself)'}.`,
        'When everyone has voted, the votes are shown.',
      ],
      end: 'Most votes drinks. Then the next prompt.',
    }),
    'jeg-har-aldrig': () => ({
      goal: 'Find out who has done what.',
      steps: ['A prompt appears: “Never have I ever …”', 'Everyone answers in secret: <b>I have</b> or <b>Never</b>.', 'When everyone has answered, the answers are shown.'],
      end: 'Everyone who has done it drinks. Then the next prompt.',
    }),
  },
  prompts: { mostLikely: MOST_LIKELY, never: NEVER },
  kongensKop: kkDefaults,
};
