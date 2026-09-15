// =========================================================
// 自習プリント生成ページ本体
// 「地方・地域を選ぶ → プリントが自動で組み立てられる」しくみです。
// 見た目のテンプレート文言を変えたいときは、renderWorksheetHTML() を見てください。
// =========================================================

// ---------- 小さな便利関数（app.js と同じもの） ----------
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

// 都道府県名・国名の「県庁所在地／首都と同じ名前か」を調べるための下ごしらえ
function stripAreaSuffix(name) {
  return name.replace(/(都|道|府|県)$/, "");
}
function stripCitySuffix(name) {
  return name.replace(/(市|区)$/, "");
}

// 県名と県庁所在地（国名と首都）がほぼ同じ文字だと、逆読み・組み合わせ系の問題で
// 答えが文章にそのまま出てしまうため、そうした項目は対象からはずす。
// 完全一致だけでなく、首都名が国名をそのまま含む場合（メキシコ→メキシコシティ等）も対象。
function isNameCapitalObvious(item) {
  return stripAreaSuffix(item.name) === stripCitySuffix(item.capital) || item.capital.includes(item.name);
}
// 候補が1つもなくなっても、答えが露骨になる項目まで戻して無理に使わない
function nonObviousItems(pool) {
  return pool.filter((it) => !isNameCapitalObvious(it));
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

// 「★まず知っていること」で見せる、県・国の名前を軽い感じにする
// （北海道はそのまま。それ以外は「〜県／都／府」を省く）
function warmupName(kindDef, it) {
  if (kindDef.mapMode !== "japan") return it.name;
  if (it.name === "北海道") return it.name;
  return stripAreaSuffix(it.name);
}

// 4〜6個くらいに絞って、聞いたことがあるか○をつけてもらう名前を選ぶ
function pickWarmupNames(kindDef, items) {
  const source = items.length > 6 ? sampleN(items, 5) : items;
  return source.map((it) => warmupName(kindDef, it));
}

// ---------- 選択範囲の設定 ----------
// kind ごとに、使うデータやラベルをまとめておく
const WORKSHEET_KIND = {
  jp: {
    pool: JAPAN_PREFECTURES,
    regions: JAPAN_REGIONS,
    featurePool: JP_FEATURE_POOL,
    regionFeatures: JP_REGION_FEATURES,
    regionAvoid: JP_REGION_AVOID,
    regionView: JAPAN_REGION_VIEW,
    fullViewKey: "全国",
    areaWord: "地方",
    unitWord: "都道府県",
    itemWord: "都道府県",
    capitalWord: "都道府県庁所在地",
    mapMode: "japan",
  },
  world: {
    pool: WORLD_COUNTRIES,
    regions: WORLD_REGIONS,
    featurePool: WORLD_FEATURE_POOL,
    regionFeatures: WORLD_REGION_FEATURES,
    regionAvoid: WORLD_REGION_AVOID,
    regionView: WORLD_REGION_VIEW,
    fullViewKey: "全世界",
    areaWord: "地域",
    unitWord: "か国",
    itemWord: "国",
    capitalWord: "首都",
    mapMode: "world",
  },
};

// ---------- 特徴を選ぼうコーナー ----------
function buildFeatureSection(kindDef, items) {
  // 選ばれた項目がどの地方・地域に属しているかを集めて、正解タグの候補にする
  const coveredRegions = Array.from(new Set(items.map((it) => it.region)));
  let trueTagsFull = [];
  const avoidTags = [];
  coveredRegions.forEach((r) => {
    (kindDef.regionFeatures[r] || []).forEach((tag) => {
      if (!trueTagsFull.includes(tag)) trueTagsFull.push(tag);
    });
    ((kindDef.regionAvoid && kindDef.regionAvoid[r]) || []).forEach((tag) => {
      if (!avoidTags.includes(tag)) avoidTags.push(tag);
    });
  });
  if (trueTagsFull.length === 0) trueTagsFull = sampleN(kindDef.featurePool, 3); // 保険
  const trueTags = sampleN(trueTagsFull, Math.min(3, trueTagsFull.length));

  // 複数の地方・地域をまたぐ選択のとき、選ばれなかった「本当は当てはまるタグ」や、
  // 「正解ではないがその地方にも実は当てはまる」タグ（avoidTags）が
  // まぎらわしい不正解として出てしまわないよう、候補から完全に除外する。
  // 3地域以上を選ぶと安全な候補が5個に届かないことがあるが、そのときは
  // 無理に5個そろえようとせず、安全な候補が少ないなら少ないままにする
  // （数をそろえるより、まぎらわしくない・正解が一意であることを優先する）。
  let decoyPool = kindDef.featurePool.filter((t) => !trueTagsFull.includes(t) && !avoidTags.includes(t));
  if (decoyPool.length === 0) {
    // 安全な候補が本当に1つもないときだけ、最後の手段として avoidTags を許す
    decoyPool = kindDef.featurePool.filter((t) => !trueTagsFull.includes(t));
  }
  const decoys = sampleN(decoyPool, Math.min(5, decoyPool.length));
  const options = shuffle([...trueTags, ...decoys]);
  const letters = "ABCDEFGH";
  const labeled = options.map((label, i) => ({ letter: letters[i], label }));
  const correctLetters = labeled.filter((o) => trueTags.includes(o.label)).map((o) => o.letter);

  return { labeled, trueTags, correctLetters };
}

// ---------- ○×問題（3段階） ----------
// 長さnの「true/false の割り当てパターン」を作る。
// 半分ずつになるように決めてからシャッフルするので、運まかせで偏ることがない。
function balancedBooleans(n) {
  const trueCount = Math.round(n / 2);
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(i < trueCount);
  return shuffle(arr);
}

function buildTrueFalseSet(kindDef, items, allPool) {
  const questions = [];

  // やさしい：地方・地域の所属　と　県庁所在地／首都　を、重複なく組み合わせて出す
  const easyCombos = [];
  items.forEach((item) => {
    easyCombos.push({ item, type: "region" });
    easyCombos.push({ item, type: "capital" });
  });
  const chosenCombos = sampleN(easyCombos, Math.min(6, easyCombos.length));
  const easyAnswers = balancedBooleans(chosenCombos.length);
  chosenCombos.forEach(({ item, type }, i) => {
    const isTrue = easyAnswers[i];
    if (type === "region") {
      const shownRegion = isTrue ? item.region : randomItem(kindDef.regions.filter((r) => r !== item.region));
      questions.push({
        level: "やさしい",
        statement: `${item.name}は${shownRegion}${kindDef.areaWord === "地方" ? "地方" : ""}にある`,
        isTrue,
        explanation: `${item.name}は${item.region}${kindDef.areaWord === "地方" ? "地方" : ""}`,
      });
    } else {
      const shownCapital = isTrue ? item.capital : pickMaruBatsuDonor(allPool, item).capital;
      questions.push({
        level: "やさしい",
        statement: `${item.name}の${kindDef.capitalWord}は「${shownCapital}」である`,
        isTrue,
        explanation: `${item.name}の${kindDef.capitalWord}は${item.capital}`,
      });
    }
  });

  // 少し考える：県庁所在地／首都の「逆読み」（○○市が県庁所在地なのはどこ？）
  // 県名と県庁所在地がほぼ同じ県・国は、文章に答えがそのまま出てしまうので使わない。
  const reversePool = nonObviousItems(items);
  const reverseCount = Math.min(2, reversePool.length);
  const reverseItems = sampleN(reversePool, reverseCount);
  const reverseAnswers = balancedBooleans(reverseCount);
  reverseItems.forEach((item, i) => {
    const isTrue = reverseAnswers[i];
    const shownName = isTrue ? item.name : pickMaruBatsuDonor(allPool, item).name;
    questions.push({
      level: "少し考える",
      statement: `${kindDef.capitalWord}が${item.capital}なのは${shownName}である`,
      isTrue,
      explanation: `${kindDef.capitalWord}が${item.capital}なのは${item.name}`,
    });
  });

  if (items.length >= 2) {
    const [a, b] = sampleN(items, 2);
    const wantTrue = Math.random() < 0.5;
    let partner = b;
    if (!wantTrue) {
      const outside = allPool.filter((x) => x.region !== a.region);
      if (outside.length) partner = randomItem(outside);
    }
    questions.push({
      level: "少し考える",
      statement: `${a.name}と${partner.name}は同じ${kindDef.areaWord}にある`,
      isTrue: partner.region === a.region,
      explanation: `${a.name}は${a.region}、${partner.name}は${partner.region}`,
    });
  }

  return questions;
}

// 考える：2つの県・国の県庁所在地／首都を同時に問う「組み合わせ確認」の問題。
// 出題する2つ（a・b）は必ず選んだ範囲内から選ぶ（範囲外の県・国を主役にしない）。
// 県名と県庁所在地がほぼ同じ県・国は見た目だけで分かってしまうため主役からはずす。
// ×にするときの「借りてくる県庁所在地／首都」は、値だけを差し替える演出であり
// 範囲外の県・国名を問題文の主役として出すわけではないため、まぎらわしさを優先して
// 全国／全世界プールから選ぶ（できれば同じ地方・地域を優先する）。
function buildHardQuestion(kindDef, items, allPool) {
  const candidates = items.filter((it) => !isNameCapitalObvious(it));
  if (candidates.length < 2) {
    return {
      level: "考える",
      statement: `${kindDef.areaWord}や${kindDef.itemWord}によって、人口・地形・産業などの特徴はちがう`,
      isTrue: true,
      explanation: `どの${kindDef.itemWord}にもそれぞれちがう特徴がある`,
    };
  }
  const [a, b] = sampleN(candidates, 2);
  const isTrue = Math.random() < 0.5;
  let shownA = a.capital;
  let shownB = b.capital;
  if (!isTrue) {
    const corruptA = Math.random() < 0.5;
    const target = corruptA ? a : b;
    const donorPool = allPool.filter((x) => x.id !== a.id && x.id !== b.id);
    const donor = pickMaruBatsuDonor(donorPool, target);
    if (corruptA) shownA = donor.capital;
    else shownB = donor.capital;
  }
  return {
    level: "考える",
    statement: `${a.name}の${kindDef.capitalWord}は${shownA}、${b.name}の${kindDef.capitalWord}は${shownB}である`,
    isTrue,
    explanation: `${a.name}の${kindDef.capitalWord}は${a.capital}、${b.name}の${kindDef.capitalWord}は${b.capital}`,
  };
}

// ---------- 白地図（対象だけを塗った地図） ----------
let printJapanMapRoot = null;
let printWorldMapRoot = null;

// getBBox()で正しく座標を計算するには、SVGが実際に文書に挿入されている必要があるため、
// 画面には見えない場所に置いておく専用のコンテナを1つ用意する
let hiddenMapHolder = null;
function getHiddenMapHolder() {
  if (!hiddenMapHolder) {
    hiddenMapHolder = document.createElement("div");
    hiddenMapHolder.style.position = "absolute";
    hiddenMapHolder.style.width = "0";
    hiddenMapHolder.style.height = "0";
    hiddenMapHolder.style.overflow = "hidden";
    document.body.appendChild(hiddenMapHolder);
  }
  return hiddenMapHolder;
}

// SVGデータが読み込めているか（中身が空でないか）を確かめてから使う
function ensurePrintMap(mapMode) {
  if (mapMode === "japan") {
    if (printJapanMapRoot === null && typeof JAPAN_MAP_SVG === "string" && JAPAN_MAP_SVG.length > 0) {
      const wrap = document.createElement("div");
      wrap.innerHTML = JAPAN_MAP_SVG;
      const svg = wrap.firstElementChild;
      if (svg && svg.querySelector("path")) {
        getHiddenMapHolder().appendChild(svg);
        printJapanMapRoot = svg;
      }
    }
    return printJapanMapRoot;
  }
  if (printWorldMapRoot === null && typeof WORLD_MAP_SVG === "string" && WORLD_MAP_SVG.length > 0) {
    const wrap = document.createElement("div");
    wrap.innerHTML = WORLD_MAP_SVG;
    const svg = wrap.firstElementChild;
    if (svg && svg.querySelector("path")) {
      getHiddenMapHolder().appendChild(svg);
      printWorldMapRoot = svg;
    }
  }
  return printWorldMapRoot;
}

// 選んだ項目だけから、地図の表示範囲（viewBox）をその場で計算する
// （プリセットの地方・地域名に当てはまらない、県・国をまたいだ独自選択のとき用）
function computeDynamicViewBox(svg, ids, pad, fallback) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  ids.forEach((id) => {
    const el = svg.querySelector('[id="' + id + '"]');
    if (!el) return;
    const b = el.getBBox();
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  });
  if (!isFinite(minX)) return fallback;
  const w = maxX - minX;
  const h = maxY - minY;
  const padX = w * pad;
  const padY = h * pad;
  return [minX - padX, minY - padY, w + padX * 2, h + padY * 2];
}

function pickPrintViewBox(kindDef, svg, items, coveredRegions, forceFullView) {
  const full = kindDef.regionView[kindDef.fullViewKey];
  if (forceFullView || items.length === kindDef.pool.length) return full; // 「全国／全世界」
  if (coveredRegions.length === 1) return kindDef.regionView[coveredRegions[0]] || full;
  // 複数の地方・地域をまたぐ選択のときは、選んだ項目だけからその場で拡大範囲を計算する。
  // ただし、選んだ地方・地域が離れすぎていて全体表示とほぼ変わらない大きさになる
  // ときは、無理に拡大せず全体表示にする（region-view-data.js と同じ考え方）。
  const box = computeDynamicViewBox(svg, items.map((it) => it.id), 0.3, full);
  const boxArea = box[2] * box[3];
  const fullArea = full[2] * full[3];
  if (boxArea / fullArea > REGION_UNION_MAX_AREA_RATIO) return full;
  return box;
}

// 白地図の上に、答えの書き込み欄と対応する番号（1,2,3…）を表示する
// 位置の計算は「文書に挿入済み」の root から行う（クローン直後の svg では
// getBBox() がまだ正しい値を返さないため）
function addMapNumbers(root, targetSvg, items, viewBox) {
  const size = Math.max(viewBox[2], viewBox[3]);
  const fontSize = size * 0.045;
  items.forEach((it, i) => {
    const el = root.querySelector('[id="' + it.id + '"]');
    if (!el) return;
    const b = el.getBBox();
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", cx);
    text.setAttribute("y", cy);
    text.setAttribute("class", "map-number");
    text.setAttribute("font-size", fontSize);
    text.textContent = String(i + 1);
    targetSvg.appendChild(text);
  });
}

function renderBlankMap(container, kindDef, items, coveredRegions, forceFullView) {
  const root = ensurePrintMap(kindDef.mapMode);
  container.innerHTML = "";
  if (!root) {
    const msg = document.createElement("p");
    msg.className = "map-error";
    msg.textContent = "地図を読み込めませんでした。ページを再読み込みしてください。";
    container.appendChild(msg);
    return;
  }
  const svg = root.cloneNode(true);
  const ids = new Set(items.map((it) => it.id));
  svg.querySelectorAll("path").forEach((p) => {
    p.classList.remove("highlight");
    if (ids.has(p.id)) p.classList.add("target");
  });
  const viewBox = pickPrintViewBox(kindDef, root, items, coveredRegions, forceFullView);
  svg.setAttribute("viewBox", viewBox.join(" "));
  addMapNumbers(root, svg, items, viewBox);
  container.appendChild(svg);
}

// ---------- 国旗クイズ（世界のみ） ----------
// 都道府県には国旗にあたるものがないため、日本地理のプリントには出さない。
const FLAG_QUIZ_MAX = 6; // 紙面がごちゃごちゃしすぎないよう、多いときは何個かに絞る

function buildFlagQuizSection(kindDef, items) {
  if (kindDef.mapMode !== "world") return null;
  const quizItems = items.length > FLAG_QUIZ_MAX ? sampleN(items, FLAG_QUIZ_MAX) : items;
  return { items: quizItems };
}

// ①白地図②国旗クイズ（世界のみ）③特徴④○×⑤振り返り、のように、
// 日本地理・世界地理で章の数が変わっても番号がズレないよう、その場で計算する
const SECTION_CIRCLED_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥"];

function computeSectionNumbers(hasFlagQuiz) {
  const order = ["map", hasFlagQuiz ? "flags" : null, "features", "tf", "reflect"].filter(Boolean);
  const numbers = {};
  order.forEach((key, i) => {
    numbers[key] = SECTION_CIRCLED_NUMBERS[i];
  });
  return numbers;
}

// 選んだ項目が、いくつかの地方・地域を「まるごと」選んだ結果と一致するかどうか
// （一致すれば見出しに地方・地域名を、そうでなければ個別の県・国名を使う）
function isFullRegionUnion(kindDef, items, coveredRegions) {
  const wholeRegionCount = coveredRegions.reduce(
    (sum, r) => sum + kindDef.pool.filter((it) => it.region === r).length,
    0
  );
  return items.length === wholeRegionCount;
}

// ---------- プリント全体を組み立てる ----------
function buildWorksheet(kindKey, items, forceFullView) {
  const kindDef = WORKSHEET_KIND[kindKey];
  const coveredRegions = Array.from(new Set(items.map((it) => it.region)));
  // 「地方・地域をまるごと選んだか」を、地方・地域が1つだけかどうかより先に判定する。
  // （先に coveredRegions.length===1 を見てしまうと、同じ地方の一部だけを
  // 　個別選択した場合でも地方名になってしまっていたため）
  const areaName =
    forceFullView || items.length === kindDef.pool.length
      ? kindDef.fullViewKey
      : isFullRegionUnion(kindDef, items, coveredRegions)
      ? coveredRegions.join("・")
      : items.map((it) => it.name).join("・");

  const feature = buildFeatureSection(kindDef, items);
  const flagQuiz = buildFlagQuizSection(kindDef, items);
  const easyMedium = buildTrueFalseSet(kindDef, items, kindDef.pool);
  const hard = buildHardQuestion(kindDef, items, kindDef.pool);
  const allQuestions = [...easyMedium, hard];

  return { kindKey, kindDef, items, coveredRegions, areaName, feature, flagQuiz, allQuestions, forceFullView: !!forceFullView };
}

// ---------- 画面への描画 ----------
function renderWorksheet(sheet) {
  const { kindDef, items, coveredRegions, areaName, feature, flagQuiz, allQuestions, forceFullView } = sheet;
  const nums = computeSectionNumbers(!!flagQuiz);

  document.getElementById("sheet-title").textContent = `${areaName}　学習プリント`;
  document.getElementById("answer-title").textContent = `${areaName}　学習プリント（解答編）　なまえ（　　　　　　　　）`;
  document.getElementById("sheet-goal").textContent =
    kindDef.mapMode === "japan"
      ? `【目標】${areaName}の地域構成・特徴を理解する`
      : `【目標】${areaName}の国・地域の位置と特徴を理解する`;

  document.getElementById("sheet-warmup-area").textContent = areaName;
  const namesEl = document.getElementById("sheet-warmup-names");
  namesEl.innerHTML = "";
  pickWarmupNames(kindDef, items).forEach((name) => {
    const span = document.createElement("span");
    span.className = "chip-box";
    span.textContent = name;
    namesEl.appendChild(span);
  });

  document.getElementById("sheet-map-heading").textContent = `${nums.map} 白地図（10分）`;
  renderBlankMap(document.getElementById("sheet-map"), kindDef, items, coveredRegions, forceFullView);

  const listEl = document.getElementById("sheet-map-list");
  listEl.innerHTML = "";
  items.forEach((it, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${"　".repeat(10)}`;
    listEl.appendChild(li);
  });
  document.getElementById("sheet-map-instruction").textContent =
    kindDef.mapMode === "japan"
      ? `【やること】地図の番号と同じ数字の欄に、${kindDef.unitWord}の名前を書く（予想でOK）`
      : `【やること】地図の番号と同じ数字の欄に、国の名前を書く（予想でOK）`;

  const flagSectionEl = document.getElementById("sheet-flag-section");
  if (flagQuiz) {
    flagSectionEl.classList.remove("hidden");
    document.getElementById("sheet-flag-heading").textContent = `${nums.flags} 国旗クイズ（5分）`;
    document.getElementById("sheet-flag-instruction").textContent = "【やること】国旗を見て、国の名前を書く（予想でOK）";
    const flagsEl = document.getElementById("sheet-flags");
    flagsEl.innerHTML = "";
    flagQuiz.items.forEach((it, i) => {
      const box = document.createElement("div");
      box.className = "flag-quiz-item";
      const img = document.createElement("img");
      img.src = `assets/flags/${it.id}.svg`;
      img.alt = `${it.name}の国旗`;
      img.className = "flag-quiz-img";
      img.onerror = () => {
        img.onerror = null;
        const fallback = document.createElement("span");
        fallback.className = "flag-fallback";
        fallback.textContent = "国旗画像を表示できません";
        img.replaceWith(fallback);
      };
      const label = document.createElement("div");
      label.className = "flag-quiz-blank";
      label.textContent = `${i + 1}. ${"　".repeat(8)}`;
      box.appendChild(img);
      box.appendChild(label);
      flagsEl.appendChild(box);
    });
  } else {
    flagSectionEl.classList.add("hidden");
  }

  document.getElementById("sheet-feature-heading").textContent = `${nums.features} 特徴を選ぼう（5分）`;
  const featEl = document.getElementById("sheet-features");
  featEl.innerHTML = "";
  feature.labeled.forEach((o) => {
    const span = document.createElement("span");
    span.className = "feat-chip";
    span.textContent = `${o.letter} ${o.label}`;
    featEl.appendChild(span);
  });
  document.getElementById("sheet-feature-instruction").textContent =
    `→　${areaName}に特に当てはまるものを3つ選ぼう（　　）（　　）（　　）`;

  document.getElementById("sheet-tf-heading").textContent = `${nums.tf} ○×問題（10分）`;
  document.getElementById("sheet-reflect-heading").textContent = `${nums.reflect} 振り返り`;

  const qList = document.getElementById("sheet-questions");
  qList.innerHTML = "";
  let levelShown = "";
  allQuestions.forEach((q, i) => {
    if (q.level !== levelShown) {
      levelShown = q.level;
      const h = document.createElement("div");
      h.className = "level-heading";
      h.textContent = `＜${q.level}問題＞`;
      qList.appendChild(h);
    }
    const p = document.createElement("div");
    p.className = "q-line";
    p.textContent = `${i + 1}　${q.statement}（　　）`;
    qList.appendChild(p);
  });

  // 解答
  const mapAnswer = document.getElementById("answer-map");
  mapAnswer.textContent = `地図：${items.map((it) => it.name).join("・")}`;

  const flagAnswerEl = document.getElementById("answer-flags");
  if (flagQuiz) {
    flagAnswerEl.textContent = `国旗：${flagQuiz.items.map((it, i) => `${i + 1}.${it.name}`).join("　")}`;
  } else {
    flagAnswerEl.textContent = "";
  }

  const featAnswer = document.getElementById("answer-features");
  featAnswer.textContent = `特徴：${feature.correctLetters.join("・")}（${feature.trueTags.join("・")}）`;

  const qAnswer = document.getElementById("answer-questions");
  qAnswer.innerHTML = "";
  allQuestions.forEach((q, i) => {
    const span = document.createElement("span");
    span.className = "answer-item";
    span.textContent = q.isTrue ? `${i + 1}〇` : `${i + 1}×→${q.explanation}`;
    qAnswer.appendChild(span);
  });

  document.getElementById("sheet-map-criteria").textContent =
    `${nums.map}地図：${items.length}${kindDef.unitWord}を地図に配置しようとしていれば○（だいたいでOK）`;

  const flagCriteriaEl = document.getElementById("sheet-flag-criteria");
  if (flagQuiz) {
    const fn = flagQuiz.items.length;
    const flagHigh = Math.max(1, Math.ceil(fn * 0.6));
    flagCriteriaEl.textContent = `${nums.flags}国旗：${fn}問中${flagHigh}問以上正解していれば○（予想でも近い形が分かればOK）`;
  } else {
    flagCriteriaEl.textContent = "";
  }

  document.getElementById("sheet-feature-criteria").textContent =
    `${nums.features}特徴：3つ選べていれば○（解答例と違っても、理由が説明できればOK）`;

  const total = allQuestions.length;
  const highLine = Math.max(1, Math.ceil(total * 0.8));
  const midLine = Math.max(1, Math.ceil(total * 0.5));
  document.getElementById("sheet-tf-criteria").textContent =
    `${nums.tf}○×：${total}問中${highLine}問以上正解していれば○、${midLine}〜${highLine - 1}問△、それ以下×`;

  document.getElementById("sheet-reflect-criteria").textContent = `${nums.reflect}振り返り：何か書いていれば○`;

  document.getElementById("screen-select").classList.add("hidden");
  document.getElementById("screen-sheet").classList.remove("hidden");
}

// ---------- 選択画面のロジック ----------
function getItemsByRegion(kindKey, region) {
  return WORKSHEET_KIND[kindKey].pool.filter((it) => it.region === region);
}
function getItemsByIds(kindKey, ids) {
  const idSet = new Set(ids);
  return WORKSHEET_KIND[kindKey].pool.filter((it) => idSet.has(it.id));
}

let lastSelection = null; // { kindKey, items, forceFullView } を覚えておいて「作り直す」で使う
const OVERVIEW_SAMPLE_SIZE = 10; // 「日本全国／世界全体」で一度に書き込む数（全部だと多すぎるため）

function generateFor(kindKey, items, forceFullView) {
  if (items.length === 0) return;
  lastSelection = { kindKey, items, forceFullView: !!forceFullView };
  const sheet = buildWorksheet(kindKey, items, forceFullView);
  renderWorksheet(sheet);
}

// 「日本全国／世界全体」：全部を書き込み対象にすると多すぎるので、
// 地図は全体表示のまま、書き込む県・国だけをランダムに10個ほど選ぶ
function generateOverview(kindKey) {
  const pool = WORKSHEET_KIND[kindKey].pool;
  const items = sampleN(pool, Math.min(OVERVIEW_SAMPLE_SIZE, pool.length));
  generateFor(kindKey, items, true);
}

// 地方・地域のボタンは複数選べるトグル式にして（東北＋関東、のように）、
// 「選んだ地方でプリントを作る」ボタンでまとめて生成する
function getCheckedRegions(kindKey) {
  const wrap = document.getElementById(kindKey === "jp" ? "jp-region-buttons" : "world-region-buttons");
  return Array.from(wrap.querySelectorAll(".region-btn.checked")).map((btn) => btn.dataset.region);
}

function buildRegionButtons(kindKey) {
  const wrap = document.getElementById(kindKey === "jp" ? "jp-region-buttons" : "world-region-buttons");
  wrap.innerHTML = "";

  WORKSHEET_KIND[kindKey].regions.forEach((region) => {
    const btn = document.createElement("button");
    btn.className = "region-btn";
    btn.textContent = region;
    btn.dataset.region = region;
    btn.type = "button";
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => {
      btn.classList.toggle("checked");
      btn.setAttribute("aria-pressed", btn.classList.contains("checked") ? "true" : "false");
    });
    wrap.appendChild(btn);
  });
}

function generateForRegions(kindKey) {
  const regions = getCheckedRegions(kindKey);
  if (regions.length === 0) {
    showSelectMessage(kindKey, "地方・地域を1つ以上選んでください");
    return;
  }
  showSelectMessage(kindKey, "");
  const items = WORKSHEET_KIND[kindKey].pool.filter((it) => regions.includes(it.region));
  generateFor(kindKey, items);
}

function showSelectMessage(kindKey, msg) {
  const id = kindKey === "jp" ? "jp-select-message" : "world-select-message";
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function buildCustomCheckboxes(kindKey) {
  const wrap = document.getElementById(kindKey === "jp" ? "jp-custom-list" : "world-custom-list");
  wrap.innerHTML = "";
  WORKSHEET_KIND[kindKey].pool.forEach((it) => {
    const label = document.createElement("label");
    label.className = "custom-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = it.id;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(it.name));
    wrap.appendChild(label);
  });
}

function getCheckedIds(kindKey) {
  const wrap = document.getElementById(kindKey === "jp" ? "jp-custom-list" : "world-custom-list");
  return Array.from(wrap.querySelectorAll("input:checked")).map((cb) => cb.value);
}

function initTabs() {
  const jpTabBtn = document.getElementById("tab-jp-btn");
  const worldTabBtn = document.getElementById("tab-world-btn");
  const jpPanel = document.getElementById("tab-jp-panel");
  const worldPanel = document.getElementById("tab-world-panel");

  jpTabBtn.addEventListener("click", () => {
    jpTabBtn.classList.add("active");
    worldTabBtn.classList.remove("active");
    jpPanel.classList.remove("hidden");
    worldPanel.classList.add("hidden");
  });
  worldTabBtn.addEventListener("click", () => {
    worldTabBtn.classList.add("active");
    jpTabBtn.classList.remove("active");
    worldPanel.classList.remove("hidden");
    jpPanel.classList.add("hidden");
  });
}

// 問題編・解答編・両方、を選んで印刷する
// （印刷ダイアログが閉じたあとに afterprint で必ず元の表示に戻す）
function printSheet(mode) {
  const paper = document.getElementById("sheet-paper");
  paper.classList.remove("print-questions-only", "print-answers-only");
  if (mode === "questions") paper.classList.add("print-questions-only");
  if (mode === "answers") paper.classList.add("print-answers-only");

  const cleanup = () => {
    paper.classList.remove("print-questions-only", "print-answers-only");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  window.print();
}

function init() {
  initTabs();
  buildRegionButtons("jp");
  buildRegionButtons("world");
  buildCustomCheckboxes("jp");
  buildCustomCheckboxes("world");

  document.getElementById("jp-region-all-btn").addEventListener("click", () => generateOverview("jp"));
  document.getElementById("world-region-all-btn").addEventListener("click", () => generateOverview("world"));
  document.getElementById("jp-region-generate-btn").addEventListener("click", () => generateForRegions("jp"));
  document.getElementById("world-region-generate-btn").addEventListener("click", () => generateForRegions("world"));

  document.getElementById("jp-custom-btn").addEventListener("click", () => {
    const ids = getCheckedIds("jp");
    if (ids.length === 0) {
      showSelectMessage("jp", "都道府県を1つ以上選んでください");
      return;
    }
    showSelectMessage("jp", "");
    generateFor("jp", getItemsByIds("jp", ids));
  });
  document.getElementById("world-custom-btn").addEventListener("click", () => {
    const ids = getCheckedIds("world");
    if (ids.length === 0) {
      showSelectMessage("world", "国を1つ以上選んでください");
      return;
    }
    showSelectMessage("world", "");
    generateFor("world", getItemsByIds("world", ids));
  });

  document.getElementById("btn-print").addEventListener("click", () => printSheet("all"));
  document.getElementById("btn-print-questions").addEventListener("click", () => printSheet("questions"));
  document.getElementById("btn-print-answers").addEventListener("click", () => printSheet("answers"));
  document.getElementById("btn-remake").addEventListener("click", () => {
    if (lastSelection) generateFor(lastSelection.kindKey, lastSelection.items, lastSelection.forceFullView);
  });
  document.getElementById("btn-back-select").addEventListener("click", () => {
    document.getElementById("screen-sheet").classList.add("hidden");
    document.getElementById("screen-select").classList.remove("hidden");
  });
}

document.addEventListener("DOMContentLoaded", init);
