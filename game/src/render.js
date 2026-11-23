// Ember Court — DOM rendering: hands, clash table, scoreboard, floating numbers.
// Keeps all DOM work in one place; engine.js owns the rules.

import { ELEMENTS, SPELLS } from './cards.js';
import { tellText } from './ai.js';
import { scoreLine, endSummary } from './engine.js';

const $ = (id) => document.getElementById(id);

export function cardEl(card, opts = {}) {
  const el = document.createElement('div');
  if (card.kind === 'spell') {
    el.className = 'card el-spell';
    el.innerHTML = `<span class="spell-tag">Spell</span>
      <div class="art">${card.icon}</div>
      <div class="cname">${card.name}</div>
      <div class="cdesc">${card.desc}</div>`;
  } else {
    const e = ELEMENTS[card.element];
    el.className = `card el-${card.element}`;
    el.innerHTML = `<div class="corner"><div class="p">${card.power}</div><div class="el">${e.icon}</div></div>
      <div class="corner corner-br"><div class="p">${card.power}</div><div class="el">${e.icon}</div></div>
      <div class="art">${e.icon}</div>
      <div class="cname">${card.name}</div>
      <div class="cdesc">${card.desc}</div>`;
  }
  if (opts.scouted) {
    el.classList.add('scouted');
    const tag = document.createElement('span');
    tag.className = 'scout-tag';
    tag.textContent = 'SCOUTED';
    el.appendChild(tag);
  }
  if (opts.dealt) el.classList.add('dealt');
  if (opts.flipped) el.classList.add('flipped');
  return el;
}

export function backEl(opts = {}) {
  const el = document.createElement('div');
  el.className = 'card back';
  el.innerHTML = '<div class="back-mark">🃏</div>';
  if (opts.dealt) el.classList.add('dealt');
  return el;
}

// Draw the whole table from state. `ui` carries callbacks + transient flags.
export function render(state, ui) {
  // Scoreboard
  $('hp-you').style.width = `${(state.you.hp / state.you.maxHp) * 100}%`;
  $('hp-foe').style.width = `${(state.foe.hp / state.foe.maxHp) * 100}%`;
  $('hp-you').classList.toggle('low', state.you.hp <= 8);
  $('hp-foe').classList.toggle('low', state.foe.hp <= 8);
  $('hp-you-num').textContent = state.you.hp;
  $('hp-foe-num').textContent = state.foe.hp;
  $('rounds-you').textContent = state.you.roundsWon;
  $('rounds-foe').textContent = state.foe.roundsWon;
  $('deck-you').textContent = state.you.deck.length;
  $('deck-foe').textContent = state.foe.deck.length;
  $('round-label').textContent = state.winner ? 'DUEL OVER' : `ROUND ${state.round}`;
  $('score-line').textContent = scoreLine(state);
  const mom = $('momentum-line');
  if (state.you.momentum > 0 && state.foe.momentum > 0) {
    mom.textContent = '🔥 Momentum: both fighters +2 next card';
    mom.className = 'momentum hot';
  } else if (state.you.momentum > 0) {
    mom.textContent = '🔥 Your Momentum: next card +2 power';
    mom.className = 'momentum hot';
  } else if (state.foe.momentum > 0) {
    mom.textContent = "🌩️ Sable's Momentum: its next card +2 power";
    mom.className = 'momentum hot';
  } else {
    mom.textContent = state.you.streak >= 1 || state.foe.streak >= 1
      ? 'Win one more round in a row for Momentum (+2).' : '';
    mom.className = 'momentum';
  }

  // Tell + scout
  $('tell-text').textContent = tellText(state);
  $('scout-text').textContent = state.scouted && state.phase === 'pick'
    ? `👁 Scout: Sable holds ${state.scouted.name} ${state.scouted.icon}` : '';

  // Sable's hand: face-down backs, except the scouted card.
  const foeHand = $('foe-hand');
  foeHand.innerHTML = '';
  state.foe.hand.forEach((c) => {
    if (state.scouted && c.id === state.scouted.id && state.phase === 'pick') {
      foeHand.appendChild(cardEl(c, { scouted: true }));
    } else {
      foeHand.appendChild(backEl());
    }
  });

  // Clash slots
  const youSlot = $('card-you-slot');
  const foeSlot = $('card-foe-slot');
  youSlot.innerHTML = '<span class="slot-hint">Your card</span>';
  foeSlot.innerHTML = '<span class="slot-hint">Sable\'s card</span>';
  if (state.lastClash) {
    youSlot.innerHTML = '';
    foeSlot.innerHTML = '';
    youSlot.appendChild(cardEl(state.lastClash.youCard, { flipped: true }));
    foeSlot.appendChild(cardEl(state.lastClash.foeCard, { flipped: true }));
  }

  // Clash text + next button
  const text = $('clash-text');
  const next = $('btn-next');
  if (state.phase === 'pick') {
    text.innerHTML = 'Pick a card from your hand.<br><span style="font-size:14px;color:#b9c9b8">Keys 1–5 work too.</span>';
    next.classList.add('hidden');
  } else if (state.phase === 'reveal') {
    text.innerHTML = state.lastClash.lines.map((l) => `<div>${l}</div>`).join('');
    if (!state.winner) next.classList.remove('hidden');
    else next.classList.add('hidden');
  }

  // History of last clashes
  $('history-items').textContent = state.history.length === 0
    ? '—'
    : state.history.map((h) => {
        const y = h.youCard.kind === 'spell' ? h.youCard.name : `${h.youCard.name}${h.youPower != null ? ` (${h.youPower})` : ''}`;
        const f = h.foeCard.kind === 'spell' ? h.foeCard.name : `${h.foeCard.name}${h.foePower != null ? ` (${h.foePower})` : ''}`;
        return `R${h.round}: ${y} vs ${f}`;
      }).join('  ·  ');

  // Player hand
  const hand = $('player-hand');
  hand.innerHTML = '';
  state.you.hand.forEach((c, i) => {
    const el = cardEl(c, { dealt: ui.justDealt });
    el.classList.add('playable');
    el.title = `Play ${c.name} (key ${i + 1})`;
    el.addEventListener('click', () => ui.onPlayCard(c));
    hand.appendChild(el);
  });
  if (state.phase !== 'pick') {
    hand.querySelectorAll('.card').forEach((el) => el.classList.add('disabled'));
  }

  // End screen
  if (state.winner) {
    const s = endSummary(state);
    $('end-emblem').textContent = s.emblem;
    $('end-title').textContent = s.title;
    $('end-title').className = state.winner === 'you' ? 'win' : state.winner === 'foe' ? 'lose' : 'draw';
    $('end-detail').textContent = s.detail;
    $('end-score').textContent = `Final score — rounds ${scoreLine(state)} · life ${state.you.hp} – ${state.foe.hp} · ${state.round} rounds played`;
    $('table-screen').classList.add('hidden');
    $('end-screen').classList.remove('hidden');
  }
  ui.justDealt = false;
}

// Floating damage/heal number over a fighter's HP bar.
export function floatNum(target, text, kind) {
  const bar = target === 'you' ? $('hp-you') : $('hp-foe');
  const r = bar.getBoundingClientRect();
  const layer = $('float-layer');
  const span = document.createElement('span');
  span.className = `float-num ${kind}`;
  span.textContent = text;
  span.style.left = `${r.left + r.width / 2 - 20}px`;
  span.style.top = `${r.top - 8}px`;
  layer.appendChild(span);
  setTimeout(() => span.remove(), 1200);
}

export function shake(target) {
  const bar = target === 'you' ? $('hp-you') : $('hp-foe');
  bar.classList.remove('shake');
  void bar.offsetWidth;
  bar.classList.add('shake');
}

export function showScreen(name) {
  for (const id of ['title-screen', 'table-screen', 'end-screen']) $(id).classList.add('hidden');
  $(`${name}-screen`).classList.remove('hidden');
}

// Tiny WebAudio blips — no audio files, no network.
let audioCtx = null;
let soundOn = true;
export function setSound(on) { soundOn = on; $('btn-sound').textContent = on ? '🔊 Sound on' : '🔇 Sound off'; }
export function blip(freq, dur = 0.09, type = 'sine', vol = 0.12) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch { /* audio unavailable: play silent */ }
}
export function playSound(kind) {
  if (kind === 'play') blip(520, 0.08, 'triangle');
  else if (kind === 'win-round') { blip(660, 0.09); setTimeout(() => blip(880, 0.12), 90); }
  else if (kind === 'lose-round') { blip(220, 0.14, 'sawtooth', 0.07); }
  else if (kind === 'win-duel') { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.16), i * 120)); }
  else if (kind === 'lose-duel') { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'sawtooth', 0.06), i * 140)); }
}
