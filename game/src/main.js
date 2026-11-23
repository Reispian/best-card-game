// Ember Court — bootstrap, input wiring, screenshot states and autopilot.
// ?shot=title|play|win|lose&seed=N renders a fixed state for screenshots.
// ?autoplay=1 plays the duel by itself (used to self-test a full game).

import { newDuel, playRound, nextRound } from './engine.js';
import { render, floatNum, shake, showScreen, playSound, setSound, blip } from './render.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || Date.now() % 2147483647);
let state = newDuel(seed);
const ui = { justDealt: false, onPlayCard };

function onPlayCard(card) {
  if (state.phase !== 'pick' || state.winner) return;
  playSound('play');
  const report = playRound(state, card);
  if (!report) return;
  if (report.damageToFoe > 0) {
    floatNum('foe', `-${report.damageToFoe}`, 'dmg');
    shake('foe');
  }
  if (report.damageToYou > 0) {
    floatNum('you', `-${report.damageToYou}`, 'dmg');
    shake('you');
  }
  const youWonRound = report.damageToFoe > report.damageToYou;
  const foeWonRound = report.damageToYou > report.damageToFoe;
  if (state.winner) {
    playSound(state.winner === 'you' ? 'win-duel' : state.winner === 'foe' ? 'lose-duel' : 'win-round');
  } else if (youWonRound) playSound('win-round');
  else if (foeWonRound) playSound('lose-round');
  render(state, ui);
  if (state.winner) setTimeout(() => showEnd(), 1400);
}

function showEnd() {
  render(state, ui);
}

function startDuel() {
  state = newDuel(Number(params.get('seed') || Date.now() % 2147483647));
  ui.justDealt = true;
  showScreen('table');
  render(state, ui);
  blip(440, 0.1, 'triangle');
}

document.getElementById('btn-play').addEventListener('click', startDuel);
document.getElementById('btn-again').addEventListener('click', startDuel);
document.getElementById('btn-restart').addEventListener('click', startDuel);
document.getElementById('btn-next').addEventListener('click', () => {
  nextRound(state);
  ui.justDealt = true;
  render(state, ui);
});
for (const id of ['btn-menu', 'btn-menu2']) {
  document.getElementById(id).addEventListener('click', () => showScreen('title'));
}
document.getElementById('btn-sound').addEventListener('click', (e) => {
  const on = e.target.textContent.includes('on');
  setSound(!on);
});

document.addEventListener('keydown', (e) => {
  if (!$('title-screen').classList.contains('hidden') && (e.key === 'Enter' || e.key === ' ')) {
    startDuel();
    return;
  }
  if (!$('end-screen').classList.contains('hidden') && (e.key === 'r' || e.key === 'R' || e.key === 'Enter')) {
    startDuel();
    return;
  }
  if (state.phase !== 'pick' || $('table-screen').classList.contains('hidden')) return;
  const n = Number(e.key);
  if (n >= 1 && n <= state.you.hand.length) onPlayCard(state.you.hand[n - 1]);
  if (e.key === 'Enter' && state.phase === 'reveal') {
    nextRound(state);
    render(state, ui);
  }
});

// ---- Screenshot states: deterministic, real renders of the game ----
function applyShot() {
  const shot = params.get('shot');
  if (!shot) return;
  const s = newDuel(seed);
  if (shot === 'title') {
    showScreen('title');
    document.title = 'Ember Court — title';
    return;
  }
  if (shot === 'play') {
    // Play a few rounds with fixed picks so the table shows history, damage and momentum.
    state = s;
    showScreen('table');
    const picks = [0, 1, 0, 2, 1];
    for (let i = 0; i < picks.length && !state.winner; i++) {
      const card = state.you.hand[Math.min(picks[i], state.you.hand.length - 1)];
      playRound(state, card);
      if (!state.winner) nextRound(state);
    }
    // One more reveal in progress for the shot: play a card and leave it revealed.
    if (!state.winner && state.you.hand.length > 0) playRound(state, state.you.hand[0]);
    render(state, ui);
    document.title = 'Ember Court — mid duel';
    return;
  }
  if (shot === 'win' || shot === 'lose') {
    state = s;
    showScreen('table');
    // Autoplay until someone wins, steering the player toward the wanted outcome.
    let guard = 0;
    while (!state.winner && guard++ < 60) {
      const hand = state.you.hand;
      let pick;
      if (shot === 'win') {
        // Best attack by raw power, else a spell.
        pick = hand.filter((c) => c.kind === 'attack').sort((a, b) => b.power - a.power)[0] || hand[0];
      } else {
        // Weakest card on purpose — and the least useful spell when no attacks.
        const atks = hand.filter((c) => c.kind === 'attack').sort((a, b) => a.power - b.power);
        const ward = hand.find((c) => c.spell === 'ward');
        const siphon = hand.find((c) => c.spell === 'siphon');
        const mend = hand.find((c) => c.spell === 'mend');
        pick = atks[0] || ward || siphon || mend || hand[0];
      }
      playRound(state, pick);
      if (!state.winner) nextRound(state);
    }
    render(state, ui);
    document.title = `Ember Court — ${shot}`;
    return;
  }
}

// ---- Autopilot: play a whole duel without input, for self-testing ----
function autopilot() {
  startDuel();
  const step = () => {
    if (state.winner) {
      document.title = `AUTOPILOT DONE winner=${state.winner} rounds=${state.round} hp=${state.you.hp}-${state.foe.hp}`;
      document.body.setAttribute('data-autopilot', `winner=${state.winner};rounds=${state.round};hp=${state.you.hp}-${state.foe.hp};score=${state.you.roundsWon}-${state.foe.roundsWon}`);
      return;
    }
    if (state.phase === 'pick') {
      const card = state.you.hand[Math.floor(Math.random() * state.you.hand.length)];
      onPlayCard(card);
      setTimeout(step, 60);
    } else {
      nextRound(state);
      render(state, ui);
      setTimeout(step, 60);
    }
  };
  setTimeout(step, 100);
}

if (params.get('shot')) applyShot();
else if (params.get('autoplay') === '1') autopilot();
else showScreen('title');
