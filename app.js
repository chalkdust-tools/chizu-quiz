const CATEGORY_LABELS = {
  japanMap: "日本地図",
  prefectureCapitals: "都道府県庁所在地",
  regions: "地方区分",
  worldMap: "世界地図",
  worldCapitals: "世界の首都・地域",
  flags: "国旗",
};
const STORAGE_KEY = "social-map-wrong-questions-v4";

const $ = (selector) => document.querySelector(selector);
const homeScreen = $("#home-screen");
const setupScreen = $("#setup-screen");
const quizScreen = $("#quiz-screen");
const resultScreen = $("#result-screen");
const printSetupScreen = $("#print-setup-screen");
const worksheetScreen = $("#worksheet-screen");
const startButton = $("#start-button");
const retryButton = $("#retry-button");
const homeButton = $("#home-button");
const japanHighlightMapElement = $("#japan-highlight-map");
const worldMapElement = $("#world-map");
let worldMapSvgMarkup = "";
const japanMapReady = Promise.resolve()
  .then(() => {
    const svg = window.INLINE_MAPS?.japan;
    if (!svg) throw new Error("日本地図を読み込めませんでした。");
    japanHighlightMapElement.innerHTML = svg;
    const mapSvg = japanHighlightMapElement.querySelector("svg");
    mapSvg?.setAttribute("preserveAspectRatio", "xMidYMid meet");
    if (mapSvg) mapSvg.dataset.fullViewBox = mapSvg.getAttribute("viewBox") || "0 0 2000 2000";
  })
  .catch(() => {
    japanHighlightMapElement.textContent = "日本地図を読み込めませんでした。";
  });
const worldMapReady = Promise.resolve()
  .then(() => {
    const svg = window.INLINE_MAPS?.world;
    if (!svg) throw new Error("世界地図を読み込めませんでした。");
    worldMapSvgMarkup = svg;
    worldMapElement.innerHTML = svg;
    const mapSvg = worldMapElement.querySelector("svg");
    if (mapSvg && !mapSvg.hasAttribute("viewBox")) {
      mapSvg.setAttribute("viewBox", `0 0 ${mapSvg.getAttribute("width")} ${mapSvg.getAttribute("height")}`);
    }
    mapSvg?.setAttribute("preserveAspectRatio", "xMidYMid meet");
    if (mapSvg) mapSvg.dataset.fullViewBox = mapSvg.getAttribute("viewBox");
  })
  .catch(() => {
    worldMapElement.textContent = "世界地図を読み込めませんでした。";
  });

let questions = [];
let currentIndex = 0;
let answers = [];
let locked = false;
let courseMode = "10";
let lastCourseConfig = null;
let retryKeys = new Set();
let worksheetVersion = 0;
let printMode = "japan";
const selectedWorldPrintRegions = new Set(["世界全体"]);
const JAPAN_PRINT_REGION_COLORS = [
  { fill: "#f7bd78", stroke: "#9b4b16" },
  { fill: "#8fd3c7", stroke: "#176b63" },
  { fill: "#a9c4eb", stroke: "#355f9b" },
];
const PRINT_REGION_MARKS = ["A", "B", "C"];

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sample(items, count = 1) {
  return shuffle(items).slice(0, count);
}

function naturalChoices(answer, preferredCandidates, allCandidates, size = 4) {
  const preferred = shuffle([...new Set(preferredCandidates)].filter((item) => item !== answer));
  const fallback = shuffle([...new Set(allCandidates)].filter((item) => item !== answer && !preferred.includes(item)));
  return shuffle([answer, ...preferred, ...fallback].slice(0, size));
}

function confusableRegions(region, table, allRegions) {
  return [...new Set([...(table[region] || []), ...allRegions.filter((item) => item !== region)])];
}

function confusableEntities(entity, entities, regionTable, count = 3) {
  const preferredRegions = regionTable[entity.region] || [];
  const preferred = entities.filter((item) => item !== entity && (item.region === entity.region || preferredRegions.includes(item.region)));
  const fallback = entities.filter((item) => item !== entity && !preferred.includes(item));
  return [...sample(preferred, count), ...sample(fallback, count)].slice(0, count);
}

function mismatchedPairs(entity, entities, labelKey, valueKey, regionTable, count = 3) {
  const pairEntities = confusableEntities(entity, entities, regionTable, count);
  const usedValues = new Set();
  return pairEntities.map((item) => {
    const donors = shuffle(entities.filter((candidate) => (
      candidate[valueKey] !== item[valueKey]
      && candidate[valueKey] !== entity[valueKey]
      && !usedValues.has(candidate[valueKey])
    )));
    const donor = donors[0] || entities.find((candidate) => candidate[valueKey] !== item[valueKey]);
    usedValues.add(donor[valueKey]);
    return `${item[labelKey]} ― ${donor[valueKey]}`;
  });
}

function paintJapanMap(container, codes, color = "#f4a261") {
  container.querySelectorAll("[data-code]").forEach((element) => {
    const selected = codes.map(String).includes(String(element.dataset.code));
    element.style.setProperty("fill", selected ? color : "#f7fafb", "important");
    element.style.setProperty("stroke", selected ? "#8f4516" : "#607783", "important");
    element.style.setProperty("stroke-width", selected ? "7" : "4", "important");
  });
}

function paintJapanPrintRegions(container, selectedPrefectures, regions) {
  const colorByRegion = new Map(regions.map((region, index) => [region, JAPAN_PRINT_REGION_COLORS[index]]));
  const selectedCodes = new Set(selectedPrefectures.map((prefecture) => prefecture.code));
  container.querySelectorAll("[data-code]").forEach((element) => {
    const prefecture = PREFECTURES.find((item) => String(item.code) === String(element.dataset.code));
    const color = prefecture && selectedCodes.has(prefecture.code) ? colorByRegion.get(prefecture.region) : null;
    element.style.setProperty("fill", color?.fill || "#f7fafb", "important");
    element.style.setProperty("stroke", color?.stroke || "#607783", "important");
    element.style.setProperty("stroke-width", color ? "6" : "4", "important");
    element.style.setProperty("vector-effect", "non-scaling-stroke", "important");
  });
}

const DIFFICULTY_LABELS = { easy: "やさしい問題", medium: "少し考える問題", think: "考える問題" };

function q({ id, scope, type, prompt, answer, choices = [], explanation, visual = null, difficulty = "easy", knowledgeKey, templateId, entityRegion, interaction = "choice" }) {
  return {
    id, scope, type, prompt, answer: String(answer), choices: choices.map(String), explanation, visual,
    difficulty, level: DIFFICULTY_LABELS[difficulty], knowledgeKey, templateId, entityRegion, interaction,
  };
}

function makeQuestion(template, entity, index) {
  const isJapan = template.kind.startsWith("jp-");
  const knowledgeKey = isJapan ? `jp:${entity.code}` : `world:${entity.id}`;
  const base = {
    id: `${template.id}-${isJapan ? entity.code : entity.id}`,
    scope: template.scope,
    type: template.type,
    difficulty: template.difficulty,
    knowledgeKey,
    templateId: template.id,
    entityRegion: entity.region,
  };

  if (isJapan) {
    const names = PREFECTURES.map((item) => item.name);
    const capitals = PREFECTURES.map((item) => item.capital);
    const codes = PREFECTURES.map((item) => String(item.code));
    const same = PREFECTURES.filter((item) => item.region === entity.region && item.code !== entity.code);
    const other = PREFECTURES.filter((item) => item.region !== entity.region);
    const nearbyRegions = JAPAN_REGION_CONFUSABLES[entity.region] || [];
    const nearby = PREFECTURES.filter((item) => nearbyRegions.includes(item.region));
    const preferredNames = [...same, ...nearby].map((item) => item.name);
    const preferredCapitals = [...same, ...nearby].map((item) => item.capital);
    const outsider = sample(nearby.length ? nearby : other)[0];
    const wrongRegion = sample(nearbyRegions.length ? nearbyRegions : JAPAN_REGIONS.filter((region) => region !== entity.region))[0];
    const wrongCapital = sample((same.length ? same : other).filter((item) => item.capital !== entity.capital))[0].capital;
    const trueStatement = Math.random() < 0.55;
    const shownRegion = trueStatement ? entity.region : wrongRegion;
    const shownCapital = trueStatement ? entity.capital : wrongCapital;
    const nearbyCodes = PREFECTURES
      .filter((item) => item.code !== entity.code && (item.region === entity.region || Math.abs(item.code - entity.code) <= 5))
      .map((item) => String(item.code));

    switch (template.kind) {
      case "jp-highlight-name": return q({ ...base, prompt: "地図で色がついている都道府県は？", answer: entity.name, choices: naturalChoices(entity.name, preferredNames, names), explanation: `${entity.name}は${entity.region}地方。`, visual: { kind: "japanHighlight", codes: [entity.code] } });
      case "jp-click-location": return q({ ...base, prompt: `${entity.name}を地図で押してください。`, answer: entity.name, explanation: `${entity.name}は${entity.region}地方。`, visual: { kind: "japanClick", region: entity.region }, interaction: "japanMapClick" });
      case "jp-number-name": return q({ ...base, prompt: `地図の「${entity.code}」はどの都道府県？`, answer: entity.name, choices: naturalChoices(entity.name, preferredNames, names), explanation: `${entity.code}番は${entity.name}。`, visual: { kind: "japanNumbered" } });
      case "jp-name-number": return q({ ...base, prompt: `${entity.name}は地図の何番？`, answer: entity.code, choices: naturalChoices(String(entity.code), nearbyCodes, codes), explanation: `${entity.name}は${entity.code}番。`, visual: { kind: "japanNumbered" } });
      case "jp-region-name": return q({ ...base, prompt: `${entity.name}は何地方？`, answer: entity.region, choices: naturalChoices(entity.region, nearbyRegions, JAPAN_REGIONS), explanation: `${entity.name}は${entity.region}地方。` });
      case "jp-region-member": return q({ ...base, prompt: `${entity.region}地方にある都道府県はどれ？`, answer: entity.name, choices: naturalChoices(entity.name, nearby.map((item) => item.name), other.map((item) => item.name)), explanation: `${entity.name}は${entity.region}地方。` });
      case "jp-region-outsider": {
        if (same.length < 3) return null;
        return q({ ...base, prompt: `${entity.region}地方に「ない」都道府県はどれ？`, answer: outsider.name, choices: shuffle([outsider.name, ...sample(same.map((item) => item.name), 3)]), explanation: `${outsider.name}は${outsider.region}地方。` });
      }
      case "jp-highlight-region": return q({ ...base, prompt: `地図で色がついている${entity.name}は何地方？`, answer: entity.region, choices: naturalChoices(entity.region, nearbyRegions, JAPAN_REGIONS), explanation: `${entity.name}は${entity.region}地方。`, visual: { kind: "japanHighlight", codes: [entity.code] } });
      case "jp-region-truefalse": return q({ ...base, prompt: `「${entity.name}は${shownRegion}地方にある」`, answer: trueStatement ? "○" : "×", choices: ["○", "×"], explanation: `${entity.name}は${entity.region}地方。` });
      case "jp-region-pair": {
        const pairIsSame = same.length > 0 && Math.random() < 0.5;
        const partner = pairIsSame ? sample(same)[0] : outsider;
        return q({ ...base, prompt: `「${entity.name}と${partner.name}は同じ地方にある」`, answer: pairIsSame ? "○" : "×", choices: ["○", "×"], explanation: `${entity.name}は${entity.region}、${partner.name}は${partner.region}。` });
      }
      case "jp-capital-forward": return q({ ...base, prompt: `${entity.name}の都道府県庁所在地は？`, answer: entity.capital, choices: naturalChoices(entity.capital, preferredCapitals, capitals), explanation: `${entity.name}―${entity.capital}。` });
      case "jp-capital-reverse": return q({ ...base, prompt: `${entity.capital}は、どの都道府県の庁所在地？`, answer: entity.name, choices: naturalChoices(entity.name, preferredNames, names), explanation: `${entity.capital}は${entity.name}。` });
      case "jp-capital-truefalse": return q({ ...base, prompt: `「${entity.name}の都道府県庁所在地は${shownCapital}」`, answer: trueStatement ? "○" : "×", choices: ["○", "×"], explanation: `${entity.name}―${entity.capital}。` });
      case "jp-capital-pair": {
        const distractors = mismatchedPairs(entity, PREFECTURES, "name", "capital", JAPAN_REGION_CONFUSABLES);
        const answer = `${entity.name} ― ${entity.capital}`;
        return q({ ...base, prompt: "都道府県と庁所在地の正しい組み合わせは？", answer, choices: shuffle([answer, ...distractors]), explanation: answer });
      }
      default: return null;
    }
  }

  const names = COUNTRIES.map((item) => item.name);
  const capitals = COUNTRIES.filter((item) => item.capitalQuiz !== false).map((item) => item.capital);
  const flags = COUNTRIES.map((item) => item.flag);
  const sameRegion = COUNTRIES.filter((item) => item.region === entity.region && item.id !== entity.id && item.capitalQuiz !== false);
  const sameRegionAll = COUNTRIES.filter((item) => item.region === entity.region && item.id !== entity.id);
  const nearbyRegions = WORLD_REGION_CONFUSABLES[entity.region] || [];
  const nearbyCountries = COUNTRIES.filter((item) => nearbyRegions.includes(item.region));
  const preferredNames = [...sameRegionAll, ...nearbyCountries].map((item) => item.name);
  const preferredCapitals = [...sameRegion, ...nearbyCountries.filter((item) => item.capitalQuiz !== false)].map((item) => item.capital);
  const preferredFlags = [...sameRegionAll, ...nearbyCountries].map((item) => item.flag);
  const sameRegionMapCountries = sameRegionAll.filter((item) => item.mapQuiz !== false);
  const wrongCountry = sample(sameRegionMapCountries.length ? sameRegionMapCountries : COUNTRIES.filter((item) => item.id !== entity.id && item.mapQuiz !== false))[0];
  const wrongRegion = sample(nearbyRegions.length ? nearbyRegions : WORLD_REGIONS.filter((region) => region !== entity.region))[0];
  const wrongCapital = sample(sameRegion.length ? sameRegion : COUNTRIES.filter((item) => item.id !== entity.id && item.capitalQuiz !== false))[0].capital;
  const trueStatement = Math.random() < 0.55;

  switch (template.kind) {
    case "world-highlight-name": return q({ ...base, prompt: "地図で色がついている国は？", answer: entity.name, choices: naturalChoices(entity.name, preferredNames, names), explanation: `${entity.name}は${entity.region}。`, visual: { kind: "world", mapId: entity.mapId } });
    case "world-click-location": return q({ ...base, prompt: `${entity.name}を地図で押してください。`, answer: entity.name, explanation: `${entity.name}は${entity.region}。`, visual: { kind: "worldClick", region: entity.region, mapId: entity.mapId }, interaction: "worldMapClick" });
    case "world-location-truefalse": return q({ ...base, prompt: `「色がついている位置は${entity.name}」`, answer: trueStatement ? "○" : "×", choices: ["○", "×"], explanation: `色がついているのは${trueStatement ? entity.name : wrongCountry.name}。`, visual: { kind: "world", mapId: trueStatement ? entity.mapId : wrongCountry.mapId } });
    case "world-capital-forward": return q({ ...base, prompt: `${entity.name}の首都は？`, answer: entity.capital, choices: naturalChoices(entity.capital, preferredCapitals, capitals), explanation: `${entity.name}―${entity.capital}。` });
    case "world-capital-reverse": return q({ ...base, prompt: `${entity.capital}は、どの国の首都？`, answer: entity.name, choices: naturalChoices(entity.name, preferredNames, names), explanation: `${entity.capital}は${entity.name}の首都。` });
    case "world-region-forward": return q({ ...base, prompt: `${entity.name}はどの地域？`, answer: entity.region, choices: naturalChoices(entity.region, nearbyRegions, WORLD_REGIONS), explanation: `${entity.name}は${entity.region}。` });
    case "world-region-truefalse": return q({ ...base, prompt: `「${entity.name}は${trueStatement ? entity.region : wrongRegion}にある」`, answer: trueStatement ? "○" : "×", choices: ["○", "×"], explanation: `${entity.name}は${entity.region}。` });
    case "world-capital-truefalse": return q({ ...base, prompt: `「${entity.name}の首都は${trueStatement ? entity.capital : wrongCapital}」`, answer: trueStatement ? "○" : "×", choices: ["○", "×"], explanation: `${entity.name}―${entity.capital}。` });
    case "world-capital-region": return q({ ...base, prompt: `${entity.capital}を首都とする国は、どの地域？`, answer: entity.region, choices: naturalChoices(entity.region, nearbyRegions, WORLD_REGIONS), explanation: `${entity.capital}は${entity.name}の首都。${entity.name}は${entity.region}。` });
    case "world-flag-name": return q({ ...base, prompt: "この国旗の国は？", answer: entity.name, choices: naturalChoices(entity.name, preferredNames, names), explanation: `${entity.flag}は${entity.name}。`, visual: { kind: "flag", value: entity.flag } });
    case "world-name-flag": return q({ ...base, prompt: `${entity.name}の国旗はどれ？`, answer: entity.flag, choices: naturalChoices(entity.flag, preferredFlags, flags), explanation: `${entity.name}の国旗は${entity.flag}。` });
    case "world-flag-capital": return q({ ...base, prompt: "この国旗の国の首都は？", answer: entity.capital, choices: naturalChoices(entity.capital, preferredCapitals, capitals), explanation: `${entity.flag}は${entity.name}。首都は${entity.capital}。`, visual: { kind: "flag", value: entity.flag } });
    default: return null;
  }
}

function buildQuestionsForScope(scope) {
  return QUIZ_TEMPLATES.filter((template) => template.scope === scope).flatMap((template) => {
    const isJapan = template.kind.startsWith("jp-");
    let entities = isJapan ? PREFECTURES : COUNTRIES;
    if (!isJapan && template.kind.includes("world-") && (template.kind.includes("highlight") || template.kind.includes("click") || template.kind.includes("location"))) {
      entities = entities.filter((country) => country.mapQuiz !== false);
    }
    if (!isJapan && (template.kind.includes("capital") || template.kind === "world-flag-capital")) {
      entities = entities.filter((country) => country.capitalQuiz !== false);
    }
    return entities.map((entity, index) => makeQuestion(template, entity, index)).filter(Boolean);
  });
}

function filteredQuestionPool(scopes, filters = {}) {
  return scopes.flatMap(buildQuestionsForScope).filter((question) => {
    if (filters.difficulty && question.difficulty !== filters.difficulty) return false;
    if (question.knowledgeKey.startsWith("jp:") && filters.japanRegion && question.entityRegion !== filters.japanRegion) return false;
    if (question.knowledgeKey.startsWith("world:") && filters.worldRegion && question.entityRegion !== filters.worldRegion) return false;
    return true;
  });
}

function buildBalancedCourse(scopes, count, filters = {}, { allowRepeats = false } = {}) {
  const pool = filteredQuestionPool(scopes, filters);
  if (!pool.length) return [];
  const targetCount = allowRepeats ? count : Math.min(count, pool.length);
  const easyCount = filters.difficulty ? targetCount : Math.round(targetCount * 0.6);
  const mediumCount = filters.difficulty ? 0 : Math.round(targetCount * 0.3);
  const thinkCount = Math.max(0, targetCount - easyCount - mediumCount);
  const sequence = filters.difficulty
    ? Array(targetCount).fill(filters.difficulty)
    : shuffle([...Array(easyCount).fill("easy"), ...Array(mediumCount).fill("medium"), ...Array(thinkCount).fill("think")]);
  const selected = [];
  const usedIds = new Set();
  const usedKnowledge = new Set();
  const scopeCounts = Object.fromEntries(scopes.map((scope) => [scope, 0]));
  const templateCounts = {};

  sequence.forEach((difficulty) => {
    let candidates = pool.filter((question) => question.difficulty === difficulty && !usedIds.has(question.id));
    if (!candidates.length) candidates = pool.filter((question) => !usedIds.has(question.id));
    if (!candidates.length) candidates = pool;
    const newKnowledge = candidates.filter((question) => !usedKnowledge.has(question.knowledgeKey));
    if (newKnowledge.length) candidates = newKnowledge;
    const recent = selected.slice(-3);
    const varied = candidates.filter((question) => !recent.some((previous) => question.templateId === previous.templateId || question.knowledgeKey === previous.knowledgeKey));
    if (varied.length) candidates = varied;
    const minScopeCount = Math.min(...new Set(candidates.map((question) => scopeCounts[question.scope] || 0)));
    candidates = candidates.filter((question) => (scopeCounts[question.scope] || 0) === minScopeCount);
    const minTemplateCount = Math.min(...new Set(candidates.map((question) => templateCounts[question.templateId] || 0)));
    candidates = candidates.filter((question) => (templateCounts[question.templateId] || 0) === minTemplateCount);
    const chosen = sample(candidates)[0];
    selected.push(chosen);
    usedIds.add(chosen.id);
    usedKnowledge.add(chosen.knowledgeKey);
    scopeCounts[chosen.scope] = (scopeCounts[chosen.scope] || 0) + 1;
    templateCounts[chosen.templateId] = (templateCounts[chosen.templateId] || 0) + 1;
  });
  return selected;
}

function getWrongBank() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function saveWrongBank(bank) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bank.slice(-100))); }
  catch { /* 保存が使えない端末でも、クイズ自体は続けられます。 */ }
  updateReviewCount();
}

function updateWrongBank(question, isCorrect) {
  const bank = getWrongBank().filter((item) => item.knowledgeKey !== question.knowledgeKey);
  if (!isCorrect) bank.push(question);
  saveWrongBank(bank);
}

function updateReviewCount() {
  const count = getWrongBank().length;
  $("#review-count").textContent = `保存 ${count}問`;
  $("#quick-review-count").textContent = `保存 ${count}問`;
}

function selectedScopes() {
  return [...document.querySelectorAll('input[name="scope"]:checked')].map((input) => input.value);
}

function selectedFilters() {
  return {
    japanRegion: $("#japan-region-filter").value,
    worldRegion: $("#world-region-filter").value,
    difficulty: $("#difficulty-filter").value,
  };
}

function startCourse(course, scopes, filters = {}, messageElement = $("#setup-message")) {
  messageElement.textContent = "";
  const courseNote = $("#course-note");
  courseNote.textContent = "";
  courseNote.classList.add("hidden");
  if (!scopes.length) {
    messageElement.textContent = "出題する分野を1つ以上選んでください。";
    return;
  }
  courseMode = course;
  lastCourseConfig = { course, scopes: [...scopes], filters: { ...filters } };
  retryKeys = new Set();

  if (course === "review") {
    questions = shuffle(getWrongBank().filter((item) => {
      if (!scopes.includes(item.scope)) return false;
      if (filters.difficulty && item.difficulty !== filters.difficulty) return false;
      if (item.knowledgeKey?.startsWith("jp:") && filters.japanRegion && item.entityRegion !== filters.japanRegion) return false;
      if (item.knowledgeKey?.startsWith("world:") && filters.worldRegion && item.entityRegion !== filters.worldRegion) return false;
      return true;
    }));
    if (!questions.length) {
      messageElement.textContent = "選んだ範囲に、復習する問題はまだありません。";
      return;
    }
  } else {
    const requestedCount = course === "endless" || course === "random" ? 20 : Number(course);
    questions = buildBalancedCourse(scopes, requestedCount, filters, { allowRepeats: course === "endless" });
    if (!questions.length) {
      messageElement.textContent = "この条件で作れる問題がありません。範囲を少し広げてください。";
      return;
    }
    if (course !== "endless" && questions.length < requestedCount) {
      courseNote.textContent = `同じ問題のくり返しを避けるため、この条件では${questions.length}問で出します。`;
      courseNote.classList.remove("hidden");
    }
  }
  currentIndex = 0;
  answers = [];
  quizScreen.dataset.plannedDifficulties = questions.map((question) => question.difficulty).join(",");
  quizScreen.dataset.plannedTemplates = questions.map((question) => question.templateId).join(",");
  quizScreen.dataset.plannedKnowledge = questions.map((question) => question.knowledgeKey).join(",");
  showScreen(quizScreen);
  window.scrollTo({ top: 0 });
  renderQuestion();
}

function startFromSetup() {
  const course = $('input[name="course"]:checked').value;
  startCourse(course, selectedScopes(), selectedFilters());
}

function startQuickCourse(course) {
  const scopes = Object.keys(CATEGORY_LABELS);
  startCourse(course, scopes, {}, $("#home-message"));
}

function resetWorldMap() {
  worldMapElement.querySelectorAll(".map-hit-assist").forEach((element) => element.remove());
  worldMapElement.querySelectorAll("[data-quiz-highlight='true']").forEach((element) => {
    element.style.removeProperty("fill");
    element.style.removeProperty("stroke");
    element.removeAttribute("data-quiz-highlight");
  });
  worldMapElement.querySelectorAll("[data-map-click]").forEach((element) => {
    element.removeAttribute("data-map-click");
    element.removeAttribute("role");
    element.removeAttribute("tabindex");
    element.removeAttribute("aria-label");
    element.onclick = null;
    element.onkeydown = null;
  });
  const svg = worldMapElement.querySelector("svg");
  if (svg?.dataset.fullViewBox) svg.setAttribute("viewBox", svg.dataset.fullViewBox);
}

function highlightWorldCountry(mapId) {
  const apply = () => {
    resetWorldMap();
    const target = worldMapElement.querySelector(`[id="${CSS.escape(mapId)}"]`);
    if (!target) return;
    const parts = target.matches("path") ? [target] : [...target.querySelectorAll("path")];
    (parts.length ? parts : [target]).forEach((element) => {
      element.style.setProperty("fill", "#f4a261", "important");
      element.style.setProperty("stroke", "#9b4b16", "important");
      element.setAttribute("data-quiz-highlight", "true");
    });
  };
  worldMapReady.then(apply);
}

function fitJapanQuizMap(region) {
  const svg = japanHighlightMapElement.querySelector("svg");
  if (!svg) return;
  if (svg.dataset.fullViewBox) svg.setAttribute("viewBox", svg.dataset.fullViewBox);
  const codes = PREFECTURES.filter((prefecture) => prefecture.region === region).map((prefecture) => String(prefecture.code));
  const boxes = [...japanHighlightMapElement.querySelectorAll("[data-code]")]
    .filter((element) => codes.includes(String(element.dataset.code)))
    .map((element) => {
      try { return element.getBBox(); } catch { return null; }
    })
    .filter((box) => box && box.width > 0 && box.height > 0);
  if (!boxes.length) return;
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  const width = maxX - minX;
  const height = maxY - minY;
  const padX = Math.max(width * 0.22, 55);
  const padY = Math.max(height * 0.22, 55);
  svg.setAttribute("viewBox", `${minX - padX} ${minY - padY} ${width + padX * 2} ${height + padY * 2}`);
}

function addJapanMapHitAssists(prefectures) {
  const svg = japanHighlightMapElement.querySelector("svg");
  const viewBox = worldViewBox(svg);
  const svgRect = svg?.getBoundingClientRect();
  if (!svg || !viewBox || !svgRect?.width || !svgRect?.height) return;
  const scale = Math.min(svgRect.width / viewBox.width, svgRect.height / viewBox.height);
  const radius = 18 / scale;
  prefectures.forEach((prefecture) => {
    const target = japanHighlightMapElement.querySelector(`[data-code="${prefecture.code}"]`);
    const box = worldElementBoxInSvg(svg, primaryWorldMapPart(target));
    if (!box || Math.min(box.width * scale, box.height * scale) >= 32) return;
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("class", "map-hit-assist");
    circle.setAttribute("cx", box.x + box.width / 2);
    circle.setAttribute("cy", box.y + box.height / 2);
    circle.setAttribute("r", radius);
    circle.setAttribute("role", "button");
    circle.setAttribute("tabindex", "0");
    circle.setAttribute("aria-label", prefecture.name);
    circle.onclick = () => answerQuestion(prefecture.name);
    circle.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") answerQuestion(prefecture.name);
    };
    svg.append(circle);
  });
}

function setupJapanMapClick(region) {
  japanMapReady.then(() => {
    paintJapanMap(japanHighlightMapElement, []);
    fitJapanQuizMap(region);
    japanHighlightMapElement.classList.add("clickable-japan");
    const regionPrefectures = PREFECTURES.filter((prefecture) => prefecture.region === region);
    japanHighlightMapElement.querySelectorAll("[data-code]").forEach((element) => {
      const prefecture = regionPrefectures.find((item) => String(item.code) === String(element.dataset.code));
      if (!prefecture) return;
      element.setAttribute("role", "button");
      element.setAttribute("tabindex", "0");
      element.setAttribute("aria-label", prefecture.name);
      element.onclick = () => answerQuestion(prefecture.name);
      element.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") answerQuestion(prefecture.name);
      };
    });
    addJapanMapHitAssists(regionPrefectures);
  });
}

function addWorldMapHitAssists(countries) {
  const svg = worldMapElement.querySelector("svg");
  const viewBox = worldViewBox(svg);
  const svgRect = svg?.getBoundingClientRect();
  if (!svg || !viewBox || !svgRect?.width || !svgRect?.height) return;
  const scale = Math.min(svgRect.width / viewBox.width, svgRect.height / viewBox.height);
  const radius = 18 / scale;
  countries.forEach((country) => {
    const target = worldMapElement.querySelector(`[id="${CSS.escape(country.mapId)}"]`);
    const box = worldElementBoxInSvg(svg, primaryWorldMapPart(target));
    if (!box || Math.min(box.width * scale, box.height * scale) >= 28) return;
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("class", "map-hit-assist");
    circle.setAttribute("cx", box.x + box.width / 2);
    circle.setAttribute("cy", box.y + box.height / 2);
    circle.setAttribute("r", radius);
    circle.setAttribute("data-map-click", "true");
    circle.setAttribute("role", "button");
    circle.setAttribute("tabindex", "0");
    circle.setAttribute("aria-label", country.name);
    circle.onclick = () => answerQuestion(country.name);
    circle.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") answerQuestion(country.name);
    };
    svg.append(circle);
  });
}

function setupWorldMapClick(region, targetMapId) {
  worldMapReady.then(() => {
    resetWorldMap();
    worldMapElement.classList.add("clickable-world");
    const targetCountry = COUNTRIES.find((country) => country.mapId === targetMapId);
    const canZoom = targetCountry?.printPrimary !== false;
    const regionCountries = COUNTRIES.filter((country) => country.region === region && country.mapQuiz !== false);
    const clickableCountries = canZoom
      ? regionCountries.filter((country) => country.printPrimary !== false)
      : COUNTRIES.filter((country) => country.mapQuiz !== false);
    if (canZoom) fitWorldMapToCountries(worldMapElement, clickableCountries);
    clickableCountries.forEach((country) => {
      const target = worldMapElement.querySelector(`[id="${CSS.escape(country.mapId)}"]`);
      if (!target) return;
      target.setAttribute("data-map-click", "true");
      target.setAttribute("role", "button");
      target.setAttribute("tabindex", "0");
      target.setAttribute("aria-label", country.name);
      target.onclick = () => answerQuestion(country.name);
      target.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") answerQuestion(country.name);
      };
    });
    addWorldMapHitAssists(clickableCountries);
  });
}

function clearJapanMapClick() {
  japanHighlightMapElement.classList.remove("clickable-japan");
  const svg = japanHighlightMapElement.querySelector("svg");
  if (svg?.dataset.fullViewBox) svg.setAttribute("viewBox", svg.dataset.fullViewBox);
  japanHighlightMapElement.querySelectorAll(".map-hit-assist").forEach((element) => element.remove());
  japanHighlightMapElement.querySelectorAll("[data-code]").forEach((element) => {
    element.removeAttribute("role");
    element.removeAttribute("tabindex");
    element.removeAttribute("aria-label");
    element.onclick = null;
    element.onkeydown = null;
  });
}

function renderVisual(visual) {
  const visualArea = $("#visual-area");
  const japanNumberedMap = $("#japan-numbered-map");
  const japanHighlightMap = $("#japan-highlight-map");
  const worldMap = $("#world-map");
  const flag = $("#flag-display");
  [visualArea, japanNumberedMap, japanHighlightMap, worldMap, flag].forEach((el) => el.classList.add("hidden"));
  resetWorldMap();
  clearJapanMapClick();
  worldMapElement.classList.remove("clickable-world");
  if (!visual) return;
  visualArea.classList.remove("hidden");
  if (visual.kind === "japanNumbered") japanNumberedMap.classList.remove("hidden");
  if (visual.kind === "japanHighlight") {
    japanHighlightMap.classList.remove("hidden");
    japanMapReady.then(() => paintJapanMap(japanHighlightMap, visual.codes));
  }
  if (visual.kind === "japanClick") {
    japanHighlightMap.classList.remove("hidden");
    setupJapanMapClick(visual.region);
  }
  if (visual.kind === "world") {
    worldMap.classList.remove("hidden");
    highlightWorldCountry(visual.mapId);
  }
  if (visual.kind === "worldClick") {
    worldMap.classList.remove("hidden");
    setupWorldMapClick(visual.region, visual.mapId);
  }
  if (visual.kind === "flag") {
    flag.textContent = visual.value;
    flag.classList.remove("hidden");
  }
}

function renderQuestion() {
  locked = false;
  let question = questions[currentIndex];
  const previous = questions[currentIndex - 1];
  if (question.isRetry && previous?.templateId === question.templateId) {
    const replacement = alternateQuestionFor(question, [previous.templateId, questions[currentIndex + 1]?.templateId].filter(Boolean));
    if (replacement) {
      question = { ...replacement, isRetry: true, retryOf: question.retryOf };
      questions[currentIndex] = question;
    }
  }
  quizScreen.dataset.difficulty = question.difficulty;
  quizScreen.dataset.templateId = question.templateId;
  quizScreen.dataset.knowledgeKey = question.knowledgeKey;
  $("#category-badge").textContent = CATEGORY_LABELS[question.scope];
  $("#progress-text").textContent = `${currentIndex + 1} / ${questions.length}`;
  $("#progress-bar").style.width = `${((currentIndex + 1) / questions.length) * 100}%`;
  $("#question-type").textContent = `＜${question.level || "やさしい問題"}＞ ${question.type}`;
  $("#question-text").textContent = question.prompt;
  $("#feedback").textContent = "";
  $("#feedback").className = "feedback";
  renderVisual(question.visual);

  const choices = $("#choices");
  choices.replaceChildren();
  question.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = `${index + 1}. ${choice}`;
    button.dataset.choice = choice;
    button.addEventListener("click", () => answerQuestion(choice));
    choices.append(button);
  });
  $("#unknown-button").disabled = false;
  $("#key-hint").textContent = question.interaction.endsWith("MapClick")
    ? "地方・地域を拡大しています。地図を押して答えます。"
    : "数字キー 1〜4 でも答えられます。";
  choices.querySelector("button")?.focus({ preventScroll: true });
}

function alternateQuestionFor(question, excludedTemplates = []) {
  if (!lastCourseConfig) return null;
  const candidates = filteredQuestionPool(lastCourseConfig.scopes, lastCourseConfig.filters)
    .filter((item) => item.knowledgeKey === question.knowledgeKey && item.templateId !== question.templateId && item.id !== question.id);
  let varied = candidates.filter((item) => item.interaction !== question.interaction && item.type !== question.type && !excludedTemplates.includes(item.templateId));
  if (!varied.length) varied = candidates.filter((item) => !excludedTemplates.includes(item.templateId));
  if (!varied.length) varied = candidates;
  const usage = Object.fromEntries(QUIZ_TEMPLATES.map((template) => [template.id, questions.filter((item) => item.templateId === template.id).length]));
  const minUsage = Math.min(...varied.map((item) => usage[item.templateId] || 0));
  const alternate = sample(varied.filter((item) => (usage[item.templateId] || 0) === minUsage))[0];
  return alternate ? { ...alternate, id: `${alternate.id}-retry-${Date.now()}`, isRetry: true, retryOf: question.id } : null;
}

function scheduleAlternateRetry(question) {
  if (question.isRetry || retryKeys.has(question.knowledgeKey)) return;
  const gap = 3 + Math.floor(Math.random() * 3);
  let targetIndex = currentIndex + gap + 1;
  if (targetIndex >= questions.length && courseMode !== "endless") return;
  if (targetIndex >= questions.length && courseMode === "endless") {
    const fillersNeeded = targetIndex - questions.length + 1;
    questions.push(...buildBalancedCourse(
      lastCourseConfig.scopes,
      fillersNeeded,
      lastCourseConfig.filters,
      { allowRepeats: true },
    ));
  }
  const openIndex = questions.findIndex((item, index) => index >= targetIndex && index <= targetIndex + 2 && !item.isRetry);
  if (openIndex < 0) return;
  targetIndex = openIndex;
  const excludedTemplates = [questions[targetIndex - 1]?.templateId, questions[targetIndex]?.templateId].filter(Boolean);
  const alternate = alternateQuestionFor(question, excludedTemplates);
  if (!alternate) return;
  retryKeys.add(question.knowledgeKey);
  questions[targetIndex] = alternate;
}

function addEndlessQuestionsIfNeeded() {
  if (courseMode !== "endless" || questions.length - currentIndex > 6 || !lastCourseConfig) return;
  const more = buildBalancedCourse(lastCourseConfig.scopes, 12, lastCourseConfig.filters, { allowRepeats: true });
  const previous = questions.at(-1);
  const start = more.findIndex((item) => item.knowledgeKey !== previous?.knowledgeKey && item.templateId !== previous?.templateId);
  questions.push(...(start > 0 ? [...more.slice(start), ...more.slice(0, start)] : more));
}

function answerQuestion(selected, { skipped = false } = {}) {
  if (locked) return;
  locked = true;
  const question = questions[currentIndex];
  const isCorrect = !skipped && selected === question.answer;
  answers.push({ question, selected: skipped ? "わからない" : selected, isCorrect });
  updateWrongBank(question, isCorrect);
  if (!isCorrect) scheduleAlternateRetry(question);

  document.querySelectorAll(".choice-button").forEach((button) => {
    button.disabled = true;
    if (button.dataset.choice === question.answer) button.classList.add("correct");
    if (!isCorrect && button.dataset.choice === selected) button.classList.add("wrong");
  });
  $("#unknown-button").disabled = true;

  const feedback = $("#feedback");
  feedback.classList.add(isCorrect ? "correct" : "wrong");
  feedback.textContent = isCorrect
    ? `○ 正解！ ${question.explanation}`
    : `${skipped ? "わからなくてもOK。" : "× 正しく直そう。"} 正解：${question.answer}。${question.explanation}`;

  window.setTimeout(() => {
    currentIndex += 1;
    addEndlessQuestionsIfNeeded();
    if (currentIndex < questions.length) renderQuestion();
    else showResults();
  }, isCorrect ? 750 : 1800);
}

function showResults() {
  quizScreen.classList.add("hidden");
  resultScreen.classList.remove("hidden");
  window.scrollTo({ top: 0 });
  const correct = answers.filter((answer) => answer.isCorrect).length;
  const wrong = answers.filter((answer) => !answer.isCorrect);
  $("#score-count").textContent = `${correct} / ${answers.length}`;
  const rate = answers.length ? Math.round((correct / answers.length) * 100) : 0;
  $("#score-rate").textContent = `${rate}%`;
  $("#assessment-text").textContent = rate >= 80
    ? "○ 基本がよく身についています。"
    : rate >= 50
      ? "△ まちがえた問題をもう一度やってみよう。"
      : "× まずは10問コースで、同じ基本をくり返そう。";

  const list = $("#mistakes-list");
  list.replaceChildren();
  if (!wrong.length) {
    const p = document.createElement("p");
    p.textContent = "全問正解です！";
    list.append(p);
  } else {
    wrong.forEach(({ question, selected }) => {
      const item = document.createElement("div");
      item.className = "mistake-item";
      item.innerHTML = `<p>${question.prompt}</p><p>あなたの答え：${selected}</p><p class="mistake-answer">正解：${question.answer}</p>`;
      list.append(item);
    });
  }
  retryButton.disabled = !getWrongBank().length;
}

function retryWrong() {
  const scopes = [...new Set(getWrongBank().map((item) => item.scope))];
  if (!scopes.length) return;
  startCourse("review", scopes, {});
}

function goHome() {
  [setupScreen, quizScreen, resultScreen, printSetupScreen, worksheetScreen].forEach((screen) => screen.classList.add("hidden"));
  homeScreen.classList.remove("hidden");
  window.scrollTo({ top: 0 });
  updateReviewCount();
}

const selectedPrintCodes = new Set();
const PRINT_LETTERS = ["ア", "イ", "ウ", "エ", "オ", "カ", "キ", "ク", "ケ", "コ", "サ", "シ"];

function showScreen(screen) {
  [homeScreen, setupScreen, quizScreen, resultScreen, printSetupScreen, worksheetScreen]
    .forEach((item) => item.classList.add("hidden"));
  screen.classList.remove("hidden");
  window.scrollTo({ top: 0 });
}

function printPrefectures() {
  return PREFECTURES.filter((prefecture) => selectedPrintCodes.has(prefecture.code));
}

function selectedPrintRegions() {
  return [...new Set(printPrefectures().map((prefecture) => prefecture.region))];
}

function isWorldPrintAll() {
  return selectedWorldPrintRegions.has("世界全体");
}

function activeWorldPrintRegions() {
  return isWorldPrintAll()
    ? [...WORLD_REGIONS]
    : WORLD_REGIONS.filter((region) => selectedWorldPrintRegions.has(region));
}

function worldPrintRegionLabel() {
  return isWorldPrintAll() ? "世界全体" : activeWorldPrintRegions().join("・");
}

function syncPrintPicker() {
  document.querySelectorAll("#prefecture-picker input").forEach((input) => {
    input.checked = selectedPrintCodes.has(Number(input.value));
  });
  document.querySelectorAll("#region-picker button").forEach((button) => {
    const members = PREFECTURES.filter((prefecture) => prefecture.region === button.dataset.region);
    const activeCount = members.filter((prefecture) => selectedPrintCodes.has(prefecture.code)).length;
    button.classList.toggle("selected", activeCount === members.length);
    button.classList.toggle("partial", activeCount > 0 && activeCount < members.length);
    button.setAttribute("aria-pressed", activeCount === members.length ? "true" : "false");
  });
  const prefs = printPrefectures();
  const regions = selectedPrintRegions();
  if (printMode === "japan") {
    $("#print-selection-summary").textContent = prefs.length
      ? `選択中：日本地理・${regions.join("・")}（${prefs.length}都道府県）`
      : "日本地理：地方を選んでください。";
  } else {
    const count = worldPrintCountries().length;
    const label = worldPrintRegionLabel();
    $("#print-selection-summary").textContent = label
      ? `選択中：世界地理・${label}（主要${count}か国）`
      : "世界地理：地域を選んでください。";
  }
}

function syncPrintMode() {
  $("#japan-print-options").classList.toggle("hidden", printMode !== "japan");
  $("#world-print-options").classList.toggle("hidden", printMode !== "world");
  document.querySelectorAll("[data-print-mode]").forEach((button) => {
    const selected = button.dataset.printMode === printMode;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  syncPrintPicker();
}

function setupPrintPicker() {
  const regionPicker = $("#region-picker");
  JAPAN_REGIONS.forEach((region) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.region = region;
    button.textContent = region;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      const members = PREFECTURES.filter((prefecture) => prefecture.region === region);
      const allSelected = members.every((prefecture) => selectedPrintCodes.has(prefecture.code));
      members.forEach((prefecture) => allSelected
        ? selectedPrintCodes.delete(prefecture.code)
        : selectedPrintCodes.add(prefecture.code));
      syncPrintPicker();
    });
    regionPicker.append(button);
  });

  const prefecturePicker = $("#prefecture-picker");
  JAPAN_REGIONS.forEach((region) => {
    const group = document.createElement("section");
    group.className = "prefecture-group";
    const heading = document.createElement("h3");
    heading.textContent = region;
    group.append(heading);
    PREFECTURES.filter((prefecture) => prefecture.region === region).forEach((prefecture) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = prefecture.code;
      input.addEventListener("change", () => {
        if (input.checked) selectedPrintCodes.add(prefecture.code);
        else selectedPrintCodes.delete(prefecture.code);
        syncPrintPicker();
      });
      label.append(input, document.createTextNode(` ${prefecture.name}`));
      group.append(label);
    });
    prefecturePicker.append(group);
  });

  const worldRegionPicker = $("#world-print-region-picker");
  ["世界全体", ...WORLD_REGIONS].forEach((region) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.worldPrintRegion = region;
    button.textContent = region;
    button.addEventListener("click", () => {
      $("#print-message").textContent = "";
      if (region === "世界全体") {
        selectedWorldPrintRegions.clear();
        selectedWorldPrintRegions.add("世界全体");
      } else {
        selectedWorldPrintRegions.delete("世界全体");
        if (selectedWorldPrintRegions.has(region)) {
          selectedWorldPrintRegions.delete(region);
        } else if (selectedWorldPrintRegions.size >= 3) {
          $("#print-message").textContent = "読みやすい1枚にするため、世界の地域は3つまでにしてください。";
          return;
        } else {
          selectedWorldPrintRegions.add(region);
        }
      }
      worldRegionPicker.querySelectorAll("button").forEach((item) => {
        const selected = selectedWorldPrintRegions.has(item.dataset.worldPrintRegion);
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", selected ? "true" : "false");
      });
      syncPrintPicker();
    });
    worldRegionPicker.append(button);
  });
  worldRegionPicker.querySelectorAll("button").forEach((item) => {
    const selected = selectedWorldPrintRegions.has(item.dataset.worldPrintRegion);
    item.classList.toggle("selected", selected);
    item.setAttribute("aria-pressed", selected ? "true" : "false");
  });

  document.querySelectorAll("[data-print-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      printMode = button.dataset.printMode;
      $("#print-message").textContent = "";
      syncPrintMode();
    });
  });
  syncPrintPicker();
  syncPrintMode();
}

function featureQuestions(regions) {
  const correctPerRegion = regions.length === 1 ? 3 : 2;
  const correct = regions.flatMap((region) => sample(REGION_FEATURES[region], correctPerRegion));
  const wrongPool = JAPAN_REGIONS
    .filter((region) => !regions.includes(region))
    .flatMap((region) => REGION_FEATURES[region]);
  const wrong = sample(wrongPool, regions.length === 1 ? 3 : 3);
  return shuffle([
    ...correct.map((text) => ({ text, correct: true })),
    ...wrong.map((text) => ({ text, correct: false })),
  ]);
}

function buildPrintOx(selectedPrefectures) {
  const regions = [...new Set(selectedPrefectures.map((prefecture) => prefecture.region))];
  const regionBuckets = shuffle(regions).map((region) => ({
    region,
    members: shuffle(selectedPrefectures.filter((prefecture) => prefecture.region === region)),
    used: 0,
  }));
  const balancedMembers = Array.from({ length: 10 }, (_, index) => {
    const bucket = regionBuckets[index % regionBuckets.length];
    const prefecture = bucket.members[bucket.used % bucket.members.length];
    bucket.used += 1;
    return prefecture;
  });
  const member = (index) => balancedMembers[index];
  const wrongRegion = (prefecture) => {
    const preferred = JAPAN_REGION_CONFUSABLES[prefecture.region] || [];
    return sample(preferred.length ? preferred : JAPAN_REGIONS.filter((region) => region !== prefecture.region))[0];
  };
  const wrongCapital = (prefecture) => {
    const sameRegion = PREFECTURES.filter((item) => item.region === prefecture.region && item.code !== prefecture.code);
    return sample(sameRegion.length ? sameRegion : PREFECTURES.filter((item) => item.code !== prefecture.code))[0].capital;
  };
  const outsiderFor = (prefecture) => {
    const preferred = JAPAN_REGION_CONFUSABLES[prefecture.region] || [];
    const nearby = PREFECTURES.filter((item) => preferred.includes(item.region));
    return sample(nearby.length ? nearby : PREFECTURES.filter((item) => item.region !== prefecture.region))[0];
  };

  const p0 = member(0); const p1 = member(1); const p2 = member(2);
  const p3 = member(3); const p4 = member(4); const p5 = member(5);
  const p6 = member(6); const p7 = member(7); const p8 = member(8); const p9 = member(9);
  const p2WrongRegion = wrongRegion(p2);
  const p8Outsider = outsiderFor(p8);
  const p9WrongRegion = wrongRegion(p9);
  const easy = [
    { statement: `${p0.name}は${p0.region}地方にある。`, answer: "○", correction: `${p0.name}は${p0.region}地方にある。` },
    { statement: `${p1.name}の都道府県庁所在地は${p1.capital}である。`, answer: "○", correction: `${p1.name}の都道府県庁所在地は${p1.capital}である。` },
    { statement: `${p2.name}は${p2WrongRegion}地方にある。`, answer: "×", correction: `${p2.name}は${p2.region}地方にある。` },
    { statement: `${p3.region}地方には${p3.name}がある。`, answer: "○", correction: `${p3.region}地方には${p3.name}がある。` },
    { statement: `${p4.capital}は${p4.name}の都道府県庁所在地である。`, answer: "○", correction: `${p4.capital}は${p4.name}の都道府県庁所在地である。` },
    { statement: `${p5.name}の都道府県庁所在地は${wrongCapital(p5)}である。`, answer: "×", correction: `${p5.name}の都道府県庁所在地は${p5.capital}である。` },
  ];
  const medium = [
    { statement: `${p6.capital}を都道府県庁所在地とする${p6.name}は${p6.region}地方にある。`, answer: "○", correction: `${p6.capital}を都道府県庁所在地とする${p6.name}は${p6.region}地方にある。` },
    { statement: `${p7.capital}を都道府県庁所在地とするのは${p7.name}である。`, answer: "○", correction: `${p7.capital}を都道府県庁所在地とするのは${p7.name}である。` },
    { statement: `${p8Outsider.name}は${p8.region}地方にある。`, answer: "×", correction: `${p8Outsider.name}は${p8Outsider.region}地方にある。` },
  ];
  const thinking = [{
    statement: `${p9.capital}を都道府県庁所在地とする${p9.name}は${p9WrongRegion}地方にある。`,
    answer: "×",
    correction: `${p9.capital}を都道府県庁所在地とする${p9.name}は${p9.region}地方にある。`,
  }];
  return [
    ...shuffle(easy).map((item) => ({ ...item, level: "やさしい問題" })),
    ...shuffle(medium).map((item) => ({ ...item, level: "少し考える問題" })),
    ...thinking.map((item) => ({ ...item, level: "考える問題" })),
  ];
}

function worksheetHeader(title, includeId = false) {
  return `
    <header class="print-header">
      <div><p class="print-kicker">社会科基礎力 自習課題</p><h1${includeId ? ' id="worksheet-title"' : ""}>${title}</h1></div>
      <p class="student-line">年　　組　　番　名前　　　　　　　　　　　　</p>
    </header>`;
}

function balancedJapanPrintSample(prefectures, regions, count) {
  const firstFromEachRegion = shuffle(regions)
    .map((region) => sample(prefectures.filter((prefecture) => prefecture.region === region))[0])
    .filter(Boolean)
    .slice(0, count);
  const remaining = prefectures.filter((prefecture) => !firstFromEachRegion.some((item) => item.code === prefecture.code));
  return [...firstFromEachRegion, ...sample(remaining, Math.max(0, count - firstFromEachRegion.length))];
}

function addJapanMapNumbers(container, prefectures) {
  const svg = container.querySelector("svg");
  const viewBox = worldViewBox(svg);
  if (!svg || !viewBox) return;
  const fontSize = Math.max(32, Math.min(58, viewBox.width * 0.032));
  prefectures.forEach((prefecture, index) => {
    const target = container.querySelector(`[data-code="${prefecture.code}"]`);
    let box = null;
    try { box = target?.getBBox(); } catch { box = null; }
    if (!box || !box.width || !box.height) return;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "japan-map-number");
    group.setAttribute("aria-hidden", "true");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", fontSize * 0.72);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", y);
    text.setAttribute("font-size", fontSize);
    text.textContent = String(index + 1);
    group.append(circle, text);
    svg.append(group);
  });
}

async function makeJapanWorksheet() {
  const prefs = shuffle(printPrefectures());
  const regions = selectedPrintRegions();
  const message = $("#print-message");
  message.textContent = "";
  if (!prefs.length) {
    message.textContent = "地方か都道府県を1つ以上選んでください。";
    return;
  }
  if (regions.length > 3) {
    message.textContent = "1枚を読みやすくするため、地方は3つまでにしてください。";
    return;
  }

  const features = featureQuestions(regions);
  const ox = buildPrintOx(prefs);
  worksheetVersion += 1;
  const regionTitle = `${regions.join("・")} 地図プリント（第${worksheetVersion}版）`;
  const mapNameCount = Math.min(3, prefs.length);
  const mapAnswerPrefs = balancedJapanPrintSample(prefs, regions, mapNameCount);
  const capitalPrefs = balancedJapanPrintSample(prefs, regions, Math.min(3, prefs.length));
  const prefecturePromptHtml = mapAnswerPrefs.map((prefecture, index) => `
    <p>${index + 1}　地図の「${index + 1}」の都道府県名：<span class="answer-line"></span></p>`).join("");
  const prefectureAnswerHtml = mapAnswerPrefs.map((prefecture, index) => `<p>${index + 1}　${prefecture.name}</p>`).join("");
  const regionPromptStart = mapNameCount + 1;
  const regionPromptHtml = regions.map((region, index) => `
    <p>${regionPromptStart + index}　色${PRINT_REGION_MARKS[index]}の地方名：<span class="answer-line"></span></p>`).join("");
  const regionAnswerHtml = regions.map((region, index) => `<p>${regionPromptStart + index}　色${PRINT_REGION_MARKS[index]}：${region}</p>`).join("");
  const regionLegendHtml = regions.map((region, index) => `
    <span><i style="--swatch:${JAPAN_PRINT_REGION_COLORS[index].fill}"></i>色${PRINT_REGION_MARKS[index]}</span>`).join("");
  const capitalPromptStart = regionPromptStart + regions.length;
  const featureInstruction = regions.length === 1
    ? `${regions[0]}地方について書かれたものを3つ選び、記号に丸をつけよう。（3つすべて合って1問）`
    : `${regions.join("・")}地方について書かれたものを、すべて選ぼう。（すべて合って1問）`;

  const featureHtml = features.map((feature, index) => `
    <li><span class="option-letter">${PRINT_LETTERS[index]}</span>${feature.text}</li>`).join("");
  const oxHtml = ox.map((item, index) => `
    ${index === 0 || ox[index - 1].level !== item.level ? `<h3 class="level-heading">＜${item.level}＞</h3>` : ""}
    <div class="ox-question"><span>${index + 1}</span><b>○・×</b><p>${item.statement}</p><i>×なら直す：　　　　　　　　　　　　　　　　　　　　　　　　　</i></div>`).join("");
  const answerRows = ox.map((item, index) => `
    <tr><td>${index + 1}</td><td>${item.answer}</td><td>${item.correction}</td></tr>`).join("");
  const correctFeatureLetters = features.map((feature, index) => feature.correct ? PRINT_LETTERS[index] : null).filter(Boolean).join("・");

  const pages = $("#worksheet-pages");
  pages.innerHTML = `
    <article class="print-page">
      ${worksheetHeader(regionTitle, true)}
      <p class="print-goal"><b>【目標】</b> ${PRINT_WORDING.goal}</p>
      <p class="print-warmup">★まず知っていること　${PRINT_WORDING.warmup || "聞いたことがある都道府県名（　　　　　　　　　）　全部知らなくてもOK"}</p>
      <section class="print-section map-section">
        <h2>① 地図問題</h2>
        <p>${PRINT_WORDING.mapHint}</p>
        <div id="worksheet-map" class="worksheet-map" aria-label="選択した都道府県を強調した日本地図"></div>
        <div class="map-region-legend" aria-label="地図の色分け">${regionLegendHtml}</div>
        <div class="map-prompts">
          ${prefecturePromptHtml}
          ${regionPromptHtml}
          ${capitalPrefs.map((prefecture, index) => `<p>${capitalPromptStart + index}　${prefecture.name}の県庁所在地：<span class="answer-line"></span></p>`).join("")}
        </div>
      </section>
      <section class="print-section feature-section">
        <h2>② 特徴を選ぼう</h2>
        <p>${featureInstruction}</p>
        <ol class="feature-list">${featureHtml}</ol>
      </section>
    </article>

    <article class="print-page">
      ${worksheetHeader(`${regions.join("・")} ○×問題`)}
      <section class="print-section">
        <h2>③ ○×問題</h2>
        <p>正しければ○、間違っていれば×。×の文は、間違いを直そう。</p>
        <div class="ox-list">${oxHtml}</div>
      </section>
      <section class="print-section reflection-section">
        <h2>④ 振り返り</h2>
        <p>一番迷った問題（　　　　）</p>
        <p>迷った理由　一言でOK</p>
        <p class="writing-box"></p>
      </section>
    </article>

    <article class="print-page answer-page">
      ${worksheetHeader(`${regions.join("・")} 解答 自己採点用`)}
      <section class="print-section">
        <h2>⑤ 解答 自己採点</h2>
        <h3>地図問題</h3>
        ${prefectureAnswerHtml}
        ${regionAnswerHtml}
        ${capitalPrefs.map((prefecture, index) => `<p>${capitalPromptStart + index}　${prefecture.capital}</p>`).join("")}
        <h3>特徴を選ぼう</h3>
        <p>正解：${correctFeatureLetters}</p>
        <h3>○×問題</h3>
        <table class="answer-table"><thead><tr><th>番号</th><th>答え</th><th>正しい内容</th></tr></thead><tbody>${answerRows}</tbody></table>
      </section>
      <section class="print-section score-section">
        <h2>自己採点</h2>
        <p>正解数　　　　　問 ／ ${11 + mapNameCount + regions.length + capitalPrefs.length}問　　自己評価　○・△・×</p>
        <p>もう一度やる問題（　　　　　　　　　　　　　　　　　）</p>
      </section>
      <p class="source-note">地図素材：lalamalink「ディフォルメ都道府県日本地図」CC0 1.0</p>
    </article>`;

  await japanMapReady;
  const worksheetMap = $("#worksheet-map");
  worksheetMap.innerHTML = japanHighlightMapElement.innerHTML;
  paintJapanPrintRegions(worksheetMap, prefs, regions);
  showScreen(worksheetScreen);
  addJapanMapNumbers(worksheetMap, mapAnswerPrefs);
}

function worldPrintCountries(regions = activeWorldPrintRegions()) {
  return isWorldPrintAll()
    ? COUNTRIES
    : COUNTRIES.filter((country) => regions.includes(country.region));
}

function balancedWorldSample(countries, count) {
  const activeRegions = activeWorldPrintRegions();
  if (activeRegions.length === 1) return sample(countries, Math.min(count, countries.length));
  const selected = shuffle(activeRegions)
    .map((region) => sample(countries.filter((country) => country.region === region))[0])
    .filter(Boolean)
    .slice(0, count);
  const remaining = countries.filter((country) => !selected.some((item) => item.id === country.id));
  return [...selected, ...sample(remaining, Math.max(0, count - selected.length))];
}

function buildWorldBasicQuestions(regionCountries) {
  const countries = shuffle(regionCountries);
  const capitalCountries = shuffle(regionCountries.filter((country) => country.capitalQuiz !== false));
  const member = (index) => countries[index % countries.length];
  const capitalMember = (index) => capitalCountries[index % capitalCountries.length];
  const selectedRegions = activeWorldPrintRegions();
  const targetRegion = sample(selectedRegions)[0];
  const regionAnswer = sample(regionCountries.filter((country) => country.region === targetRegion))[0];
  const nearbyRegions = WORLD_REGION_CONFUSABLES[targetRegion] || [];
  const outsiders = COUNTRIES.filter((country) => country.region !== targetRegion);
  const preferredOutsiders = outsiders.filter((country) => nearbyRegions.includes(country.region));
  const pairCountry = capitalMember(2);
  const pairAnswer = `${pairCountry.name} ― ${pairCountry.capital}`;
  const pairDistractors = mismatchedPairs(pairCountry, COUNTRIES.filter((country) => country.capitalQuiz !== false), "name", "capital", WORLD_REGION_CONFUSABLES);
  const preferredFor = (country, valueKey) => {
    const regions = WORLD_REGION_CONFUSABLES[country.region] || [];
    return COUNTRIES.filter((item) => item.id !== country.id && (item.region === country.region || regions.includes(item.region)))
      .filter((item) => valueKey !== "capital" || item.capitalQuiz !== false)
      .map((item) => item[valueKey]);
  };
  return [
    {
      prompt: `${capitalMember(0).name}の首都は？`, answer: capitalMember(0).capital,
      choices: naturalChoices(capitalMember(0).capital, preferredFor(capitalMember(0), "capital"), COUNTRIES.filter((country) => country.capitalQuiz !== false).map((country) => country.capital)),
    },
    {
      prompt: `${capitalMember(1).capital}は、どの国の首都？`, answer: capitalMember(1).name,
      choices: naturalChoices(capitalMember(1).name, preferredFor(capitalMember(1), "name"), COUNTRIES.map((country) => country.name)),
    },
    {
      prompt: `${member(2).name}はどの地域？`, answer: member(2).region,
      choices: naturalChoices(member(2).region, WORLD_REGION_CONFUSABLES[member(2).region] || [], WORLD_REGIONS),
    },
    {
      prompt: `${member(3).flag} この国旗はどの国？`, answer: member(3).name,
      choices: naturalChoices(member(3).name, preferredFor(member(3), "name"), COUNTRIES.map((country) => country.name)),
    },
    {
      prompt: `${targetRegion}にある国はどれ？`, answer: regionAnswer.name,
      choices: naturalChoices(regionAnswer.name, preferredOutsiders.map((country) => country.name), outsiders.map((country) => country.name)),
    },
    {
      prompt: "国と首都の正しい組み合わせは？", answer: pairAnswer,
      choices: shuffle([pairAnswer, ...pairDistractors]),
    },
  ];
}

function buildWorldPrintOx(regionCountries) {
  const countries = shuffle(regionCountries);
  const capitalCountries = shuffle(regionCountries.filter((country) => country.capitalQuiz !== false));
  const member = (index) => countries[index % countries.length];
  const capitalMember = (index) => capitalCountries[index % capitalCountries.length];
  const wrongRegion = (country) => {
    const preferred = WORLD_REGION_CONFUSABLES[country.region] || [];
    return sample(preferred.length ? preferred : WORLD_REGIONS.filter((region) => region !== country.region))[0];
  };
  const wrongCapital = (country) => {
    const sameRegion = capitalCountries.filter((item) => item.id !== country.id);
    const pool = sameRegion.length
      ? sameRegion
      : COUNTRIES.filter((item) => item.id !== country.id && item.capitalQuiz !== false);
    return sample(pool)[0].capital;
  };
  const easy = [
    { statement: `${member(0).name}は${member(0).region}にある。`, answer: "○", correction: `${member(0).name}は${member(0).region}にある。` },
    { statement: `${capitalMember(0).name}の首都は${capitalMember(0).capital}である。`, answer: "○", correction: `${capitalMember(0).name}の首都は${capitalMember(0).capital}である。` },
    { statement: `${member(1).name}は${wrongRegion(member(1))}にある。`, answer: "×", correction: `${member(1).name}は${member(1).region}にある。` },
    { statement: `${member(2).flag}は${member(2).name}の国旗である。`, answer: "○", correction: `${member(2).flag}は${member(2).name}の国旗である。` },
    { statement: `${member(3).name}は${member(3).region}の国である。`, answer: "○", correction: `${member(3).name}は${member(3).region}の国である。` },
    { statement: `${capitalMember(1).name}の首都は${wrongCapital(capitalMember(1))}である。`, answer: "×", correction: `${capitalMember(1).name}の首都は${capitalMember(1).capital}である。` },
  ];
  const medium = [
    { statement: `${capitalMember(2).capital}は${capitalMember(2).name}の首都である。`, answer: "○", correction: `${capitalMember(2).capital}は${capitalMember(2).name}の首都である。` },
    { statement: `${capitalMember(3).name}の首都は${wrongCapital(capitalMember(3))}である。`, answer: "×", correction: `${capitalMember(3).name}の首都は${capitalMember(3).capital}である。` },
    { statement: `${capitalMember(4).capital}を首都とする${capitalMember(4).name}は${capitalMember(4).region}にある。`, answer: "○", correction: `${capitalMember(4).capital}を首都とする${capitalMember(4).name}は${capitalMember(4).region}にある。` },
  ];
  const thinkingCountry = capitalMember(5);
  const thinking = [{
    statement: `${thinkingCountry.capital}を首都とする${thinkingCountry.name}は${wrongRegion(thinkingCountry)}にある。`,
    answer: "×",
    correction: `${thinkingCountry.capital}を首都とする${thinkingCountry.name}は${thinkingCountry.region}にある。`,
  }];
  return [
    ...shuffle(easy).map((item) => ({ ...item, level: "やさしい問題" })),
    ...shuffle(medium).map((item) => ({ ...item, level: "少し考える問題" })),
    ...thinking.map((item) => ({ ...item, level: "考える問題" })),
  ];
}

function mapTargetParts(target) {
  if (!target) return [];
  if (target.matches("path, polygon, circle, ellipse")) return [target];
  const parts = [...target.querySelectorAll("path, polygon, circle, ellipse")];
  return parts.length ? parts : [target];
}

function primaryWorldMapPart(target) {
  const parts = mapTargetParts(target);
  return parts.reduce((largest, part) => {
    const rect = part.getBoundingClientRect();
    const largestRect = largest?.getBoundingClientRect();
    return !largest || rect.width * rect.height > largestRect.width * largestRect.height ? part : largest;
  }, null);
}

function paintWorldPrintCountries(container, countries, color) {
  countries.forEach((country) => {
    const target = container.querySelector(`[id="${CSS.escape(country.mapId)}"]`);
    mapTargetParts(target).forEach((part) => {
      part.style.setProperty("fill", color, "important");
      part.style.setProperty("stroke", "#334e68", "important");
      part.style.setProperty("stroke-width", "1.4", "important");
    });
  });
}

function paintWorldPrintRegions(container, countries) {
  const regions = activeWorldPrintRegions();
  const colors = new Map(regions.map((region, index) => [region, JAPAN_PRINT_REGION_COLORS[index]]));
  countries.forEach((country) => {
    const target = container.querySelector(`[id="${CSS.escape(country.mapId)}"]`);
    const color = colors.get(country.region);
    mapTargetParts(target).forEach((part) => {
      part.style.setProperty("fill", color?.fill || "#8fd3c7", "important");
      part.style.setProperty("stroke", color?.stroke || "#334e68", "important");
      part.style.setProperty("stroke-width", "1.8", "important");
      part.style.setProperty("vector-effect", "non-scaling-stroke", "important");
    });
  });
}

function worldViewBox(svg) {
  const values = (svg?.getAttribute("viewBox") || "").trim().split(/[ ,]+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return null;
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}

function worldElementBoxInSvg(svg, target) {
  if (!svg || !target) return null;
  const svgRect = svg.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const viewBox = worldViewBox(svg);
  if (!viewBox) return null;
  if (!svgRect.width || !svgRect.height || !targetRect.width || !targetRect.height || !viewBox.width || !viewBox.height) return null;
  const scale = Math.min(svgRect.width / viewBox.width, svgRect.height / viewBox.height);
  const offsetX = (svgRect.width - viewBox.width * scale) / 2;
  const offsetY = (svgRect.height - viewBox.height * scale) / 2;
  return {
    x: viewBox.x + (targetRect.left - svgRect.left - offsetX) / scale,
    y: viewBox.y + (targetRect.top - svgRect.top - offsetY) / scale,
    width: targetRect.width / scale,
    height: targetRect.height / scale,
  };
}

function fitWorldMapToCountries(container, countries) {
  const svg = container.querySelector("svg");
  if (!svg) return;
  const boxes = countries.map((country) => {
    const target = container.querySelector(`[id="${CSS.escape(country.mapId)}"]`);
    return worldElementBoxInSvg(svg, primaryWorldMapPart(target));
  }).filter((box) => box && box.width > 0 && box.height > 0);
  if (!boxes.length) return;
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  const width = maxX - minX;
  const height = maxY - minY;
  const padX = Math.max(width * 0.18, 45);
  const padY = Math.max(height * 0.2, 35);
  const viewBox = [minX - padX, minY - padY, width + padX * 2, height + padY * 2];
  svg.setAttribute("viewBox", viewBox.join(" "));
  container.dataset.regionViewbox = viewBox.map((value) => Math.round(value)).join(" ");
}

function fitWorldPrintMap(container, countries) {
  if (isWorldPrintAll()) return;
  fitWorldMapToCountries(container, countries);
}

function addWorldMapNumbers(container, countries) {
  const svg = container.querySelector("svg");
  if (!svg) return;
  const viewBox = worldViewBox(svg);
  if (!viewBox) return;
  const fontSize = Math.max(14, Math.min(54, viewBox.width * 0.03));
  countries.forEach((country, index) => {
    const target = container.querySelector(`[id="${CSS.escape(country.mapId)}"]`);
    const box = worldElementBoxInSvg(svg, primaryWorldMapPart(target));
    if (!box) return;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "world-map-number");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", fontSize * 0.72);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", y);
    text.setAttribute("font-size", fontSize);
    text.textContent = String(index + 1);
    group.append(circle, text);
    svg.append(group);
  });
}

async function setupWorldWorksheetMaps(regionCountries, mapCountries) {
  await worldMapReady;
  const locator = $("#world-locator-map");
  const detail = $("#world-worksheet-map");
  [locator, detail].forEach((container) => {
    container.innerHTML = worldMapSvgMarkup;
    const svg = container.querySelector("svg");
    if (svg && !svg.hasAttribute("viewBox")) svg.setAttribute("viewBox", `0 0 ${svg.getAttribute("width")} ${svg.getAttribute("height")}`);
    svg?.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg?.removeAttribute("width");
    svg?.removeAttribute("height");
  });
  const locatorCountries = isWorldPrintAll() ? mapCountries : regionCountries;
  if (isWorldPrintAll()) paintWorldPrintCountries(locator, locatorCountries, "#8fd3c7");
  else paintWorldPrintRegions(locator, locatorCountries);
  const zoomCountries = regionCountries.filter((country) => country.printPrimary !== false);
  fitWorldPrintMap(detail, zoomCountries);
  paintWorldPrintCountries(detail, mapCountries, "#f4a261");
  addWorldMapNumbers(detail, mapCountries);
}

async function makeWorldWorksheet() {
  const message = $("#print-message");
  message.textContent = "";
  const regionCountries = worldPrintCountries();
  if (!regionCountries.length) {
    message.textContent = "世界の地域を1つ以上選んでください。";
    return;
  }
  const mapPool = regionCountries.filter((country) => country.mapQuiz !== false && country.printPrimary !== false);
  const mapCountries = balancedWorldSample(mapPool, 5);
  const capitalMapCountries = mapCountries.filter((country) => country.capitalQuiz !== false).slice(0, 2);
  const basic = buildWorldBasicQuestions(regionCountries);
  const ox = buildWorldPrintOx(regionCountries);
  worksheetVersion += 1;
  const regionLabel = worldPrintRegionLabel();
  const title = `${regionLabel} 世界地理プリント（第${worksheetVersion}版）`;
  const worldRegionLegend = isWorldPrintAll() ? "" : `
    <div class="world-region-legend">${activeWorldPrintRegions().map((region, index) => `
      <span><i style="--swatch:${JAPAN_PRINT_REGION_COLORS[index].fill}"></i>${region}</span>`).join("")}</div>`;

  const mapPromptHtml = mapCountries.map((country, index) => `
    <p>${index + 1}　地図の「${index + 1}」の国名：<span class="answer-line"></span></p>`).join("");
  const capitalPromptHtml = capitalMapCountries.map((country, index) => `
    <p>${mapCountries.length + index + 1}　${country.name}の首都：<span class="answer-line"></span></p>`).join("");
  const basicHtml = basic.map((question, index) => `
    <div class="world-basic-question">
      <p><b>${index + 1}</b>　${question.prompt}</p>
      <div>${question.choices.map((choice, choiceIndex) => `<span>${PRINT_LETTERS[choiceIndex]}　${choice}</span>`).join("")}</div>
    </div>`).join("");
  const oxHtml = ox.map((item, index) => `
    ${index === 0 || ox[index - 1].level !== item.level ? `<h3 class="level-heading">＜${item.level}＞</h3>` : ""}
    <div class="ox-question"><span>${index + 1}</span><b>○・×</b><p>${item.statement}</p><i>×なら直す：　　　　　　　　　　　　　　　　　　　　　　　　　</i></div>`).join("");
  const basicAnswerRows = basic.map((question, index) => {
    const answerIndex = question.choices.indexOf(question.answer);
    return `<tr><td>${index + 1}</td><td>${PRINT_LETTERS[answerIndex]}</td><td>${question.answer}</td></tr>`;
  }).join("");
  const oxAnswerRows = ox.map((item, index) => `
    <tr><td>${index + 1}</td><td>${item.answer}</td><td>${item.correction}</td></tr>`).join("");
  const totalQuestions = mapCountries.length + capitalMapCountries.length + basic.length + ox.length;

  $("#worksheet-pages").innerHTML = `
    <article class="print-page world-map-page">
      ${worksheetHeader(title, true)}
      <p class="print-goal"><b>【目標】</b> ${WORLD_PRINT_WORDING.goal}</p>
      <p class="print-warmup">★まず知っていること　${WORLD_PRINT_WORDING.warmup || "聞いたことがある国名（　　　　　　　　　）　全部知らなくてもOK"}</p>
      <section class="print-section">
        <h2>① 地図問題</h2>
        <p>${WORLD_PRINT_WORDING.mapHint}</p>
        <div class="world-map-stack">
          <figure class="world-locator-figure"><figcaption>${isWorldPrintAll() ? "世界全体の位置を確認" : "どのあたり？　色の部分が今回の地域"}</figcaption><div id="world-locator-map" class="world-map world-print-map locator-map"></div>${worldRegionLegend}</figure>
          <figure class="world-detail-figure"><figcaption>${isWorldPrintAll() ? "世界全図" : `${regionLabel}と周辺の拡大図`}</figcaption><div id="world-worksheet-map" class="world-map world-print-map detail-map"></div></figure>
        </div>
        <div class="world-map-prompts">${mapPromptHtml}${capitalPromptHtml}</div>
      </section>
    </article>

    <article class="print-page world-basic-page">
      ${worksheetHeader(`${regionLabel} 基本問題`)}
      <section class="print-section">
        <h2>② 基本問題</h2>
        <p>正しいものを1つ選び、記号に丸をつけよう。予想でもOK。</p>
        <div class="world-basic-list">${basicHtml}</div>
      </section>
      <p class="print-cheer">全部分からなくても大丈夫。地図や選択肢を見て、まず1つ選ぼう。</p>
    </article>

    <article class="print-page">
      ${worksheetHeader(`${regionLabel} ○×問題`)}
      <section class="print-section">
        <h2>③ ○×問題</h2>
        <p>正しければ○、間違っていれば×。×の文は、間違いを直そう。</p>
        <div class="ox-list">${oxHtml}</div>
      </section>
      <section class="print-section reflection-section">
        <h2>④ 振り返り</h2>
        <p>一番迷った問題（　　　　）</p>
        <p>迷った理由　一言でOK</p>
        <p class="writing-box"></p>
      </section>
    </article>

    <article class="print-page answer-page world-answer-page">
      ${worksheetHeader(`${regionLabel} 解答 自己採点用`)}
      <section class="print-section">
        <h2>⑤ 解答 自己採点</h2>
        <h3>地図問題</h3>
        <div class="compact-answer-grid">
          ${mapCountries.map((country, index) => `<p>${index + 1}　${country.name}</p>`).join("")}
          ${capitalMapCountries.map((country, index) => `<p>${mapCountries.length + index + 1}　${country.capital}</p>`).join("")}
        </div>
        <h3>基本問題</h3>
        <table class="answer-table"><thead><tr><th>番号</th><th>記号</th><th>答え</th></tr></thead><tbody>${basicAnswerRows}</tbody></table>
        <h3>○×問題</h3>
        <table class="answer-table"><thead><tr><th>番号</th><th>答え</th><th>正しい内容</th></tr></thead><tbody>${oxAnswerRows}</tbody></table>
      </section>
      <section class="print-section score-section">
        <h2>自己採点</h2>
        <p>正解数　　　　　問 ／ ${totalQuestions}問　　自己評価　○・△・×</p>
        <p>もう一度やる問題（　　　　　　　　　　　　　　　　　）</p>
      </section>
      <p class="source-note">世界地図素材：Wikimedia Commons「Blank map of the world」CC0 1.0</p>
    </article>`;

  showScreen(worksheetScreen);
  await setupWorldWorksheetMaps(regionCountries, mapCountries);
}

function makeWorksheet() {
  return printMode === "world" ? makeWorldWorksheet() : makeJapanWorksheet();
}

document.addEventListener("keydown", (event) => {
  if (quizScreen.classList.contains("hidden") || locked) return;
  const index = Number(event.key) - 1;
  const buttons = [...document.querySelectorAll(".choice-button")];
  if (index >= 0 && index < buttons.length) buttons[index].click();
});

startButton.addEventListener("click", startFromSetup);
retryButton.addEventListener("click", retryWrong);
homeButton.addEventListener("click", goHome);
$("#unknown-button").addEventListener("click", () => answerQuestion(null, { skipped: true }));
$("#quit-quiz-button").addEventListener("click", showResults);
$("#leave-quiz-button").addEventListener("click", () => {
  if (window.confirm("クイズをやめてトップへ戻りますか？")) goHome();
});
$("#repeat-button").addEventListener("click", () => {
  if (lastCourseConfig) startCourse(lastCourseConfig.course, lastCourseConfig.scopes, lastCourseConfig.filters);
});
document.querySelectorAll("[data-quick-course]").forEach((button) => {
  button.addEventListener("click", () => startQuickCourse(button.dataset.quickCourse));
});
$("#open-quiz-button").addEventListener("click", () => showScreen(setupScreen));
$("#open-print-button").addEventListener("click", () => showScreen(printSetupScreen));
document.querySelectorAll("[data-go-home]").forEach((button) => button.addEventListener("click", goHome));
$("#make-print-button").addEventListener("click", makeWorksheet);
$("#remake-print-button").addEventListener("click", makeWorksheet);
$("#edit-print-button").addEventListener("click", () => showScreen(printSetupScreen));
$("#print-button").addEventListener("click", () => window.print());
[...JAPAN_REGIONS].forEach((region) => $("#japan-region-filter").add(new Option(region, region)));
[...WORLD_REGIONS].forEach((region) => $("#world-region-filter").add(new Option(region, region)));
setupPrintPicker();
updateReviewCount();
