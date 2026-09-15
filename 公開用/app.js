// =========================================================
// 社会科 基礎地図トレーニング アプリ本体
//
// 「知識データ」(data/japan-data.js, data/world-data.js) と
// 「問題テンプレート」(このファイルの中の gen〜 関数たち) を
// 組み合わせて問題を作る構造になっています。
//
// 問題データ自体を増やしたいときはデータファイルを、
// 出題の「聞き方」を増やしたいときはこのファイルの
// TEMPLATES 一覧に新しい gen〜 関数を足してください。
// =========================================================

// ---------- 小さな便利関数 ----------
function randInt(n) {
  return Math.floor(Math.random() * n);
}
function randomItem(arr) {
  return arr[randInt(arr.length)];
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sampleN(arr, n) {
  return shuffle(arr).slice(0, n);
}
function sampleExcluding(arr, excludeFn, n) {
  return sampleN(arr.filter((x) => !excludeFn(x)), n);
}
function stripAreaSuffix(name) {
  return name.replace(/(都|道|府|県)$/, "");
}
function stripCitySuffix(name) {
  return name.replace(/(市|区)$/, "");
}

const ALL_CATEGORIES = ["jpMap", "jpCapital", "jpRegion", "worldMap", "worldCapital", "worldFlag"];

// ---------- 難易度づくりの下ごしらえ ----------
// 県名と県庁所在地（国名と首都）がほぼ同じ文字の場合、「○○の県庁所在地は？」を
// 逆から聞くだけで答えが問題文に出てしまい、「少し考える」「考える」問題として
// 成立しなくなる。そうした項目は、逆読み・組み合わせ系の問題では使わないようにする。
function isJpCapitalObvious(pref) {
  return stripAreaSuffix(pref.name) === stripCitySuffix(pref.capital);
}
function isWorldCapitalObvious(country) {
  // 完全一致（シンガポールなど）に加えて、首都名が国名をそのまま含む場合
  // （メキシコ→メキシコシティ など）も答えが推測できてしまうため対象にする
  return country.name === country.capital || country.capital.includes(country.name);
}
// 候補が1つもなくなっても、答えが露骨になる項目まで戻して無理に使わない
// （呼び出し側は、空配列が返ってきたらそのテンプレートをスキップする）
function nonObviousJpItems(pool) {
  return pool.filter((p) => !isJpCapitalObvious(p));
}
function nonObviousWorldItems(pool) {
  return pool.filter((c) => !isWorldCapitalObvious(c));
}

// できるだけ「本当にまぎらわしい」ひっかけ選択肢にするため、同じ地方・地域の
// 項目を半分くらい混ぜつつ、残りは全体から選ぶ（全部が近い項目・全部が
// 遠く離れた項目、のどちらかに偏らないようにする）
// 同じ地方・地域だけで十分な数（n個以上）そろうなら、そこだけから選ぶ。
// 足りないときだけ、残りを全国・全世界から補う。
function pickMixedDecoys(pool, exclude, n) {
  const sameRegion = pool.filter((x) => x.id !== exclude.id && x.region === exclude.region);
  if (sameRegion.length >= n) return sampleN(sameRegion, n);
  const usedIds = new Set([exclude.id, ...sameRegion.map((x) => x.id)]);
  const rest = pool.filter((x) => !usedIds.has(x.id));
  const far = sampleN(rest, n - sameRegion.length);
  return shuffle([...sameRegion, ...far]);
}

// ○×問題で「まちがった方」を見せるときも、同じ地方・地域からの方が
// 単純な遠い県名・国名の入れ替えより、まぎらわしく・実践的になる
// 同じ地方・地域に候補があれば必ずそこから選ぶ（100%）。
// 候補がまったくない（北海道など）ときだけ全国・全世界から選ぶ。
function pickMaruBatsuDonor(pool, exclude) {
  const sameRegion = pool.filter((x) => x.id !== exclude.id && x.region === exclude.region);
  if (sameRegion.length) return randomItem(sameRegion);
  return randomItem(pool.filter((x) => x.id !== exclude.id));
}

// ---------- 国旗の表示（絵文字ではなくローカルのSVG画像ファイルを使う） ----------
// Windows等の環境によっては国旗の絵文字が「JP」のような文字表示になってしまうため、
// assets/flags/ に保存した本物のSVG画像を <img> で表示する。
// ファイル名は国データの id と対応している（例: id "jp" → assets/flags/jp.svg）。
function buildFlagImg(countryId, extraClass) {
  const country = WORLD_COUNTRIES.find((c) => c.id === countryId);
  const name = country ? country.name : "";
  const img = document.createElement("img");
  img.src = `assets/flags/${countryId}.svg`;
  img.alt = name ? `${name}の国旗` : "国旗";
  img.className = "flag-img" + (extraClass ? " " + extraClass : "");
  img.onerror = () => {
    img.onerror = null;
    const fallback = document.createElement("span");
    fallback.className = "flag-fallback";
    fallback.textContent = name ? `${name}（国旗画像を表示できません）` : "国旗画像を表示できません";
    img.replaceWith(fallback);
  };
  return img;
}

// targets（複数）それぞれに対して、できるだけ「その項目と同じ地方・地域」から
// 借りてきた、重複しないドナーを1つずつ選ぶ（組み合わせ問題のひっかけ用）
function pickDistinctDonors(pool, targets) {
  const used = new Set();
  const donors = [];
  for (const t of targets) {
    const avail = pool.filter((p) => !used.has(p.id));
    if (avail.length === 0) return null;
    const donor = pickMaruBatsuDonor(avail, t);
    donors.push(donor);
    used.add(donor.id);
  }
  return donors;
}

// ---------- 問題オブジェクトの共通の組み立て ----------
function makeChoiceQuestion(category, prompt, correctLabel, wrongLabels, extra) {
  const choices = shuffle([
    { label: correctLabel, correct: true },
    ...wrongLabels.map((label) => ({ label, correct: false })),
  ]);
  return Object.assign(
    {
      category,
      prompt,
      mapMode: null,
      mapHighlight: null,
      mapClickable: false,
      targetId: null,
      flagPrompt: null,
      isFlagChoices: false,
      choices,
      answerText: correctLabel,
      itemIds: [],
    },
    extra || {}
  );
}

function makeTrueFalseQuestion(category, statement, isTrue, factText, extra) {
  return makeChoiceQuestion(
    category,
    statement,
    isTrue ? "○" : "×",
    [isTrue ? "×" : "○"],
    Object.assign({ isTrueFalse: true, answerText: isTrue ? "○（正しい）" : `×　正しくは「${factText}」` }, extra || {})
  );
}

// ---------- 出題範囲の絞り込み（任意フィルタ）に対応した知識プール ----------
// 地方・地域は複数選べるので、フィルタは配列で持つ（空配列＝絞り込みなし）
function getJpPool() {
  const regions = state.filters.jpRegions;
  return regions && regions.length ? JAPAN_PREFECTURES.filter((p) => regions.includes(p.region)) : JAPAN_PREFECTURES;
}
function getWorldPool() {
  const regions = state.filters.worldRegions;
  return regions && regions.length ? WORLD_COUNTRIES.filter((c) => regions.includes(c.region)) : WORLD_COUNTRIES;
}
// 「○○地方にある県は？」のような、地方そのものを1つ選ぶ系の問題で使う
// （複数選んでいれば、その中からランダムに1つ）
function pickJpRegionForQuestion() {
  const regions = state.filters.jpRegions;
  return regions && regions.length ? randomItem(regions) : randomItem(JAPAN_REGIONS);
}
function pickWorldRegionForQuestion() {
  const regions = state.filters.worldRegions;
  return regions && regions.length ? randomItem(regions) : randomItem(WORLD_REGIONS);
}

// 複数の地方・地域を選んでいるとき、県・国の数が多い地方に問題が偏らないよう、
// 先に地方・地域をランダムに1つ選び、そのあとでその中から項目を選ぶ（2段階抽選）。
// 絞り込みなしのときは、これまで通りプール全体から直接選ぶ。
// pool にはあらかじめ絞り込んだ候補（nonObvious等）を渡してもよく、選んだ地方に
// 候補が1つもない場合は他の地方を順に試し、それでも無ければ null を返す。
function pickBalancedItem(pool, regions) {
  if (regions && regions.length) {
    for (const region of shuffle(regions)) {
      const inRegion = pool.filter((x) => x.region === region);
      if (inRegion.length) return randomItem(inRegion);
    }
    return null;
  }
  return pool.length ? randomItem(pool) : null;
}
function pickBalancedJpItem() {
  return pickBalancedItem(getJpPool(), state.filters.jpRegions);
}
function pickBalancedWorldItem() {
  return pickBalancedItem(getWorldPool(), state.filters.worldRegions);
}
function pickBalancedNonObviousJpItem() {
  return pickBalancedItem(nonObviousJpItems(getJpPool()), state.filters.jpRegions);
}
function pickBalancedNonObviousWorldItem() {
  return pickBalancedItem(nonObviousWorldItems(getWorldPool()), state.filters.worldRegions);
}

// =========================================================
// 日本地理：問題テンプレート
// すべて (forcedItem) を受け取れるようにしてあります。
// forcedItem を渡すと、その県について出題します（まちがえた問題の再出題・復習で使用）。
// =========================================================
function genJpMapToName(forcedItem) {
  const pref = forcedItem || pickBalancedJpItem();
  const wrongs = pickMixedDecoys(JAPAN_PREFECTURES, pref, 3).map((p) => p.name);
  return makeChoiceQuestion("jpMap", "地図で色がついているのはどこ？", pref.name, wrongs, {
    mapMode: "japan",
    mapHighlight: pref.id,
    itemIds: [pref.id],
  });
}

function genJpNameToMap(forcedItem) {
  const pref = forcedItem || pickBalancedJpItem();
  return {
    category: "jpMap",
    prompt: `「${pref.name}」はどこ？ 地図をタップしよう`,
    mapMode: "japan",
    mapHighlight: null,
    mapClickable: true,
    targetId: pref.id,
    flagPrompt: null,
    isFlagChoices: false,
    choices: null,
    answerText: pref.name,
    itemIds: [pref.id],
  };
}

function genJpMapToRegion(forcedItem) {
  const pref = forcedItem || pickBalancedJpItem();
  const wrongs = sampleExcluding(JAPAN_REGIONS, (r) => r === pref.region, 3);
  return makeChoiceQuestion("jpMap", "地図で色がついている都道府県は何地方？", pref.region, wrongs, {
    mapMode: "japan",
    mapHighlight: pref.id,
    itemIds: [pref.id],
  });
}

function genJpMapToCapital(forcedItem) {
  const pref = forcedItem || pickBalancedJpItem();
  const wrongs = pickMixedDecoys(JAPAN_PREFECTURES, pref, 3).map((p) => p.capital);
  return makeChoiceQuestion("jpMap", "地図で色がついている都道府県の県庁所在地は？", pref.capital, wrongs, {
    mapMode: "japan",
    mapHighlight: pref.id,
    itemIds: [pref.id],
  });
}

// 地図読み取り＋県庁所在地の知識を組み合わせる「考える」問題。
// （県名と県庁所在地が同じ文字かどうか、ではなく、○×はランダムに半々にして、
// 　地図から県を特定したうえで正しい組み合わせか判断させる）
function genJpMapCapitalCheck(forcedItem) {
  const pref = forcedItem || pickBalancedJpItem();
  const isTrue = Math.random() < 0.5;
  const shown = isTrue ? pref.capital : pickMaruBatsuDonor(JAPAN_PREFECTURES, pref).capital;
  const statement = `地図で色がついている都道府県の県庁所在地は「${shown}」である`;
  return makeTrueFalseQuestion("jpMap", statement, isTrue, `${pref.name}の県庁所在地は${pref.capital}`, {
    mapMode: "japan",
    mapHighlight: pref.id,
    itemIds: [pref.id],
  });
}

function genJpPrefToRegion(forcedItem) {
  const pref = forcedItem || pickBalancedJpItem();
  const wrongs = sampleExcluding(JAPAN_REGIONS, (r) => r === pref.region, 3);
  return makeChoiceQuestion("jpRegion", `${pref.name}は何地方？`, pref.region, wrongs, { itemIds: [pref.id] });
}

function genJpRegionToPref() {
  const region = pickJpRegionForQuestion();
  const inRegion = JAPAN_PREFECTURES.filter((p) => p.region === region);
  const correct = randomItem(inRegion);
  const wrongs = sampleExcluding(JAPAN_PREFECTURES, (p) => p.region === region, 3).map((p) => p.name);
  return makeChoiceQuestion("jpRegion", `${region}にある県はどれ？`, correct.name, wrongs, { itemIds: [correct.id] });
}

function genJpRegionNotIn() {
  const region = pickJpRegionForQuestion();
  const inRegion = JAPAN_PREFECTURES.filter((p) => p.region === region);
  const outRegion = JAPAN_PREFECTURES.filter((p) => p.region !== region);
  if (inRegion.length < 3) return null; // 北海道など県が少ない地方はスキップ
  const decoys = sampleN(inRegion, 3).map((p) => p.name);
  const correct = randomItem(outRegion);
  return makeChoiceQuestion("jpRegion", `${region}に「ない」県はどれ？`, correct.name, decoys, { itemIds: [correct.id] });
}

function genJpRegionMaruBatsu(forcedItem) {
  const pref = forcedItem || pickBalancedJpItem();
  const isTrue = Math.random() < 0.5;
  const shown = isTrue ? pref.region : randomItem(JAPAN_REGIONS.filter((r) => r !== pref.region));
  const statement = `${pref.name}は${shown}地方にある`;
  return makeTrueFalseQuestion("jpRegion", statement, isTrue, `${pref.name}は${pref.region}地方`, { itemIds: [pref.id] });
}

function genJpPairSameRegion() {
  const a = pickBalancedJpItem();
  if (!a) return null;
  const wantTrue = Math.random() < 0.5;
  let partner;
  if (wantTrue) {
    const sameRegion = JAPAN_PREFECTURES.filter((x) => x.id !== a.id && x.region === a.region);
    partner = sameRegion.length ? randomItem(sameRegion) : randomItem(JAPAN_PREFECTURES.filter((x) => x.id !== a.id));
  } else {
    const outside = JAPAN_PREFECTURES.filter((x) => x.region !== a.region);
    partner = outside.length ? randomItem(outside) : randomItem(JAPAN_PREFECTURES.filter((x) => x.id !== a.id));
  }
  const isTrue = partner.region === a.region;
  return makeTrueFalseQuestion(
    "jpRegion",
    `${a.name}と${partner.name}は同じ地方にある`,
    isTrue,
    `${a.name}は${a.region}地方、${partner.name}は${partner.region}地方`,
    { itemIds: [a.id, partner.id] }
  );
}

function genJpRegionToCapital(forcedItem) {
  const region = forcedItem ? forcedItem.region : pickJpRegionForQuestion();
  const inRegion = JAPAN_PREFECTURES.filter((p) => p.region === region);
  const correct = forcedItem && forcedItem.region === region ? forcedItem : randomItem(inRegion);
  const wrongs = sampleExcluding(JAPAN_PREFECTURES, (p) => p.region === region, 3).map((p) => p.capital);
  return makeChoiceQuestion("jpRegion", `次のうち${region}地方の県庁所在地はどれ？`, correct.capital, wrongs, {
    itemIds: [correct.id],
  });
}

function genJpCapitalToRegion(forcedItem) {
  const pref = forcedItem || pickBalancedJpItem();
  const wrongs = sampleExcluding(JAPAN_REGIONS, (r) => r === pref.region, 3);
  return makeChoiceQuestion("jpCapital", `県庁所在地が${pref.capital}の県は、何地方？`, pref.region, wrongs, {
    itemIds: [pref.id],
  });
}

function genJpPrefToCapital(forcedItem) {
  const pref = forcedItem || pickBalancedJpItem();
  const wrongs = pickMixedDecoys(JAPAN_PREFECTURES, pref, 3).map((p) => p.capital);
  return makeChoiceQuestion("jpCapital", `${pref.name}の県庁所在地は？`, pref.capital, wrongs, { itemIds: [pref.id] });
}

// 「県庁所在地→県」の逆読み。県名と県庁所在地がほぼ同じ県だと、
// 問題文に答えがそのまま出てしまうので、そうした県は対象からはずす。
function genJpCapitalToPref(forcedItem) {
  const pref = forcedItem || pickBalancedNonObviousJpItem();
  if (!pref || isJpCapitalObvious(pref)) return null;
  const wrongs = pickMixedDecoys(JAPAN_PREFECTURES, pref, 3).map((p) => p.name);
  return makeChoiceQuestion("jpCapital", `県庁所在地が${pref.capital}なのはどこ？`, pref.name, wrongs, { itemIds: [pref.id] });
}

function genJpCapitalMaruBatsu(forcedItem) {
  const pref = forcedItem || pickBalancedJpItem();
  const isTrue = Math.random() < 0.5;
  const shown = isTrue ? pref.capital : pickMaruBatsuDonor(JAPAN_PREFECTURES, pref).capital;
  const statement = `${pref.name}の県庁所在地は「${shown}」である`;
  return makeTrueFalseQuestion("jpCapital", statement, isTrue, `${pref.name}の県庁所在地は${pref.capital}`, {
    itemIds: [pref.id],
  });
}

function genJpCapitalNameMatch(forcedItem) {
  const pref = forcedItem || pickBalancedJpItem();
  const same = stripAreaSuffix(pref.name) === stripCitySuffix(pref.capital);
  const statement = `${pref.name}の県庁所在地は、県名と同じ漢字で書く`;
  return makeTrueFalseQuestion(
    "jpCapital",
    statement,
    same,
    same ? `${pref.name}の県庁所在地は県名と同じ` : `${pref.name}の県庁所在地は${pref.capital}`,
    { itemIds: [pref.id] }
  );
}

// 「県と県庁所在地の組み合わせで、まちがっているものはどれ？」
// 4組のうち1組だけ、県庁所在地をよそから借りてきて入れ替える。
// 誤答候補・借りてくる県庁所在地とも、できるだけ同じ地方・地域から選ぶことで、
// 「明らかに遠い県との入れ替え」ではなく、実際に紛らわしい組み合わせにする
function genJpCapitalPairWrong(forcedItem) {
  const wrongOne = forcedItem || pickBalancedJpItem();
  const others = pickMixedDecoys(JAPAN_PREFECTURES, wrongOne, 3);
  if (others.length < 3) return null;
  const group = shuffle([wrongOne, ...others]);
  const donorPool = JAPAN_PREFECTURES.filter((p) => !group.some((g) => g.id === p.id));
  if (donorPool.length === 0) return null;
  const donor = pickMaruBatsuDonor(donorPool, wrongOne);
  const choices = group.map((p) => (p.id === wrongOne.id ? `${p.name} － ${donor.capital}` : `${p.name} － ${p.capital}`));
  const correctLabel = `${wrongOne.name} － ${donor.capital}`;
  const wrongLabels = choices.filter((c) => c !== correctLabel);
  return makeChoiceQuestion("jpCapital", "県と県庁所在地の組み合わせで、まちがっているものはどれ？", correctLabel, wrongLabels, {
    itemIds: [wrongOne.id],
  });
}

// 「県と県庁所在地の正しい組み合わせはどれ？」
// 4組のうち1組だけ正しい組み合わせにし、残り3組はよそから借りてきて入れ替える。
// 正しい役は、県名と県庁所在地がほぼ同じ県だと見た目だけで分かってしまうため使わない。
function genJpCapitalPairRight(forcedItem) {
  const rightOne = forcedItem || pickBalancedNonObviousJpItem();
  if (!rightOne || isJpCapitalObvious(rightOne)) return null;
  const decoys = pickMixedDecoys(JAPAN_PREFECTURES, rightOne, 3);
  if (decoys.length < 3) return null;
  const donorPool = JAPAN_PREFECTURES.filter((p) => p.id !== rightOne.id && !decoys.some((d) => d.id === p.id));
  const donors = pickDistinctDonors(donorPool, decoys);
  if (!donors) return null;
  const group = shuffle([rightOne, ...decoys]);
  const choices = group.map((p) => {
    if (p.id === rightOne.id) return `${p.name} － ${p.capital}`;
    const idx = decoys.findIndex((d) => d.id === p.id);
    return `${p.name} － ${donors[idx].capital}`;
  });
  const correctLabel = `${rightOne.name} － ${rightOne.capital}`;
  const wrongLabels = choices.filter((c) => c !== correctLabel);
  return makeChoiceQuestion("jpCapital", "県と県庁所在地の正しい組み合わせはどれ？", correctLabel, wrongLabels, {
    itemIds: [rightOne.id],
  });
}

// =========================================================
// 世界地理：問題テンプレート
// =========================================================
function genWorldMapToName(forcedItem) {
  const c = forcedItem || pickBalancedWorldItem();
  const wrongs = pickMixedDecoys(WORLD_COUNTRIES, c, 3).map((x) => x.name);
  return makeChoiceQuestion("worldMap", "地図で色がついている国はどこ？", c.name, wrongs, {
    mapMode: "world",
    mapHighlight: c.id,
    itemIds: [c.id],
  });
}

function genWorldMapClick(forcedItem) {
  const c = forcedItem || pickBalancedWorldItem();
  return {
    category: "worldMap",
    prompt: `「${c.name}」はどこ？ 地図をタップしよう`,
    mapMode: "world",
    mapHighlight: null,
    mapClickable: true,
    targetId: c.id,
    flagPrompt: null,
    isFlagChoices: false,
    choices: null,
    answerText: c.name,
    itemIds: [c.id],
  };
}

function genWorldMapToRegion(forcedItem) {
  const c = forcedItem || pickBalancedWorldItem();
  const wrongs = sampleExcluding(WORLD_REGIONS, (r) => r === c.region, 3);
  return makeChoiceQuestion("worldMap", "地図で色がついている国は、どの地域？", c.region, wrongs, {
    mapMode: "world",
    mapHighlight: c.id,
    itemIds: [c.id],
  });
}

function genWorldMapToCapital(forcedItem) {
  const c = forcedItem || pickBalancedWorldItem();
  const wrongs = pickMixedDecoys(WORLD_COUNTRIES, c, 3).map((x) => x.capital);
  return makeChoiceQuestion("worldMap", "地図で色がついている国の首都は？", c.capital, wrongs, {
    mapMode: "world",
    mapHighlight: c.id,
    itemIds: [c.id],
  });
}

function genWorldCountryToRegion(forcedItem) {
  const c = forcedItem || pickBalancedWorldItem();
  const wrongs = sampleExcluding(WORLD_REGIONS, (r) => r === c.region, 3);
  return makeChoiceQuestion("worldMap", `${c.name}はどの地域？`, c.region, wrongs, { itemIds: [c.id] });
}

function genWorldRegionToCountry() {
  const region = pickWorldRegionForQuestion();
  const inRegion = WORLD_COUNTRIES.filter((c) => c.region === region);
  const correct = randomItem(inRegion);
  const wrongs = sampleExcluding(WORLD_COUNTRIES, (c) => c.region === region, 3).map((c) => c.name);
  return makeChoiceQuestion("worldMap", `${region}にある国はどれ？`, correct.name, wrongs, { itemIds: [correct.id] });
}

function genWorldRegionNotIn() {
  const region = pickWorldRegionForQuestion();
  const inRegion = WORLD_COUNTRIES.filter((c) => c.region === region);
  const outRegion = WORLD_COUNTRIES.filter((c) => c.region !== region);
  if (inRegion.length < 3) return null;
  const decoys = sampleN(inRegion, 3).map((c) => c.name);
  const correct = randomItem(outRegion);
  return makeChoiceQuestion("worldMap", `${region}に「ない」国はどれ？`, correct.name, decoys, { itemIds: [correct.id] });
}

function genWorldRegionMaruBatsu(forcedItem) {
  const c = forcedItem || pickBalancedWorldItem();
  const isTrue = Math.random() < 0.5;
  const shown = isTrue ? c.region : randomItem(WORLD_REGIONS.filter((r) => r !== c.region));
  const statement = `${c.name}は${shown}にある`;
  return makeTrueFalseQuestion("worldMap", statement, isTrue, `${c.name}は${c.region}`, { itemIds: [c.id] });
}

function genWorldPairSameRegion() {
  const a = pickBalancedWorldItem();
  if (!a) return null;
  const wantTrue = Math.random() < 0.5;
  let partner;
  if (wantTrue) {
    const sameRegion = WORLD_COUNTRIES.filter((x) => x.id !== a.id && x.region === a.region);
    partner = sameRegion.length ? randomItem(sameRegion) : randomItem(WORLD_COUNTRIES.filter((x) => x.id !== a.id));
  } else {
    const outside = WORLD_COUNTRIES.filter((x) => x.region !== a.region);
    partner = outside.length ? randomItem(outside) : randomItem(WORLD_COUNTRIES.filter((x) => x.id !== a.id));
  }
  const isTrue = partner.region === a.region;
  return makeTrueFalseQuestion(
    "worldMap",
    `${a.name}と${partner.name}は同じ地域にある`,
    isTrue,
    `${a.name}は${a.region}、${partner.name}は${partner.region}`,
    { itemIds: [a.id, partner.id] }
  );
}

function genWorldRegionToCapital(forcedItem) {
  const region = forcedItem ? forcedItem.region : pickWorldRegionForQuestion();
  const inRegion = WORLD_COUNTRIES.filter((c) => c.region === region);
  const correct = forcedItem && forcedItem.region === region ? forcedItem : randomItem(inRegion);
  const wrongs = sampleExcluding(WORLD_COUNTRIES, (c) => c.region === region, 3).map((c) => c.capital);
  return makeChoiceQuestion("worldMap", `次のうち${region}にある国の首都はどれ？`, correct.capital, wrongs, {
    itemIds: [correct.id],
  });
}

function genWorldCapitalToRegion(forcedItem) {
  const c = forcedItem || pickBalancedWorldItem();
  const wrongs = sampleExcluding(WORLD_REGIONS, (r) => r === c.region, 3);
  return makeChoiceQuestion("worldCapital", `首都が${c.capital}の国はどの地域？`, c.region, wrongs, { itemIds: [c.id] });
}

function genWorldFlagToRegion(forcedItem) {
  const c = forcedItem || pickBalancedWorldItem();
  const wrongs = sampleExcluding(WORLD_REGIONS, (r) => r === c.region, 3);
  return makeChoiceQuestion("worldFlag", "この国旗の国は、どの地域にある？", c.region, wrongs, {
    flagPrompt: c.id,
    itemIds: [c.id],
  });
}

// 国旗の選択肢は、表示のときに country id から実際のSVG画像を組み立てるため、
// choice の label には id を入れ、answerText だけ読みやすい国名にしておく。
function genWorldRegionToFlag() {
  const region = pickWorldRegionForQuestion();
  const inRegion = WORLD_COUNTRIES.filter((c) => c.region === region);
  if (inRegion.length === 0) return null;
  const correct = randomItem(inRegion);
  const wrongFlags = sampleExcluding(WORLD_COUNTRIES, (c) => c.region === region, 3).map((c) => c.id);
  return makeChoiceQuestion("worldMap", `次のうち${region}にある国の国旗はどれ？`, correct.id, wrongFlags, {
    isFlagChoices: true,
    itemIds: [correct.id],
    answerText: correct.name,
  });
}

function genWorldCountryToCapital(forcedItem) {
  const c = forcedItem || pickBalancedWorldItem();
  const wrongs = pickMixedDecoys(WORLD_COUNTRIES, c, 3).map((x) => x.capital);
  return makeChoiceQuestion("worldCapital", `${c.name}の首都は？`, c.capital, wrongs, { itemIds: [c.id] });
}

// 「首都→国」の逆読み。国名と首都名がほぼ同じ国（このデータではシンガポールのみ）は、
// 問題文に答えがそのまま出てしまうので対象からはずす。
function genWorldCapitalToCountry(forcedItem) {
  const c = forcedItem || pickBalancedNonObviousWorldItem();
  if (!c || isWorldCapitalObvious(c)) return null;
  const wrongs = pickMixedDecoys(WORLD_COUNTRIES, c, 3).map((x) => x.name);
  return makeChoiceQuestion("worldCapital", `首都が${c.capital}なのはどこ？`, c.name, wrongs, { itemIds: [c.id] });
}

function genWorldCapitalMaruBatsu(forcedItem) {
  const c = forcedItem || pickBalancedWorldItem();
  const isTrue = Math.random() < 0.5;
  const shown = isTrue ? c.capital : pickMaruBatsuDonor(WORLD_COUNTRIES, c).capital;
  const statement = `${c.name}の首都は「${shown}」である`;
  return makeTrueFalseQuestion("worldCapital", statement, isTrue, `${c.name}の首都は${c.capital}`, { itemIds: [c.id] });
}

// 「国と首都の組み合わせで、まちがっているものはどれ？」（考える）
// 誤答候補・借りてくる首都とも、できるだけ同じ地域から選ぶことで、
// 「明らかに遠い国との入れ替え」ではなく、実際に紛らわしい組み合わせにする
function genWorldCapitalPairWrong(forcedItem) {
  const wrongOne = forcedItem || pickBalancedWorldItem();
  const others = pickMixedDecoys(WORLD_COUNTRIES, wrongOne, 3);
  if (others.length < 3) return null;
  const group = shuffle([wrongOne, ...others]);
  const donorPool = WORLD_COUNTRIES.filter((x) => !group.some((g) => g.id === x.id));
  if (donorPool.length === 0) return null;
  const donor = pickMaruBatsuDonor(donorPool, wrongOne);
  const choices = group.map((x) => (x.id === wrongOne.id ? `${x.name} － ${donor.capital}` : `${x.name} － ${x.capital}`));
  const correctLabel = `${wrongOne.name} － ${donor.capital}`;
  const wrongLabels = choices.filter((c) => c !== correctLabel);
  return makeChoiceQuestion("worldCapital", "国と首都の組み合わせで、まちがっているものはどれ？", correctLabel, wrongLabels, {
    itemIds: [wrongOne.id],
  });
}

// 「国と首都の正しい組み合わせはどれ？」（考える）
// 正しい役は、国名と首都名がほぼ同じ国だと見た目だけで分かってしまうため使わない。
function genWorldCapitalPairRight(forcedItem) {
  const rightOne = forcedItem || pickBalancedNonObviousWorldItem();
  if (!rightOne || isWorldCapitalObvious(rightOne)) return null;
  const decoys = pickMixedDecoys(WORLD_COUNTRIES, rightOne, 3);
  if (decoys.length < 3) return null;
  const donorPool = WORLD_COUNTRIES.filter((x) => x.id !== rightOne.id && !decoys.some((d) => d.id === x.id));
  const donors = pickDistinctDonors(donorPool, decoys);
  if (!donors) return null;
  const group = shuffle([rightOne, ...decoys]);
  const choices = group.map((x) => {
    if (x.id === rightOne.id) return `${x.name} － ${x.capital}`;
    const idx = decoys.findIndex((d) => d.id === x.id);
    return `${x.name} － ${donors[idx].capital}`;
  });
  const correctLabel = `${rightOne.name} － ${rightOne.capital}`;
  const wrongLabels = choices.filter((c) => c !== correctLabel);
  return makeChoiceQuestion("worldCapital", "国と首都の正しい組み合わせはどれ？", correctLabel, wrongLabels, {
    itemIds: [rightOne.id],
  });
}

function genWorldFlagToCountry(forcedItem) {
  const c = forcedItem || pickBalancedWorldItem();
  const wrongs = pickMixedDecoys(WORLD_COUNTRIES, c, 3).map((x) => x.name);
  return makeChoiceQuestion("worldFlag", "この国旗はどこの国？", c.name, wrongs, { flagPrompt: c.id, itemIds: [c.id] });
}

function genWorldFlagCapitalMaruBatsu(forcedItem) {
  const c = forcedItem || pickBalancedWorldItem();
  const isTrue = Math.random() < 0.5;
  const shown = isTrue ? c.capital : pickMaruBatsuDonor(WORLD_COUNTRIES, c).capital;
  const statement = `この国旗の国の首都は「${shown}」である`;
  return makeTrueFalseQuestion("worldFlag", statement, isTrue, `${c.name}の首都は${c.capital}`, {
    flagPrompt: c.id,
    itemIds: [c.id],
  });
}

function genWorldCountryToFlag(forcedItem) {
  const c = forcedItem || pickBalancedWorldItem();
  const wrongFlags = pickMixedDecoys(WORLD_COUNTRIES, c, 3).map((x) => x.id);
  return makeChoiceQuestion("worldFlag", `${c.name}の国旗はどれ？`, c.id, wrongFlags, {
    isFlagChoices: true,
    itemIds: [c.id],
    answerText: c.name,
  });
}

// 表示する国旗（flagPrompt）は常にcの本物の国旗にして、文の中では国名だけを
// 入れ替える（他のworldFlag系テンプレートと同じ考え方。絵文字を文に埋め込むと
// 環境によって表示が崩れるため、国旗は画像として上に表示する）
function genWorldFlagMaruBatsu(forcedItem) {
  const c = forcedItem || pickBalancedWorldItem();
  const isTrue = Math.random() < 0.5;
  const shownName = isTrue ? c.name : randomItem(WORLD_COUNTRIES.filter((x) => x.id !== c.id)).name;
  const statement = `この国旗は${shownName}の国旗である`;
  return makeTrueFalseQuestion("worldFlag", statement, isTrue, `${c.name}の国旗`, {
    flagPrompt: c.id,
    itemIds: [c.id],
  });
}

// =========================================================
// テンプレート一覧（日本15種類＋世界20種類 = 35種類）
// level: easy / medium / hard
// forceable: true なら「この県・国について出して」と指定できる
//            （まちがえた問題の再出題・復習で使う）
// requires: この問題を出すために必要な出題範囲チェック
// factKind: 「わからない」を押したときに出す一言（region/capital/flag）が
//           実際に聞かれている内容と合うようにするための印
// =========================================================
const TEMPLATES = [
  // ---- 日本地理 ----
  { name: "jpMapToName", kind: "jp", category: "jpMap", level: "easy", forceable: true, requires: ["jpMap"], factKind: "region", fn: genJpMapToName },
  { name: "jpNameToMap", kind: "jp", category: "jpMap", level: "easy", forceable: true, requires: ["jpMap"], factKind: "region", fn: genJpNameToMap },
  { name: "jpMapToRegion", kind: "jp", category: "jpMap", level: "medium", forceable: true, requires: ["jpMap", "jpRegion"], factKind: "region", fn: genJpMapToRegion },
  { name: "jpMapToCapital", kind: "jp", category: "jpMap", level: "medium", forceable: true, requires: ["jpMap", "jpCapital"], factKind: "capital", fn: genJpMapToCapital },
  { name: "jpMapCapitalCheck", kind: "jp", category: "jpMap", level: "hard", forceable: true, requires: ["jpMap", "jpCapital"], factKind: "capital", fn: genJpMapCapitalCheck },
  { name: "jpPrefToRegion", kind: "jp", category: "jpRegion", level: "easy", forceable: true, requires: ["jpRegion"], factKind: "region", fn: genJpPrefToRegion },
  { name: "jpRegionToPref", kind: "jp", category: "jpRegion", level: "easy", forceable: false, requires: ["jpRegion"], factKind: "region", fn: genJpRegionToPref },
  { name: "jpRegionNotIn", kind: "jp", category: "jpRegion", level: "medium", forceable: false, requires: ["jpRegion"], factKind: "region", fn: genJpRegionNotIn },
  { name: "jpRegionMaruBatsu", kind: "jp", category: "jpRegion", level: "easy", forceable: true, requires: ["jpRegion"], factKind: "region", fn: genJpRegionMaruBatsu },
  { name: "jpPairSameRegion", kind: "jp", category: "jpRegion", level: "medium", forceable: false, requires: ["jpRegion"], factKind: "region", fn: genJpPairSameRegion },
  { name: "jpRegionToCapital", kind: "jp", category: "jpRegion", level: "hard", forceable: true, requires: ["jpRegion", "jpCapital"], factKind: "capital", fn: genJpRegionToCapital },
  { name: "jpCapitalToRegion", kind: "jp", category: "jpCapital", level: "hard", forceable: true, requires: ["jpCapital", "jpRegion"], factKind: "region", fn: genJpCapitalToRegion },
  { name: "jpPrefToCapital", kind: "jp", category: "jpCapital", level: "easy", forceable: true, requires: ["jpCapital"], factKind: "capital", fn: genJpPrefToCapital },
  { name: "jpCapitalToPref", kind: "jp", category: "jpCapital", level: "medium", forceable: true, requires: ["jpCapital"], factKind: "capital", fn: genJpCapitalToPref },
  { name: "jpCapitalMaruBatsu", kind: "jp", category: "jpCapital", level: "easy", forceable: true, requires: ["jpCapital"], factKind: "capital", fn: genJpCapitalMaruBatsu },
  { name: "jpCapitalNameMatch", kind: "jp", category: "jpCapital", level: "easy", forceable: true, requires: ["jpCapital"], factKind: "capital", fn: genJpCapitalNameMatch },
  { name: "jpCapitalPairWrong", kind: "jp", category: "jpCapital", level: "hard", forceable: true, requires: ["jpCapital"], factKind: "capital", fn: genJpCapitalPairWrong },
  { name: "jpCapitalPairRight", kind: "jp", category: "jpCapital", level: "hard", forceable: true, requires: ["jpCapital"], factKind: "capital", fn: genJpCapitalPairRight },

  // ---- 世界地理 ----
  { name: "worldMapToName", kind: "world", category: "worldMap", level: "easy", forceable: true, requires: ["worldMap"], factKind: "region", fn: genWorldMapToName },
  { name: "worldMapClick", kind: "world", category: "worldMap", level: "easy", forceable: true, requires: ["worldMap"], factKind: "region", fn: genWorldMapClick },
  { name: "worldMapToRegion", kind: "world", category: "worldMap", level: "medium", forceable: true, requires: ["worldMap"], factKind: "region", fn: genWorldMapToRegion },
  { name: "worldMapToCapital", kind: "world", category: "worldMap", level: "medium", forceable: true, requires: ["worldMap", "worldCapital"], factKind: "capital", fn: genWorldMapToCapital },
  { name: "worldCountryToRegion", kind: "world", category: "worldMap", level: "easy", forceable: true, requires: ["worldMap"], factKind: "region", fn: genWorldCountryToRegion },
  { name: "worldRegionToCountry", kind: "world", category: "worldMap", level: "easy", forceable: false, requires: ["worldMap"], factKind: "region", fn: genWorldRegionToCountry },
  { name: "worldRegionNotIn", kind: "world", category: "worldMap", level: "medium", forceable: false, requires: ["worldMap"], factKind: "region", fn: genWorldRegionNotIn },
  { name: "worldRegionMaruBatsu", kind: "world", category: "worldMap", level: "easy", forceable: true, requires: ["worldMap"], factKind: "region", fn: genWorldRegionMaruBatsu },
  { name: "worldPairSameRegion", kind: "world", category: "worldMap", level: "medium", forceable: false, requires: ["worldMap"], factKind: "region", fn: genWorldPairSameRegion },
  { name: "worldRegionToCapital", kind: "world", category: "worldMap", level: "hard", forceable: true, requires: ["worldMap", "worldCapital"], factKind: "capital", fn: genWorldRegionToCapital },
  { name: "worldCapitalToRegion", kind: "world", category: "worldCapital", level: "hard", forceable: true, requires: ["worldCapital", "worldMap"], factKind: "region", fn: genWorldCapitalToRegion },
  { name: "worldFlagToRegion", kind: "world", category: "worldFlag", level: "hard", forceable: true, requires: ["worldFlag", "worldMap"], factKind: "region", fn: genWorldFlagToRegion },
  { name: "worldRegionToFlag", kind: "world", category: "worldMap", level: "hard", forceable: false, requires: ["worldMap", "worldFlag"], factKind: "flag", fn: genWorldRegionToFlag },
  { name: "worldCountryToCapital", kind: "world", category: "worldCapital", level: "easy", forceable: true, requires: ["worldCapital"], factKind: "capital", fn: genWorldCountryToCapital },
  { name: "worldCapitalToCountry", kind: "world", category: "worldCapital", level: "medium", forceable: true, requires: ["worldCapital"], factKind: "capital", fn: genWorldCapitalToCountry },
  { name: "worldCapitalMaruBatsu", kind: "world", category: "worldCapital", level: "easy", forceable: true, requires: ["worldCapital"], factKind: "capital", fn: genWorldCapitalMaruBatsu },
  { name: "worldCapitalPairWrong", kind: "world", category: "worldCapital", level: "hard", forceable: true, requires: ["worldCapital"], factKind: "capital", fn: genWorldCapitalPairWrong },
  { name: "worldCapitalPairRight", kind: "world", category: "worldCapital", level: "hard", forceable: true, requires: ["worldCapital"], factKind: "capital", fn: genWorldCapitalPairRight },
  { name: "worldFlagToCountry", kind: "world", category: "worldFlag", level: "easy", forceable: true, requires: ["worldFlag"], factKind: "flag", fn: genWorldFlagToCountry },
  { name: "worldFlagCapitalMaruBatsu", kind: "world", category: "worldFlag", level: "medium", forceable: true, requires: ["worldFlag", "worldCapital"], factKind: "capital", fn: genWorldFlagCapitalMaruBatsu },
  { name: "worldCountryToFlag", kind: "world", category: "worldFlag", level: "easy", forceable: true, requires: ["worldFlag"], factKind: "flag", fn: genWorldCountryToFlag },
  { name: "worldFlagMaruBatsu", kind: "world", category: "worldFlag", level: "easy", forceable: true, requires: ["worldFlag"], factKind: "flag", fn: genWorldFlagMaruBatsu },
];

// ---------- 地図の描画（SVGを1回だけ組み立てて使い回す） ----------
let japanMapRoot = null;
let worldMapRoot = null;

// SVGの中身が実際に読み込めているか確認してから使う（読み込み失敗時はnullを返す）
function ensureJapanMap() {
  if (japanMapRoot === null && typeof JAPAN_MAP_SVG === "string" && JAPAN_MAP_SVG.length > 0) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = JAPAN_MAP_SVG;
    const svg = wrapper.firstElementChild;
    if (svg && svg.querySelector("path")) japanMapRoot = svg;
  }
  return japanMapRoot;
}
function ensureWorldMap() {
  if (worldMapRoot === null && typeof WORLD_MAP_SVG === "string" && WORLD_MAP_SVG.length > 0) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = WORLD_MAP_SVG;
    const svg = wrapper.firstElementChild;
    if (svg && svg.querySelector("path")) worldMapRoot = svg;
  }
  return worldMapRoot;
}

// 問題に出てくる県・国の「地方・地域」に合わせて、地図の表示範囲を拡大する。
// 出題範囲を地方・地域で絞っているときは、問題ごとに拡大範囲が変わって
// 見づらくならないよう、選んだ地方・地域をまとめた範囲を毎回使う。
function pickQuizViewBox(q) {
  const table = q.kind === "jp" ? JAPAN_REGION_VIEW : WORLD_REGION_VIEW;
  const fullKey = q.kind === "jp" ? "全国" : "全世界";
  const selectedRegions = q.kind === "jp" ? state.filters.jpRegions : state.filters.worldRegions;
  if (selectedRegions && selectedRegions.length) return unionRegionViewBox(table, fullKey, selectedRegions);

  if (q.mapClickable || !q.itemIds || q.itemIds.length === 0) return table[fullKey];
  const pool = q.kind === "jp" ? JAPAN_PREFECTURES : WORLD_COUNTRIES;
  const item = pool.find((x) => x.id === q.itemIds[0]);
  if (!item) return table[fullKey];
  return table[item.region] || table[fullKey];
}

function renderMap(container, q) {
  const svg = q.mapMode === "japan" ? ensureJapanMap() : ensureWorldMap();
  container.innerHTML = "";

  if (!svg) {
    const msg = document.createElement("p");
    msg.className = "map-error";
    msg.textContent = "地図を読み込めませんでした。ページを再読み込みしてください。";
    container.appendChild(msg);
    container.classList.remove("hidden");
    state.currentMapSvg = null;
    return;
  }

  svg.querySelectorAll("path").forEach((p) => {
    p.classList.remove("highlight", "correct", "wrong", "reveal-correct");
    p.onclick = null;
  });

  if (q.mapClickable) {
    svg.classList.add("clickable");
    // 背景として表示しているだけの国・地域（bg-country）はクリック対象にしない
    svg.querySelectorAll("path:not(.bg-country)").forEach((p) => {
      p.onclick = () => handleMapClick(p);
    });
  } else {
    svg.classList.remove("clickable");
    const target = svg.querySelector('[id="' + q.mapHighlight + '"]');
    if (target) target.classList.add("highlight");
  }

  svg.setAttribute("viewBox", pickQuizViewBox(q).join(" "));

  container.appendChild(svg);
  container.classList.remove("hidden");
  state.currentMapSvg = svg;
}

// ---------- アプリの状態 ----------
// 正解数・正答率・まちがえた問題は history から毎回計算し直します。
// （「1問戻る」で回答をやり直しても、矛盾が起きないようにするためです）
const state = {
  categories: [],
  filters: { jpRegions: [], worldRegions: [], levelOnly: null },
  mode: "fixed", // 'fixed' | 'endless' | 'review'
  targetLength: 10,
  history: [], // 答え終わった問題（q.userCorrect / q.userIsDontKnow を持つ）
  pendingReasks: [],
  reviewQueue: [],
  recentGenNames: [],
  recentItemIds: [],
  recentCategories: [],
  currentQuestion: null,
  currentPairs: null,
  currentMapSvg: null,
  answered: false,
  lastCourse: "today10",
};

function historyCorrectCount() {
  return state.history.filter((h) => h.userCorrect).length;
}
function historyWrongList() {
  return state.history.filter((h) => !h.userCorrect).map((h) => ({ prompt: h.prompt, answerText: h.answerText }));
}

const WRONG_STORAGE_KEY = "mapquiz_wrong_v2";

function loadWrongTickets() {
  try {
    const raw = localStorage.getItem(WRONG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function saveWrongTickets(list) {
  try {
    if (list.length > 0) localStorage.setItem(WRONG_STORAGE_KEY, JSON.stringify(list));
    else localStorage.removeItem(WRONG_STORAGE_KEY);
  } catch (e) {
    /* localStorageが使えなくても動くようにする */
  }
  updateReviewButtonState();
}
// 「同じ県・国」でも「県庁所在地」と「地方区分」は別の知識として扱う
// （例：山形県の県庁所在地を間違えたあと、山形県の地方区分を正解しても、
// 　　　県庁所在地の方のまちがい記録は消さない）
// category ではなく factKind で見分ける（例：jpMap category には
// 「地図→地方」(factKind=region) と「地図→県庁所在地」(factKind=capital) が
// 同居しているため、category だけでは別の知識同士を混同してしまう）
function sameKnowledge(t, q) {
  return t.itemId === q.itemIds[0] && t.kind === q.kind && t.factKind === q.factKind;
}
function recordWrongTicket(q) {
  if (!q.itemIds || q.itemIds.length === 0) return;
  const list = loadWrongTickets().filter((t) => !sameKnowledge(t, q));
  list.push({ itemId: q.itemIds[0], kind: q.kind, factKind: q.factKind, category: q.category });
  saveWrongTickets(list);
}
function clearWrongTicket(q) {
  if (!q.itemIds || q.itemIds.length === 0) return;
  const list = loadWrongTickets();
  const filtered = list.filter((t) => !sameKnowledge(t, q));
  if (filtered.length !== list.length) saveWrongTickets(filtered);
}
function updateReviewButtonState() {
  const btn = document.getElementById("btn-review");
  btn.disabled = loadWrongTickets().length === 0;
}

// ---------- 問題を選ぶロジック ----------
function pickLevel() {
  if (state.filters.levelOnly) return state.filters.levelOnly;
  const r = Math.random();
  if (r < 0.6) return "easy";
  if (r < 0.9) return "medium";
  return "hard";
}

function templatesFor(level, category) {
  return TEMPLATES.filter(
    (t) => (!level || t.level === level) && (!category || t.category === category) && t.requires.every((c) => state.categories.includes(c))
  );
}

// state（実際のクイズ中の選択）に依存せず、「この範囲チェックの組み合わせで、
// 指定した難易度の問題が1つでも作れるか」を確認するための、判定専用の関数。
// ホーム画面で範囲・難易度を選んだ時点で、事前にチェックできるようにする。
function levelAvailableForCategories(level, categories) {
  if (!level || categories.length === 0) return true;
  return categories.some((cat) =>
    TEMPLATES.some((t) => t.level === level && t.category === cat && t.requires.every((c) => categories.includes(c)))
  );
}

function tagQuestion(q, tpl) {
  q.genName = tpl.name;
  q.kind = tpl.kind;
  q.level = tpl.level;
  q.factKind = tpl.factKind;
  return q;
}

// カテゴリをまず均等に抽選してから、そのカテゴリの中でテンプレートを選ぶ。
// （テンプレート数がカテゴリごとに違うので、先にテンプレートを抽選すると
// 　テンプレートが多いカテゴリばかり出やすくなってしまうため）
function generateFreshRandom() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const level = pickLevel();

    let catCandidates = state.categories;
    const lastCat = state.recentCategories[state.recentCategories.length - 1];
    const prevCat = state.recentCategories[state.recentCategories.length - 2];
    if (lastCat && lastCat === prevCat) {
      const alt = state.categories.filter((c) => c !== lastCat);
      if (alt.length) catCandidates = alt;
    }
    const category = randomItem(catCandidates);

    let pool = templatesFor(level, category);
    if (pool.length === 0) pool = templatesFor(null, category);
    if (pool.length === 0) continue; // このカテゴリでは出せる問題がない → カテゴリを引き直す

    const tpl = randomItem(pool);
    if (tpl.name === state.recentGenNames[state.recentGenNames.length - 1]) continue;
    const q = tpl.fn();
    if (!q) continue;
    if (q.itemIds && q.itemIds.some((id) => state.recentItemIds.includes(id))) continue;
    return tagQuestion(q, tpl);
  }
  // 何度試してもダメだったら、条件をゆるめて、作れるテンプレートが見つかるまで順に試す
  // （北海道のように県が少ない地方＋出せないテンプレートの組み合わせでも、
  // 　他に作れる問題が1つでもあれば必ず出題できるようにする）
  const fallbackPool = shuffle(templatesFor(null, null));
  for (const tpl of fallbackPool) {
    const q = tpl.fn();
    if (q) return tagQuestion(q, tpl);
  }
  return null;
}

function generateFreshReview() {
  while (state.reviewQueue.length) {
    const ticket = state.reviewQueue.shift();
    const q = buildTicketQuestion(ticket, true);
    if (q) return q;
  }
  return null;
}

function buildTicketQuestion(ticket, respectSelection) {
  const pool = ticket.kind === "jp" ? JAPAN_PREFECTURES : WORLD_COUNTRIES;
  const item = pool.find((x) => x.id === ticket.itemId);
  if (!item) return null;

  const base = TEMPLATES.filter((t) => t.kind === ticket.kind && t.forceable && t.name !== ticket.excludeGen);
  const respecting = respectSelection ? base.filter((t) => t.requires.every((c) => state.categories.includes(c))) : base;
  // まちがえたときと同じ知識（factKind）を聞くテンプレートを最優先し、
  // なければ同じ category、それも無ければ何でも forceable なものを使う
  const sameFactKind = ticket.factKind ? respecting.filter((t) => t.factKind === ticket.factKind) : [];
  const sameCategory = respecting.filter((t) => t.category === ticket.category);
  const list = sameFactKind.length ? sameFactKind : sameCategory.length ? sameCategory : respecting.length ? respecting : base;
  if (!list.length) return null;

  // 県名と県庁所在地がほぼ同じ県・国など、テンプレートによっては
  // その項目では問題を作れず null を返すことがあるので、他のテンプレートも順に試す
  // （1つ試して失敗しただけで、復習の問題を丸ごと諦めてしまわないようにする）
  for (const tpl of shuffle(list)) {
    const q = tpl.fn(item);
    if (q) return tagQuestion(q, tpl);
  }
  return null;
}

function nextFreshQuestion() {
  return state.mode === "review" ? generateFreshReview() : generateFreshRandom();
}

function scheduleReask(q) {
  if (!q.itemIds || q.itemIds.length === 0) return;
  const itemId = q.itemIds[0];
  // 同じ県・国でも factKind が違えば別の知識として、それぞれ再出題を予約する
  state.pendingReasks = state.pendingReasks.filter((t) => !(t.itemId === itemId && t.kind === q.kind && t.factKind === q.factKind));
  state.pendingReasks.push({
    itemId,
    kind: q.kind,
    category: q.category,
    factKind: q.factKind,
    excludeGen: q.genName,
    dueAt: state.history.length + 3 + randInt(3), // 3〜5問後
  });
}

function takeDueReask() {
  const idx = state.pendingReasks.findIndex((t) => t.dueAt <= state.history.length);
  if (idx === -1) return null;
  const ticket = state.pendingReasks.splice(idx, 1)[0];
  const q = buildTicketQuestion(ticket, true);
  if (q) q.isReask = true;
  return q;
}

const REASK_FLUSH_CAP = 10; // 目標数を超えて再出題を消化できる上限（ずっと間違え続けても終わるようにする）

function pickNextQuestion() {
  for (let guard = 0; guard < 10; guard++) {
    const reachedTarget = state.mode !== "endless" && state.history.length >= state.targetLength;

    // 目標数を超えて再出題を消化しすぎている場合は、たまっていてもここで打ち切る
    // （ずっと間違え続けても、コースが永久に終わらなくなるのを防ぐ）
    if (reachedTarget) {
      const overflow = state.history.length - state.targetLength;
      if (overflow >= REASK_FLUSH_CAP) return null;
    }

    const reask = takeDueReask();
    if (reask) return reask;

    if (reachedTarget) {
      if (state.pendingReasks.length === 0) return null;
      const ticket = state.pendingReasks.shift();
      const q = buildTicketQuestion(ticket, true);
      if (q) {
        q.isReask = true;
        return q;
      }
      continue;
    }

    const q = nextFreshQuestion();
    if (q) return q;
    if (state.mode === "review") return null;
  }
  return null;
}

// ---------- 「わからない」用の短い解説 ----------
function factLineFor(q) {
  if (!q.itemIds || q.itemIds.length === 0) return "";
  const pool = q.kind === "jp" ? JAPAN_PREFECTURES : WORLD_COUNTRIES;
  const item = pool.find((x) => x.id === q.itemIds[0]);
  if (!item) return "";
  // factKind で「実際に聞かれていた内容」に合わせた一言を選ぶ
  if (q.factKind === "capital") {
    return q.kind === "jp" ? `${item.name}の県庁所在地は${item.capital}です。` : `${item.name}の首都は${item.capital}です。`;
  }
  // 国旗の画像は正解表示（reveal-correct）や上部の表示ですでに見えているので、
  // 一言メモでは絵文字を埋め込まず、国名だけを文章で伝える
  if (q.factKind === "flag") return `${item.name}の国旗です。`;
  return q.kind === "jp" ? `${item.name}は${item.region}地方です。` : `${item.name}は${item.region}です。`;
}

// ---------- 画面の共通操作 ----------
function getSelectedCategories() {
  const map = [
    ["chk-jpMap", "jpMap"],
    ["chk-jpCapital", "jpCapital"],
    ["chk-jpRegion", "jpRegion"],
    ["chk-worldMap", "worldMap"],
    ["chk-worldCapital", "worldCapital"],
    ["chk-worldFlag", "worldFlag"],
  ];
  return map.filter(([id]) => document.getElementById(id).checked).map(([, key]) => key);
}

function getCheckedValues(containerId) {
  return Array.from(document.querySelectorAll("#" + containerId + " input:checked")).map((cb) => cb.value);
}

function getSelectedFilters() {
  const jpRegions = getCheckedValues("filter-jp-regions");
  const worldRegions = getCheckedValues("filter-world-regions");
  const levelOnly = document.getElementById("filter-level").value || null;
  return { jpRegions, worldRegions, levelOnly };
}

function showHomeMessage(msg) {
  document.getElementById("home-message").textContent = msg;
}

function switchScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  document.getElementById("screen-" + name).classList.remove("hidden");
}

function resetSessionState() {
  state.history = [];
  state.pendingReasks = [];
  state.reviewQueue = [];
  state.recentGenNames = [];
  state.recentItemIds = [];
  state.recentCategories = [];
  state.currentQuestion = null;
  state.answered = false;
}

// ---------- クイズの進行 ----------
function startQuiz(course) {
  showHomeMessage("");
  resetSessionState();

  if (course === "review") {
    const tickets = loadWrongTickets();
    if (tickets.length === 0) {
      showHomeMessage("復習する問題がありません");
      return;
    }
    state.mode = "review";
    state.reviewQueue = shuffle(tickets);
    state.targetLength = tickets.length;
    state.categories = ALL_CATEGORIES;
    state.filters = { jpRegions: [], worldRegions: [], levelOnly: null };
  } else if (course === "today10" || course === "today20") {
    state.mode = "fixed";
    state.categories = ALL_CATEGORIES;
    state.filters = { jpRegions: [], worldRegions: [], levelOnly: null };
    state.targetLength = course === "today10" ? 10 : 20;
  } else {
    const categories = getSelectedCategories();
    if (categories.length === 0) {
      showHomeMessage("出題する範囲を1つ以上選んでください");
      return;
    }
    state.categories = categories;
    state.filters = getSelectedFilters();
    if (course === "30") {
      state.mode = "fixed";
      state.targetLength = 30;
    } else {
      state.mode = "endless";
      state.targetLength = Infinity;
    }
  }

  state.lastCourse = course;
  switchScreen("quiz");
  document.getElementById("btn-finish-endless").classList.toggle("hidden", state.mode !== "endless");
  renderQuestion();
}

function renderQuestion() {
  const q = pickNextQuestion();
  if (!q) {
    finishQuiz();
    return;
  }
  displayQuestion(q);
}

// 与えられた問題を画面に表示する（新しく作った問題にも、「戻る」でやり直す問題にも使う）
function displayQuestion(q) {
  state.currentQuestion = q;
  state.answered = false;

  document.getElementById("quiz-progress").textContent = `第${state.history.length + 1}問`;
  document.getElementById("btn-back").disabled = state.history.length === 0;
  document.getElementById("quiz-prompt").textContent = q.prompt;
  document.getElementById("btn-next").classList.add("hidden");
  document.getElementById("btn-dontknow").classList.remove("hidden");

  const fb = document.getElementById("quiz-feedback");
  fb.classList.add("hidden");
  fb.classList.remove("ok", "ng");
  fb.innerHTML = "";

  const flagBox = document.getElementById("quiz-flag");
  if (q.flagPrompt) {
    flagBox.innerHTML = "";
    flagBox.appendChild(buildFlagImg(q.flagPrompt));
    flagBox.classList.remove("hidden");
  } else {
    flagBox.innerHTML = "";
    flagBox.classList.add("hidden");
  }

  const mapwrap = document.getElementById("quiz-mapwrap");
  if (q.mapMode) {
    renderMap(mapwrap, q);
  } else {
    mapwrap.innerHTML = "";
    mapwrap.classList.add("hidden");
    state.currentMapSvg = null;
  }

  const choicesBox = document.getElementById("quiz-choices");
  if (q.mapClickable) {
    choicesBox.innerHTML = "";
    choicesBox.classList.add("hidden");
    state.currentPairs = null;
  } else {
    choicesBox.classList.remove("hidden");
    renderChoices(choicesBox, q);
  }

  updateScoreDisplay();
}

function renderChoices(container, q) {
  container.innerHTML = "";
  const pairs = [];
  q.choices.forEach((choice) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn" + (q.isFlagChoices ? " flag-choice" : "");
    if (q.isFlagChoices) btn.appendChild(buildFlagImg(choice.label, "flag-choice-img"));
    else btn.textContent = choice.label;
    pairs.push({ btn, choice });
    container.appendChild(btn);
  });
  pairs.forEach(({ btn, choice }) => {
    btn.addEventListener("click", () => handleChoiceClick(pairs, btn, choice));
  });
  state.currentPairs = pairs;
}

function handleChoiceClick(pairs, btn, choice) {
  if (state.answered) return;
  state.answered = true;

  btn.classList.add(choice.correct ? "correct" : "wrong");
  if (!choice.correct) {
    const correctPair = pairs.find((p) => p.choice.correct);
    if (correctPair) correctPair.btn.classList.add("reveal-correct");
  }
  pairs.forEach((p) => (p.btn.disabled = true));

  finishAnswer(choice.correct, false);
}

function handleMapClick(pathEl) {
  if (state.answered) return;
  state.answered = true;

  const correct = pathEl.id === state.currentQuestion.targetId;
  pathEl.classList.add(correct ? "correct" : "wrong");
  if (!correct) {
    const target = pathEl.ownerSVGElement.querySelector('[id="' + state.currentQuestion.targetId + '"]');
    if (target) target.classList.add("reveal-correct");
  }

  finishAnswer(correct, false);
}

function handleDontKnow() {
  if (state.answered) return;
  state.answered = true;
  const q = state.currentQuestion;

  if (q.mapClickable && state.currentMapSvg) {
    const target = state.currentMapSvg.querySelector('[id="' + q.targetId + '"]');
    if (target) target.classList.add("reveal-correct");
  } else if (state.currentPairs) {
    state.currentPairs.forEach((p) => {
      p.btn.disabled = true;
      if (p.choice.correct) p.btn.classList.add("reveal-correct");
    });
  }

  finishAnswer(false, true);
}

function finishAnswer(correct, isDontKnow) {
  const q = state.currentQuestion;
  q.userCorrect = correct;
  q.userIsDontKnow = isDontKnow;
  state.history.push(q);

  if (correct) {
    clearWrongTicket(q);
  } else {
    scheduleReask(q);
    recordWrongTicket(q);
  }

  state.recentGenNames.push(q.genName);
  if (state.recentGenNames.length > 3) state.recentGenNames.shift();
  state.recentCategories.push(q.category);
  if (state.recentCategories.length > 3) state.recentCategories.shift();
  if (q.itemIds) {
    state.recentItemIds.push(...q.itemIds);
    while (state.recentItemIds.length > 5) state.recentItemIds.shift();
  }

  const fb = document.getElementById("quiz-feedback");
  fb.classList.remove("hidden");
  fb.innerHTML = "";
  if (correct) {
    fb.textContent = "🎉 正解！";
    fb.classList.add("ok");
  } else {
    const line1 = document.createElement("div");
    // ○×問題の answerText は already「×　正しくは「〜」」の形で説明を含んでいるので、
    // 「正解は「」」でさらに二重括弧にしない
    if (q.isTrueFalse) {
      line1.textContent = isDontKnow ? `正解：${q.answerText}` : `❌ 残念…　${q.answerText}`;
    } else {
      line1.textContent = isDontKnow ? `正解：${q.answerText}` : `❌ 残念…　正解は「${q.answerText}」`;
    }
    fb.appendChild(line1);
    // ○×問題はすでに一言解説を含んでいるので、下の一言は重ねて出さない
    const fact = q.isTrueFalse ? "" : factLineFor(q);
    if (fact) {
      const line2 = document.createElement("div");
      line2.className = "feedback-fact";
      line2.textContent = fact;
      fb.appendChild(line2);
    }
    fb.classList.add("ng");
  }

  document.getElementById("btn-next").classList.remove("hidden");
  document.getElementById("btn-dontknow").classList.add("hidden");
  updateScoreDisplay();
}

function updateScoreDisplay() {
  document.getElementById("quiz-score").textContent = `正解 ${historyCorrectCount()}`;
}

function nextQuestion() {
  renderQuestion();
}

// 1問前に戻って、その問題を答え直せるようにする
function goBack() {
  if (state.history.length === 0) return;
  const prev = state.history.pop();

  // この問題の答えがまちがっていた場合に予約されていた再出題を取り消す（重複を防ぐ）
  if (prev.itemIds && prev.itemIds.length) {
    const itemId = prev.itemIds[0];
    state.pendingReasks = state.pendingReasks.filter((t) => !(t.itemId === itemId && t.kind === prev.kind && t.excludeGen === prev.genName));
  }

  // 「直近の出題」トラッキングも1つ戻す
  if (state.recentGenNames[state.recentGenNames.length - 1] === prev.genName) state.recentGenNames.pop();
  if (state.recentCategories[state.recentCategories.length - 1] === prev.category) state.recentCategories.pop();
  if (prev.itemIds) prev.itemIds.forEach(() => state.recentItemIds.pop());

  delete prev.userCorrect;
  delete prev.userIsDontKnow;
  displayQuestion(prev);
}

function finishQuiz() {
  switchScreen("result");
  renderResult();
}

function renderResult() {
  const total = state.history.length;
  const correct = historyCorrectCount();
  const rate = total ? Math.round((correct / total) * 100) : 0;
  const wrongList = historyWrongList();

  document.getElementById("result-summary").textContent = `正解数: ${correct} / ${total}　正答率: ${rate}%`;

  const wrongBox = document.getElementById("result-wrong");
  wrongBox.innerHTML = "";
  if (wrongList.length === 0) {
    wrongBox.textContent = "まちがえた問題はありませんでした。すごい！";
  } else {
    const ul = document.createElement("ul");
    wrongList.forEach((w) => {
      const li = document.createElement("li");
      li.textContent = `${w.prompt} → 正解：${w.answerText}`;
      ul.appendChild(li);
    });
    wrongBox.appendChild(ul);
  }

  document.getElementById("btn-result-review").disabled = loadWrongTickets().length === 0;
}

// ---------- 画面の初期化 ----------
// 地方・地域は複数選べるようにチェックボックスで並べる
function populateRegionCheckboxes(containerId, options) {
  const wrap = document.getElementById(containerId);
  wrap.innerHTML = "";
  options.forEach((opt) => {
    const label = document.createElement("label");
    label.className = "check-item region-check-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = opt;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(opt));
    wrap.appendChild(label);
  });
}

// 選んだ範囲チェックボックス＋難易度の組み合わせで、指定した難易度の問題が
// 作れるかどうかを見て、注意書きの文言を切りかえる
const DEFAULT_FILTER_NOTE =
  "※範囲を1つだけに絞ると、指定した難易度の問題が少なく、別の難易度が混ざることがあります。複数の範囲を選ぶとより正確になります。";
const LEVEL_LABELS = { easy: "やさしい", medium: "少し考える", hard: "考える" };

function updateFilterLevelNote() {
  const note = document.getElementById("filter-level-note");
  if (!note) return;
  const level = document.getElementById("filter-level").value || null;
  const categories = getSelectedCategories();
  if (!level || categories.length === 0) {
    note.textContent = DEFAULT_FILTER_NOTE;
    return;
  }
  if (!levelAvailableForCategories(level, categories)) {
    note.textContent = `※選んだ範囲では「${LEVEL_LABELS[level]}問題」を作れないため、別の難易度の問題になります。範囲を増やすと選べるようになることがあります。`;
  } else {
    note.textContent = DEFAULT_FILTER_NOTE;
  }
}

function init() {
  populateRegionCheckboxes("filter-jp-regions", JAPAN_REGIONS);
  populateRegionCheckboxes("filter-world-regions", WORLD_REGIONS);

  const filterInputs = [
    "chk-jpMap",
    "chk-jpCapital",
    "chk-jpRegion",
    "chk-worldMap",
    "chk-worldCapital",
    "chk-worldFlag",
    "filter-level",
  ];
  filterInputs.forEach((id) => document.getElementById(id).addEventListener("change", updateFilterLevelNote));
  updateFilterLevelNote();

  document.querySelectorAll(".course-btn[data-course]").forEach((btn) => {
    btn.addEventListener("click", () => startQuiz(btn.dataset.course));
  });
  document.getElementById("btn-next").addEventListener("click", nextQuestion);
  document.getElementById("btn-dontknow").addEventListener("click", handleDontKnow);
  document.getElementById("btn-finish-endless").addEventListener("click", finishQuiz);
  document.getElementById("btn-back").addEventListener("click", goBack);
  document.getElementById("btn-quit").addEventListener("click", () => {
    document.getElementById("quit-modal").classList.remove("hidden");
  });
  document.getElementById("btn-quit-cancel").addEventListener("click", () => {
    document.getElementById("quit-modal").classList.add("hidden");
  });
  document.getElementById("btn-quit-confirm").addEventListener("click", () => {
    document.getElementById("quit-modal").classList.add("hidden");
    switchScreen("home");
    showHomeMessage("");
    updateReviewButtonState();
  });
  document.getElementById("btn-result-review").addEventListener("click", () => startQuiz("review"));
  document.getElementById("btn-result-again").addEventListener("click", () => {
    if (state.lastCourse === "review" && loadWrongTickets().length === 0) {
      // 復習対象がもうない状態で「もう一度やる」を押しても無反応にならないようにする
      switchScreen("home");
      showHomeMessage("👏 まちがえた問題はもうありません！");
      updateReviewButtonState();
      return;
    }
    startQuiz(state.lastCourse);
  });
  document.getElementById("btn-result-home").addEventListener("click", () => {
    switchScreen("home");
    showHomeMessage("");
    updateReviewButtonState();
  });

  updateReviewButtonState();
}

document.addEventListener("DOMContentLoaded", init);
