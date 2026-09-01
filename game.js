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
  btnMicInline: $("btn-mic-inline"),
  btnHint: $("btn-hint"),
  btnSkip: $("btn-skip"),
  btnModeText: $("btn-mode-text"),
  btnModeMic: $("btn-mode-mic"),
  micPanel: $("mic-panel"),
  btnMic: $("btn-mic"),
  micStatus: $("mic-status"),
  micTranscript: $("mic-transcript"),
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
const LB_KEY = "namit-lb-v2"; // v2 = empty school-only (v1 had seeded fake students)
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
  return []; // school-only: start empty, no prefilled test students
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
    // migrate: if old v1 seeded data leaked into v2 (shouldn't), treat as empty
    return arr;
  }catch(e){
    const seed = lbSeed();
    try{ localStorage.setItem(LB_KEY, JSON.stringify(seed)); }catch(_){}
    return seed.slice();
  }
}
// one-time cleanup of old v1 seeded leaderboard (so school devices don't keep fake students)
try{
  const old = localStorage.getItem("namit-lb-v1");
  if(old){
    const a = JSON.parse(old);
    const fakeNames = ["Sakura","Kenji","Maya","Leo","Ava","Noah","Zara","Omar","Luna","Finn"];
    if(Array.isArray(a) && a.length && a.every(e=> fakeNames.includes(e.name))){
      localStorage.removeItem("namit-lb-v1");
    }
  }
}catch(e){}
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

// ── Mic mode (Web Speech API) ──
let inputMode = (function(){ try{ return localStorage.getItem("namit-input-mode") || "text"; }catch(e){ return "text"; }})();
let recognition = null;
let micListening = false;
let micSupported = false;

function setInputMode(mode){
  inputMode = mode;
  try{ localStorage.setItem("namit-input-mode", mode); }catch(e){}
  const isMic = mode === "mic";
  if(el.btnModeText){ el.btnModeText.classList.toggle("active", !isMic); el.btnModeText.setAttribute("aria-selected", String(!isMic)); }
  if(el.btnModeMic){ el.btnModeMic.classList.toggle("active", isMic); el.btnModeMic.setAttribute("aria-selected", String(isMic)); }
  if(el.form) el.form.classList.toggle("mic-hidden", isMic);
  if(el.micPanel) el.micPanel.classList.toggle("hidden", !isMic);
  if(isMic && !micSupported && el.micStatus){
    el.micStatus.textContent = "Voice not supported in this browser — try Chrome or Edge";
    el.micStatus.classList.remove("listening");
    if(el.btnMic) el.btnMic.disabled = true;
    if(el.btnMicInline) el.btnMicInline.disabled = true;
  } else {
    if(el.btnMic) el.btnMic.disabled = !!state.locked;
    if(el.btnMicInline) el.btnMicInline.disabled = !micSupported;
  }
  if(isMic) stopMic();
}
function ensureRecognition(){
  if(recognition) return recognition;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return null;
  const r = new SR();
  r.lang = "en-US";
  r.interimResults = true;
  r.maxAlternatives = 3;
  r.continuous = false;
  r.onstart = ()=>{
    micListening = true;
    if(el.btnMic) el.btnMic.classList.add("listening");
    if(el.btnMicInline) el.btnMicInline.classList.add("listening");
    if(el.micStatus){ el.micStatus.textContent = "Listening… say the answer"; el.micStatus.classList.add("listening"); }
    if(el.micTranscript){ el.micTranscript.textContent = ""; el.micTranscript.classList.add("interim"); }
  };
  r.onresult = (ev)=>{
    let interim = "";
    let finalText = "";
    for(let i=ev.resultIndex; i<ev.results.length; i++){
      const res = ev.results[i];
      const alt = res[0] && res[0].transcript ? res[0].transcript : "";
      if(res.isFinal) finalText += alt + " ";
      else interim += alt + " ";
    }
    const show = (finalText || interim).trim();
    if(el.micTranscript){
      el.micTranscript.textContent = show ? '“' + show + '”' : "";
      el.micTranscript.classList.toggle("interim", !finalText);
    }
    // live type into input for visibility
    if(show && el.input) el.input.value = show;
    if(finalText){
      const text = finalText.trim();
      // try all alternatives for best match (accent tolerance)
      let heard = text;
      try{
        for(let i=ev.resultIndex;i<ev.results.length;i++){
          if(ev.results[i].isFinal){
            for(let a=0;a<ev.results[i].length;a++){
              const t = ev.results[i][a].transcript || "";
              if(isMatch(t, state.item)){ heard = t; break; }
            }
          }
        }
      }catch(e){}
      handleMicFinal(heard);
    }
  };
  r.onerror = (ev)=>{
    micListening = false;
    if(el.btnMic) el.btnMic.classList.remove("listening");
    if(el.btnMicInline) el.btnMicInline.classList.remove("listening");
    if(el.micStatus){
      el.micStatus.classList.remove("listening");
      const err = ev.error || "error";
      if(err === "not-allowed" || err === "service-not-allowed") el.micStatus.textContent = "Mic blocked — allow microphone access and try again";
      else if(err === "no-speech") el.micStatus.textContent = "Didn't hear anything — tap mic to try again";
      else if(err === "audio-capture") el.micStatus.textContent = "No microphone found";
      else el.micStatus.textContent = "Mic error (" + err + ") — tap to retry";
    }
  };
  r.onend = ()=>{
    micListening = false;
    if(el.btnMic) el.btnMic.classList.remove("listening");
    if(el.btnMicInline) el.btnMicInline.classList.remove("listening");
    if(el.micStatus && !state.locked) {
      if(!el.micStatus.textContent || el.micStatus.textContent === "Listening… say the answer"){
        el.micStatus.textContent = "Tap the mic and say the answer";
        el.micStatus.classList.remove("listening");
      }
    }
  };
  recognition = r;
  return r;
}
function wordsToDigits(s){
  const map = {zero:"0",one:"1",two:"2",three:"3",four:"4",five:"5",six:"6",seven:"7",eight:"8",nine:"9",ten:"10",eleven:"11",twelve:"12",thirteen:"13",fourteen:"14",fifteen:"15",sixteen:"16",seventeen:"17",eighteen:"18",nineteen:"19",twenty:"20",thirty:"30",forty:"40",fifty:"50",sixty:"60",seventy:"70",eighty:"80",ninety:"90",hundred:"100",thousand:"1000"};
  const toks = normalize(s).split(/\s+/).filter(Boolean);
  if(!toks.length) return null;
  // if it's already digits like "56", keep
  if(toks.length===1 && /^\d+$/.test(toks[0])) return toks[0];
  // quick path: all tokens are number words -> try to parse
  const isNumWord = toks.every(t=> map[t]!==undefined || t==="and");
  if(!isNumWord) return null;
  let total = 0, cur = 0;
  for(const w of toks){
    if(w==="and") continue;
    const v = map[w];
    if(v==="100" || v==="1000"){
      const mul = parseInt(v,10);
      if(cur===0) cur=1;
      cur *= mul;
      if(mul===1000){ total+=cur; cur=0; }
    } else {
      cur += parseInt(v,10);
    }
  }
  total += cur;
  return String(total);
}
function handleMicFinal(text){
  if(state.locked || !state.item) return;
  const t = (text||"").trim();
  if(!normalize(t)) {
    if(el.micStatus) el.micStatus.textContent = "Didn't catch that — try again";
    return;
  }
  stopMic();
  // for math items, allow spoken number words e.g. "fifty six" -> "56"
  let extra = null;
  if(state.item && state.item.mode === "math"){
    extra = wordsToDigits(t);
    if(extra && normalize(extra) === normalize(state.item.answer)) {
      onCorrect(); return;
    }
    // also try extracting first number from transcript ("the answer is fifty six")
    if(!extra){
      const m = t.match(/\d+/);
      if(m && normalize(m[0]) === normalize(state.item.answer)){ onCorrect(); return; }
    }
  }
  if(isMatch(t, state.item) || (extra && isMatch(extra, state.item))) onCorrect();
  else onWrong();
}
function startMic(){
  if(state.locked || !state.item) return;
  const r = ensureRecognition();
  if(!r){
    if(el.micStatus) el.micStatus.textContent = "Voice not supported — use Chrome/Edge or switch to Text mode";
    return;
  }
  try{
    // if already listening, toggle off
    if(micListening){ try{ r.stop(); }catch(e){} return; }
    // clear previous transcript
    if(el.micTranscript) el.micTranscript.textContent = "";
    if(el.micStatus){ el.micStatus.textContent = "Listening… say the answer"; el.micStatus.classList.add("listening"); }
    r.start();
  }catch(e){
    // start can throw if already started
    try{ r.stop(); }catch(_){}
    setTimeout(()=>{ try{ r.start(); }catch(_){ }}, 180);
  }
}
function stopMic(){
  micListening = false;
  if(recognition){ try{ recognition.stop(); }catch(e){} }
  if(el.btnMic) el.btnMic.classList.remove("listening");
  if(el.btnMicInline) el.btnMicInline.classList.remove("listening");
  if(el.micStatus) el.micStatus.classList.remove("listening");
}

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
  stopMic();
  state.locked = true;
  el.input.disabled = true;
  el.btnGuess.disabled = true;
  if(el.btnMic) el.btnMic.disabled = true;
  if(el.btnMicInline) el.btnMicInline.disabled = true;
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
  // mic UI reset per round
  if(el.micTranscript) { el.micTranscript.textContent = ""; el.micTranscript.classList.remove("interim"); }
  if(el.micStatus){ el.micStatus.textContent = micSupported ? "Tap the mic and say the answer" : "Voice not supported — use Chrome/Edge"; el.micStatus.classList.remove("listening"); }
  if(el.btnMic) el.btnMic.disabled = !micSupported || false;
  if(el.btnMicInline) el.btnMicInline.disabled = !micSupported;
  stopMic();
  if(inputMode === "text") el.input.focus();
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
  stopMic();
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
  stopMic();
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
  stopMic();
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
  stopMic();
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
  stopMic();
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

// ── Mic mode wiring ──
(function initMic(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  micSupported = !!SR;
  if(!micSupported){
    if(el.btnModeMic) { el.btnModeMic.disabled = true; el.btnModeMic.title = "Voice not supported in this browser — use Chrome/Edge"; }
    if(el.btnMicInline) { el.btnMicInline.disabled = true; el.btnMicInline.title = "Voice not supported"; }
    if(el.btnMic) el.btnMic.disabled = true;
  }
  setInputMode(inputMode);
  if(el.btnModeText) el.btnModeText.addEventListener("click", ()=> setInputMode("text"));
  if(el.btnModeMic) el.btnModeMic.addEventListener("click", ()=>{
    if(!micSupported){
      if(el.micStatus) el.micStatus.textContent = "Voice not supported — use Chrome/Edge or switch to Text";
      return;
    }
    setInputMode("mic");
  });
  if(el.btnMic) el.btnMic.addEventListener("click", startMic);
  if(el.btnMicInline) el.btnMicInline.addEventListener("click", ()=>{
    // inline mic: quick voice guess without switching mode
    if(!micSupported){
      if(el.micStatus) el.micStatus.textContent = "Voice not supported — use Chrome/Edge";
      return;
    }
    // if in text mode, show temporary status in mic panel or inline
    if(inputMode !== "mic"){
      // use inline listening then evaluate: show transcript in input
      startMicInline();
    } else {
      startMic();
    }
  });
})();

function startMicInline(){
  // reuse same recognition but show feedback in input placeholder
  const r = ensureRecognition();
  if(!r) return;
  if(el.input) el.input.placeholder = "Listening… say the answer";
  // temporarily route status to input area via micStatus if hidden
  if(el.micPanel && el.micPanel.classList.contains("hidden")){
    el.micPanel.classList.remove("hidden");
    el.micPanel.style.opacity = "0.95";
    setTimeout(()=>{ if(inputMode==="text" && !micListening) { el.micPanel.classList.add("hidden"); el.micPanel.style.opacity=""; if(el.input) el.input.placeholder="Type your guess…"; } }, 6000);
  }
  startMic();
}

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
