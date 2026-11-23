// Ember Court — card definitions and deck building.
// Elements cycle: Ember > Gale > Stone > Tide > Ember. Advantage adds +3 power.

export const ELEMENTS = {
  ember: { name: 'Ember', icon: '🔥', beats: 'gale', color: '#e4572e' },
  gale: { name: 'Gale', icon: '💨', beats: 'stone', color: '#7d8894' },
  stone: { name: 'Stone', icon: '🪨', beats: 'tide', color: '#9c8b6e' },
  tide: { name: 'Tide', icon: '🌊', beats: 'ember', color: '#2e86e4' },
};

export const SPELLS = {
  mend: { name: 'Mend', icon: '💚', desc: 'Heal 6 life' },
  ward: { name: 'Ward', icon: '🛡️', desc: 'Block the next hit' },
  siphon: { name: 'Siphon', icon: '🩸', desc: 'Steal 4 life' },
};

// One card: { id, kind: 'attack'|'spell', element, power, name }
let nextId = 1;

export function attackCard(element, power) {
  const el = ELEMENTS[element];
  return {
    id: nextId++, kind: 'attack', element, power,
    name: `${el.name} ${power}`,
    icon: el.icon,
    desc: `Beats ${ELEMENTS[el.beats].name} +3`,
  };
}

export function spellCard(spell) {
  const s = SPELLS[spell];
  return { id: nextId++, kind: 'spell', element: 'spell', power: 0, spell, name: s.name, icon: s.icon, desc: s.desc };
}

// A 24-card duel deck: 18 attacks spread over the four elements, 6 spells.
export function buildDeck(rng) {
  const cards = [];
  const powers = [2, 3, 4, 5, 6, 7, 8, 9];
  const elements = ['ember', 'gale', 'stone', 'tide'];
  for (const el of elements) {
    // 4 attacks per element: two mid, one low, one high — 16 attacks
    cards.push(attackCard(el, 3), attackCard(el, 5), attackCard(el, 7), attackCard(el, 9));
  }
  // Two extra wild attacks to keep hands varied
  cards.push(attackCard('ember', 6), attackCard('tide', 4));
  for (const s of ['mend', 'mend', 'ward', 'ward', 'siphon', 'siphon']) cards.push(spellCard(s));
  return shuffle(cards, rng);
}

export function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deterministic RNG (mulberry32) so ?seed= replays the same duel.
export function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Power of an attack card against a rival element, before momentum.
export function effectivePower(card, foeCard) {
  if (card.kind !== 'attack') return 0;
  let p = card.power;
  if (foeCard && foeCard.kind === 'attack' && ELEMENTS[card.element].beats === foeCard.element) p += 3;
  return p;
}
