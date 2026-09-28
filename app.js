/* ============================================================
   Flora Autòctona — joc d'aprenentatge de plantes
   Dades: SPECIES_DATA (species_data.js), generades del "Visum de
   flora - Espècies autòctones" (Generalitat de Catalunya).
   ============================================================ */

const STORAGE_KEY = "flora-quiz-progress-v1";
const MODE_KEY = "flora-quiz-answermode-v1";
const SIZE_KEY = "flora-quiz-roundsize-v1";
const ORIGIN_KEY = "flora-quiz-origin-v1";
const ROUND_SIZE_OPTIONS = [10, 20, 40, "all"];
const DEFAULT_ROUND_SIZE = 10;

const state = {
  view: "home",
  mode: null,          // 'reto' | 'repas'
  pool: [],            // species used in the current round
  current: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  missed: [],
  answered: false,
};

/* ---------- installable app (PWA) ---------- */
let deferredInstallPrompt = null;
const isStandaloneApp = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOSDevice = /iphone|ipad|ipod/i.test(navigator.userAgent);
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (state.view === "home") render();
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  showToast("Instal·lada! Ja la tens a la pantalla d'inici 🌿");
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* offline support just won't be available */ });
  });
}

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

// answerMode: 'common' (nom en català) | 'sci' (nom científic) | 'combined' (tots dos)
let answerMode = localStorage.getItem(MODE_KEY) || "common";
function setAnswerMode(mode) {
  answerMode = mode;
  localStorage.setItem(MODE_KEY, mode);
}
function labelFor(sp) {
  if (answerMode === "sci") return sp.sci;
  if (answerMode === "combined") return `${sp.common}<i>${sp.sci}</i>`;
  return sp.common;
}

// roundSize: number of questions per round, or "all" for every species
let roundSize = localStorage.getItem(SIZE_KEY) || DEFAULT_ROUND_SIZE;
if (roundSize !== "all") roundSize = Number(roundSize) || DEFAULT_ROUND_SIZE;
function setRoundSize(val) {
  roundSize = val === "all" ? "all" : Number(val);
  localStorage.setItem(SIZE_KEY, roundSize);
}
function resolvedRoundSize() {
  const pool = activeSpecies();
  return roundSize === "all" ? pool.length : Math.min(roundSize, pool.length);
}

// origin: 'autoctona' | 'exotica' | 'all' — quin subconjunt del catàleg s'usa
let origin = localStorage.getItem(ORIGIN_KEY) || "autoctona";
function setOrigin(val) {
  origin = val;
  localStorage.setItem(ORIGIN_KEY, val);
}
function activeSpecies() {
  if (origin === "exotica") return SPECIES_DATA.filter((s) => s.category !== "autoctona");
  if (origin === "all") return SPECIES_DATA;
  return SPECIES_DATA.filter((s) => s.category === "autoctona");
}
function statusTag(sp) {
  if (sp.category === "invasora") return `<span class="status-tag tag-invasora">🚨 Invasora</span>`;
  if (sp.category === "no_invasora") return `<span class="status-tag tag-exotica">🌍 Exòtica</span>`;
  return "";
}

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
function firstImage(sp) { return sp.images[0]; }
function randomImage(sp) { return sp.images[Math.floor(Math.random() * sp.images.length)]; }
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ---------- weighted pool for "Repàs intel·ligent" ---------- */
function buildWeightedPool(pool) {
  // species with more wrong answers (relative to correct) get higher weight
  const weighted = [];
  pool.forEach((sp) => {
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
function makeQuestion(correctSp, pool) {
  const distractorsPool = (pool || SPECIES_DATA).filter((s) => s.sci !== correctSp.sci);
  const distractors = sample(distractorsPool, 3);
  const options = shuffle([correctSp, ...distractors]);
  return { correctSp, options, image: randomImage(correctSp) };
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

function renderInstallPanel() {
  if (isStandaloneApp) return "";
  if (deferredInstallPrompt) {
    return `
      <div class="filters-panel install-panel">
        <h4>📲 Instal·la l'app</h4>
        <p>Afegeix-la a la pantalla d'inici per obrir-la com una app, més ràpida i amb accés sense connexió.</p>
        <button class="btn-primary" id="installBtn">Instal·la al mòbil</button>
      </div>
    `;
  }
  if (isIOSDevice) {
    return `
      <div class="filters-panel install-panel">
        <h4>📲 Instal·la l'app a l'iPhone/iPad</h4>
        <p>Prem <strong>Compartir</strong> ⬆️ a la barra de Safari i tria <strong>"Afegeix a la pantalla d'inici"</strong>.</p>
      </div>
    `;
  }
  return "";
}

function renderHome() {
  const active = activeSpecies();
  const totalSeen = active.filter((sp) => progress.seen[keyFor(sp)]).length;
  const nAutoctona = SPECIES_DATA.filter((s) => s.category === "autoctona").length;
  const nExotica = SPECIES_DATA.filter((s) => s.category !== "autoctona").length;

  main.innerHTML = `
    <section class="hero">
      <h1 class="font-display">Coneixes la flora catalana? 🌱</h1>
      <p>Practica amb fotos reals i endevina quina planta és. Quatre opcions, feedback immediat i repàs de les que et costen més.</p>
    </section>

    ${renderInstallPanel()}

    <div class="filters-panel">
      <h4>Origen de les espècies</h4>
      <div class="chip-row" id="originChips">
        <button class="chip ${origin === "autoctona" ? "active" : ""}" data-origin="autoctona">🌱 Autòctones (${nAutoctona})</button>
        <button class="chip ${origin === "exotica" ? "active" : ""}" data-origin="exotica">🌍 Exòtiques (${nExotica})</button>
        <button class="chip ${origin === "all" ? "active" : ""}" data-origin="all">🔀 Totes (${SPECIES_DATA.length})</button>
      </div>
    </div>

    <div class="filters-panel">
      <h4>Tipus de test</h4>
      <div class="chip-row" id="answerModeChips">
        <button class="chip ${answerMode === "common" ? "active" : ""}" data-answer-mode="common">🇨🇦 Nom en català</button>
        <button class="chip ${answerMode === "sci" ? "active" : ""}" data-answer-mode="sci">🔬 Nom científic</button>
        <button class="chip ${answerMode === "combined" ? "active" : ""}" data-answer-mode="combined">🇨🇦+🔬 Tots dos</button>
      </div>
    </div>

    <div class="filters-panel">
      <h4>Nombre de preguntes</h4>
      <div class="chip-row" id="roundSizeChips">
        ${ROUND_SIZE_OPTIONS.map((n) => `
          <button class="chip ${roundSize === n ? "active" : ""}" data-round-size="${n}">${n === "all" ? `Totes (${active.length})` : n}</button>
        `).join("")}
      </div>
    </div>

    <div class="mode-grid">
      <button class="mode-card reto" data-start="reto">
        <div class="mode-icon">🎯</div>
        <div class="mode-body">
          <h3>Repte ràpid</h3>
          <p>${resolvedRoundSize()} preguntes a l'atzar del catàleg triat, sense repetir.</p>
          <span class="badge-count">${active.length} espècies disponibles</span>
        </div>
      </button>
      <button class="mode-card est" data-start="repas">
        <div class="mode-icon">🔁</div>
        <div class="mode-body">
          <h3>Repàs intel·ligent</h3>
          <p>Prioritza les plantes que encara no domines o que has fallat.</p>
          <span class="badge-count">${totalSeen}/${active.length} explorades</span>
        </div>
      </button>
    </div>

    <div class="filters-panel">
      <h4>Consell</h4>
      <p style="margin:0;color:var(--ink-soft);font-size:.88rem;line-height:1.5;">
        Fes un cop d'ull a la pestanya <strong>Fitxes</strong> per repassar totes les espècies amb foto i descripció abans de jugar,
        i mira el teu <strong>Progrés</strong> per veure quines et costen més. Durant el joc pots prémer
        <strong>"Veure totes les fotos"</strong> per comparar diferents exemplars de la mateixa espècie.
      </p>
    </div>
  `;
  const installBtn = document.getElementById("installBtn");
  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      renderHome();
    });
  }
  main.querySelectorAll("[data-start]").forEach((btn) => {
    btn.addEventListener("click", () => startRound(btn.dataset.start));
  });
  main.querySelectorAll("[data-answer-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setAnswerMode(btn.dataset.answerMode);
      renderHome();
    });
  });
  main.querySelectorAll("[data-round-size]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setRoundSize(btn.dataset.roundSize);
      renderHome();
    });
  });
  main.querySelectorAll("[data-origin]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setOrigin(btn.dataset.origin);
      renderHome();
    });
  });
}

function startRound(mode) {
  state.mode = mode;
  state.score = 0;
  state.streak = 0;
  state.missed = [];
  state.current = 0;
  state.answered = false;

  const active = activeSpecies();
  const size = resolvedRoundSize();
  if (mode === "reto") {
    state.pool = sample(active, size);
  } else {
    const weighted = buildWeightedPool(active);
    state.pool = pickWeighted(weighted, size);
  }
  state.questions = state.pool.map((sp) => makeQuestion(sp, active));
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
      <img src="${q.image}" alt="Fotografia de la planta a endevinar" loading="eager" id="quizPhoto" />
      ${q.correctSp.images.length > 1 ? `<button class="gallery-btn" id="galleryBtn">📷 Veure totes les fotos (${q.correctSp.images.length})</button>` : ""}
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

  const galleryBtn = document.getElementById("galleryBtn");
  if (galleryBtn) {
    galleryBtn.addEventListener("click", () => openGallery(q.correctSp, { hideNames: true }));
  }

  const letters = ["A", "B", "C", "D"];
  const grid = document.getElementById("optionsGrid");
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "opt-btn";
    btn.dataset.sci = opt.sci;
    btn.innerHTML = `<span class="letter">${letters[i]}</span><span>${labelFor(opt)}</span>`;
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
    if (b.dataset.sci === q.correctSp.sci) b.classList.add("correct");
    else if (b === btnEl) b.classList.add("wrong");
    else b.classList.add("dim");
  });

  const panel = document.createElement("div");
  panel.className = `feedback-panel ${isCorrect ? "ok" : "bad"}`;
  panel.innerHTML = `
    <div class="fb-title">${isCorrect ? "✅ Correcte!" : "❌ No era aquesta"} — ${q.correctSp.common}</div>
    <div class="fb-sci">${q.correctSp.sci} ${statusTag(q.correctSp)}</div>
    <p class="fb-desc">${q.correctSp.description || "Sense descripció disponible."}</p>
    ${q.correctSp.images.length > 1 ? `<button class="gallery-btn wide" id="fbGalleryBtn">📷 Veure totes les fotos (${q.correctSp.images.length})</button>` : ""}
    <button class="next-btn" id="nextBtn">${state.current + 1 < state.questions.length ? "Següent →" : "Veure resultats"}</button>
  `;
  document.getElementById("feedbackSlot").appendChild(panel);
  document.getElementById("nextBtn").addEventListener("click", nextQuestion);
  const fbGalleryBtn = document.getElementById("fbGalleryBtn");
  if (fbGalleryBtn) fbGalleryBtn.addEventListener("click", () => openGallery(q.correctSp));
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
      state.questions = state.pool.map((sp) => makeQuestion(sp, activeSpecies()));
      state.current = 0; state.score = 0; state.streak = 0; state.missed = []; state.answered = false;
      state.view = "quiz";
      render();
    });
    main.querySelectorAll(".missed-row").forEach((el) => {
      el.addEventListener("click", () => openGallery(SPECIES_DATA.find((s) => s.sci === decodeURIComponent(el.dataset.sci))));
    });
  }
}

function renderMissedList() {
  const rows = state.missed.map((sp) => `
    <div class="missed-row" data-sci="${encodeURIComponent(sp.sci)}">
      <img src="${firstImage(sp)}" alt="" />
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
  const list = activeSpecies().filter((sp) =>
    !term || sp.common.toLowerCase().includes(term) || sp.sci.toLowerCase().includes(term)
  );
  grid.innerHTML = list.map((sp) => {
    const k = keyFor(sp);
    const wrong = progress.wrong[k] || 0;
    const correct = progress.correct[k] || 0;
    let dot = "";
    if (correct > 0 && wrong === 0) dot = `<span class="learned-dot" title="Ben apresa">✓</span>`;
    else if (wrong > correct) dot = `<span class="learned-dot struggle-dot" title="Et costa">!</span>`;
    const countBadge = sp.images.length > 1 ? `<span class="img-count">📷 ${sp.images.length}</span>` : "";
    return `
      <div class="flash" data-sci="${encodeURIComponent(sp.sci)}">
        ${dot}
        <img class="thumb" src="${firstImage(sp)}" alt="${sp.common}" loading="lazy" />
        ${countBadge}
        <div class="meta">
          <div class="common">${sp.common}</div>
          <div class="sci">${sp.sci}</div>
          ${statusTag(sp)}
        </div>
      </div>
    `;
  }).join("") || `<p class="empty-hint">Cap resultat per "${studyFilter}".</p>`;

  grid.querySelectorAll(".flash").forEach((el) => {
    el.addEventListener("click", () => openGallery(SPECIES_DATA.find((s) => s.sci === decodeURIComponent(el.dataset.sci))));
  });
}

/* ---------- photo gallery / card modal ---------- */
function openGallery(sp, opts) {
  if (!sp) return;
  const hideNames = !!(opts && opts.hideNames);
  let idx = 0;
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";

  // pre-warm the browser cache for every photo of this species so switching is instant
  sp.images.forEach((src) => { const pre = new Image(); pre.src = src; });

  function paint() {
    const dots = sp.images.map((_, i) => `<span class="dot ${i === idx ? "active" : ""}" data-dot="${i}"></span>`).join("");
    backdrop.innerHTML = `
      <div class="modal-card">
        <button class="modal-close" aria-label="Tancar">✕</button>
        <div class="carousel">
          ${sp.images.length > 1 ? `<button class="car-nav prev" aria-label="Foto anterior">‹</button>` : ""}
          <div class="img-wrap">
            <div class="img-spinner"></div>
            <img class="gal-img" src="${sp.images[idx]}" alt="${hideNames ? "Fotografia de la planta" : sp.common}" loading="eager" decoding="async" />
          </div>
          ${sp.images.length > 1 ? `<button class="car-nav next" aria-label="Foto següent">›</button>` : ""}
        </div>
        ${sp.images.length > 1 ? `<div class="dots">${dots}</div>` : ""}
        <div class="modal-body">
          ${hideNames
            ? `<p class="hint-text">Compara els diferents exemplars per fixar-te en els detalls que no canvien: forma de la fulla, flor, fruit o escorça.</p>`
            : `<h3>${sp.common}</h3><span class="sci">${sp.sci}</span> ${statusTag(sp)}<p>${sp.description || "Sense descripció disponible."}</p>`}
        </div>
      </div>
    `;
    const imgEl = backdrop.querySelector(".gal-img");
    const wrapEl = backdrop.querySelector(".img-wrap");
    const markLoaded = () => wrapEl.classList.add("loaded");
    if (imgEl.complete && imgEl.naturalWidth > 0) markLoaded();
    else {
      imgEl.addEventListener("load", markLoaded);
      imgEl.addEventListener("error", () => wrapEl.classList.add("error"));
    }
    backdrop.querySelector(".modal-close").addEventListener("click", close);
    if (sp.images.length > 1) {
      backdrop.querySelector(".prev").addEventListener("click", () => { idx = (idx - 1 + sp.images.length) % sp.images.length; paint(); });
      backdrop.querySelector(".next").addEventListener("click", () => { idx = (idx + 1) % sp.images.length; paint(); });
      backdrop.querySelectorAll(".dot").forEach((d) => {
        d.addEventListener("click", () => { idx = Number(d.dataset.dot); paint(); });
      });
    }
  }
  function close() { backdrop.remove(); document.removeEventListener("keydown", onKey); }
  function onKey(e) {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight" && sp.images.length > 1) { idx = (idx + 1) % sp.images.length; paint(); }
    else if (e.key === "ArrowLeft" && sp.images.length > 1) { idx = (idx - 1 + sp.images.length) % sp.images.length; paint(); }
  }
  document.addEventListener("keydown", onKey);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  paint();
  document.body.appendChild(backdrop);
}

/* ---------- stats ---------- */
function renderStats() {
  const active = activeSpecies();
  const total = active.length;
  const seen = active.filter((sp) => progress.seen[keyFor(sp)]).length;
  const acc = progress.totalAnswered ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100) : 0;

  const struggling = active
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
            <img class="thumb" src="${firstImage(sp)}" alt="${sp.common}" loading="lazy" />
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
    el.addEventListener("click", () => openGallery(SPECIES_DATA.find((s) => s.sci === decodeURIComponent(el.dataset.sci))));
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
