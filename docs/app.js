(() => {
  "use strict";

  const books = Array.isArray(window.WORDQUEST_BOOKS) ? window.WORDQUEST_BOOKS : [];
  const allWords = books.flatMap((book) => book.words);
  const wordsById = new Map(allWords.map((word) => [word.id, word]));
  const conceptCounts = allWords.reduce((counts, word) => {
    if (word.conceptId) counts.set(word.conceptId, (counts.get(word.conceptId) || 0) + 1);
    return counts;
  }, new Map());
  const STORAGE_KEY = "wordquest-progress-v1";
  const speechSupported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const naturalSort = (a, b) => String(a).localeCompare(String(b), "zh-Hant", { numeric: true });
  const semesterLabel = (value) => value === "First Semester" ? "第一學期" : value === "Second Semester" ? "第二學期" : value;
  const contentKindLabels = {
    word: "單字", phrase: "片語", contraction: "縮寫", verb_forms: "動詞三態",
    grammar_pattern: "文法句型", word_relation: "詞語關係", spelling_change: "拼字變化",
  };
  const shuffle = (items) => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  };

  const state = {
    screen: "library",
    mode: "review",
    selectedBooks: new Set(),
    scopes: {},
    search: "",
    masteryFilter: "all",
    visibleWords: 60,
    flashDeck: [],
    flashIndex: 0,
    flashFlipped: false,
    flashFront: "english",
    flashOrder: "ordered",
    flashcardRestored: false,
    lastFlashSpeechKey: null,
    quizSize: "10",
    quizSpeechEnabled: speechSupported,
    quiz: null,
    focusSession: "inactive",
    focusReturnElement: null,
    progress: loadProgress(),
  };

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.version === 1 && saved.words) return {
        ...saved,
        flashcardSessions: saved.flashcardSessions || {},
        flashcardLastContext: saved.flashcardLastContext || null,
      };
    } catch (_) { /* A damaged local record should never block studying. */ }
    return { version: 1, words: {}, lastQuiz: null, flashcardSessions: {}, flashcardLastContext: null };
  }

  function saveProgress() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); }
    catch (_) { showToast("瀏覽器無法儲存紀錄，但仍可繼續使用。", 3200); }
  }

  function wordProgress(wordOrId) {
    const word = typeof wordOrId === "string" ? wordsById.get(wordOrId) : wordOrId;
    const wordId = word?.id || wordOrId;
    if (!state.progress.words[wordId] && word?.legacyId && state.progress.words[word.legacyId]) {
      state.progress.words[wordId] = state.progress.words[word.legacyId];
      delete state.progress.words[word.legacyId];
      saveProgress();
    }
    return state.progress.words[wordId] || { status: "new", correct: 0, incorrect: 0, lastPracticed: null };
  }

  function setWordStatus(wordId, status) {
    const current = wordProgress(wordId);
    state.progress.words[wordId] = { ...current, status, lastPracticed: new Date().toISOString() };
    saveProgress();
    updateStudySummary();
  }

  function recordAttempt(wordId, correct) {
    const current = wordProgress(wordId);
    state.progress.words[wordId] = {
      ...current,
      status: correct ? current.status : "review",
      correct: current.correct + (correct ? 1 : 0),
      incorrect: current.incorrect + (correct ? 0 : 1),
      lastPracticed: new Date().toISOString(),
    };
    saveProgress();
  }

  function showToast(message, duration = 1800) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), duration);
  }

  function speak(text) {
    if (!speechSupported || !String(text || "").trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.84;
    window.speechSynthesis.speak(utterance);
  }

  function renderLibrary() {
    $("totalWordCount").textContent = allWords.length.toLocaleString("zh-TW");
    $("bookGrid").innerHTML = books.map((book) => {
      const selected = state.selectedBooks.has(book.id);
      const semesters = [...new Set(book.words.map((word) => word.semester))].sort(naturalSort);
      const readyCount = book.words.filter((word) => !word.needsReview).length;
      const number = book.title.match(/\d+/)?.[0] || "W";
      return `
        <button class="book-card${selected ? " is-selected" : ""}" type="button" data-book-id="${escapeHtml(book.id)}" aria-pressed="${selected}">
          <span class="book-cover" aria-hidden="true">${escapeHtml(number)}</span>
          <span class="book-info">
            <h3>${escapeHtml(book.title)}</h3>
            <p>${book.words.length} 筆教材內容 · ${readyCount} 筆可測驗<br>${escapeHtml(semesters.map(semesterLabel).join(" · "))}</p>
          </span>
          <span class="book-check" aria-hidden="true">✓</span>
        </button>`;
    }).join("");
    const selectedCount = state.selectedBooks.size;
    $("selectionSummary").textContent = selectedCount ? `已選 ${selectedCount} 份教材` : "尚未選擇教材";
    $("startStudyButton").disabled = selectedCount === 0;
    $("startStudyButton").textContent = selectedCount ? `用 ${selectedCount} 份教材開始複習` : "選好教材，開始複習";
    $("selectAllButton").textContent = selectedCount === books.length ? "取消全部" : "一次選擇全部";
  }

  function toggleBook(bookId) {
    if (state.selectedBooks.has(bookId)) state.selectedBooks.delete(bookId);
    else state.selectedBooks.add(bookId);
    renderLibrary();
  }

  function emptyScopesForSelectedBooks() {
    return Object.fromEntries(
      [...state.selectedBooks].map((bookId) => [bookId, { semesters: new Set(), units: new Set(), classes: new Set() }]),
    );
  }

  function scopeSnapshot() {
    return Object.fromEntries(
      Object.entries(state.scopes).map(([bookId, scope]) => [bookId, {
        semesters: [...scope.semesters].sort(naturalSort),
        units: [...scope.units].sort(naturalSort),
        classes: [...scope.classes].sort(naturalSort),
      }]),
    );
  }

  function flashcardContextSnapshot() {
    return {
      selectedBooks: [...state.selectedBooks].sort(naturalSort),
      scopes: scopeSnapshot(),
    };
  }

  function flashcardContextKey(snapshot = flashcardContextSnapshot()) {
    return JSON.stringify(snapshot);
  }

  function restoreSavedScopes() {
    const saved = state.progress.flashcardLastContext;
    const selectedBooks = [...state.selectedBooks].sort(naturalSort);
    if (!saved || JSON.stringify(saved.selectedBooks || []) !== JSON.stringify(selectedBooks)) return emptyScopesForSelectedBooks();
    const scopes = emptyScopesForSelectedBooks();
    for (const bookId of selectedBooks) {
      const savedScope = saved.scopes?.[bookId];
      if (!savedScope || !scopes[bookId]) continue;
      scopes[bookId] = {
        semesters: new Set(savedScope.semesters || []),
        units: new Set(savedScope.units || []),
        classes: new Set(savedScope.classes || []),
      };
    }
    return scopes;
  }

  function openStudy() {
    if (!state.selectedBooks.size) return;
    state.screen = "study";
    document.body.classList.add("is-studying");
    state.scopes = restoreSavedScopes();
    $("libraryScreen").hidden = true;
    $("studyScreen").hidden = false;
    const selected = books.filter((book) => state.selectedBooks.has(book.id));
    $("studyTitle").textContent = selected.length === 1 ? selected[0].title : "混合教材複習";
    $("activeBooksLabel").textContent = selected.map((book) => book.title).join(" ＋ ");
    renderFilters();
    switchMode("review");
    resetFlashDeck();
    updateStudySummary();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openLibrary() {
    if (state.focusSession !== "inactive" && !exitFocusSession()) return;
    state.screen = "library";
    document.body.classList.remove("is-studying");
    saveFlashSession();
    window.speechSynthesis?.cancel();
    $("studyScreen").hidden = true;
    $("libraryScreen").hidden = false;
    renderLibrary();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function focusScopeDescription() {
    const selected = books.filter((book) => state.selectedBooks.has(book.id)).map((book) => book.title).join(" ＋ ");
    const count = filteredWords().length;
    return `${selected} · 目前範圍 ${count} 筆`;
  }

  function enterFocusSession(type) {
    const wasInactive = state.focusSession === "inactive";
    state.focusSession = type;
    if (wasInactive) state.focusReturnElement = document.activeElement;
    document.body.classList.add("is-focus-session");
    const pageShell = document.querySelector(".page-shell");
    pageShell.inert = true;
    pageShell.setAttribute("aria-hidden", "true");
    $("focusSession").hidden = false;
    $("focusFlashcards").hidden = type !== "flashcard";
    $("quizPlay").hidden = type !== "quiz";
    $("focusSessionTitle").textContent = type === "flashcard" ? "閃卡練習" : "單字測驗";
    $("focusScopeTitle").textContent = type === "flashcard" ? "閃卡範圍" : "測驗範圍";
    $("focusScopeDetail").textContent = type === "quiz" && state.quiz
      ? `${books.filter((book) => state.selectedBooks.has(book.id)).map((book) => book.title).join(" ＋ ")} · 本次 ${state.quiz.questions.length} 題`
      : focusScopeDescription();
    $("flashcardMasteryLabel").hidden = type !== "flashcard";
    $("reviewAgainButton").hidden = type !== "flashcard";
    $("focusMenu").open = false;
    if (type === "flashcard") renderFlashcard();
    else renderQuizQuestion();
    setTimeout(() => (type === "flashcard" ? $("flashcard") : $("questionPrompt"))?.focus(), 0);
  }

  function exitFocusSession({ skipConfirm = false, preserveQuiz = false } = {}) {
    if (state.focusSession === "inactive") return true;
    if (state.focusSession === "quiz" && !skipConfirm && state.quiz?.questions.some((question) => question.answered)) {
      if (!confirm("要離開這次測驗嗎？本次作答進度不會保留。")) return false;
    }
    if (state.focusSession === "flashcard") {
      saveFlashSession();
      state.flashcardRestored = true;
    }
    window.speechSynthesis?.cancel();
    const previousType = state.focusSession;
    state.focusSession = "inactive";
    document.body.classList.remove("is-focus-session");
    $("focusSession").hidden = true;
    $("focusFlashcards").hidden = true;
    $("quizPlay").hidden = true;
    const pageShell = document.querySelector(".page-shell");
    pageShell.inert = false;
    pageShell.removeAttribute("aria-hidden");
    if (previousType === "quiz" && !preserveQuiz) resetQuiz();
    if (previousType === "flashcard") renderFlashcardSetup();
    const returnTarget = state.focusReturnElement;
    state.focusReturnElement = null;
    if (!preserveQuiz) setTimeout(() => returnTarget?.focus(), 0);
    return true;
  }

  function selectedBookWords() {
    return allWords.filter((word) => state.selectedBooks.has(word.bookId));
  }

  function filteredWords() {
    return selectedBookWords().filter((word) => wordMatchesScope(word, state.scopes[word.bookId]));
  }

  function wordMatchesScope(word, scope) {
    if (!scope) return false;
    return (!scope.semesters.size || scope.semesters.has(word.semester))
      && (!scope.units.size || scope.units.has(word.unit))
      && (!scope.classes.size || scope.classes.has(word.className));
  }

  const filterDefinitions = [
    ["semesters", "semester", "學期", semesterLabel],
    ["units", "unit", "單元", (value) => value],
    ["classes", "className", "課次", (value) => value.replace("Class ", "第 ") + " 課"],
  ];

  function renderFilters() {
    const selectedBooks = books.filter((book) => state.selectedBooks.has(book.id));
    $("filterGroups").innerHTML = selectedBooks.map((book) => {
      const scope = state.scopes[book.id];
      const matchingCount = book.words.filter((word) => wordMatchesScope(word, scope)).length;
      const groups = filterDefinitions.map(([scopeKey, wordProperty, title, labeler]) => {
        const values = [...new Set(book.words.map((word) => word[wordProperty]))].sort(naturalSort);
        const selected = scope[scopeKey];
        return `<div class="filter-group">
          <strong>${title}</strong>
          <div class="filter-chips" data-book-id="${escapeHtml(book.id)}" data-filter-group="${scopeKey}">
            <button class="filter-chip${selected.size === 0 ? " is-active" : ""}" data-value="__all__" type="button">全部</button>
            ${values.map((value) => `<button class="filter-chip${selected.has(value) ? " is-active" : ""}" data-value="${escapeHtml(value)}" type="button">${escapeHtml(labeler(value))}</button>`).join("")}
          </div>
        </div>`;
      }).join("");
      return `<section class="book-filter-card" aria-labelledby="filter-${escapeHtml(book.id)}">
        <div class="book-filter-heading">
          <div><span class="book-filter-number">${escapeHtml(book.title.match(/\d+/)?.[0] || "W")}</span><strong id="filter-${escapeHtml(book.id)}">${escapeHtml(book.title)}</strong></div>
          <span>${matchingCount} / ${book.words.length} 筆</span>
        </div>
        ${groups}
      </section>`;
    }).join("");
  }

  function updateStudySummary() {
    const words = filteredWords();
    $("activeWordCount").textContent = words.length;
    const activeFilterCount = Object.values(state.scopes).reduce(
      (sum, scope) => sum + scope.semesters.size + scope.units.size + scope.classes.size,
      0,
    );
    $("filterSummary").textContent = activeFilterCount ? `${state.selectedBooks.size} 份教材 · ${activeFilterCount} 個條件` : "每份教材皆為全部內容";
    if (state.mode === "review") renderReview();
    if (state.mode === "flashcards") renderFlashcardSetup();
    if (state.mode === "quiz" && !state.quiz) updateQuizSetup();
  }

  function switchMode(mode) {
    const previousMode = state.mode;
    if (previousMode === "flashcards" && mode !== "flashcards") saveFlashSession();
    state.mode = mode;
    document.querySelectorAll(".mode-tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.mode === mode));
    $("reviewPanel").hidden = mode !== "review";
    $("flashcardsPanel").hidden = mode !== "flashcards";
    $("quizPanel").hidden = mode !== "quiz";
    if (mode === "review") renderReview();
    if (mode === "flashcards") {
      if (previousMode !== "flashcards") state.lastFlashSpeechKey = null;
      renderFlashcardSetup();
    }
    if (mode === "quiz") updateQuizSetup();
  }

  function renderReview() {
    const query = state.search.trim().toLocaleLowerCase();
    const words = filteredWords().filter((word) => {
      const progress = wordProgress(word.id);
      const matchesSearch = !query || [word.english, word.chinese, word.exampleSentence, word.exampleChinese]
        .some((value) => String(value || "").toLocaleLowerCase().includes(query));
      const matchesStatus = state.masteryFilter === "all" || progress.status === state.masteryFilter;
      return matchesSearch && matchesStatus;
    });
    $("reviewResultCount").textContent = `找到 ${words.length} 筆內容`;
    const visible = words.slice(0, state.visibleWords);
    $("wordList").innerHTML = visible.length ? visible.map(renderWordRow).join("") : `<div class="empty-state">目前沒有符合條件的單字，試著調整搜尋或篩選範圍。</div>`;
    $("loadMoreButton").hidden = visible.length >= words.length;
  }

  function trustedExample(word) {
    return word.exampleSentence && word.exampleChinese
      ? { english: word.exampleSentence, chinese: word.exampleChinese, draft: word.exampleStatus === "draft" }
      : null;
  }

  function structuredDetail(word) {
    if (word.contentKind === "verb_forms" && word.baseForm && word.pastTense && word.pastParticiple) {
      return `${word.baseForm} → ${word.pastTense} → ${word.pastParticiple}`;
    }
    if (word.contentKind === "contraction" && word.fullForm && word.shortForm) return `${word.fullForm} ↔ ${word.shortForm}`;
    if (word.contentKind === "word_relation" && word.relatedTerms?.length >= 2) {
      const symbol = word.relationType === "antonym" ? "↔" : "=";
      return `${word.relatedTerms[0]} ${symbol} ${word.relatedTerms[1]}`;
    }
    if (word.contentKind === "spelling_change" && word.singularForm && word.pluralForm) return `${word.singularForm} → ${word.pluralForm}`;
    return "";
  }

  function renderWordRow(word) {
    const progress = wordProgress(word.id);
    const pos = word.partOfSpeech.replaceAll("_", " ");
    const detail = structuredDetail(word);
    const example = trustedExample(word);
    const relatedCount = word.conceptId ? conceptCounts.get(word.conceptId) || 0 : 0;
    return `<article class="word-row">
      <div class="word-english"><strong>${escapeHtml(word.english)}</strong><span>${escapeHtml(pos)} · ${escapeHtml(contentKindLabels[word.contentKind] || word.type.replaceAll("_", " "))}</span></div>
      <div class="word-chinese"><strong>${escapeHtml(word.chinese)}</strong>${detail ? `<span class="structure-detail">${escapeHtml(detail)}</span>` : ""}</div>
      <div class="word-meta">${escapeHtml(word.bookTitle)} · ${escapeHtml(semesterLabel(word.semester))} · ${escapeHtml(word.unit)} · ${escapeHtml(word.className)} · ${escapeHtml(word.page)}${relatedCount > 1 ? ` · 同概念共 ${relatedCount} 筆` : ""}
        ${example ? `<span class="example-line${example.draft ? " draft" : ""}">${example.draft ? "例句草稿：" : ""}${escapeHtml(example.english)}｜${escapeHtml(example.chinese)}</span>` : ""}
        ${word.needsReview ? `<span class="review-note">此筆等待教材內容確認，暫不納入測驗</span>` : ""}
      </div>
      <div class="word-actions">
        ${speechSupported && word.audioText ? `<button class="icon-button" data-word-action="speak" data-word-id="${escapeHtml(word.id)}" type="button" aria-label="播放 ${escapeHtml(word.audioText)} 的發音">▶</button>` : ""}
        <button class="icon-button${progress.status === "review" ? " is-review" : ""}" data-word-action="review" data-word-id="${escapeHtml(word.id)}" type="button" aria-label="標記待加強">↺</button>
        <button class="icon-button${progress.status === "mastered" ? " is-mastered" : ""}" data-word-action="mastered" data-word-id="${escapeHtml(word.id)}" type="button" aria-label="標記已熟悉">✓</button>
      </div>
    </article>`;
  }

  function saveFlashSession() {
    if (!state.selectedBooks.size || !state.flashDeck.length) return;
    const context = flashcardContextSnapshot();
    const key = flashcardContextKey(context);
    state.progress.flashcardSessions ||= {};
    state.progress.flashcardSessions[key] = {
      deckIds: state.flashDeck.map((word) => word.id),
      index: state.flashIndex,
      flipped: state.flashFlipped,
      front: state.flashFront,
      order: state.flashOrder,
      updatedAt: new Date().toISOString(),
    };
    state.progress.flashcardLastContext = context;
    saveProgress();
  }

  function resetFlashDeck(source = filteredWords(), { forceNew = false } = {}) {
    const contextKey = flashcardContextKey();
    const saved = state.progress.flashcardSessions?.[contextKey];
    const sourceIds = new Set(source.map((word) => word.id));
    const savedIds = saved ? saved.deckIds || [] : [];
    const canRestore = !forceNew && savedIds.length === source.length
      && savedIds.every((id) => sourceIds.has(id) && wordsById.has(id));
    if (canRestore) state.flashOrder = saved.order === "random" ? "random" : "ordered";
    const freshDeck = state.flashOrder === "random" ? shuffle(source) : [...source];
    state.flashDeck = canRestore ? savedIds.map((id) => wordsById.get(id)) : freshDeck;
    state.flashIndex = canRestore ? Math.min(Math.max(Number(saved.index) || 0, 0), Math.max(state.flashDeck.length - 1, 0)) : 0;
    state.flashFlipped = canRestore ? Boolean(saved.flipped) : false;
    state.flashFront = canRestore && ["english", "chinese"].includes(saved.front) ? saved.front : state.flashFront;
    state.lastFlashSpeechKey = null;
    state.flashcardRestored = canRestore;
    renderFlashcard();
    renderFlashcardSetup();
  }

  function currentFlashWord() { return state.flashDeck[state.flashIndex]; }

  function renderFlashcard() {
    const word = currentFlashWord();
    $("flashcardEmpty").hidden = Boolean(word);
    $("flashcardStage").hidden = !word;
    if (!word) return;
    const frontEnglish = state.flashFront === "english";
    const showingFront = !state.flashFlipped;
    $("flashcard").classList.toggle("is-flipped", state.flashFlipped);
    $("flashcardKicker").textContent = showingFront ? (frontEnglish ? "ENGLISH" : "中文") : (frontEnglish ? "中文" : "ENGLISH");
    $("flashcardMain").textContent = showingFront ? (frontEnglish ? word.english : word.chinese) : (frontEnglish ? word.chinese : word.english);
    $("flashcardSub").textContent = showingFront ? "點一下翻面" : word.partOfSpeech.replaceAll("_", " ");
    const detail = structuredDetail(word);
    const example = trustedExample(word);
    $("flashcardDetail").textContent = showingFront ? "" : detail;
    $("flashcardExample").textContent = showingFront || !example ? "" : `${example.draft ? "例句草稿：" : ""}${example.english}｜${example.chinese}`;
    $("flashcardSource").textContent = `${word.bookTitle} · ${semesterLabel(word.semester)} · ${word.unit} · ${word.className} · ${word.page}`;
    $("flashcardMore").hidden = showingFront;
    if (showingFront) $("flashcardMore").open = false;
    $("focusSessionProgress").textContent = `${state.flashIndex + 1} / ${state.flashDeck.length}`;
    const mastered = state.flashDeck.filter((item) => wordProgress(item.id).status === "mastered").length;
    $("flashcardMasteryLabel").textContent = `${mastered} 個已熟悉`;
    $("flashcardProgressBar").style.width = `${((state.flashIndex + 1) / state.flashDeck.length) * 100}%`;
    $("flashcardSpeakButton").hidden = !speechSupported || !word.audioText;
    $("previousCardButton").disabled = state.flashDeck.length < 2;
    $("nextCardButton").disabled = state.flashDeck.length < 2;
    maybeAutoSpeakFlashcard(word);
  }

  function renderFlashcardSetup() {
    const words = filteredWords();
    const hasWords = words.length > 0;
    $("flashcardEmpty").hidden = hasWords;
    $("flashcardSetup").hidden = !hasWords;
    $("flashcardSetupCount").textContent = `${words.length} 個單字`;
    $("flashcardSetupScope").textContent = focusScopeDescription();
    $("flashcardFront").value = state.flashFront;
    document.querySelectorAll("#flashcardOrderOptions [data-order]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.order === state.flashOrder);
    });
    $("flashcardResumeLabel").textContent = state.flashcardRestored
      ? `上次看到第 ${state.flashIndex + 1} 張，可直接繼續。`
      : "";
    $("startFlashcardsButton").textContent = state.flashcardRestored ? "繼續上次" : "開始閃卡";
    $("restartFlashcardsButton").hidden = !state.flashcardRestored;
  }

  function startFlashcardSession(resume = state.flashcardRestored) {
    if (!filteredWords().length) return showToast("目前範圍沒有可練習的單字");
    if (!resume) {
      resetFlashDeck(filteredWords(), { forceNew: true });
      saveFlashSession();
    }
    enterFocusSession("flashcard");
  }

  function maybeAutoSpeakFlashcard(word) {
    if (!speechSupported || state.focusSession !== "flashcard") return;
    const shouldSpeak = (state.flashFront === "english" && !state.flashFlipped)
      || (state.flashFront === "chinese" && state.flashFlipped);
    if (!shouldSpeak) return;
    const speechKey = `${word.id}:${state.flashFront}:${state.flashFlipped ? "back" : "front"}`;
    if (state.lastFlashSpeechKey === speechKey) return;
    state.lastFlashSpeechKey = speechKey;
    setTimeout(() => {
      const current = currentFlashWord();
      if (current?.id === word.id && state.focusSession === "flashcard") speak(word.audioText);
    }, 120);
  }

  function moveFlashcard(direction) {
    if (!state.flashDeck.length) return;
    state.flashIndex = (state.flashIndex + direction + state.flashDeck.length) % state.flashDeck.length;
    state.flashFlipped = false;
    state.flashcardRestored = false;
    saveFlashSession();
    renderFlashcard();
  }

  const hasMode = (word, mode) => word.quizModes?.includes(mode);
  const baseQuizEligible = (word) => !word.needsReview;
  const quizTypes = {
    enZh: {
      label: "英 → 中", description: "看英文選中文，題目出現時播放英文發音", input: false, autoSpeak: true,
      eligible: (word) => baseQuizEligible(word) && hasMode(word, "en_zh_choice"),
      prompt: (word) => word.english, answer: (word) => word.chinese, accepted: (word) => [word.chinese], optionValue: (word) => word.chinese,
    },
    zhEn: {
      label: "中 → 英", description: "看中文選英文", input: false,
      eligible: (word) => baseQuizEligible(word) && hasMode(word, "zh_en_choice"),
      prompt: (word) => word.chinese, answer: (word) => word.english, accepted: (word) => word.acceptedAnswers, optionValue: (word) => word.english,
    },
    spelling: {
      label: "拼字", description: "看中文寫英文，題目出現時播放英文發音", input: true, autoSpeak: true,
      eligible: (word) => baseQuizEligible(word) && hasMode(word, "spelling"),
      prompt: (word) => word.chinese, answer: (word) => word.english, accepted: (word) => word.acceptedAnswers,
    },
    listenChoice: {
      label: "聽音", description: "聽發音選英文", input: false, speech: true,
      eligible: (word) => baseQuizEligible(word) && hasMode(word, "listening") && Boolean(word.audioText),
      prompt: () => "聽一聽，選出正確的英文", answer: (word) => word.audioText, accepted: (word) => [word.audioText], optionValue: (word) => word.audioText,
    },
    dictation: {
      label: "聽寫", description: "聽發音寫英文", input: true, speech: true,
      eligible: (word) => baseQuizEligible(word) && hasMode(word, "listening") && hasMode(word, "spelling") && Boolean(word.audioText),
      prompt: () => "聽一聽，把英文寫下來", answer: (word) => word.audioText, accepted: (word) => word.acceptedAnswers,
    },
    contraction: {
      label: "縮寫", description: "完整形式與縮寫互換", input: false,
      eligible: (word) => baseQuizEligible(word) && hasMode(word, "contraction_choice") && word.fullForm && word.shortForm,
      prompt: (word) => `「${word.fullForm}」的縮寫是？`, answer: (word) => word.shortForm, accepted: (word) => [word.shortForm], optionValue: (word) => word.shortForm,
    },
    verbForms: {
      label: "動詞三態", description: "寫出過去式與過去分詞", input: true, structured: true,
      eligible: (word) => baseQuizEligible(word) && (hasMode(word, "verb_form_input") || hasMode(word, "verb_forms")) && word.baseForm && word.pastTense && word.pastParticiple,
      prompt: (word) => `${word.baseForm}（${word.chinese}）的過去式、過去分詞是？`,
      answer: (word) => `${word.pastTense} → ${word.pastParticiple}`,
      accepted: (word) => [`${word.pastTense} → ${word.pastParticiple}`, `${word.pastTense} ${word.pastParticiple}`],
    },
    relation: {
      label: "詞語關係", description: "辨認同義詞或反義詞", input: false,
      eligible: (word) => baseQuizEligible(word) && (hasMode(word, "equivalent_choice") || hasMode(word, "relation")) && word.relatedTerms?.length >= 2,
      prompt: (word) => `和「${word.relatedTerms[0]}」意思${word.relationType === "antonym" ? "相反" : "相近"}的是？`,
      answer: (word) => word.relatedTerms[1], accepted: (word) => [word.relatedTerms[1]], optionValue: (word) => word.relatedTerms[1],
    },
    spellingChange: {
      label: "拼字變化", description: "練習單數與複數變化", input: false,
      eligible: (word) => baseQuizEligible(word) && (hasMode(word, "form_change_choice") || hasMode(word, "spelling_change")) && word.singularForm && word.pluralForm,
      prompt: (word) => `「${word.singularForm}」的複數是？`, answer: (word) => word.pluralForm, accepted: (word) => [word.pluralForm], optionValue: (word) => word.pluralForm,
    },
    grammarMeaning: {
      label: "文法句型", description: "辨認句型的意思", input: false,
      eligible: (word) => baseQuizEligible(word) && hasMode(word, "grammar_choice") && Boolean(word.chinese),
      prompt: (word) => word.english, answer: (word) => word.chinese, accepted: (word) => [word.chinese], optionValue: (word) => word.chinese,
    },
    cloze: {
      label: "句型填空", description: "依提示完成句型", input: true,
      eligible: (word) => baseQuizEligible(word) && hasMode(word, "grammar_cloze") && word.clozePrompt && word.clozeAnswer,
      prompt: (word) => word.clozePrompt, answer: (word) => word.clozeAnswer, accepted: (word) => [word.clozeAnswer],
    },
  };

  function normalizeAnswer(value, structured = false) {
    let normalized = String(value || "").trim().toLocaleLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
    if (structured) normalized = normalized.replace(/\s*(?:→|,|\/|\|)\s*/g, "|");
    return normalized;
  }

  function spellingHint(answer) {
    return String(answer || "").split(/(\s+)/).map((token) => {
      if (/^\s+$/.test(token)) return token;
      const letters = [...token].filter((character) => /[A-Za-z]/.test(character));
      let revealed = 0;
      return [...token].map((character) => {
        if (!/[A-Za-z]/.test(character)) return character;
        const show = revealed === 0 || (letters.length >= 5 && revealed === 1);
        revealed += 1;
        return show ? character : "＿";
      }).join("");
    }).join("");
  }

  function enabledQuizTypeIds(words, includeSpeech = speechSupported && state.quizSpeechEnabled) {
    return Object.entries(quizTypes)
      .filter(([, definition]) => (!definition.speech || includeSpeech) && words.some((word) => definition.eligible(word)))
      .map(([type]) => type);
  }

  function updateQuizSetup() {
    const words = filteredWords();
    const speechAvailable = speechSupported && words.some((word) => word.audioText && hasMode(word, "listening") && !word.needsReview);
    const includeSpeech = speechAvailable && state.quizSpeechEnabled;
    const enabledTypes = enabledQuizTypeIds(words, includeSpeech);
    const eligibleCount = words.filter((word) => enabledTypes.some((type) => quizTypes[type].eligible(word))).length;
    $("quizSetupCount").textContent = `${eligibleCount} 筆可測驗`;
    $("quizSetupScope").textContent = focusScopeDescription();
    $("startQuizButton").disabled = eligibleCount === 0;
    $("startQuizButton").textContent = eligibleCount ? `從 ${eligibleCount} 筆可用內容中開始測驗` : "目前範圍沒有可用題目";
    $("speechWarning").hidden = speechAvailable;
    $("speechWarning").textContent = speechSupported ? "目前範圍沒有可用發音內容，將使用文字題。" : "此瀏覽器不支援語音，將自動改用文字題。";
    $("quizSpeechToggle").checked = includeSpeech;
    $("quizSpeechToggle").disabled = !speechAvailable;
    $("quizSpeechSetting").classList.toggle("is-disabled", !speechAvailable);
    $("quizTypeList").innerHTML = enabledTypes.map((type) => {
      const definition = quizTypes[type];
      const count = words.filter((word) => definition.eligible(word)).length;
      return `<li><span>${escapeHtml(definition.label)}</span>${escapeHtml(definition.description)} · ${count} 筆</li>`;
    }).join("") || `<li><span>尚無題型</span>請調整教材範圍</li>`;
  }

  function createQuiz(sourceWords = filteredWords()) {
    const includeSpeech = speechSupported && state.quizSpeechEnabled;
    const types = enabledQuizTypeIds(sourceWords, includeSpeech);
    const eligibleWords = shuffle(sourceWords.filter((word) => types.some((type) => quizTypes[type].eligible(word))));
    const requested = state.quizSize === "all" ? eligibleWords.length : Number(state.quizSize);
    const chosenWords = eligibleWords.slice(0, Math.min(requested, eligibleWords.length));
    const typeUsage = Object.fromEntries(types.map((type) => [type, 0]));
    const questionPool = chosenWords.map((word) => {
      const available = types.filter((type) => quizTypes[type].eligible(word));
      const type = available.sort((a, b) => typeUsage[a] - typeUsage[b])[0];
      typeUsage[type] += 1;
      const definition = quizTypes[type];
      const answer = definition.answer(word);
      const question = {
        word, type, answer, accepted: definition.accepted(word).filter(Boolean),
        answered: false, completed: false, correct: false, userAnswer: "", autoSpoken: false,
        attempts: 0, hintShown: false, usedHint: false,
      };
      if (!definition.input) {
        const distractors = shuffle(sourceWords
          .filter((item) => item.id !== word.id && definition.eligible(item))
          .map((item) => definition.optionValue(item))
          .filter((value, index, values) => value && normalizeAnswer(value) !== normalizeAnswer(answer) && values.indexOf(value) === index))
          .slice(0, 3);
        question.options = shuffle([answer, ...distractors]);
      }
      return question;
    });
    if (!questionPool.length) return showToast("目前範圍沒有符合資料規則的測驗題目", 2800);
    state.quiz = { questions: questionPool, index: 0, sourceWords: [...sourceWords] };
    $("quizSetup").hidden = true;
    $("quizResult").hidden = true;
    enterFocusSession("quiz");
  }

  function renderQuizQuestion() {
    const quiz = state.quiz;
    const question = quiz?.questions[quiz.index];
    if (!question) return finishQuiz();
    const definition = quizTypes[question.type];
    $("focusSessionProgress").textContent = `${quiz.index + 1} / ${quiz.questions.length}`;
    $("quizProgressBar").style.width = `${((quiz.index + (question.answered ? 1 : 0)) / quiz.questions.length) * 100}%`;
    $("questionType").textContent = definition.label;
    $("questionSource").textContent = `${question.word.bookTitle} · ${question.word.partOfSpeech.replaceAll("_", " ")} · ${question.word.unit} · ${question.word.className}`;
    $("questionSource").hidden = !question.answered;
    $("questionPrompt").textContent = definition.prompt(question.word);
    $("questionSpeechButton").hidden = !question.word.audioText || (!definition.speech && !definition.autoSpeak && !question.answered);
    $("questionSpeechButton").textContent = question.answered ? "重播發音" : "播放題目發音";
    $("answerFeedback").className = "answer-feedback";
    $("answerFeedback").innerHTML = "";
    $("nextQuestionButton").hidden = !question.answered;
    $("nextQuestionButton").textContent = quiz.index === quiz.questions.length - 1 ? "查看結果" : "下一題";

    if (!definition.input) {
      $("answerArea").innerHTML = `<div class="answer-options">${question.options.map((option) => {
        const isCorrect = normalizeAnswer(option) === normalizeAnswer(question.answer);
        const isChosen = normalizeAnswer(option) === normalizeAnswer(question.userAnswer);
        const className = question.answered ? (isCorrect ? " correct" : isChosen ? " incorrect" : "") : "";
        return `<button class="answer-option${className}" type="button" data-answer="${escapeHtml(option)}" ${question.answered ? "disabled" : ""}>${escapeHtml(option)}</button>`;
      }).join("")}</div>`;
    } else {
      $("answerArea").innerHTML = `<form class="text-answer" id="textAnswerForm">
        <label class="sr-only" for="textAnswerInput">輸入英文答案</label>
        <input id="textAnswerInput" type="text" autocomplete="off" spellcheck="false" placeholder="輸入英文答案…" value="${escapeHtml(question.userAnswer)}" ${question.answered ? "disabled" : ""} />
        <button class="primary-button" type="submit" ${question.answered ? "disabled" : ""}>送出答案</button>
      </form>`;
      if (!question.answered) setTimeout(() => $("textAnswerInput")?.focus(), 0);
    }

    if (question.hintShown && !question.answered) {
      $("answerFeedback").classList.add("incorrect");
      $("answerFeedback").innerHTML = `<strong>再試一次</strong><span class="answer-hint-label">部分提示：</span><code class="answer-hint">${escapeHtml(spellingHint(question.answer))}</code><span class="answer-hint-help">再聽一次發音，想想完整拼字。</span>`;
    }

    if (question.answered) {
      const feedback = $("answerFeedback");
      feedback.classList.add(question.correct ? "correct" : "incorrect");
      feedback.innerHTML = question.correct
        ? `<strong>答對了！</strong>${question.usedHint ? "<span>使用提示後答對，已加深記憶。</span>" : ""}${escapeHtml(question.word.english)}｜${escapeHtml(question.word.chinese)}`
        : `<strong>再記一次就好</strong>正確答案：${escapeHtml(question.answer)}`;
      setTimeout(() => $("nextQuestionButton")?.focus(), 0);
    }
    if ((definition.speech || definition.autoSpeak) && !question.autoSpoken && !question.answered) {
      question.autoSpoken = true;
      setTimeout(() => {
        const current = state.quiz?.questions[state.quiz.index];
        if (current === question) speak(question.word.audioText);
      }, 150);
    }
  }

  function submitQuizAnswer(answer) {
    const question = state.quiz?.questions[state.quiz.index];
    if (!question || question.answered) return;
    const definition = quizTypes[question.type];
    question.userAnswer = answer;
    question.attempts += 1;
    question.correct = question.accepted.some((expected) => normalizeAnswer(answer, definition.structured) === normalizeAnswer(expected, definition.structured));
    recordAttempt(question.word.id, question.correct);
    if (question.type === "spelling" && !question.correct && question.attempts === 1) {
      question.hintShown = true;
      question.usedHint = true;
      question.userAnswer = "";
      question.answered = false;
      renderQuizQuestion();
      return;
    }
    question.answered = true;
    question.completed = true;
    renderQuizQuestion();
  }

  function nextQuizQuestion() {
    if (!state.quiz) return;
    if (state.quiz.index >= state.quiz.questions.length - 1) finishQuiz();
    else { state.quiz.index += 1; renderQuizQuestion(); }
  }

  function finishQuiz() {
    if (!state.quiz) return;
    const questions = state.quiz.questions;
    const correct = questions.filter((question) => question.correct).length;
    const wrong = questions.filter((question) => !question.correct);
    const hinted = questions.filter((question) => question.usedHint).length;
    const percent = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    const breakdown = Object.keys(quizTypes).map((type) => {
      const items = questions.filter((question) => question.type === type);
      if (!items.length) return "";
      return `<div><strong>${items.filter((item) => item.correct).length}/${items.length}</strong><span>${quizTypes[type].label}</span></div>`;
    }).join("");
    state.progress.lastQuiz = { date: new Date().toISOString(), correct, total: questions.length, percent };
    saveProgress();
    exitFocusSession({ skipConfirm: true, preserveQuiz: true });
    $("quizPlay").hidden = true;
    $("quizResult").hidden = false;
    $("quizResult").innerHTML = `<div class="quiz-result-card" tabindex="-1">
      <p class="eyebrow">QUIZ COMPLETE</p>
      <div class="score-ring" style="--score:${percent}%"><span>${percent}%</span></div>
      <h2>${percent >= 90 ? "太棒了，記得很扎實！" : percent >= 70 ? "很不錯，再練幾個就更穩了" : "完成就是進步，再試一次吧"}</h2>
      <p>這次答對 ${correct} 題，共 ${questions.length} 題。${hinted ? `其中 ${hinted} 題使用了提示。` : ""}</p>
      <div class="result-breakdown">${breakdown}</div>
      ${wrong.length ? `<h3>再看一次這些單字</h3><div class="wrong-list">${wrong.map((question) => `<div class="wrong-item"><strong>${escapeHtml(question.word.english)}</strong><span>${escapeHtml(question.word.chinese)} · ${escapeHtml(question.word.bookTitle)}</span></div>`).join("")}</div>` : ""}
      <div class="result-actions">
        ${wrong.length ? `<button class="secondary-button" id="retryWrongButton" type="button">重練錯題</button>` : ""}
        <button class="primary-button" id="restartQuizButton" type="button">再測驗一次</button>
        <button class="text-button" id="returnReviewButton" type="button">回單字複習</button>
      </div>
    </div>`;
    $("retryWrongButton")?.addEventListener("click", () => createQuiz([...new Map(wrong.map((item) => [item.word.id, item.word])).values()]));
    $("restartQuizButton").addEventListener("click", resetQuiz);
    $("returnReviewButton").addEventListener("click", () => { resetQuiz(); switchMode("review"); });
    setTimeout(() => $("quizResult").querySelector(".quiz-result-card")?.focus(), 0);
  }

  function resetQuiz() {
    state.quiz = null;
    $("quizPlay").hidden = true;
    $("quizResult").hidden = true;
    $("quizSetup").hidden = false;
    updateQuizSetup();
  }

  function clearProgress() {
    if (!confirm("要清除這台裝置上的熟悉度與測驗紀錄嗎？")) return;
    if (!confirm("再次確認：清除後無法復原。")) return;
    state.progress = { version: 1, words: {}, lastQuiz: null, flashcardSessions: {}, flashcardLastContext: null };
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* no-op */ }
    renderLibrary();
    if (state.screen === "study") { resetFlashDeck(); updateStudySummary(); resetQuiz(); }
    showToast("學習紀錄已清除");
  }

  $("bookGrid").addEventListener("click", (event) => {
    const card = event.target.closest("[data-book-id]");
    if (card) toggleBook(card.dataset.bookId);
  });
  $("startStudyButton").addEventListener("click", openStudy);
  $("selectAllButton").addEventListener("click", () => {
    state.selectedBooks = state.selectedBooks.size === books.length ? new Set() : new Set(books.map((book) => book.id));
    renderLibrary();
  });
  $("backButton").addEventListener("click", openLibrary);
  $("brandButton").addEventListener("click", openLibrary);
  $("clearProgressButton").addEventListener("click", clearProgress);

  document.querySelector(".mode-tabs").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-mode]");
    if (tab) switchMode(tab.dataset.mode);
  });

  $("filterGroups").addEventListener("click", (event) => {
    const chip = event.target.closest(".filter-chip");
    if (!chip) return;
    const group = chip.closest("[data-filter-group]");
    const scopeKey = group.dataset.filterGroup;
    const bookId = group.dataset.bookId;
    const value = chip.dataset.value;
    const selection = state.scopes[bookId]?.[scopeKey];
    if (!selection) return;
    if (value === "__all__") selection.clear();
    else if (selection.has(value)) selection.delete(value);
    else selection.add(value);
    state.visibleWords = 60;
    renderFilters();
    resetFlashDeck();
    resetQuiz();
    updateStudySummary();
  });

  $("searchInput").addEventListener("input", (event) => { state.search = event.target.value; state.visibleWords = 60; renderReview(); });
  $("masteryFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-status]");
    if (!button) return;
    state.masteryFilter = button.dataset.status;
    document.querySelectorAll("#masteryFilters button").forEach((item) => item.classList.toggle("is-active", item === button));
    state.visibleWords = 60;
    renderReview();
  });
  $("loadMoreButton").addEventListener("click", () => { state.visibleWords += 60; renderReview(); });
  $("wordList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-word-action]");
    if (!button) return;
    const word = wordsById.get(button.dataset.wordId);
    if (!word) return;
    if (button.dataset.wordAction === "speak") speak(word.audioText);
    else {
      const status = button.dataset.wordAction;
      const nextStatus = wordProgress(word.id).status === status ? "new" : status;
      setWordStatus(word.id, nextStatus);
      renderReview();
      showToast(nextStatus === "new" ? "已移除標記" : nextStatus === "mastered" ? "已標記為熟悉" : "已加入待加強");
    }
  });

  $("flashcard").addEventListener("click", () => { state.flashFlipped = !state.flashFlipped; state.flashcardRestored = false; saveFlashSession(); renderFlashcard(); });
  $("flashcardFront").addEventListener("change", (event) => {
    state.flashFront = event.target.value;
    state.flashFlipped = false;
    state.flashcardRestored = false;
    state.lastFlashSpeechKey = null;
    renderFlashcardSetup();
  });
  $("flashcardOrderOptions").addEventListener("click", (event) => {
    const button = event.target.closest("[data-order]");
    if (!button) return;
    state.flashOrder = button.dataset.order;
    state.flashcardRestored = false;
    renderFlashcardSetup();
  });
  $("startFlashcardsButton").addEventListener("click", () => startFlashcardSession());
  $("restartFlashcardsButton").addEventListener("click", () => startFlashcardSession(false));
  $("previousCardButton").addEventListener("click", () => moveFlashcard(-1));
  $("nextCardButton").addEventListener("click", () => moveFlashcard(1));
  $("flashcardSpeakButton").addEventListener("click", () => { const word = currentFlashWord(); if (word) speak(word.audioText); });
  $("markReviewButton").addEventListener("click", () => { const word = currentFlashWord(); if (word) { setWordStatus(word.id, "review"); moveFlashcard(1); } });
  $("markMasteredButton").addEventListener("click", () => { const word = currentFlashWord(); if (word) { setWordStatus(word.id, "mastered"); moveFlashcard(1); } });
  $("reviewAgainButton").addEventListener("click", () => {
    const reviewWords = filteredWords().filter((word) => wordProgress(word.id).status === "review");
    if (!reviewWords.length) return showToast("目前沒有待加強單字");
    resetFlashDeck(reviewWords, { forceNew: true });
    saveFlashSession();
    $("focusMenu").open = false;
    showToast(`開始複習 ${reviewWords.length} 個待加強單字`);
  });

  document.addEventListener("keydown", (event) => {
    if (state.focusSession === "inactive") return;
    const editable = ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName);
    if (event.key === "Escape") {
      event.preventDefault();
      exitFocusSession();
      return;
    }
    if (state.focusSession !== "flashcard" || editable) return;
    if (event.key === "ArrowRight") { event.preventDefault(); moveFlashcard(1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); moveFlashcard(-1); }
    if (event.key === " " && document.activeElement === $("flashcard")) {
      event.preventDefault();
      $("flashcard").click();
    }
    if (event.key === "1") { event.preventDefault(); $("markReviewButton").click(); }
    if (event.key === "2") { event.preventDefault(); $("markMasteredButton").click(); }
    if (event.key.toLocaleLowerCase() === "r") { event.preventDefault(); $("flashcardSpeakButton").click(); }
  });

  $("exitFocusButton").addEventListener("click", () => exitFocusSession());
  $("restartFocusButton").addEventListener("click", () => {
    if (!confirm("要重新開始目前的學習工作階段嗎？")) return;
    $("focusMenu").open = false;
    if (state.focusSession === "flashcard") startFlashcardSession(false);
    else if (state.focusSession === "quiz") createQuiz(state.quiz?.sourceWords || filteredWords());
  });

  $("quizSizeOptions").addEventListener("click", (event) => {
    const button = event.target.closest("[data-size]");
    if (!button) return;
    state.quizSize = button.dataset.size;
    document.querySelectorAll("#quizSizeOptions button").forEach((item) => item.classList.toggle("is-active", item === button));
  });
  $("quizSpeechToggle").addEventListener("change", (event) => {
    state.quizSpeechEnabled = speechSupported && event.target.checked;
    updateQuizSetup();
  });
  $("startQuizButton").addEventListener("click", () => createQuiz());
  $("answerArea").addEventListener("click", (event) => { const option = event.target.closest("[data-answer]"); if (option) submitQuizAnswer(option.dataset.answer); });
  $("answerArea").addEventListener("submit", (event) => { event.preventDefault(); const input = $("textAnswerInput"); if (input?.value.trim()) submitQuizAnswer(input.value); });
  $("questionSpeechButton").addEventListener("click", () => { const question = state.quiz?.questions[state.quiz.index]; if (question) speak(question.word.audioText); });
  $("nextQuestionButton").addEventListener("click", nextQuizQuestion);

  if (!books.length) {
    $("bookGrid").innerHTML = `<div class="empty-state">找不到教材資料，請先產生 vocabulary-data.js。</div>`;
  }
  renderLibrary();
})();
