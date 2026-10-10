// Computer players, by game id. Games without an entry (the party games) seat no bots.
import * as dice from './dice.js';
import * as cards from './cards.js';

export const BOTS = {
  snyd: dice.snyd,
  meyer: dice.meyer,
  10000: dice.tiotusind,
  gris: dice.gris,
  skib: dice.skib,
  yatzy: dice.yatzy,
  sjavs: cards.sjavs,
  'snyd-kort': cards.snydKort,
  hestelob: cards.hestelob,
  'kongens-kop': cards.kongensKop,
  bussen: cards.bussen,
};

export const BOT_NAMES = ['Bent', 'Grethe', 'Svend', 'Inge', 'Poul', 'Lone', 'Jørgen', 'Birthe', 'Ib', 'Hanne', 'Knud', 'Kirsten'];
