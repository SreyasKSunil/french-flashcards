// app.js
(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    csvFile: $("csvFile"),
    loadSample: $("loadSample"),
    toggleTheme: $("toggleTheme"),
    ttsVoice: $("ttsVoice"),
    shuffle: $("shuffle"),
    autoSpeak: $("autoSpeak"),
    preferExample: $("preferExample"),
    tagFilter: $("tagFilter"),
    stats: $("stats"),
    card: $("card"),
    frontText: $("frontText"),
    backText: $("backText"),
    flip: $("flip"),
    speak: $("speak"),
    prev: $("prev"),
    next: $("next"),
    again: $("again"),
    good: $("good"),
    easy: $("easy"),
    pill: $("pill"),
    indexPill: $("indexPill"),
    resetProgress: $("resetProgress"),
    exportProgress: $("exportProgress"),
    help: $("help"),
    openHelp: $("openHelp"),
    closeHelp: $("closeHelp"),
  };

  const STORAGE_KEY = "fr_flashcards_v1";
  const THEME_KEY = "fr_flashcards_theme_v1";

  let deckRaw = [];
  let deck = [];
  let order = [];
  let idx = 0;
  let showingBack = false;

  let voices = [];
  let selectedVoiceURI = "";

  const progress = loadProgress();

  initTheme();
  initEvents();
  initTTS();

  renderEmpty();

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const theme = saved === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  }

  function initEvents() {
    els.toggleTheme.addEventListener("click", toggleTheme);

    els.openHelp.addEventListener("click", () => els.help.showModal());
    els.closeHelp.addEventListener("click", () => els.help.close());

    els.csvFile.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const text = await file.text();
      loadFromCSV(text, file.name);
    });

    els.loadSample.addEventListener("click", async () => {
      const res = await fetch("sample.csv", { cache: "no-store" });
      const text = await res.text();
      loadFromCSV(text, "sample.csv");
    });

    els.flip.addEventListener("click", () => flipCard());
    els.card.addEventListener("click", () => flipCard());
    els.card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        flipCard();
      }
    });

    els.speak.addEventListener("click", () => speakCurrent());

    els.prev.addEventListener("click", () => move(-1));
    els.next.addEventListener("click", () => move(1));

    els.again.addEventListener("click", () => rate("again"));
    els.good.addEventListener("click", () => rate("good"));
    els.easy.addEventListener("click", () => rate("easy"));

    els.shuffle.addEventListener("change", () => rebuildView());
    els.preferExample.addEventListener("change", () => rebuildView());
    els.tagFilter.addEventListener("input", debounce(() => rebuildView(), 220));

    els.resetProgress.addEventListener("click", () => {
      if (!confirm("Reset progress for all cards?")) return;
      for (const k of Object.keys(progress.ratings)) delete progress.ratings[k];
      saveProgress();
      updateStats();
    });

    els.exportProgress.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "flashcards-progress.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    document.addEventListener("keydown", (e) => {
      if (els.help.open) return;

      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
      if (e.key === " ") {
        e.preventDefault();
        flipCard();
      }
      if (e.key === "1") rate("again");
      if (e.key === "2") rate("good");
      if (e.key === "3") rate("easy");
      if (e.key.toLowerCase() === "s") speakCurrent();
    });

    els.ttsVoice.addEventListener("change", () => {
      selectedVoiceURI = els.ttsVoice.value;
      progress.voiceURI = selectedVoiceURI;
      saveProgress();
    });
  }

  function initTTS() {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      els.ttsVoice.innerHTML = `<option value="">Speech not supported on this device</option>`;
      els.ttsVoice.disabled = true;
      return;
    }

    const loadVoices = () => {
      voices = window.speechSynthesis.getVoices() || [];
      const frVoices = voices.filter(v => (v.lang || "").toLowerCase().startsWith("fr"));

      const list = frVoices.length ? frVoices : voices;
      els.ttsVoice.innerHTML = list.map(v => {
        const label = `${v.name} (${v.lang})`;
        const safe = escapeHtml(label);
        return `<option value="${escapeHtml(v.voiceURI)}">${safe}</option>`;
      }).join("");

      selectedVoiceURI = progress.voiceURI || (frVoices[0]?.voiceURI || list[0]?.voiceURI || "");
      els.ttsVoice.value = selectedVoiceURI || "";
    };

    loadVoices();
    if (typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  function speak(text) {
    if (!text) return;
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    const v = voices.find(v => v.voiceURI === selectedVoiceURI);
    if (v) u.voice = v;

    u.lang = (v && v.lang) ? v.lang : "fr-FR";
    u.rate = 0.95;
    u.pitch = 1.0;

    window.speechSynthesis.speak(u);
  }

  function speakCurrent() {
    const c = deck[idx];
    if (!c) return;
    const front = getFrontText(c);
    const fr = c.fr || front;
    speak(fr);
  }

  function loadFromCSV(text, name) {
    const rows = parseCSV(text);
    if (!rows.length) {
      renderEmpty("No rows found in CSV.");
      return;
    }

    const header = rows[0].map(h => (h || "").trim().toLowerCase());
    const dataRows = rows.slice(1).filter(r => r.some(x => String(x || "").trim().length));

    const col = (key) => header.indexOf(key);

    const iFR = col("fr");
    const iEN = col("en");
    const iEX = col("example");
    const iTAGS = col("tags");

    if (iFR < 0 || iEN < 0) {
      renderEmpty("CSV needs headers: fr,en (example,tags optional).");
      return;
    }

    deckRaw = dataRows.map((r, n) => {
      const fr = (r[iFR] || "").trim();
      const en = (r[iEN] || "").trim();
      const example = iEX >= 0 ? (r[iEX] || "").trim() : "";
      const tags = iTAGS >= 0 ? (r[iTAGS] || "").trim() : "";

      const id = stableId(fr, en, example, tags, n);
      return { id, fr, en, example, tags };
    }).filter(x => x.fr && x.en);

    els.pill.textContent = name;

    idx = 0;
    showingBack = false;

    rebuildView();
  }

  function rebuildView() {
    const tagNeedle = (els.tagFilter.value || "").trim().toLowerCase();
    const preferExample = !!els.preferExample.checked;

    deck = deckRaw.filter(c => {
      if (!tagNeedle) return true;
      const tags = (c.tags || "").toLowerCase();
      return tags.includes(tagNeedle);
    }).map(c => ({ ...c, _preferExample: preferExample }));

    order = deck.map((_, i) => i);

    if (els.shuffle.checked) shuffleInPlace(order);

    if (!deck.length) {
      renderEmpty("No cards match the current filter.");
      return;
    }

    idx = 0;
    showingBack = false;
    renderCard();

    if (els.autoSpeak.checked) speakCurrent();

    updateStats();
  }

  function renderEmpty(msg) {
    els.frontText.textContent = msg || "Import a CSV to start.";
    els.backText.textContent = "";
    els.backText.classList.add("hidden");
    els.indexPill.textContent = "0 / 0";
    updateStats();
  }

  function renderCard() {
    const i = order[idx];
    const c = deck[i];
    if (!c) return renderEmpty("No cards available.");

    const front = getFrontText(c);
    const back = getBackText(c);

    els.frontText.textContent = front;
    els.backText.textContent = back;

    if (showingBack) {
      els.backText.classList.remove("hidden");
    } else {
      els.backText.classList.add("hidden");
    }

    els.indexPill.textContent = `${idx + 1} / ${order.length}`;
    updateStats();
  }

  function getFrontText(c) {
    if (c._preferExample && c.example) return c.example;
    return c.fr;
  }

  function getBackText(c) {
    const lines = [];
    lines.push(c.en);
    if (c._preferExample && c.example) lines.push("");
    if (c.example && !(c._preferExample)) lines.push(c.example);
    if (c.tags) lines.push(`Tags: ${c.tags}`);
    return lines.join("\n");
  }

  function flipCard() {
    if (!deck.length) return;
    showingBack = !showingBack;
    renderCard();
    if (!showingBack && els.autoSpeak.checked) speakCurrent();
  }

  function move(dir) {
    if (!deck.length) return;
    idx = (idx + dir + order.length) % order.length;
    showingBack = false;
    renderCard();
    if (els.autoSpeak.checked) speakCurrent();
  }

  function rate(level) {
    if (!deck.length) return;
    const i = order[idx];
    const c = deck[i];
    if (!c) return;

    progress.ratings[c.id] = {
      level,
      at: new Date().toISOString()
    };
    saveProgress();

    const step = level === "again" ? 1 : (level === "good" ? 1 : 1);
    idx = (idx + step) % order.length;
    showingBack = false;
    renderCard();

    if (els.autoSpeak.checked) speakCurrent();
  }

  function updateStats() {
    const total = deckRaw.length || 0;

    const rated = Object.keys(progress.ratings).length;
    const again = countRatings("again");
    const good = countRatings("good");
    const easy = countRatings("easy");

    if (!total) {
      els.stats.textContent = "No deck loaded.";
      return;
    }

    const filtered = deck.length || 0;
    els.stats.textContent =
      `Cards: ${filtered}/${total}. Rated: ${rated}. Again: ${again}. Good: ${good}. Easy: ${easy}.`;
  }

  function countRatings(level) {
    let n = 0;
    for (const k of Object.keys(progress.ratings)) {
      if (progress.ratings[k]?.level === level) n += 1;
    }
    return n;
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ratings: {}, voiceURI: "" };
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return { ratings: {}, voiceURI: "" };
      if (!obj.ratings) obj.ratings = {};
      if (!obj.voiceURI) obj.voiceURI = "";
      return obj;
    } catch {
      return { ratings: {}, voiceURI: "" };
    }
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (ch === "," && !inQuotes) {
        row.push(cur);
        cur = "";
        continue;
      }

      if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cur);
        cur = "";
        if (row.some(v => String(v).length)) rows.push(row);
        row = [];
        continue;
      }

      cur += ch;
    }

    row.push(cur);
    if (row.some(v => String(v).length)) rows.push(row);

    return rows;
  }

  function shuffleInPlace(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  function stableId(fr, en, example, tags, n) {
    const s = `${fr}||${en}||${example}||${tags}||${n}`.toLowerCase();
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `c_${(h >>> 0).toString(16)}`;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function debounce(fn, ms) {
    let t = 0;
    return (...args) => {
      window.clearTimeout(t);
      t = window.setTimeout(() => fn(...args), ms);
    };
  }
})();
