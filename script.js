const curatedLibrary = {
  "интерстеллар": {
    overview:
      "Фильм Кристофера Нолана собрал восторженные отзывы критиков и зрителей."
  },
  "во все тяжкие": {
    overview: "Один из самых высокооценённых сериалов последнего десятилетия."
  },
  "игра престолов": {
    overview:
      "Эпическая сага, которая удерживала внимание миллионов зрителей по всему миру."
  },
  "темный рыцарь": {
    overview: "Классика супергеройского кино с блистательной игрой Хита Леджера."
  },
  "чернобыль": {
    overview:
      "Мини-сериал HBO, который считается образцом серьёзной исторической драмы."
  },
  "мстители финал": {
    overview:
      "Финал саги о Мстителях получил уверенно высокие оценки критиков и фанатов."
  }
};

const SOURCE_CONFIG = [
  { id: "Internet Movie Database", label: "IMDb" },
  { id: "Rotten Tomatoes", label: "Rotten Tomatoes" },
  { id: "Metacritic", label: "Metacritic" }
];

const TYPE_SUMMARY_LABEL = {
  movie: "фильма",
  series: "сериала",
  episode: "эпизода"
};

const API_STORAGE_KEY = "cinema-advisor.omdb-key";
const OMDB_ENDPOINT = "https://www.omdbapi.com/";

const titleInput = document.getElementById("titleInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const resultsSection = document.getElementById("results");
const emptyState = document.getElementById("emptyState");
const ratingCards = document.getElementById("ratingCards");
const averageScore = document.getElementById("averageScore");
const verdictEl = document.getElementById("verdict");
const summaryDescription = document.getElementById("summaryDescription");
const statusMessage = document.getElementById("statusMessage");
const apiSettings = document.getElementById("apiSettings");
const apiKeyInput = document.getElementById("apiKeyInput");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const clearKeyBtn = document.getElementById("clearKeyBtn");

const analyzeButtonDefaultLabel = analyzeBtn.textContent;

function normalizeTitle(title) {
  return title.trim().toLowerCase();
}

function decorateTitle(title) {
  return title.replace(/\S+/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );
}

function getStoredApiKey() {
  try {
    return localStorage.getItem(API_STORAGE_KEY) || "";
  } catch (error) {
    console.warn("Не удалось прочитать ключ из localStorage", error);
    return "";
  }
}

function persistApiKey(value) {
  try {
    if (value) {
      localStorage.setItem(API_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(API_STORAGE_KEY);
    }
    return true;
  } catch (error) {
    console.warn("Не удалось сохранить ключ OMDb", error);
    return false;
  }
}

function loadStoredApiKey() {
  const stored = getStoredApiKey();
  if (stored && apiKeyInput) {
    apiKeyInput.value = stored;
    if (apiSettings && typeof apiSettings.open === "boolean") {
      apiSettings.open = true;
    }
  }
}

function getActiveApiKey() {
  if (apiKeyInput && apiKeyInput.value.trim()) {
    return apiKeyInput.value.trim();
  }
  return getStoredApiKey();
}

function setLoadingState(isLoading) {
  analyzeBtn.disabled = isLoading;
  analyzeBtn.setAttribute("aria-busy", isLoading ? "true" : "false");
  analyzeBtn.textContent = isLoading ? "Ищем рейтинги..." : analyzeButtonDefaultLabel;
}

function clearStatus() {
  if (!statusMessage) {
    return;
  }
  statusMessage.hidden = true;
  statusMessage.textContent = "";
  statusMessage.classList.remove(
    "status-message--error",
    "status-message--success",
    "status-message--info"
  );
  statusMessage.setAttribute("role", "status");
}

function showStatus(message, tone = "info") {
  if (!statusMessage) {
    return;
  }
  if (!message) {
    clearStatus();
    return;
  }

  statusMessage.hidden = false;
  statusMessage.textContent = message;
  statusMessage.classList.remove(
    "status-message--error",
    "status-message--success",
    "status-message--info"
  );
  statusMessage.classList.add(`status-message--${tone}`);
  statusMessage.setAttribute("role", tone === "error" ? "alert" : "status");
}

function formatSourceList(sources) {
  if (!sources.length) {
    return "";
  }
  if (sources.length === 1) {
    return sources[0];
  }
  const last = sources[sources.length - 1];
  const start = sources.slice(0, -1).join(", ");
  return `${start} и ${last}`;
}

function normalizeRatingValue(rawValue) {
  if (!rawValue || typeof rawValue !== "string") {
    return null;
  }

  const percentMatch = rawValue.match(/^(\d+(?:\.\d+)?)%$/);
  if (percentMatch) {
    const percent = Number.parseFloat(percentMatch[1]);
    if (!Number.isNaN(percent)) {
      return Number((percent / 10).toFixed(1));
    }
  }

  const fractionMatch = rawValue.match(
    /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/
  );
  if (fractionMatch) {
    const numerator = Number.parseFloat(fractionMatch[1]);
    const denominator = Number.parseFloat(fractionMatch[2]);
    if (!Number.isNaN(numerator) && !Number.isNaN(denominator) && denominator !== 0) {
      return Number(((numerator / denominator) * 10).toFixed(1));
    }
  }

  const numeric = Number.parseFloat(rawValue);
  if (!Number.isNaN(numeric)) {
    const scaled = numeric > 10 ? numeric / 10 : numeric;
    return Number(scaled.toFixed(1));
  }

  return null;
}

function buildRatingsFromPayload(payload) {
  const ratings = Array.isArray(payload?.Ratings) ? payload.Ratings : [];
  return SOURCE_CONFIG.map(({ id, label }) => {
    const entry = ratings.find((item) => item.Source === id);
    const rawValue = entry?.Value || null;
    const score = normalizeRatingValue(rawValue);
    return {
      site: label,
      rawValue,
      score
    };
  });
}

function computeAverage(ratings) {
  const numericRatings = ratings.filter((item) => typeof item.score === "number");
  if (!numericRatings.length) {
    return null;
  }
  const total = numericRatings.reduce((sum, item) => sum + item.score, 0);
  return Number((total / numericRatings.length).toFixed(1));
}

function buildSummary({ metadata, average, availableSources, missingSources, curatedOverview }) {
  const pieces = [];
  const typeLabel = TYPE_SUMMARY_LABEL[metadata.type] || "тайтла";
  const yearFragment = metadata.year ? ` (${metadata.year})` : "";
  const titleFragment = `«${metadata.title}»${yearFragment}`;

  if (average !== null) {
    const sourcesText = availableSources.length
      ? `по данным ${formatSourceList(availableSources)}`
      : "по доступным данным";
    pieces.push(`Средний балл для ${typeLabel} ${titleFragment} — ${average.toFixed(1)} ${sourcesText}.`);
  } else {
    pieces.push(`OMDb пока не публикует оценки для ${typeLabel} ${titleFragment}.`);
  }

  if (missingSources.length && availableSources.length) {
    pieces.push(`Нет данных от ${formatSourceList(missingSources)}.`);
  } else if (missingSources.length === SOURCE_CONFIG.length) {
    pieces.push("Попробуйте уточнить запрос или проверить позже — рейтинги ещё не загружены.");
  }

  if (curatedOverview) {
    pieces.push(curatedOverview);
  }

  return pieces.join(" ");
}

async function queryOmdb(params, apiKey) {
  const url = new URL(OMDB_ENDPOINT);
  url.searchParams.set("apikey", apiKey);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  let response;
  try {
    response = await fetch(url.toString());
  } catch (error) {
    const networkError = new Error("Не удалось подключиться к OMDb. Проверьте соединение.");
    networkError.code = "NETWORK";
    throw networkError;
  }

  if (!response.ok) {
    const serverError = new Error("OMDb временно недоступен. Попробуйте позже.");
    serverError.code = "SERVER";
    throw serverError;
  }

  return response.json();
}

async function fetchOmdbEntry(title, apiKey) {
  if (!apiKey) {
    const error = new Error("Добавьте ключ OMDb ниже, чтобы загружать реальные рейтинги.");
    error.code = "NO_API_KEY";
    throw error;
  }

  const exactMatch = await queryOmdb({ t: title, plot: "short" }, apiKey);
  if (exactMatch.Response !== "False") {
    return exactMatch;
  }

  const errorText = (exactMatch.Error || "").toLowerCase();
  if (errorText.includes("invalid api key")) {
    const error = new Error("Неверный ключ OMDb. Проверьте ввод или запросите новый на omdbapi.com.");
    error.code = "INVALID_KEY";
    throw error;
  }

  if (errorText.includes("no api key")) {
    const error = new Error("Сервис OMDb требует ключ API. Добавьте его в настройках ниже.");
    error.code = "NO_API_KEY";
    throw error;
  }

  const searchResult = await queryOmdb({ s: title, page: "1" }, apiKey);
  if (searchResult.Response === "True" && Array.isArray(searchResult.Search) && searchResult.Search.length) {
    const bestMatch = searchResult.Search[0];
    const byId = await queryOmdb({ i: bestMatch.imdbID, plot: "short" }, apiKey);
    if (byId.Response !== "False") {
      return byId;
    }
  }

  const notFound = new Error(
    exactMatch.Error || "Не удалось найти тайтл. Попробуйте уточнить название или добавить год выпуска."
  );
  notFound.code = "NOT_FOUND";
  throw notFound;
}

async function analyzeTitle(rawTitle) {
  const normalized = normalizeTitle(rawTitle);
  const decorated = decorateTitle(rawTitle);
  const curated = curatedLibrary[normalized];
  const apiKey = getActiveApiKey() || "";

  const payload = await fetchOmdbEntry(rawTitle, apiKey.trim());
  const displayTitle = payload.Title && payload.Title !== "N/A" ? payload.Title : decorated;
  const ratings = buildRatingsFromPayload(payload);
  const average = computeAverage(ratings);

  const availableSources = ratings
    .filter((item) => typeof item.score === "number")
    .map((item) => item.site);
  const missingSources = ratings
    .filter((item) => typeof item.score !== "number")
    .map((item) => item.site);

  const metadata = {
    title: displayTitle,
    year: payload.Year && payload.Year !== "N/A" ? payload.Year : "",
    type: payload.Type && payload.Type !== "N/A" ? payload.Type : ""
  };

  return {
    ratings,
    average,
    availableSources,
    missingSources,
    curatedOverview: curated?.overview || "",
    metadata
  };
}

function getCardComment(score) {
  if (typeof score !== "number") {
    return "нет данных";
  }
  if (score >= 8.5) {
    return "восторг аудитории";
  }
  if (score >= 7) {
    return "положительные отзывы";
  }
  if (score >= 5.5) {
    return "смешанные оценки";
  }
  return "много критики";
}

function renderRatings(ratings) {
  ratingCards.innerHTML = "";
  ratings.forEach(({ site, score, rawValue }) => {
    const card = document.createElement("article");
    card.className = "card";

    const header = document.createElement("div");
    header.className = "card-header";

    const title = document.createElement("span");
    title.className = "card-title";
    title.textContent = site;

    const scoreElement = document.createElement("span");
    scoreElement.className = "card-score";
    scoreElement.textContent = typeof score === "number" ? score.toFixed(1) : "—";
    scoreElement.title = rawValue ? `Исходная оценка: ${rawValue}` : "Нет данных";

    header.append(title, scoreElement);

    const trend = document.createElement("span");
    trend.className = "card-trend";
    const comment = getCardComment(score);
    if (rawValue && typeof score === "number") {
      trend.textContent = `${comment} · ${rawValue}`;
    } else if (rawValue) {
      trend.textContent = `Формат оценки: ${rawValue}`;
    } else {
      trend.textContent = comment;
    }

    card.append(header, trend);
    ratingCards.append(card);
  });
}

function updateVerdict(average) {
  verdictEl.classList.remove("positive", "negative");
  if (typeof average === "number") {
    if (average >= 7) {
      verdictEl.textContent = "Смотреть";
      verdictEl.classList.add("positive");
    } else {
      verdictEl.textContent = "Не смотреть";
      verdictEl.classList.add("negative");
    }
  } else {
    verdictEl.textContent = "Недостаточно данных";
  }
}

function showResults() {
  resultsSection.hidden = false;
  emptyState.hidden = true;
}

function showEmptyState() {
  resultsSection.hidden = true;
  emptyState.hidden = false;
}

async function handleAnalyze() {
  const rawTitle = titleInput.value.trim();

  if (!rawTitle) {
    titleInput.classList.add("input-error");
    titleInput.focus();
    showEmptyState();
    return;
  }

  titleInput.classList.remove("input-error");
  clearStatus();
  setLoadingState(true);

  try {
    const analysis = await analyzeTitle(rawTitle);

    renderRatings(analysis.ratings);
    averageScore.textContent =
      typeof analysis.average === "number" ? analysis.average.toFixed(1) : "—";
    summaryDescription.textContent = buildSummary({
      metadata: analysis.metadata,
      average: analysis.average,
      availableSources: analysis.availableSources,
      missingSources: analysis.missingSources,
      curatedOverview: analysis.curatedOverview
    });

    updateVerdict(analysis.average);
    showResults();

    if (analysis.missingSources.length && analysis.availableSources.length) {
      showStatus(`Нет данных от: ${formatSourceList(analysis.missingSources)}.`, "info");
    } else if (!analysis.availableSources.length) {
      showStatus("Рейтинги по этому названию пока не найдены в OMDb.", "info");
    } else {
      clearStatus();
    }
  } catch (error) {
    if (error.code === "NO_API_KEY") {
      showStatus("Добавьте ключ OMDb в настройках ниже, чтобы загружать оценки.", "error");
    } else if (error.code === "INVALID_KEY") {
      showStatus(error.message, "error");
    } else if (error.code === "NOT_FOUND") {
      showStatus(error.message, "error");
    } else {
      showStatus(error.message || "Не удалось получить данные. Попробуйте ещё раз позже.", "error");
    }
    showEmptyState();
  } finally {
    setLoadingState(false);
  }
}

analyzeBtn.addEventListener("click", handleAnalyze);

titleInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleAnalyze();
  }
});

titleInput.addEventListener("input", () => {
  if (titleInput.classList.contains("input-error")) {
    titleInput.classList.remove("input-error");
  }
});

if (saveKeyBtn) {
  saveKeyBtn.addEventListener("click", () => {
    if (!apiKeyInput) {
      showStatus("Поле для ключа не найдено.", "error");
      return;
    }

    const value = apiKeyInput.value.trim();
    if (!value) {
      showStatus("Введите ключ OMDb перед сохранением.", "error");
      return;
    }
    const saved = persistApiKey(value);
    if (saved) {
      showStatus("Ключ сохранён. Он хранится только в этом браузере.", "success");
    } else {
      showStatus("Не удалось сохранить ключ — проверьте настройки браузера.", "error");
    }
  });
}

if (clearKeyBtn) {
  clearKeyBtn.addEventListener("click", () => {
    if (!apiKeyInput) {
      showStatus("Поле для ключа не найдено.", "error");
      return;
    }
    apiKeyInput.value = "";
    persistApiKey("");
    showStatus("Сохранённый ключ удалён.", "info");
    apiKeyInput.focus();
  });
}

if (apiKeyInput) {
  apiKeyInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveKeyBtn?.click();
    }
  });
}

loadStoredApiKey();
showEmptyState();
