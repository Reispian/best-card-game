// Ember Court — the AI opponent, Sable the Storm Warden.
// Sable is readable on purpose: it favours one element all duel (its "tell"),
// it telegraphs a card every 4th round (Scout), and its last plays stay on screen.

import { ELEMENTS, effectivePower } from './cards.js';

// Sable's personality for this duel: a favoured element and a risk appetite.
export function makePersonality(rng) {
  const elements = Object.keys(ELEMENTS);
  return {
    favoured: elements[Math.floor(rng() * elements.length)],
    bold: rng() < 0.5, // bold Sable gambles on high cards; cautious Sable saves them
  };
}

// Pick Sable's card for the round. `state` is the engine state (see engine.js).
export function chooseCard(state, rng) {
  const hand = state.foe.hand;
  const youHp = state.you.hp;
  const foeHp = state.foe.hp;
  const foe = state.foe;

  // 1. Survival first: heal when hurt and a Mend is in hand.
  const mend = hand.find((c) => c.kind === 'spell' && c.spell === 'mend');
  if (mend && foeHp <= 12) return mend;

  // 2. Finish the duel: Siphon when it would end you.
  const siphon = hand.find((c) => c.kind === 'spell' && c.spell === 'siphon');
  if (siphon && youHp <= 4) return siphon;

  // 3. Ward when you are likely to hit hard: your momentum is up or you
  //    just won big. Sable reads the table too.
  const ward = hand.find((c) => c.kind === 'spell' && c.spell === 'ward');
  if (ward && state.you.streak >= 2 && rng() < 0.7) return ward;

  // 4. Attack: score each attack card by expected power, favouring its
  //    element, holding back its biggest card unless bold or behind.
  const attacks = hand.filter((c) => c.kind === 'attack');
  if (attacks.length === 0) return hand[0]; // only spells left: play the first
  const scored = attacks.map((c) => {
    let score = c.power + (c.element === state.personality.favoured ? 2 : 0);
    if (c.power >= 9 && !state.personality.bold && foeHp > youHp) score -= 4; // save the ace
    if (state.foe.streak >= 1) score += 1; // ride momentum
    return { card: c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  // Sable is beatable on purpose: 1 in 5 it takes its 2nd best, 1 in 10 any card.
  const roll = rng();
  if (scored.length > 1 && roll < 0.2) return scored[1].card;
  if (roll < 0.3) return hand[Math.floor(rng() * hand.length)];
  return scored[0].card;
}

// What the player can read about Sable this round.
export function tellText(state) {
  const el = ELEMENTS[state.personality.favoured];
  return `🔍 Sable favours ${el.name} ${el.icon} — its ${el.name} cards hit harder in its hands.`;
}

// Every 4th round the player scouts one of Sable's cards.
export function scoutCard(state, rng) {
  if (state.round % 4 !== 0) return null;
  const hand = state.foe.hand;
  if (hand.length === 0) return null;
  return hand[Math.floor(rng() * hand.length)];
}
