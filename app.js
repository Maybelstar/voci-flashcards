const GOAL_PER_CARD = 5;

const state = {
  cards: [],
  cardDeck: [],
  currentCard: null,
  currentMode: "loading",
  missedThisRound: false,
  lastCardId: null,
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

function shuffleCards(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function getIncompleteCards() {
  return state.cards.filter((card) => card.firstTrySuccesses < GOAL_PER_CARD);
}

function getMasteredCards() {
  return state.cards.filter((card) => card.firstTrySuccesses >= GOAL_PER_CARD);
}

function buildDeck(cards) {
  const deck = shuffleCards(cards);

  if (deck.length > 1 && deck[0].id === state.lastCardId) {
    const swapIndex = deck.findIndex((card) => card.id !== state.lastCardId);
    [deck[0], deck[swapIndex]] = [deck[swapIndex], deck[0]];
  }

  return deck;
}

function drawNextCard() {
  const incompleteCards = getIncompleteCards();

  if (incompleteCards.length === 0) {
    return null;
  }

  if (state.cardDeck.length === 0) {
    state.cardDeck = buildDeck(incompleteCards);
  }

  while (state.cardDeck.length > 0) {
    const nextCard = state.cardDeck.shift();

    if (!nextCard || nextCard.firstTrySuccesses >= GOAL_PER_CARD) {
      continue;
    }

    if (nextCard.id === state.lastCardId && incompleteCards.length > 1) {
      state.cardDeck = buildDeck(incompleteCards);
      continue;
    }

    return nextCard;
  }

  state.cardDeck = buildDeck(incompleteCards);
  return state.cardDeck.shift() || null;
}

function setFeedback(message, type = "") {
  elements.feedbackText.textContent = message;
  elements.feedbackText.className = "feedback";

  if (type) {
    elements.feedbackText.classList.add(type);
  }
}

function updateProgress() {
  const totalTarget = state.cards.length * GOAL_PER_CARD;
  const totalWins = state.cards.reduce((sum, card) => sum + card.firstTrySuccesses, 0);
  const mastered = getMasteredCards().length;
  const progressPercent = totalTarget === 0 ? 0 : (totalWins / totalTarget) * 100;

  elements.overallProgress.textContent = `${totalWins} / ${totalTarget}`;
  elements.masteredProgress.textContent = `${mastered} / ${state.cards.length}`;
  elements.progressFill.style.width = `${progressPercent}%`;

  if (state.currentCard) {
    elements.cardProgress.textContent = `First-try wins: ${state.currentCard.firstTrySuccesses} / ${GOAL_PER_CARD}`;
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

function showCompletion() {
  state.currentMode = "complete";
  state.currentCard = null;
  elements.gameState.classList.add("hidden");
  elements.completeState.classList.remove("hidden");
  setFeedback("");
  updateProgress();
}

function presentCard(card) {
  state.currentCard = card;
  state.currentMode = "answering";
  state.missedThisRound = false;
  state.lastCardId = card.id;

  elements.germanWord.textContent = card.german;
  elements.answerInput.value = "";
  elements.answerInput.disabled = false;
  elements.submitButton.textContent = "Check answer";
  setFeedback("");
  updateProgress();
  showGame();
  focusInput();
}

function moveToNextCard() {
  const nextCard = drawNextCard();

  if (!nextCard) {
    showCompletion();
    return;
  }

  presentCard(nextCard);
}

function startGame() {
  state.cards.forEach((card) => {
    card.firstTrySuccesses = 0;
  });
  state.cardDeck = [];
  state.lastCardId = null;
  moveToNextCard();
}

function handleCorrectAnswer() {
  const currentCard = state.currentCard;

  if (!state.missedThisRound) {
    currentCard.firstTrySuccesses += 1;
  }

  state.currentMode = "correct-feedback";
  elements.answerInput.value = "";
  elements.submitButton.textContent = "Next word";

  if (currentCard.firstTrySuccesses >= GOAL_PER_CARD) {
    setFeedback(`Correct! "${currentCard.german}" is mastered. Press Enter for the next word.`, "is-success");
  } else if (state.missedThisRound) {
    setFeedback(`Correct. Press Enter for a new word.`, "is-success");
  } else {
    setFeedback(`Correct on the first try! Press Enter for the next word.`, "is-success");
  }

  updateProgress();
}

function handleWrongAnswer() {
  state.missedThisRound = true;
  state.currentMode = "wrong-feedback";
  elements.answerInput.value = "";
  elements.submitButton.textContent = "Try again";
  setFeedback(`Not quite. The correct answer is "${state.currentCard.english}". Press Enter, then type it again.`, "is-error");
}

function handleSubmit(event) {
  event.preventDefault();

  if (state.currentMode === "loading" || state.currentMode === "error") {
    return;
  }

  if (state.currentMode === "complete") {
    startGame();
    return;
  }

  if (state.currentMode === "wrong-feedback") {
    state.currentMode = "answering";
    elements.submitButton.textContent = "Check answer";
    setFeedback(`Type the correct answer for "${state.currentCard.german}".`);
    focusInput();
    return;
  }

  if (state.currentMode === "correct-feedback") {
    moveToNextCard();
    return;
  }

  const answer = elements.answerInput.value;
  if (!answer.trim()) {
    setFeedback("Please type an answer first.", "is-error");
    return;
  }

  if (isCorrectAnswer(answer, state.currentCard.english)) {
    handleCorrectAnswer();
    return;
  }

  handleWrongAnswer();
}

function showError(message) {
  state.currentMode = "error";
  elements.loadingState.classList.add("hidden");
  elements.gameState.classList.add("hidden");
  elements.completeState.classList.add("hidden");
  elements.errorState.classList.remove("hidden");
  elements.errorMessage.textContent = message;
}

async function loadVocabulary() {
  try {
    const response = await fetch("./vocabulary.json");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Failed to load vocabulary.");
    }

    const items = payload.items || [];

    if (items.length === 0) {
      throw new Error("No vocabulary entries were found in vocabulary.json.");
    }

    state.cards = items.map((item, index) => ({
      id: `${index}-${item.german}-${item.english}`,
      german: item.german,
      english: item.english,
      firstTrySuccesses: 0,
    }));

    updateProgress();
    startGame();
  } catch (error) {
    showError(
      error instanceof Error
        ? `${error.message} If you updated voci.xlsx, run build_vocabulary.py before publishing.`
        : "Failed to load vocabulary."
    );
  }
}

elements.answerForm.addEventListener("submit", handleSubmit);
elements.restartButton.addEventListener("click", startGame);

loadVocabulary();
