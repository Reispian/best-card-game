// Ember Court — duel engine: state, rounds, clash resolution, win/lose.
// Pure logic, no DOM: render.js draws it, main.js wires input.
// A fighter: { hp, maxHp, deck, hand, roundsWon, streak, shield, momentum }

import { buildDeck, effectivePower } from './cards.js';
import { makePersonality, chooseCard, scoutCard } from './ai.js';

export const MAX_HP = 30;
export const FOE_HP = 27; // Sable starts a little lower: a thinking player should win about half the duels.
export const HAND_SIZE = 5;
export const DECK_SIZE = 24;

export function newDuel(seed) {
  const rng = (function mulberry(seed) {
    let s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })(seed);
  const mkFighter = (hp) => ({
    hp, maxHp: hp, deck: buildDeck(rng),
    hand: [], roundsWon: 0, streak: 0, shield: false, momentum: 0,
  });
  const state = {
    seed, rng, round: 1, phase: 'pick', // pick | reveal | over
    you: mkFighter(MAX_HP), foe: mkFighter(FOE_HP),
    personality: makePersonality(rng),
    scouted: null, lastClash: null, history: [],
    winner: null, // 'you' | 'foe' | 'draw'
    log: [],
  };
  drawUp(state.you);
  drawUp(state.foe);
  state.scouted = scoutCard(state, rng);
  return state;
}

function drawUp(f) {
  while (f.hand.length < HAND_SIZE && f.deck.length > 0) f.hand.push(f.deck.shift());
}

function drawOne(f) {
  if (f.deck.length > 0) f.hand.push(f.deck.shift());
}

function removeFromHand(f, card) {
  const i = f.hand.findIndex((c) => c.id === card.id);
  if (i >= 0) f.hand.splice(i, 1);
}

// Apply a spell's effect. Returns a short description for the log.
function castSpell(state, who, card) {
  const me = state[who];
  const other = state[who === 'you' ? 'foe' : 'you'];
  if (card.spell === 'mend') {
    const healed = Math.min(6, me.maxHp - me.hp);
    me.hp += healed;
    return `heals ${healed} life`;
  }
  if (card.spell === 'ward') {
    me.shield = true;
    return 'raises a Ward';
  }
  if (card.spell === 'siphon') {
    const stolen = Math.min(4, other.hp);
    other.hp -= stolen;
    me.hp = Math.min(me.maxHp, me.hp + stolen);
    return `steals ${stolen} life`;
  }
  return '';
}

function damage(state, who, amount) {
  const f = state[who];
  if (amount <= 0) return 0;
  if (f.shield) {
    f.shield = false;
    return 0; // Ward absorbs the whole hit
  }
  const dealt = Math.min(amount, f.hp);
  f.hp -= dealt;
  return dealt;
}

// Play one round: the player picked `youCard`; Sable picks its own.
// Returns the clash report the renderer shows.
export function playRound(state, youCard) {
  if (state.phase !== 'pick') return null;
  const foeCard = chooseCard(state, state.rng);
  removeFromHand(state.you, youCard);
  removeFromHand(state.foe, foeCard);

  const report = { round: state.round, youCard, foeCard, lines: [], damageToYou: 0, damageToFoe: 0 };
  const youMomentum = state.you.momentum;
  const foeMomentum = state.foe.momentum;

  // Spells resolve before the clash, in play order: yours, then Sable's.
  for (const [who, card] of [['you', youCard], ['foe', foeCard]]) {
    if (card.kind === 'spell') {
      const text = castSpell(state, who, card);
      report.lines.push(`${who === 'you' ? 'You' : 'Sable'} cast ${card.name} — ${text}.`);
    }
  }

  // Clash only when both played attacks.
  if (youCard.kind === 'attack' && foeCard.kind === 'attack') {
    const youPower = effectivePower(youCard, foeCard) + youMomentum;
    const foePower = effectivePower(foeCard, youCard) + foeMomentum;
    report.youPower = youPower;
    report.foePower = foePower;
    if (youPower > foePower) {
      const dmg = damage(state, 'foe', youPower - foePower);
      report.damageToFoe = dmg;
      report.lines.push(`Your ${youCard.name} beats Sable's ${foeCard.name} ${youPower}–${foePower}.`);
      state.you.roundsWon++;
      state.you.streak++;
      state.foe.streak = 0;
    } else if (foePower > youPower) {
      const dmg = damage(state, 'you', foePower - youPower);
      report.damageToYou = dmg;
      report.lines.push(`Sable's ${foeCard.name} beats your ${youCard.name} ${foePower}–${youPower}.`);
      state.foe.roundsWon++;
      state.foe.streak++;
      state.you.streak = 0;
    } else {
      const dYou = damage(state, 'you', 2);
      const dFoe = damage(state, 'foe', 2);
      report.damageToYou = dYou;
      report.damageToFoe = dFoe;
      report.lines.push(`A tied clash at ${youPower} — both fighters take 2.`);
      state.you.streak = 0;
      state.foe.streak = 0;
    }
  } else if (youCard.kind === 'attack' || foeCard.kind === 'attack') {
    // One side cast a spell while the other attacked: the attack lands free.
    const [attacker, defender] = youCard.kind === 'attack' ? ['you', 'foe'] : ['foe', 'you'];
    const atk = attacker === 'you' ? youCard : foeCard;
    const bonus = attacker === 'you' ? youMomentum : foeMomentum;
    const dmg = damage(state, defender, atk.power + bonus);
    if (attacker === 'you') {
      report.damageToFoe = dmg;
      state.you.roundsWon++;
      state.you.streak++;
      state.foe.streak = 0;
    } else {
      report.damageToYou = dmg;
      state.foe.roundsWon++;
      state.foe.streak++;
      state.you.streak = 0;
    }
    report.lines.push(`${attacker === 'you' ? 'Your' : "Sable's"} ${atk.name} lands unopposed for ${dmg}.`);
  } else {
    // Both cast spells: no clash, no streak change.
    report.lines.push('Both sides weave spells — no clash this round.');
  }

  // Momentum: two straight round wins arm the next card with +2 power.
  state.you.momentum = state.you.streak >= 2 ? 2 : 0;
  state.foe.momentum = state.foe.streak >= 2 ? 2 : 0;

  state.lastClash = report;
  state.history.unshift(report);
  state.history = state.history.slice(0, 3);
  state.phase = 'reveal';

  checkEnd(state);
  return report;
}

// Advance to the next round: draw a card each and reset the table.
export function nextRound(state) {
  if (state.phase !== 'reveal' || state.winner) return false;
  state.round++;
  drawOne(state.you);
  drawOne(state.foe);
  state.scouted = scoutCard(state, state.rng);
  state.lastClash = null;
  state.phase = 'pick';
  checkEnd(state);
  return true;
}

function checkEnd(state) {
  if (state.winner) return;
  const youOut = state.you.hp <= 0;
  const foeOut = state.foe.hp <= 0;
  if (youOut && foeOut) state.winner = 'draw';
  else if (foeOut) state.winner = 'you';
  else if (youOut) state.winner = 'foe';
  else if (state.you.deck.length === 0 && state.foe.deck.length === 0
    && state.you.hand.length === 0 && state.foe.hand.length === 0) {
    state.winner = state.you.hp > state.foe.hp ? 'you' : state.foe.hp > state.you.hp ? 'foe' : 'draw';
  }
  if (state.winner) state.phase = 'over';
}

export function scoreLine(state) {
  return `${state.you.roundsWon} — ${state.foe.roundsWon}`;
}

export function endSummary(state) {
  if (state.winner === 'you') {
    return {
      title: 'VICTORY', emblem: '🏆',
      detail: `Sable's life falls to ${state.foe.hp}. The Ember Court is yours — the Four Winds bow to a new champion.`,
    };
  }
  if (state.winner === 'foe') {
    return {
      title: 'DEFEAT', emblem: '🌩️',
      detail: `Your life falls to ${state.you.hp}. Sable keeps the court… this time. Study its favoured element and challenge it again.`,
    };
  }
  return {
    title: 'DRAW', emblem: '🤝',
    detail: `Both fighters stand at ${state.you.hp} — ${state.foe.hp}. The winds themselves could not choose a winner.`,
  };
}
