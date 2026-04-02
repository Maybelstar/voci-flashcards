const ADVANCE_DELAY_MS = 700;
const LANGUAGE_LABELS = {
  en: "Englisch",
  fr: "Französisch",
};

const state = {
  cards: [],
  activeCards: [],
  cardQueue: [],
  currentCard: null,
  currentLanguage: "en",
  currentMode: "loading",
  currentAttemptHadMistake: false,
  difficultCardIds: new Set(),
  advanceTimerId: null,
  repeatCount: 5,
};

const elements = {
  loadingState: document.querySelector("#loading-state"),
  errorState: document.querySelector("#error-state"),
  errorMessage: document.querySelector("#error-message"),
  gameState: document.querySelector("#game-state"),
  completeState: document.querySelector("#complete-state"),
  overallProgress: document.querySelector("#overall-progress"),
  masteredProgress: document.querySelector("#mastered-progress"),
  progressFill: document.querySelector("#progress-fill"),
  germanWord: document.querySelector("#german-word"),
  cardProgress: document.querySelector("#card-progress"),
  feedbackText: document.querySelector("#feedback-text"),
  answerForm: document.querySelector("#answer-form"),
  answerInput: document.querySelector("#answer-input"),
  submitButton: document.querySelector("#submit-button"),
  restartButton: document.querySelector("#restart-button"),
  promptLabel: document.querySelector("#prompt-label"),
  answerLabel: document.querySelector("#answer-label"),
  languagePicker: document.querySelector("#language-picker"),
  languageButtons: document.querySelector("#language-buttons"),
  repeatCount: document.querySelector("#repeat-count"),
  completeMessage: document.querySelector("#complete-message"),
  difficultSummary: document.querySelector("#difficult-summary"),
  difficultList: document.querySelector("#difficult-list"),
  difficultButton: document.querySelector("#difficult-button"),
};

function normalizeAnswer(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getAcceptedAnswers(english) {
  return english
    .split(/\s*(?:\/|;|,|\n|\bor\b)\s*/i)
    .map((variant) => normalizeAnswer(variant))
    .filter(Boolean);
}

function isCorrectAnswer(input, english) {
  const normalizedInput = normalizeAnswer(input);
  return getAcceptedAnswers(english).includes(normalizedInput);
}

function getLanguageLabel(languageCode) {
  return LANGUAGE_LABELS[languageCode] || languageCode.toUpperCase();
}

function getCurrentTranslation(card) {
  return card.translations[state.currentLanguage] || "";
}

function clearAdvanceTimer() {
  if (state.advanceTimerId !== null) {
    window.clearTimeout(state.advanceTimerId);
    state.advanceTimerId = null;
  }
}

function shuffleCards(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function getPlayableCards() {
  return state.cards.filter((card) => getCurrentTranslation(card));
}

function getMasteredCards() {
  return state.activeCards.filter((card) => card.correctCount >= state.repeatCount);
}

function getDifficultCards() {
  return state.activeCards.filter((card) => state.difficultCardIds.has(card.id));
}

function buildRound(cards, previousCardId = null) {
  const round = shuffleCards(cards);

  if (previousCardId && round.length > 1 && round[0].id === previousCardId) {
    const swapIndex = round.findIndex((card) => card.id !== previousCardId);
    if (swapIndex > 0) {
      [round[0], round[swapIndex]] = [round[swapIndex], round[0]];
    }
  }

  return round;
}

function buildQueue(cards) {
  const queue = [];
  let previousCardId = null;

  for (let roundIndex = 0; roundIndex < state.repeatCount; roundIndex += 1) {
    const round = buildRound(cards, previousCardId);
    queue.push(...round);
    previousCardId = round.length > 0 ? round[round.length - 1].id : previousCardId;
  }

  return queue;
}

function setFeedback(message, type = "") {
  elements.feedbackText.textContent = message;
  elements.feedbackText.className = "feedback";

  if (type) {
    elements.feedbackText.classList.add(type);
  }
}

function updateProgress() {
  const totalTarget = state.activeCards.length * state.repeatCount;
  const totalWins = state.activeCards.reduce((sum, card) => sum + card.correctCount, 0);
  const mastered = getMasteredCards().length;
  const progressPercent = totalTarget === 0 ? 0 : (totalWins / totalTarget) * 100;

  elements.overallProgress.textContent = `${totalWins} / ${totalTarget}`;
  elements.masteredProgress.textContent = `${mastered} / ${state.activeCards.length}`;
  elements.progressFill.style.width = `${progressPercent}%`;

  if (state.currentCard) {
    elements.cardProgress.textContent = `Schon richtig gelöst: ${state.currentCard.correctCount} / ${state.repeatCount}`;
  }
}

function focusInput() {
  window.requestAnimationFrame(() => {
    elements.answerInput.focus();
  });
}

function showGame() {
  elements.loadingState.classList.add("hidden");
  elements.errorState.classList.add("hidden");
  elements.completeState.classList.add("hidden");
  elements.gameState.classList.remove("hidden");
}

function renderCompletionState() {
  const difficultCards = getDifficultCards();
  const repeatText = state.repeatCount === 1 ? "1 Mal" : `${state.repeatCount} Mal`;

  elements.completeMessage.textContent = `Du hast alle Wörter ${repeatText} richtig beantwortet.`;

  if (difficultCards.length === 0) {
    elements.difficultSummary.textContent = "Super! Alle Wörter waren immer sofort richtig.";
    elements.difficultList.innerHTML = "";
    elements.difficultList.classList.add("hidden");
    elements.difficultButton.classList.add("hidden");
    return;
  }

  if (difficultCards.length === 1) {
    elements.difficultSummary.textContent = "1 schwieriges Wort war nicht gleich beim ersten Versuch richtig.";
  } else {
    elements.difficultSummary.textContent = `${difficultCards.length} schwierige Wörter waren nicht gleich beim ersten Versuch richtig.`;
  }
  elements.difficultList.innerHTML = "";

  difficultCards.forEach((card) => {
    const item = document.createElement("li");
    item.textContent = card.german;
    elements.difficultList.appendChild(item);
  });

  elements.difficultList.classList.remove("hidden");
  elements.difficultButton.classList.remove("hidden");
}

function showCompletion() {
  clearAdvanceTimer();
  state.currentMode = "complete";
  state.currentCard = null;
  elements.gameState.classList.add("hidden");
  elements.completeState.classList.remove("hidden");
  setFeedback("");
  updateProgress();
  renderCompletionState();
}

function presentCard(card) {
  clearAdvanceTimer();
  state.currentCard = card;
  state.currentMode = "answering";
  state.currentAttemptHadMistake = false;

  elements.germanWord.textContent = card.german;
  elements.answerInput.value = "";
  elements.answerInput.disabled = false;
  elements.answerInput.readOnly = false;
  elements.submitButton.disabled = false;
  elements.submitButton.textContent = "Prüfen";
  setFeedback("");
  updateProgress();
  showGame();
  focusInput();
}

function moveToNextCard() {
  const nextCard = state.cardQueue.shift() || null;

  if (!nextCard) {
    showCompletion();
    return;
  }

  presentCard(nextCard);
}

function startGame(cards = getPlayableCards()) {
  clearAdvanceTimer();
  state.activeCards = [...cards];
  state.currentCard = null;
  state.currentAttemptHadMistake = false;
  state.difficultCardIds = new Set();

  state.activeCards.forEach((card) => {
    card.correctCount = 0;
  });

  state.cardQueue = buildQueue(state.activeCards);
  moveToNextCard();
}

function handleCorrectAnswer() {
  state.currentCard.correctCount += 1;
  state.currentMode = "transitioning";
  elements.answerInput.value = "";
  elements.answerInput.disabled = true;
  elements.submitButton.disabled = true;
  setFeedback("Richtig!", "is-success");

  updateProgress();
  state.advanceTimerId = window.setTimeout(() => {
    state.advanceTimerId = null;
    moveToNextCard();
  }, ADVANCE_DELAY_MS);
}

function handleWrongAnswer(answer) {
  state.currentMode = "wrong-feedback";
  if (!state.currentAttemptHadMistake) {
    state.currentAttemptHadMistake = true;
    state.difficultCardIds.add(state.currentCard.id);
  }
  const enteredAnswer = answer.trim();
  const correctAnswer = getCurrentTranslation(state.currentCard);
  elements.answerInput.value = "";
  elements.answerInput.readOnly = true;
  elements.submitButton.textContent = "Weiter";
  setFeedback(
    `Falsch.\nDeine Eingabe: "${enteredAnswer}"\nRichtige Antwort: "${correctAnswer}"\nDrücke auf "Weiter", dann kannst du es noch einmal versuchen.`,
    "is-error"
  );
  focusInput();
}

function handleSubmit(event) {
  event.preventDefault();

  if (
    state.currentMode === "loading" ||
    state.currentMode === "error" ||
    state.currentMode === "transitioning"
  ) {
    return;
  }

  if (state.currentMode === "complete") {
    startGame();
    return;
  }

  if (state.currentMode === "wrong-feedback") {
    state.currentMode = "answering";
    elements.answerInput.readOnly = false;
    elements.submitButton.textContent = "Prüfen";
    setFeedback("");
    focusInput();
    return;
  }

  const answer = elements.answerInput.value;
  if (!answer.trim()) {
    setFeedback("Bitte gib zuerst eine Antwort ein.", "is-error");
    return;
  }

  if (isCorrectAnswer(answer, getCurrentTranslation(state.currentCard))) {
    handleCorrectAnswer();
    return;
  }

  handleWrongAnswer(answer);
}

function showError(message) {
  clearAdvanceTimer();
  state.currentMode = "error";
  elements.loadingState.classList.add("hidden");
  elements.gameState.classList.add("hidden");
  elements.completeState.classList.add("hidden");
  elements.errorState.classList.remove("hidden");
  elements.errorMessage.textContent = message;
}

function updateLanguageCopy() {
  elements.promptLabel.textContent = "Was ist die Antwort?";
  elements.answerLabel.textContent = "Deine Antwort";
}

function applyRepeatCount(value) {
  const parsed = Number.parseInt(value, 10);
  const safeValue = Number.isFinite(parsed) ? Math.min(25, Math.max(1, parsed)) : 5;
  state.repeatCount = safeValue;
  elements.repeatCount.value = String(safeValue);

  if (state.cards.length > 0 && state.currentMode !== "loading" && state.currentMode !== "error") {
    startGame();
  }
}

function renderLanguagePicker(languages) {
  if (languages.length <= 1) {
    elements.languagePicker.classList.add("hidden");
    return;
  }

  elements.languagePicker.classList.remove("hidden");
  elements.languageButtons.innerHTML = "";

  languages.forEach((languageCode) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "language-button";
    button.textContent = getLanguageLabel(languageCode);

    if (languageCode === state.currentLanguage) {
      button.classList.add("is-active");
    }

    button.addEventListener("click", () => {
      if (state.currentLanguage === languageCode) {
        return;
      }

      state.currentLanguage = languageCode;
      renderLanguagePicker(languages);
      updateLanguageCopy();
      startGame();
    });

    elements.languageButtons.appendChild(button);
  });
}

async function loadVocabulary() {
  try {
    const response = await fetch("./vocabulary.json");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Failed to load vocabulary.");
    }

    const items = payload.items || [];
    const languages = Array.isArray(payload.languages) ? payload.languages : ["en"];

    if (items.length === 0) {
      throw new Error("In der Datei vocabulary.json wurden keine Wörter gefunden.");
    }

    state.cards = items.map((item, index) => ({
      id: `${index}-${item.german}`,
      german: item.german,
      translations: item.translations || {},
      correctCount: 0,
    }));
    state.currentLanguage = languages.includes("en") ? "en" : languages[0];
    state.activeCards = getPlayableCards();

    renderLanguagePicker(languages);
    updateLanguageCopy();
    updateProgress();
    startGame();
  } catch (error) {
    showError(
      error instanceof Error
        ? `${error.message} Wenn du voci.xlsx geändert hast, führe vorher build_vocabulary.py aus.`
        : "Die Wörter konnten nicht geladen werden."
    );
  }
}

elements.answerForm.addEventListener("submit", handleSubmit);
elements.restartButton.addEventListener("click", startGame);
elements.difficultButton.addEventListener("click", () => {
  startGame(getDifficultCards());
});
elements.repeatCount.addEventListener("change", (event) => {
  applyRepeatCount(event.target.value);
});
elements.repeatCount.addEventListener("blur", (event) => {
  applyRepeatCount(event.target.value);
});

loadVocabulary();
