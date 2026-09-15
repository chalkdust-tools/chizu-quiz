const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.resolve(__dirname, "..");

function stubElement() {
  const element = {
    value: "",
    checked: false,
    disabled: false,
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    hasAttribute() { return true; },
    getAttribute(name) { return name === "viewBox" ? "0 0 2000 1000" : ""; },
    append() {},
    add() {},
    replaceChildren() {},
    querySelector() { return stubElement(); },
    querySelectorAll() { return []; },
    matches() { return false; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 400 }; },
    getBBox() { return { x: 0, y: 0, width: 100, height: 100 }; },
    focus() {},
  };
  return element;
}

const elements = new Map();
const getElement = (selector) => {
  if (!elements.has(selector)) elements.set(selector, stubElement());
  return elements.get(selector);
};

const context = {
  console,
  Math,
  Date,
  Set,
  Map,
  JSON,
  Promise,
  CSS: { escape: (value) => String(value) },
  Option: function Option(text, value) { this.text = text; this.value = value; },
  localStorage: { getItem() { return null; }, setItem() {} },
  document: {
    querySelector: getElement,
    querySelectorAll() { return []; },
    createElement: stubElement,
    createElementNS: stubElement,
    createTextNode: (text) => ({ textContent: text }),
    addEventListener() {},
  },
  window: {
    INLINE_MAPS: { japan: "<svg></svg>", world: "<svg></svg>" },
    scrollTo() {},
    setTimeout() {},
    confirm() { return true; },
    print() {},
  },
};
context.globalThis = context;
vm.createContext(context);

const sources = [
  "data/prefectures.js",
  "data/countries.js",
  "data/questions.js",
  "app.js",
].map((file) => fs.readFileSync(path.join(root, file), "utf8"));

vm.runInContext(`${sources.join("\n")}
globalThis.__qa = {
  JAPAN_REGIONS, PREFECTURES, WORLD_REGIONS, COUNTRIES, QUIZ_TEMPLATES,
  makeQuestion, buildBalancedCourse, buildPrintOx, buildWorldBasicQuestions,
  buildWorldPrintOx, worldPrintCountries, selectedWorldPrintRegions,
};`, context);

const qa = context.__qa;
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const unique = (items) => new Set(items).size === items.length;

check(qa.PREFECTURES.length === 47, `都道府県数が47ではありません: ${qa.PREFECTURES.length}`);
check(unique(qa.PREFECTURES.map((item) => item.code)), "都道府県コードが重複しています");
check(unique(qa.PREFECTURES.map((item) => item.name)), "都道府県名が重複しています");
check(unique(qa.PREFECTURES.map((item) => item.capital)), "県庁所在地が重複しています");
check(qa.COUNTRIES.length >= 30 && qa.COUNTRIES.length <= 40, `主要国数が想定外です: ${qa.COUNTRIES.length}`);
check(unique(qa.COUNTRIES.map((item) => item.id)), "国IDが重複しています");
check(unique(qa.COUNTRIES.map((item) => item.name)), "国名が重複しています");
check(unique(qa.QUIZ_TEMPLATES.map((item) => item.id)), "問題テンプレートIDが重複しています");

for (const template of qa.QUIZ_TEMPLATES) {
  const entities = template.kind.startsWith("jp-") ? qa.PREFECTURES : qa.COUNTRIES;
  for (const entity of entities) {
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const question = qa.makeQuestion(template, entity, iteration);
      if (!question) continue;
      check(Boolean(question.prompt && question.answer && question.explanation), `${template.id}/${entity.name}: 問題文・答え・短い解説の欠落`);
      check(unique(question.choices), `${template.id}/${entity.name}: 選択肢重複 [${question.choices.join(" / ")}]`);
      if (question.choices.length) {
        check(question.choices.filter((choice) => choice === question.answer).length === 1, `${template.id}/${entity.name}: 正解が選択肢に1つではありません`);
        check(question.choices.length === (question.choices.includes("○") ? 2 : 4), `${template.id}/${entity.name}: 選択肢数が不正です`);
      }
      if (template.kind.endsWith("pair") && question.choices.length === 4) {
        const source = template.kind.startsWith("jp-") ? qa.PREFECTURES : qa.COUNTRIES.filter((item) => item.capitalQuiz !== false);
        const correctPairs = new Set(source.map((item) => `${item.name} ― ${item.capital}`));
        check(question.choices.filter((choice) => correctPairs.has(choice)).length === 1, `${template.id}/${entity.name}: 正しい組み合わせが1つではありません`);
      }
    }
  }
}

for (let iteration = 0; iteration < 40; iteration += 1) {
  const course = qa.buildBalancedCourse(qa.QUIZ_TEMPLATES.map((item) => item.scope).filter((scope, index, all) => all.indexOf(scope) === index), 20);
  check(course.length === 20, `20問コースが${course.length}問です`);
  check(course.every((question, index) => index === 0 || question.knowledgeKey !== course[index - 1].knowledgeKey), "同じ知識が連続しています");
  check(course.every((question, index) => index === 0 || question.templateId !== course[index - 1].templateId), "同じ形式が連続しています");
}

const japanSelections = [
  ["東北"], ["東北", "関東"], ["中部", "近畿", "中国"], ["中国", "四国", "九州・沖縄"],
];
for (const regions of japanSelections) {
  const selected = qa.PREFECTURES.filter((item) => regions.includes(item.region));
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const ox = qa.buildPrintOx(selected);
    check(ox.length === 10, `日本${regions.join("・")}: ○×が10問ではありません`);
    check(ox.filter((item) => item.answer === "○").length === 6, `日本${regions.join("・")}: ○の数が6ではありません`);
    check(unique(ox.map((item) => item.statement)), `日本${regions.join("・")}: 同一文が重複しています`);
    check(ox.every((item) => item.correction && ["○", "×"].includes(item.answer)), `日本${regions.join("・")}: 解答・訂正文の欠落`);
  }
}

const worldSelections = [
  ["東アジア"], ["東アジア", "東南アジア"], ["ヨーロッパ", "北アメリカ"], ["南アメリカ", "アフリカ", "オセアニア"],
];
for (const regions of worldSelections) {
  qa.selectedWorldPrintRegions.clear();
  regions.forEach((region) => qa.selectedWorldPrintRegions.add(region));
  const selected = qa.worldPrintCountries();
  check(selected.length === qa.COUNTRIES.filter((item) => regions.includes(item.region)).length, `世界${regions.join("・")}: 選択国数が一致しません`);
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const basic = qa.buildWorldBasicQuestions(selected);
    const ox = qa.buildWorldPrintOx(selected);
    check(basic.length === 6, `世界${regions.join("・")}: 基本問題が6問ではありません`);
    check(basic.every((item) => item.choices.length === 4 && unique(item.choices) && item.choices.filter((choice) => choice === item.answer).length === 1), `世界${regions.join("・")}: 基本問題の選択肢不良`);
    check(ox.length === 10, `世界${regions.join("・")}: ○×が10問ではありません`);
    check(ox.filter((item) => item.answer === "○").length === 6, `世界${regions.join("・")}: ○の数が6ではありません`);
    check(unique(ox.map((item) => item.statement)), `世界${regions.join("・")}: 同一文が重複しています`);
  }
}

if (failures.length) {
  console.error(`品質検査: ${failures.length}件の問題`);
  [...new Set(failures)].slice(0, 50).forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("品質検査: 合格");
console.log(`- 都道府県 ${qa.PREFECTURES.length}件 / 主要国 ${qa.COUNTRIES.length}件 / テンプレート ${qa.QUIZ_TEMPLATES.length}種類`);
console.log("- 全テンプレート×全対象×8回、20問コース40回を検査");
console.log("- 日本4条件×30回、世界4条件×30回のプリント問題を検査");
