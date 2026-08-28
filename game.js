"use strict";

const $ = (id) => document.getElementById(id);

const MAX_TIME = 90;

const el = {
  start: $("screen-start"),
  game: $("screen-game"),
  over: $("screen-over"),
  btnPlay: $("btn-play"),
  btnAgain: $("btn-again"),
  btnMenu: $("btn-menu"),
  btnRetry: $("btn-retry"),
  chipBest: $("chip-best"),
  bestVal: $("best-val"),
  score: $("score"),
  round: $("round"),
  streak: $("streak"),
  timeChip: $("time-chip"),
  timeVal: $("time-val"),
  timeFloat: $("time-float"),
  globalFill: $("global-fill"),
  mute: $("mute"),
  card: $("card"),
  cardBg: $("card-bg"),
  cardImg: $("card-img"),
  category: $("category"),
  loader: $("loader"),
  overlay: $("overlay"),
  ovEmoji: $("ov-emoji"),
  ovTitle: $("ov-title"),
  ovSub: $("ov-sub"),
  timerFill: $("timer-fill"),
  timerSecs: $("timer-secs"),
  desc: $("desc"),
  hint: $("hint"),
  form: $("form-guess"),
  input: $("guess-input"),
  btnGuess: $("btn-guess"),
  btnHint: $("btn-hint"),
  btnSkip: $("btn-skip"),
  loadError: $("load-error"),
  finalScore: $("final-score"),
  finalBest: $("final-best"),
  finalRounds: $("final-rounds"),
  finalCorrect: $("final-correct"),
  finalStreak: $("final-streak"),
  newBest: $("new-best")
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function normalize(s) {
  let n = (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  n = n.replace(/&/g, " and ");
  n = n.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  while (n.startsWith("the ")) n = n.slice(4);
  return n.trim();
}

function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function isMatch(input, item) {
  const n = normalize(input);
  if (!n) return false;
  const cands = [item.answer].concat(item.aliases || []).map(normalize).filter(Boolean);
  for (const c of cands) {
    if (n === c) return true;
    const minLen = Math.min(n.length, c.length);
    if (minLen >= 5 && Math.abs(n.length - c.length) <= 3) {
      if (lev(n, c) <= (minLen >= 9 ? 2 : 1)) return true;
    }
    if (n.length <= c.length + 18) {
      const toks = c.split(" ").filter((t) => t.length >= 3);
      if (toks.length && toks.every((t) => n.includes(t))) return true;
    }
  }
  return false;
}

const state = {
  round: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  correct: 0,
  time: MAX_TIME,
  item: null,
  locked: true,
  waiting: false,
  hintFlags: [],
  best: parseInt(localStorage.getItem("namit-best") || "0", 10) || 0
};

let curatedQueue = [];
const queue = [];
const usedTitles = new Set();
let filling = false;

let muted = localStorage.getItem("namit-muted") === "1";
let AC = null;

function beep(freq, dur, type, gain, when) {
  if (muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    o.connect(g);
    g.connect(AC.destination);
    const t = AC.currentTime + (when || 0);
    const d = dur || 0.12;
    g.gain.setValueAtTime(gain || 0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.start(t);
    o.stop(t + d + 0.05);
  } catch (e) { /* audio unavailable */ }
}

const sfx = {
  correct() { beep(523, 0.12, "sine", 0.15); beep(659, 0.12, "sine", 0.15, 0.1); beep(784, 0.22, "sine", 0.15, 0.2); },
  wrong() { beep(196, 0.32, "sawtooth", 0.1); },
  skip() { beep(330, 0.1, "triangle", 0.08); },
  hint() { beep(440, 0.08, "triangle", 0.08); },
  over() { beep(392, 0.2, "triangle", 0.12); beep(311, 0.25, "triangle", 0.12, 0.18); beep(233, 0.45, "triangle", 0.12, 0.36); }
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function buildCuratedQueue() {
  const byTier = (n) => shuffle(CURATED_ITEMS.filter((i) => i.tier === n));
  curatedQueue = byTier(1).concat(byTier(2)).concat(byTier(3));
}

function upscale(src) {
  return src.replace(/\/(\d{2,4})px-/, (m, w) => "/" + Math.min(+w * 2, 640) + "px-");
}

function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("img fail"));
    i.referrerPolicy = "no-referrer";
    i.src = src;
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWiki(title, attempt) {
  attempt = attempt || 0;
  try {
    const url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title) + "?redirect=true";
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (r.status === 429 && attempt < 2) {
      await sleep(900);
      return fetchWiki(title, attempt + 1);
    }
    if (!r.ok) throw new Error("http " + r.status);
    return await r.json();
  } catch (e) {
    if (attempt < 1) {
      await sleep(700);
      return fetchWiki(title, attempt + 1);
    }
    throw e;
  }
}

async function nextCurated() {
  if (!curatedQueue.length) return null;
  const base = curatedQueue.pop();
  try {
    const data = await fetchWiki(base.wiki || base.answer);
    const src = data.thumbnail && data.thumbnail.source;
    if (!src) return null;
    usedTitles.add(data.title);
    let img;
    try { img = await loadImg(upscale(src)); } catch (e) { img = await loadImg(src); }
    return {
      answer: base.answer,
      aliases: (base.aliases || []).slice(),
      category: base.category,
      desc: data.description || "",
      imgURL: img.src
    };
  } catch (e) {
    curatedQueue.unshift(base);
    return null;
  }
}

async function nextRandom() {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch("https://en.wikipedia.org/api/rest_v1/page/random/summary");
      if (!r.ok) { await sleep(800); continue; }
      const d = await r.json();
      if (d.type !== "standard") continue;
      if (!d.thumbnail || !d.thumbnail.source) continue;
      if (!d.description || d.description.length < 8) continue;
      const t = d.title || "";
      if (/^(list of|index of|outline of|talk:|portal:|wikipedia:|special:)/i.test(t)) continue;
      if (usedTitles.has(t)) continue;
      usedTitles.add(t);
      const stripped = t.replace(/\s*\([^)]*\)\s*$/, "").trim();
      const aliases = stripped && stripped.toLowerCase() !== t.toLowerCase() ? [stripped] : [];
      let img;
      try { img = await loadImg(upscale(d.thumbnail.source)); } catch (e) { img = await loadImg(d.thumbnail.source); }
      return { answer: t, aliases, category: "Anything", desc: d.description || "", imgURL: img.src };
    } catch (e) {
      await sleep(500);
    }
  }
  return null;
}

async function obtainItem() {
  return (await nextCurated()) || (await nextRandom());
}

async function ensureQueue() {
  if (filling) return;
  filling = true;
  try {
    while (queue.length < 2) {
      const it = await obtainItem();
      if (!it) break;
      queue.push(it);
    }
  } finally {
    filling = false;
  }
  if (state.waiting) {
    if (queue.length) startRound();
    else showLoadError();
  }
}

function updateHUD() {
  el.score.textContent = state.score;
  el.round.textContent = Math.max(1, state.round);
  el.streak.textContent = state.streak;
}

function renderTime() {
  el.timeVal.textContent = Math.ceil(state.time);
  const pct = Math.max(0, Math.min(100, (state.time / MAX_TIME) * 100));
  el.globalFill.style.width = pct + "%";
  const low = state.time < 15;
  el.globalFill.classList.toggle("low", low);
  el.timeChip.classList.toggle("low", low);
}

function floatTime(sec) {
  el.timeFloat.textContent = (sec > 0 ? "+" : "−") + Math.abs(sec) + "s";
  el.timeFloat.className = "";
  void el.timeFloat.offsetWidth;
  el.timeFloat.className = sec > 0 ? "gain" : "loss";
}

let gRunning = false;
let gEnd = 0;
let gRaf = 0;

function startGlobal() {
  if (gRunning || state.time <= 0) return;
  gEnd = performance.now() + state.time * 1000;
  gRunning = true;
  tickGlobal();
}

function tickGlobal() {
  if (!gRunning) return;
  const left = Math.max(0, gEnd - performance.now());
  state.time = left / 1000;
  renderTime();
  if (left <= 0) { gRunning = false; onGlobalExpired(); return; }
  gRaf = requestAnimationFrame(tickGlobal);
}

function stopGlobal() {
  if (!gRunning) { renderTime(); return; }
  gRunning = false;
  cancelAnimationFrame(gRaf);
  state.time = Math.max(0, (gEnd - performance.now()) / 1000);
  renderTime();
}

function adjustTime(sec) {
  stopGlobal();
  state.time = Math.max(0, Math.min(MAX_TIME, state.time + sec));
  renderTime();
  floatTime(sec);
  if (sec > 0 && state.time > 0) startGlobal();
}

function onGlobalExpired() {
  stopTimer();
  state.locked = true;
  el.input.disabled = true;
  el.btnGuess.disabled = true;
  sfx.over();
  setTimeout(gameOver, 350);
}

function showScreen(s) {
  el.start.classList.add("hidden");
  el.game.classList.add("hidden");
  el.over.classList.add("hidden");
  s.classList.remove("hidden");
}

function refreshBestChip() {
  if (state.best > 0) {
    el.chipBest.classList.remove("hidden");
    el.bestVal.textContent = state.best;
  }
}

function setOverlay(emoji, title, subHtml, cls) {
  el.ovEmoji.textContent = emoji;
  el.ovTitle.textContent = title;
  el.ovSub.innerHTML = subHtml;
  el.overlay.className = "overlay show" + (cls ? " " + cls : "");
}

function hideOverlay() {
  el.overlay.className = "overlay";
}

function showLoadError() {
  el.card.classList.remove("loading");
  el.category.textContent = "OFFLINE?";
  el.loadError.classList.remove("hidden");
  state.locked = true;
}

function startTimer(sec, onTimeout) {
  const dur = sec * 1000;
  const end = performance.now() + dur;
  let running = true;
  const tick = () => {
    if (!running) return;
    const left = Math.max(0, end - performance.now());
    const ratio = left / dur;
    el.timerFill.style.width = ratio * 100 + "%";
    el.timerFill.classList.toggle("low", ratio <= 0.35);
    el.timerSecs.textContent = Math.ceil(left / 1000) + "s";
    if (left <= 0) { running = false; onTimeout(); return; }
    requestAnimationFrame(tick);
  };
  tick();
  return () => { running = false; };
}

let stopTimer = () => {};

function setupHint() {
  state.hintFlags = state.item.answer.split("").map((ch) => !/[a-z0-9]/i.test(ch));
  el.hint.classList.add("hidden");
  el.btnHint.disabled = false;
}

function renderHint() {
  const s = state.item.answer.split("").map((ch, i) => (state.hintFlags[i] ? ch : "•")).join("");
  el.hint.textContent = s;
  el.hint.classList.remove("hidden");
}

function useHint() {
  if (state.locked || !state.item) return;
  const idx = state.hintFlags.indexOf(false);
  if (idx < 0) return;
  state.hintFlags[idx] = true;
  state.score = Math.max(0, state.score - 30);
  updateHUD();
  renderHint();
  sfx.hint();
  if (state.hintFlags.indexOf(false) < 0) el.btnHint.disabled = true;
}

function roundSeconds() {
  return Math.max(8, 16 - Math.floor((state.round - 1) / 4));
}

function startRound() {
  state.waiting = false;
  state.item = queue.shift();
  ensureQueue();
  state.locked = false;
  state.round++;
  updateHUD();
  setupHint();
  hideOverlay();
  el.loadError.classList.add("hidden");
  el.card.classList.remove("shake");
  el.card.classList.remove("pop");
  void el.card.offsetWidth;
  el.card.classList.add("pop");
  el.card.classList.remove("loading");
  el.card.classList.add("ready");
  el.cardImg.src = state.item.imgURL;
  el.cardBg.style.backgroundImage = "url(\"" + state.item.imgURL + "\")";
  el.category.textContent = state.item.category;
  el.desc.textContent = state.item.desc || "";
  el.timerFill.style.width = "100%";
  el.timerFill.classList.remove("low");
  el.input.value = "";
  el.input.disabled = false;
  el.btnGuess.disabled = false;
  el.input.focus();
  stopTimer = startTimer(roundSeconds(), onTimeout);
  startGlobal();
}

function advance() {
  if (state.time <= 0) { gameOver(); return; }
  if (queue.length) startRound();
  else {
    state.waiting = true;
    state.locked = true;
    el.card.classList.remove("ready");
    el.card.classList.add("loading");
    el.category.textContent = "LOADING…";
    el.desc.textContent = "";
    ensureQueue();
  }
}

function onCorrect() {
  state.locked = true;
  stopTimer();
  const leftRatio = Math.max(0, parseFloat(el.timerFill.style.width) / 100);
  state.streak++;
  state.correct++;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  const pts = 100 + Math.round(leftRatio * roundSeconds()) * 5 + (state.streak - 1) * 25;
  state.score += pts;
  updateHUD();
  adjustTime(6);
  sfx.correct();
  if (window.confetti) {
    window.confetti({ particleCount: 110, spread: 75, origin: { y: 0.6 } });
  }
  setOverlay("🎉", "Correct!", "+" + pts + " · ⏱ +6s" + (state.streak > 1 ? " · 🔥 " + state.streak + " in a row" : ""), "good");
  setTimeout(advance, 1400);
}

function onWrong() {
  state.locked = true;
  stopTimer();
  state.streak = 0;
  updateHUD();
  adjustTime(-5);
  sfx.wrong();
  el.card.classList.remove("shake");
  void el.card.offsetWidth;
  el.card.classList.add("shake");
  setOverlay("💀", "Nope!", "It was <b>" + esc(state.item.answer) + "</b> · ⏱ −5s", "bad");
  setTimeout(advance, 2300);
}

function onTimeout() {
  state.locked = true;
  state.streak = 0;
  updateHUD();
  adjustTime(-5);
  sfx.wrong();
  setOverlay("⏰", "Time's up!", "It was <b>" + esc(state.item.answer) + "</b> · ⏱ −5s", "bad");
  setTimeout(advance, 2300);
}

function onSkip() {
  if (state.locked || !state.item) return;
  state.locked = true;
  stopTimer();
  state.streak = 0;
  updateHUD();
  adjustTime(-2);
  sfx.skip();
  setOverlay("🤝", "Skipped", "It was <b>" + esc(state.item.answer) + "</b> · ⏱ −2s", "");
  setTimeout(advance, 1300);
}

function startGame() {
  state.round = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.correct = 0;
  state.time = MAX_TIME;
  state.item = null;
  state.locked = true;
  state.waiting = true;
  queue.length = 0;
  usedTitles.clear();
  buildCuratedQueue();
  updateHUD();
  renderTime();
  el.loadError.classList.add("hidden");
  el.card.classList.remove("ready");
  el.card.classList.add("loading");
  el.cardImg.removeAttribute("src");
  el.cardBg.style.backgroundImage = "none";
  el.category.textContent = "LOADING…";
  el.desc.textContent = "";
  el.timerFill.style.width = "100%";
  showScreen(el.game);
  ensureQueue();
}

function gameOver() {
  stopGlobal();
  stopTimer();
  sfx.over();
  const isNew = state.score > state.best;
  if (isNew) {
    state.best = state.score;
    localStorage.setItem("namit-best", String(state.best));
  }
  refreshBestChip();
  el.finalScore.textContent = state.score;
  el.finalBest.textContent = state.best;
  el.finalRounds.textContent = state.round;
  el.finalCorrect.textContent = state.correct;
  el.finalStreak.textContent = state.bestStreak;
  el.newBest.classList.toggle("hidden", !isNew);
  if (isNew && window.confetti) {
    window.confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
  }
  showScreen(el.over);
}

function updateMuteIcon() {
  el.mute.textContent = muted ? "🔇" : "🔊";
}

el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (state.locked || !state.item) return;
  const v = el.input.value;
  if (!normalize(v)) return;
  if (isMatch(v, state.item)) onCorrect();
  else onWrong();
});

el.btnSkip.addEventListener("click", onSkip);
el.btnHint.addEventListener("click", useHint);
el.btnPlay.addEventListener("click", startGame);
el.btnAgain.addEventListener("click", startGame);
el.btnMenu.addEventListener("click", () => showScreen(el.start));
el.btnRetry.addEventListener("click", () => {
  el.loadError.classList.add("hidden");
  el.card.classList.add("loading");
  el.category.textContent = "LOADING…";
  state.waiting = true;
  ensureQueue();
});
el.mute.addEventListener("click", () => {
  muted = !muted;
  localStorage.setItem("namit-muted", muted ? "1" : "0");
  updateMuteIcon();
});

refreshBestChip();
updateMuteIcon();
showScreen(el.start);
