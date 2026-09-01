"use strict";

const $ = (id) => document.getElementById(id);

const MAX_TIME = 90;

const el = {
  start: $("screen-start"),
  game: $("screen-game"),
  over: $("screen-over"),
  screenLb: $("screen-lb"),
  btnPlay: $("btn-play"),
  btnViewLb: $("btn-view-lb"),
  btnViewLbAfter: $("btn-view-lb-after"),
  lbBack: $("lb-back"),
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
  cardText: $("card-text"),
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
  newBest: $("new-best"),
  lbPrompt: $("lb-prompt"),
  lbBoardWrap: $("lb-board-wrap"),
  lbName: $("lb-name"),
  lbSubmit: $("lb-submit"),
  lbSkip: $("lb-skip"),
  lbMsg: $("lb-msg"),
  lbList: $("lb-list"),
  lbListStart: $("lb-list-start"),
  lbRankNote: $("lb-rank-note"),
  lbClose: $("lb-close"),
  lbSubtitle: $("lb-subtitle"),
  lbEmpty: $("lb-empty")
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ── Internet Leaderboard (optional, per-internet, filtered) ──
const LEADERBOARD_ENDPOINT = null; // e.g. "https://your-worker.workers.dev/scores" — leave null for local demo
const LB_KEY = "namit-lb-v1";
const LB_NAME_KEY = "namit-lb-name";
const LB_MAX = 50;

const BAD_WORDS_SUBSTRING = [
  "fuck","shit","bitch","bastard","dick","pussy","cunt","slut","whore","fag","faggot",
  "nigger","nigga","cock","cum","jizz","dildo","wanker","bollocks","twat","prick","arse",
  "crap","douche","blowjob","handjob","porn","sex","penis","vagina","tits","boobs",
  "motherfucker","asshole","asshat","nazi","hitler","kkk","retard","spic","chink","gook","kike","tranny","shemale","rape","rapist"
];
const BAD_WORDS_EXACT = ["ass","damn","hell","sex","asshole"];

function normalizeProfanity(s){
  let n = (s||"").toLowerCase();
  n = n.replace(/0/g,"o").replace(/1/g,"i").replace(/3/g,"e").replace(/4/g,"a").replace(/5/g,"s").replace(/7/g,"t").replace(/8/g,"b").replace(/@/g,"a").replace(/\$/g,"s");
  n = n.normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  n = n.replace(/[^a-z]/g," ");
  return n;
}
function containsProfanity(name){
  const norm = normalizeProfanity(name);
  const tokens = norm.split(/\s+/).filter(Boolean);
  const joined = tokens.join(" ");
  for(const w of BAD_WORDS_SUBSTRING){
    if(joined.includes(w)) return true;
  }
  for(const w of BAD_WORDS_EXACT){
    if(tokens.includes(w)) return true;
  }
  // block repeated chars like "fffuuuuck" -> "fuck"
  const collapsed = norm.replace(/(.)\1+/g,"$1");
  if(collapsed !== norm){
    const c2 = collapsed.replace(/[^a-z]/g,"");
    for(const w of BAD_WORDS_SUBSTRING) if(c2.includes(w)) return true;
  }
  return false;
}
function isValidLeaderboardName(name){
  const t = (name||"").trim();
  if(t.length < 3 || t.length > 16) return {ok:false, msg:"Name must be 3–16 characters."};
  if(!/^[a-zA-Z0-9 _\-]+$/.test(t)) return {ok:false, msg:"Only letters, numbers, space, _ and - allowed."};
  if(/^\d+$/.test(t)) return {ok:false, msg:"Name can't be only numbers."};
  if(containsProfanity(t)) return {ok:false, msg:"That name contains a blocked word. Try another."};
  return {ok:true, value:t};
}
function lbSeed(){
  return [
    {name:"Sakura", score:3420, rounds:28, correct:22, streak:9, date:"2026-04-12"},
    {name:"Kenji", score:2980, rounds:24, correct:19, streak:7, date:"2026-04-20"},
    {name:"Maya", score:2670, rounds:21, correct:17, streak:6, date:"2026-05-03"},
    {name:"Leo", score:2350, rounds:19, correct:15, streak:5, date:"2026-05-18"},
    {name:"Ava", score:1980, rounds:16, correct:13, streak:4, date:"2026-06-01"},
    {name:"Noah", score:1650, rounds:14, correct:11, streak:4, date:"2026-06-15"},
    {name:"Zara", score:1320, rounds:12, correct:9, streak:3, date:"2026-07-02"},
    {name:"Omar", score:980, rounds:9, correct:7, streak:3, date:"2026-07-20"},
    {name:"Luna", score:740, rounds:7, correct:5, streak:2, date:"2026-08-10"},
    {name:"Finn", score:520, rounds:5, correct:4, streak:2, date:"2026-08-25"}
  ];
}
function getLeaderboard(){
  try{
    const raw = localStorage.getItem(LB_KEY);
    if(!raw){
      const seed = lbSeed();
      localStorage.setItem(LB_KEY, JSON.stringify(seed));
      return seed.slice();
    }
    const arr = JSON.parse(raw);
    if(!Array.isArray(arr)) throw new Error("bad");
    return arr;
  }catch(e){
    const seed = lbSeed();
    try{ localStorage.setItem(LB_KEY, JSON.stringify(seed)); }catch(_){}
    return seed.slice();
  }
}
function saveLeaderboard(arr){
  try{ localStorage.setItem(LB_KEY, JSON.stringify(arr.slice(0,LB_MAX))); }catch(e){}
}
async function fetchRemoteLeaderboard(){
  if(!LEADERBOARD_ENDPOINT) return null;
  try{
    const r = await fetch(LEADERBOARD_ENDPOINT, {headers:{Accept:"application/json"}});
    if(!r.ok) return null;
    const d = await r.json();
    if(Array.isArray(d)) return d;
    if(Array.isArray(d.scores)) return d.scores;
    return null;
  }catch(e){ return null; }
}
async function pushRemoteScore(entry){
  if(!LEADERBOARD_ENDPOINT) return false;
  try{
    const r = await fetch(LEADERBOARD_ENDPOINT, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(entry)});
    return r.ok;
  }catch(e){ return false; }
}
function addToLeaderboard(entry){
  const lb = getLeaderboard();
  lb.push(entry);
  lb.sort((a,b)=> b.score - a.score || new Date(b.date) - new Date(a.date));
  const dedup = [];
  const seen = new Set();
  for(const e of lb){
    const key = e.name+"|"+e.score+"|"+e.date;
    if(seen.has(key)) continue;
    seen.add(key);
    dedup.push(e);
  }
  const trimmed = dedup.slice(0,LB_MAX);
  saveLeaderboard(trimmed);
  return trimmed;
}
function getRankForScore(score, lb){
  const sorted = lb.slice().sort((a,b)=> b.score - a.score);
  let rank = 1;
  for(const e of sorted){ if(score > e.score) break; if(score <= e.score) rank++; }
  // simpler: position after sort
  const withNew = sorted.concat([{score}]).sort((a,b)=> b.score - a.score);
  for(let i=0;i<withNew.length;i++) if(withNew[i].score===score){ return i+1; }
  return rank;
}
function renderLbList(targetEl, highlightEntry){
  const lb = getLeaderboard();
  targetEl.innerHTML = "";
  const top = lb.slice(0, targetEl===el.lbListStart ? 20 : 10);
  if(!top.length){
    if(el.lbEmpty) el.lbEmpty.classList.remove("hidden");
    return;
  }
  if(el.lbEmpty) el.lbEmpty.classList.add("hidden");
  top.forEach((e,i)=>{
    const li = document.createElement("li");
    const isMe = highlightEntry && e.name===highlightEntry.name && e.score===highlightEntry.score && e.date===highlightEntry.date;
    if(isMe) li.className = "me";
    else if(i===0) li.className = "top1";
    const medal = i===0 ? "🥇" : i===1 ? "🥈" : i===2 ? "🥉" : "#" + (i+1);
    li.innerHTML = '<span class="lb-rank">'+medal+'</span><span class="lb-name">'+esc(e.name)+'</span><span class="lb-score">'+e.score+'</span><span class="lb-meta">'+esc(e.rounds)+'r · '+esc(e.correct)+'✓</span>';
    targetEl.appendChild(li);
  });
  return lb;
}
function showLbBoard(highlight){
  renderLbList(el.lbList, highlight);
  el.lbBoardWrap.classList.remove("hidden");
  // also sync start screen list if present
  if(el.lbListStart) renderLbList(el.lbListStart, highlight);
}
function setLbMsg(msg, ok){
  el.lbMsg.textContent = msg;
  el.lbMsg.className = "lb-msg " + (ok ? "ok" : "err");
  el.lbMsg.classList.remove("hidden");
}

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
  // Fully random uniform shuffle across all tiers/categories.
  // Previously this was tier-ordered (1→2→3) + pop() which meant
  // tier-3 hard items always appeared first and tier-1 rarely,
  // making early games feel identical despite 800+ items.
  curatedQueue = shuffle(CURATED_ITEMS);
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

async function tryImg(hi, lo) {
  try { return await loadImg(hi); } catch (e) { return await loadImg(lo); }
}

async function fetchWikidataP18(qid) {
  try {
    const url = "https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&origin=*&entity=" + encodeURIComponent(qid) + "&property=P18";
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    const claims = d.claims && d.claims.P18;
    if (!claims || !claims.length) return null;
    const snak = claims[0].mainsnak;
    if (!snak || snak.snaktype !== "value" || !snak.datavalue) return null;
    return snak.datavalue.value;
  } catch (e) { return null; }
}

async function commonsThumb(fileTitle) {
  try {
    const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=imageinfo&iiprop=url&iiurlwidth=480&titles=" + encodeURIComponent(fileTitle);
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    const pages = d.query && d.query.pages;
    if (!pages) return null;
    for (const k in pages) {
      const ii = pages[k].imageinfo && pages[k].imageinfo[0];
      if (ii && ii.thumburl) return ii.thumburl;
    }
    return null;
  } catch (e) { return null; }
}

async function searchCommons(query) {
  try {
    const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=" + encodeURIComponent(query) + "&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url%7Csize&iiurlwidth=480";
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    const pages = d.query && d.query.pages;
    if (!pages) return null;
    const list = Object.keys(pages).map((k) => pages[k]).sort((a, b) => (a.index || 0) - (b.index || 0));
    for (const p of list) {
      const ii = p.imageinfo && p.imageinfo[0];
      if (!ii || !ii.thumburl) continue;
      if ((ii.width || 0) < 220 || (ii.height || 0) < 150) continue;
      return ii.thumburl;
    }
    return null;
  } catch (e) { return null; }
}

async function resolveImageFor(base) {
  let desc = "";
  try {
    const data = await fetchWiki(base.wiki || base.answer);
    desc = data.description || "";
    const src = data.thumbnail && data.thumbnail.source;
    if (src) {
      const img = await tryImg(upscale(src), src);
      return { desc, imgURL: img.src };
    }
    const qid = data.wikibase_item;
    if (qid) {
      const file = await fetchWikidataP18(qid);
      if (file) {
        const t = await commonsThumb(file);
        if (t) {
          const img = await tryImg(upscale(t), t);
          return { desc, imgURL: img.src };
        }
      }
    }
  } catch (e) { /* fall through to commons search */ }
  const s = await searchCommons(base.search || base.answer);
  if (s) {
    const img = await tryImg(upscale(s), s);
    return { desc: desc || base.desc || "", imgURL: img.src };
  }
  return null;
}

const failedCount = new Map();

async function nextCurated() {
  if (!curatedQueue.length) return null;
  const base = curatedQueue.pop();
  if (base.type === "text") {
    return {
      answer: base.answer,
      aliases: (base.aliases || []).slice(),
      category: base.category,
      desc: base.desc || "",
      text: base.text,
      mode: base.mode || "quote",
      imgURL: null
    };
  }
  try {
    const res = await resolveImageFor(base);
    if (!res) {
      const c = (failedCount.get(base.answer) || 0) + 1;
      failedCount.set(base.answer, c);
      if (c < 2) curatedQueue.unshift(base);
      return null;
    }
    usedTitles.add(base.answer);
    return {
      answer: base.answer,
      aliases: (base.aliases || []).slice(),
      category: base.category,
      desc: res.desc,
      imgURL: res.imgURL
    };
  } catch (e) {
    const c = (failedCount.get(base.answer) || 0) + 1;
    failedCount.set(base.answer, c);
    if (c < 2) curatedQueue.unshift(base);
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
  // 15% chance to inject a truly random Wikipedia article for variety
  if (Math.random() < 0.15) {
    const rnd = await nextRandom();
    if (rnd) return rnd;
  }
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
  if(el.screenLb) el.screenLb.classList.add("hidden");
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
  const isText = !!state.item.text;
  el.card.classList.toggle("textmode", isText);
  if (isText) {
    el.card.classList.remove("ready");
    el.cardText.textContent = state.item.text;
    el.cardText.dataset.mode = state.item.mode || "quote";
  } else {
    el.cardImg.src = state.item.imgURL;
    el.cardBg.style.backgroundImage = "url(\"" + state.item.imgURL + "\")";
    el.card.classList.add("ready");
  }
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
    el.card.classList.remove("textmode");
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
  el.card.classList.remove("textmode");
  el.card.classList.add("loading");
  el.cardImg.removeAttribute("src");
  el.cardBg.style.backgroundImage = "none";
  el.category.textContent = "LOADING…";
  el.desc.textContent = "";
  el.timerFill.style.width = "100%";
  showScreen(el.game);
  ensureQueue();
}

let lbSubmittedThisGame = false;
function resetLbOverUI(){
  lbSubmittedThisGame = false;
  if(el.lbMsg){ el.lbMsg.classList.add("hidden"); el.lbMsg.textContent=""; }
  if(el.lbName){ el.lbName.value = ""; try{ el.lbName.value = localStorage.getItem(LB_NAME_KEY)||""; }catch(e){} }
  if(el.lbPrompt) el.lbPrompt.classList.add("hidden");
  if(el.lbBoardWrap) el.lbBoardWrap.classList.add("hidden");
  if(el.lbRankNote) el.lbRankNote.classList.add("hidden");
  if(el.btnViewLbAfter) el.btnViewLbAfter.classList.remove("hidden");
  if(el.lbSubmit) el.lbSubmit.disabled = false;
}

function prepareLbPrompt(){
  resetLbOverUI();
  // Always show the board after a game so player sees "something popped"
  // Prompt (submit) is optional and only shown if score > 0
  try{ showLbBoard(null); }catch(e){ console.warn("lb show failed", e); }
  if(el.lbBoardWrap) el.lbBoardWrap.classList.remove("hidden");
  if(el.btnViewLbAfter) el.btnViewLbAfter.textContent = "Hide Leaderboard";
  if(state.score <= 0){
    if(el.lbPrompt) el.lbPrompt.classList.add("hidden");
    if(el.lbRankNote){
      el.lbRankNote.textContent = "Score 0 — play again and submit to climb the internet!";
      el.lbRankNote.classList.remove("hidden");
    }
    return;
  }
  if(el.lbPrompt) el.lbPrompt.classList.remove("hidden");
  if(el.lbName) setTimeout(()=>{ try{el.lbName.focus();}catch(e){}},200);
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
  console.log("[lb] gameOver score", state.score, "lbPrompt", !!el.lbPrompt, "lbBoard", !!el.lbBoardWrap);
  prepareLbPrompt();
  showScreen(el.over);
  // try to refresh remote board in background if configured
  if(LEADERBOARD_ENDPOINT){
    fetchRemoteLeaderboard().then(remote=>{
      if(remote && Array.isArray(remote)) saveLeaderboard(remote);
    });
  }
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

// ── Leaderboard interactions ──
function handleLbSubmit(){
  if(lbSubmittedThisGame){ setLbMsg("Already submitted this game.", false); return; }
  if(state.score<=0){ setLbMsg("Play a round to get a score first!", false); return; }
  const check = isValidLeaderboardName(el.lbName.value);
  if(!check.ok){ setLbMsg(check.msg, false); return; }
  const name = check.value;
  try{ localStorage.setItem(LB_NAME_KEY, name); }catch(e){}
  const entry = {name, score: state.score, rounds: state.round, correct: state.correct, streak: state.bestStreak, date: new Date().toISOString().slice(0,10)};
  const lb = addToLeaderboard(entry);
  lbSubmittedThisGame = true;
  if(LEADERBOARD_ENDPOINT) pushRemoteScore(entry);
  setLbMsg("Submitted! Good luck beating the internet 🌐", true);
  if(el.lbSubmit) el.lbSubmit.disabled = true;
  setTimeout(()=>{
    if(el.lbPrompt) el.lbPrompt.classList.add("hidden");
    showLbBoard(entry);
    // rank note
    const sorted = lb.slice().sort((a,b)=> b.score - a.score);
    const idx = sorted.findIndex(e=> e.name===entry.name && e.score===entry.score && e.date===entry.date);
    const rank = idx>=0? idx+1 : sorted.length;
    if(el.lbRankNote){
      if(rank===1) el.lbRankNote.innerHTML = "You are <strong>#1 on the internet!</strong> 👑";
      else if(rank<=3) el.lbRankNote.innerHTML = "You are <strong>#"+rank+" in the world!</strong> 🔥 Top 3!";
      else if(rank<=10) el.lbRankNote.innerHTML = "You are <strong>#"+rank+" / "+lb.length+"</strong> — top 10!";
      else el.lbRankNote.innerHTML = "You are <strong>#"+rank+" / "+lb.length+"</strong> — keep grinding!";
      el.lbRankNote.classList.remove("hidden");
    }
    if(el.btnViewLbAfter){ el.btnViewLbAfter.classList.remove("hidden"); el.btnViewLbAfter.textContent = "Hide Leaderboard"; }
    if(window.confetti) window.confetti({particleCount:120, spread:70, origin:{y:0.6}});
  }, 400);
}
function handleLbSkip(){
  if(el.lbPrompt) el.lbPrompt.classList.add("hidden");
  setLbMsg("", true);
  el.lbMsg.classList.add("hidden");
  showLbBoard(null);
  if(el.lbBoardWrap) el.lbBoardWrap.classList.remove("hidden");
  if(el.lbRankNote) el.lbRankNote.classList.add("hidden");
  if(el.btnViewLbAfter){ el.btnViewLbAfter.classList.remove("hidden"); el.btnViewLbAfter.textContent = "Hide Leaderboard"; }
}
function handleLbViewToggle(){
  const isHidden = el.lbBoardWrap.classList.contains("hidden");
  if(isHidden){
    showLbBoard(null);
    if(state.score>0 && !lbSubmittedThisGame && !el.lbPrompt.classList.contains("hidden")){
      // keep prompt visible alongside board
    }
    if(el.btnViewLbAfter) el.btnViewLbAfter.textContent = "Hide Leaderboard";
  } else {
    el.lbBoardWrap.classList.add("hidden");
    if(el.lbRankNote) el.lbRankNote.classList.add("hidden");
    if(el.btnViewLbAfter) el.btnViewLbAfter.textContent = state.score>0 && !lbSubmittedThisGame ? "🏆 View Leaderboard (skip submit)" : "🏆 View Internet Leaderboard";
  }
}
function openLbScreen(){
  renderLbList(el.lbListStart, null);
  showScreen(el.screenLb);
}
if(el.lbSubmit) el.lbSubmit.addEventListener("click", handleLbSubmit);
if(el.lbSkip) el.lbSkip.addEventListener("click", handleLbSkip);
if(el.lbClose) el.lbClose.addEventListener("click", ()=>{
  el.lbBoardWrap.classList.add("hidden");
  if(el.lbRankNote) el.lbRankNote.classList.add("hidden");
  if(el.btnViewLbAfter){
    el.btnViewLbAfter.classList.remove("hidden");
    el.btnViewLbAfter.textContent = lbSubmittedThisGame ? "🏆 View Internet Leaderboard" : "🏆 View Leaderboard (skip submit)";
  }
});
if(el.btnViewLbAfter) el.btnViewLbAfter.addEventListener("click", handleLbViewToggle);
if(el.btnViewLb) el.btnViewLb.addEventListener("click", openLbScreen);
if(el.lbBack) el.lbBack.addEventListener("click", ()=> showScreen(el.start));
if(el.lbName) el.lbName.addEventListener("keydown", (e)=>{
  if(e.key==="Enter"){ e.preventDefault(); handleLbSubmit(); }
});

refreshBestChip();
updateMuteIcon();
showScreen(el.start);
// init lb seed if empty
try{ getLeaderboard(); }catch(e){}
if(el.lbListStart) renderLbList(el.lbListStart, null);
