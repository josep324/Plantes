/* ============================================================
   Flora Autòctona — joc d'aprenentatge de plantes
   Dades: SPECIES_DATA (species_data.js), generades del "Visum de
   flora - Espècies autòctones" (Generalitat de Catalunya).
   ============================================================ */

const STORAGE_KEY = "flora-quiz-progress-v1";
const QUESTIONS_PER_ROUND = 10;

const state = {
  view: "home",
  mode: null,          // 'reto' | 'repas'
  pool: [],            // species used in the current round
  order: [],           // shuffled indices into pool
  current: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  missed: [],
  answered: false,
};

/* ---------- persistence ---------- */
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { seen: {}, wrong: {}, correct: {}, rounds: 0, bestStreak: 0, totalAnswered: 0, totalCorrect: 0 };
}
function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
let progress = loadProgress();

/* ---------- helpers ---------- */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sample(arr, n) {
  return shuffle(arr).slice(0, n);
}
function keyFor(sp) { return sp.sci; }
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ---------- weighted pool for "Repàs intel·ligent" ---------- */
function buildWeightedPool() {
  // species with more wrong answers (relative to correct) get higher weight
  const weighted = [];
  SPECIES_DATA.forEach((sp) => {
    const k = keyFor(sp);
    const wrong = progress.wrong[k] || 0;
    const correct = progress.correct[k] || 0;
    let weight = 1 + wrong * 3 - Math.min(correct, 3) * 0.5;
    if (!progress.seen[k]) weight += 1.5; // give unseen species a boost
    weighted.push({ sp, weight: Math.max(weight, 0.2) });
  });
  return weighted;
}
function pickWeighted(weighted, n) {
  const pool = weighted.slice();
  const chosen = [];
  n = Math.min(n, pool.length);
  for (let i = 0; i < n; i++) {
    const total = pool.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= pool[idx].weight;
      if (r <= 0) break;
    }
    idx = Math.min(idx, pool.length - 1);
    chosen.push(pool[idx].sp);
    pool.splice(idx, 1);
  }
  return chosen;
}

/* ---------- quiz question generation ---------- */
function makeQuestion(correctSp) {
  const distractorsPool = SPECIES_DATA.filter((s) => s.sci !== correctSp.sci);
  const distractors = sample(distractorsPool, 3);
  const options = shuffle([correctSp, ...distractors]);
  return { correctSp, options };
}

/* ---------- rendering ---------- */
const main = document.getElementById("main");

function setActiveTab(view) {
  document.querySelectorAll(".tab-btn").forEach((b) => {
    const active = b.dataset.view === view;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", active ? "true" : "false");
  });
}

function render() {
  setActiveTab(state.view === "home" ? "home" : state.view === "study" ? "study" : state.view === "stats" ? "stats" : state.view);
  if (state.view === "home") renderHome();
  else if (state.view === "quiz") renderQuiz();
  else if (state.view === "result") renderResult();
  else if (state.view === "study") renderStudy();
  else if (state.view === "stats") renderStats();
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

function renderHome() {
  const totalSeen = Object.keys(progress.seen).length;
  main.innerHTML = `
    <section class="hero">
      <h1 class="font-display">Coneixes la flora autòctona? 🌱</h1>
      <p>Practica amb fotos reals i endevina quina planta és. Quatre opcions, feedback immediat i repàs de les que et costen més.</p>
    </section>

    <div class="mode-grid">
      <button class="mode-card reto" data-start="reto">
        <div class="mode-icon">🎯</div>
        <div class="mode-body">
          <h3>Repte ràpid</h3>
          <p>${QUESTIONS_PER_ROUND} preguntes a l'atzar de tot el catàleg.</p>
          <span class="badge-count">${SPECIES_DATA.length} espècies disponibles</span>
        </div>
      </button>
      <button class="mode-card est" data-start="repas">
        <div class="mode-icon">🔁</div>
        <div class="mode-body">
          <h3>Repàs intel·ligent</h3>
          <p>Prioritza les plantes que encara no domines o que has fallat.</p>
          <span class="badge-count">${totalSeen}/${SPECIES_DATA.length} explorades</span>
        </div>
      </button>
    </div>

    <div class="filters-panel">
      <h4>Consell</h4>
      <p style="margin:0;color:var(--ink-soft);font-size:.88rem;line-height:1.5;">
        Fes un cop d'ull a la pestanya <strong>Fitxes</strong> per repassar totes les espècies amb foto i descripció abans de jugar,
        i mira el teu <strong>Progrés</strong> per veure quines et costen més.
      </p>
    </div>
  `;
  main.querySelectorAll("[data-start]").forEach((btn) => {
    btn.addEventListener("click", () => startRound(btn.dataset.start));
  });
}

function startRound(mode) {
  state.mode = mode;
  state.score = 0;
  state.streak = 0;
  state.missed = [];
  state.current = 0;
  state.answered = false;

  if (mode === "reto") {
    state.pool = sample(SPECIES_DATA, Math.min(QUESTIONS_PER_ROUND, SPECIES_DATA.length));
  } else {
    const weighted = buildWeightedPool();
    state.pool = pickWeighted(weighted, Math.min(QUESTIONS_PER_ROUND, SPECIES_DATA.length));
  }
  state.questions = state.pool.map(makeQuestion);
  state.view = "quiz";
  render();
}

function renderQuiz() {
  const q = state.questions[state.current];
  const total = state.questions.length;
  const pct = Math.round((state.current / total) * 100);

  main.innerHTML = `
    <div class="quiz-header">
      <button class="back" aria-label="Tornar a l'inici" id="backBtn">←</button>
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-meta">
          <span>Pregunta ${state.current + 1} / ${total}</span>
          <span>Encerts: ${state.score}</span>
        </div>
      </div>
      <div class="streak-pill">🔥 ${state.streak}</div>
    </div>

    <div class="photo-card">
      <img src="${q.correctSp.image}" alt="Fotografia de la planta a endevinar" loading="eager" />
      <span class="zoom-hint">Fixa't en fulles, flors i fruits</span>
    </div>

    <p class="question-title">Quina planta és aquesta?</p>

    <div class="options-grid" id="optionsGrid"></div>
    <div id="feedbackSlot"></div>
  `;

  document.getElementById("backBtn").addEventListener("click", () => {
    if (confirm("Vols sortir del repte? Es perdrà el progrés d'aquesta ronda.")) {
      state.view = "home";
      render();
    }
  });

  const letters = ["A", "B", "C", "D"];
  const grid = document.getElementById("optionsGrid");
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "opt-btn";
    btn.innerHTML = `<span class="letter">${letters[i]}</span><span>${opt.common}</span>`;
    btn.addEventListener("click", () => handleAnswer(opt, btn));
    grid.appendChild(btn);
  });
}

function handleAnswer(chosen, btnEl) {
  if (state.answered) return;
  state.answered = true;
  const q = state.questions[state.current];
  const isCorrect = chosen.sci === q.correctSp.sci;
  const k = keyFor(q.correctSp);

  progress.seen[k] = true;
  progress.totalAnswered = (progress.totalAnswered || 0) + 1;
  if (isCorrect) {
    progress.correct[k] = (progress.correct[k] || 0) + 1;
    progress.totalCorrect = (progress.totalCorrect || 0) + 1;
    state.score++;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    progress.bestStreak = Math.max(progress.bestStreak || 0, state.streak);
  } else {
    progress.wrong[k] = (progress.wrong[k] || 0) + 1;
    state.streak = 0;
    state.missed.push(q.correctSp);
  }
  saveProgress();

  document.querySelectorAll(".opt-btn").forEach((b) => {
    b.disabled = true;
    const label = b.querySelector("span:last-child").textContent;
    if (label === q.correctSp.common) b.classList.add("correct");
    else if (b === btnEl) b.classList.add("wrong");
    else b.classList.add("dim");
  });

  const panel = document.createElement("div");
  panel.className = `feedback-panel ${isCorrect ? "ok" : "bad"}`;
  panel.innerHTML = `
    <div class="fb-title">${isCorrect ? "✅ Correcte!" : "❌ No era aquesta"} — ${q.correctSp.common}</div>
    <div class="fb-sci">${q.correctSp.sci}</div>
    <p class="fb-desc">${q.correctSp.description || "Sense descripció disponible."}</p>
    <button class="next-btn" id="nextBtn">${state.current + 1 < state.questions.length ? "Següent →" : "Veure resultats"}</button>
  `;
  document.getElementById("feedbackSlot").appendChild(panel);
  document.getElementById("nextBtn").addEventListener("click", nextQuestion);
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function nextQuestion() {
  state.answered = false;
  state.current++;
  if (state.current >= state.questions.length) {
    progress.rounds = (progress.rounds || 0) + 1;
    saveProgress();
    state.view = "result";
  }
  render();
}

function renderResult() {
  const total = state.questions.length;
  const pct = Math.round((state.score / total) * 100);
  let emoji = "🌱", msg = "Continua practicant, cada intent compta!";
  if (pct === 100) { emoji = "🏆"; msg = "Perfecte! Ets tot un/a botànic/a."; }
  else if (pct >= 80) { emoji = "🌳"; msg = "Molt bé! Domines bona part de la flora."; }
  else if (pct >= 50) { emoji = "🌿"; msg = "Bon camí, repassa les que has fallat."; }

  main.innerHTML = `
    <div class="result-card">
      <div class="result-emoji">${emoji}</div>
      <div class="result-score">${state.score} / ${total}</div>
      <p class="result-sub">${msg} ${state.bestStreak > 1 ? `Ratxa màxima: ${state.bestStreak} 🔥` : ""}</p>
      <div class="result-actions">
        <button class="btn-primary" id="retryMissed" ${state.missed.length === 0 ? "disabled style='opacity:.5;cursor:not-allowed;'" : ""}>Repassar les fallades (${state.missed.length})</button>
        <button class="btn-secondary" id="newRound">Nova ronda</button>
        <button class="btn-secondary" id="goHome">Tornar a l'inici</button>
      </div>
      ${state.missed.length > 0 ? renderMissedList() : ""}
    </div>
  `;
  document.getElementById("newRound").addEventListener("click", () => startRound(state.mode));
  document.getElementById("goHome").addEventListener("click", () => { state.view = "home"; render(); });
  const retryBtn = document.getElementById("retryMissed");
  if (state.missed.length > 0) {
    retryBtn.addEventListener("click", () => {
      state.pool = shuffle(state.missed);
      state.questions = state.pool.map(makeQuestion);
      state.current = 0; state.score = 0; state.streak = 0; state.missed = []; state.answered = false;
      state.view = "quiz";
      render();
    });
  }
}

function renderMissedList() {
  const rows = state.missed.map((sp) => `
    <div class="missed-row">
      <img src="${sp.image}" alt="" />
      <div>
        <div class="name">${sp.common}</div>
        <div class="sci">${sp.sci}</div>
      </div>
    </div>
  `).join("");
  return `<div class="result-missed"><h4>Espècies a repassar</h4>${rows}</div>`;
}

/* ---------- study / flashcards ---------- */
let studyFilter = "";
function renderStudy() {
  main.innerHTML = `
    <h2 class="section-title">Fitxes de flora</h2>
    <div class="study-toolbar">
      <input type="search" class="search-box" id="searchBox" placeholder="Cerca per nom (català o científic)…" value="${studyFilter}" />
    </div>
    <div class="card-grid" id="cardGrid"></div>
  `;
  const box = document.getElementById("searchBox");
  box.addEventListener("input", () => { studyFilter = box.value; paintCards(); });
  paintCards();
}
function paintCards() {
  const grid = document.getElementById("cardGrid");
  const term = studyFilter.trim().toLowerCase();
  const list = SPECIES_DATA.filter((sp) =>
    !term || sp.common.toLowerCase().includes(term) || sp.sci.toLowerCase().includes(term)
  );
  grid.innerHTML = list.map((sp) => {
    const k = keyFor(sp);
    const wrong = progress.wrong[k] || 0;
    const correct = progress.correct[k] || 0;
    let dot = "";
    if (correct > 0 && wrong === 0) dot = `<span class="learned-dot" title="Ben apresa">✓</span>`;
    else if (wrong > correct) dot = `<span class="learned-dot struggle-dot" title="Et costa">!</span>`;
    return `
      <div class="flash" data-sci="${encodeURIComponent(sp.sci)}">
        ${dot}
        <img class="thumb" src="${sp.image}" alt="${sp.common}" loading="lazy" />
        <div class="meta">
          <div class="common">${sp.common}</div>
          <div class="sci">${sp.sci}</div>
        </div>
      </div>
    `;
  }).join("") || `<p class="empty-hint">Cap resultat per "${studyFilter}".</p>`;

  grid.querySelectorAll(".flash").forEach((el) => {
    el.addEventListener("click", () => openCardModal(decodeURIComponent(el.dataset.sci)));
  });
}
function openCardModal(sci) {
  const sp = SPECIES_DATA.find((s) => s.sci === sci);
  if (!sp) return;
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-card">
      <button class="modal-close" aria-label="Tancar">✕</button>
      <img src="${sp.image}" alt="${sp.common}" />
      <div class="modal-body">
        <h3>${sp.common}</h3>
        <span class="sci">${sp.sci}</span>
        <p>${sp.description || "Sense descripció disponible."}</p>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector(".modal-close").addEventListener("click", close);
}

/* ---------- stats ---------- */
function renderStats() {
  const total = SPECIES_DATA.length;
  const seen = Object.keys(progress.seen).length;
  const learned = SPECIES_DATA.filter((sp) => {
    const k = keyFor(sp);
    return (progress.correct[k] || 0) > 0 && (progress.correct[k] || 0) >= (progress.wrong[k] || 0);
  }).length;
  const acc = progress.totalAnswered ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100) : 0;

  const struggling = SPECIES_DATA
    .map((sp) => ({ sp, wrong: progress.wrong[keyFor(sp)] || 0, correct: progress.correct[keyFor(sp)] || 0 }))
    .filter((x) => x.wrong > 0 && x.wrong >= x.correct)
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, 8);

  main.innerHTML = `
    <h2 class="section-title">El teu progrés</h2>
    <div class="stat-grid">
      <div class="stat-box"><div class="num">${seen}/${total}</div><div class="lbl">Explorades</div></div>
      <div class="stat-box"><div class="num">${acc}%</div><div class="lbl">Encert global</div></div>
      <div class="stat-box"><div class="num">${progress.bestStreak || 0}</div><div class="lbl">Millor ratxa</div></div>
    </div>
    ${struggling.length > 0 ? `
      <h4 style="font-size:.85rem;text-transform:uppercase;color:var(--ink-soft);letter-spacing:.04em;">Et costen més</h4>
      <div class="card-grid">
        ${struggling.map(({ sp }) => `
          <div class="flash" data-sci="${encodeURIComponent(sp.sci)}">
            <span class="learned-dot struggle-dot">!</span>
            <img class="thumb" src="${sp.image}" alt="${sp.common}" loading="lazy" />
            <div class="meta"><div class="common">${sp.common}</div><div class="sci">${sp.sci}</div></div>
          </div>
        `).join("")}
      </div>
    ` : `<p class="empty-hint">Encara no tens dades suficients. Fes un repte per començar! 🌱</p>`}

    ${(progress.rounds || 0) > 0 ? `<div style="text-align:center;margin-top:24px;">
        <button class="btn-secondary" id="resetProgress">Reiniciar progrés</button>
      </div>` : ""}
  `;
  main.querySelectorAll(".flash").forEach((el) => {
    el.addEventListener("click", () => openCardModal(decodeURIComponent(el.dataset.sci)));
  });
  const resetBtn = document.getElementById("resetProgress");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Segur que vols esborrar tot el progrés desat en aquest navegador?")) {
        progress = { seen: {}, wrong: {}, correct: {}, rounds: 0, bestStreak: 0, totalAnswered: 0, totalCorrect: 0 };
        saveProgress();
        showToast("Progrés reiniciat");
        renderStats();
      }
    });
  }
}

/* ---------- nav wiring ---------- */
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.view = btn.dataset.view;
    render();
  });
});

render();
