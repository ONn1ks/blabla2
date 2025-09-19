const SITES = ["IMDb", "Кинопоиск", "Rotten Tomatoes"];

const curatedLibrary = {
  "интерстеллар": {
    sites: {
      "IMDb": 8.7,
      "Кинопоиск": 8.6,
      "Rotten Tomatoes": 8.2,
    },
    overview:
      "Фильм Кристофера Нолана собрал восторженные отзывы критиков и зрителей."
  },
  "во все тяжкие": {
    sites: {
      "IMDb": 9.5,
      "Кинопоиск": 8.9,
      "Rotten Tomatoes": 9.6,
    },
    overview: "Один из самых высокооценённых сериалов последнего десятилетия."
  },
  "игра престолов": {
    sites: {
      "IMDb": 9.2,
      "Кинопоиск": 8.9,
      "Rotten Tomatoes": 8.5,
    },
    overview:
      "Эпическая сага, которая удерживала внимание миллионов зрителей по всему миру."
  },
  "темный рыцарь": {
    sites: {
      "IMDb": 9.0,
      "Кинопоиск": 8.5,
      "Rotten Tomatoes": 9.4,
    },
    overview:
      "Классика супергеройского кино с блистательной игрой Хита Леджера."
  },
  "чернобыль": {
    sites: {
      "IMDb": 9.4,
      "Кинопоиск": 9.0,
      "Rotten Tomatoes": 9.6,
    },
    overview:
      "Мини-сериал HBO, который считается образцом серьёзной исторической драмы."
  },
  "мстители финал": {
    sites: {
      "IMDb": 8.4,
      "Кинопоиск": 7.6,
      "Rotten Tomatoes": 8.9,
    },
    overview:
      "Финал саги о Мстителях получил уверенно высокие оценки критиков и фанатов."
  }
};

const titleInput = document.getElementById("titleInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const resultsSection = document.getElementById("results");
const emptyState = document.getElementById("emptyState");
const ratingCards = document.getElementById("ratingCards");
const averageScore = document.getElementById("averageScore");
const verdictEl = document.getElementById("verdict");
const summaryDescription = document.getElementById("summaryDescription");

function normalizeTitle(title) {
  return title.trim().toLowerCase();
}

function hashTitle(title) {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash << 5) - hash + title.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function generateSyntheticRatings(title) {
  const hash = hashTitle(title);
  return SITES.map((site, index) => {
    const base = 6 + (((hash >> (index * 3)) & 31) / 10);
    const signal =
      (Math.sin(hash * (index + 1)) + Math.cos(hash / (index + 1 || 1))) * 0.55;
    const adjustment = ((hash % (7 + index * 3)) - (3 + index)) * 0.1;
    const rawScore = base + signal + adjustment - 0.6;
    const score = Math.max(0, Math.min(10, Number(rawScore.toFixed(1))));
    return { site, score };
  });
}

function getCardComment(score) {
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

function buildSummary({ isCurated, title, average }) {
  if (isCurated) {
    return `Тайтл «${title}» есть в нашей базе избранных и уверенно держит средний балл ${average}.`;
  }
  return `Мы не нашли «${title}» в каталоге, поэтому рассчитали рейтинги алгоритмически — ориентируйтесь на них как на предварительную подсказку.`;
}

function analyzeTitle(title) {
  const normalized = normalizeTitle(title);
  const curated = curatedLibrary[normalized];

  let ratings;
  let overview = "";
  let isCurated = false;

  if (curated) {
    ratings = SITES.map((site) => ({
      site,
      score: Number(curated.sites[site].toFixed(1))
    }));
    overview = curated.overview;
    isCurated = true;
  } else {
    ratings = generateSyntheticRatings(normalized);
  }

  const averageRaw =
    ratings.reduce((total, item) => total + item.score, 0) / ratings.length;
  const average = Number(averageRaw.toFixed(1));

  return {
    ratings,
    average,
    overview,
    isCurated,
  };
}

function renderRatings(ratings) {
  ratingCards.innerHTML = "";
  ratings.forEach(({ site, score }) => {
    const card = document.createElement("article");
    card.className = "card";

    const header = document.createElement("div");
    header.className = "card-header";

    const title = document.createElement("span");
    title.className = "card-title";
    title.textContent = site;

    const scoreElement = document.createElement("span");
    scoreElement.className = "card-score";
    scoreElement.textContent = score.toFixed(1);

    header.append(title, scoreElement);

    const trend = document.createElement("span");
    trend.className = "card-trend";
    trend.textContent = getCardComment(score);

    card.append(header, trend);
    ratingCards.append(card);
  });
}

function updateVerdict(average) {
  verdictEl.classList.remove("positive", "negative");
  if (average >= 7) {
    verdictEl.textContent = "Смотреть";
    verdictEl.classList.add("positive");
  } else {
    verdictEl.textContent = "Не смотреть";
    verdictEl.classList.add("negative");
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

function handleAnalyze() {
  const rawTitle = titleInput.value.trim();

  if (!rawTitle) {
    titleInput.classList.add("input-error");
    titleInput.focus();
    showEmptyState();
    return;
  }

  titleInput.classList.remove("input-error");

  const analysis = analyzeTitle(rawTitle);
  const decoratedTitle = rawTitle.replace(/\S+/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );

  renderRatings(analysis.ratings);
  averageScore.textContent = analysis.average.toFixed(1);
  summaryDescription.textContent = buildSummary({
    isCurated: analysis.isCurated,
    title: decoratedTitle,
    average: analysis.average.toFixed(1),
  });

  if (analysis.overview) {
    summaryDescription.textContent += ` ${analysis.overview}`;
  }

  updateVerdict(analysis.average);
  showResults();
}

analyzeBtn.addEventListener("click", handleAnalyze);

titleInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleAnalyze();
  }
});

showEmptyState();
