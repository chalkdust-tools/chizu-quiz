// クイズの「問い方」です。知識そのものは prefectures.js / countries.js にあります。
// 形式を増やすときは、既存行をコピーし、id・kind・type などを変更します。
// difficulty は easy（やさしい）/ medium（少し考える）/ think（考える）の3段階です。
const QUIZ_TEMPLATES = [
  { id: "jp-highlight-name", scope: "japanMap", difficulty: "easy", kind: "jp-highlight-name", type: "地図 → 県名" },
  { id: "jp-click-location", scope: "japanMap", difficulty: "medium", kind: "jp-click-location", type: "県名 → 地図クリック" },
  { id: "jp-number-name", scope: "japanMap", difficulty: "easy", kind: "jp-number-name", type: "地図番号 → 県名" },
  { id: "jp-name-number", scope: "japanMap", difficulty: "medium", kind: "jp-name-number", type: "県名 → 地図番号" },

  { id: "jp-region-name", scope: "regions", difficulty: "easy", kind: "jp-region-name", type: "県 → 地方" },
  { id: "jp-region-member", scope: "regions", difficulty: "easy", kind: "jp-region-member", type: "地方 → 県" },
  { id: "jp-region-outsider", scope: "regions", difficulty: "medium", kind: "jp-region-outsider", type: "地方にない県" },
  { id: "jp-highlight-region", scope: "regions", difficulty: "medium", kind: "jp-highlight-region", type: "地図 → 地方" },
  { id: "jp-region-truefalse", scope: "regions", difficulty: "easy", kind: "jp-region-truefalse", type: "地方 ○×" },
  { id: "jp-region-pair", scope: "regions", difficulty: "think", kind: "jp-region-pair", type: "2県の地方 ○×" },

  { id: "jp-capital-forward", scope: "prefectureCapitals", difficulty: "easy", kind: "jp-capital-forward", type: "県 → 県庁所在地" },
  { id: "jp-capital-reverse", scope: "prefectureCapitals", difficulty: "medium", kind: "jp-capital-reverse", type: "県庁所在地 → 県" },
  { id: "jp-capital-truefalse", scope: "prefectureCapitals", difficulty: "easy", kind: "jp-capital-truefalse", type: "県庁所在地 ○×" },
  { id: "jp-capital-pair", scope: "prefectureCapitals", difficulty: "medium", kind: "jp-capital-pair", type: "正しい組み合わせ" },

  { id: "world-highlight-name", scope: "worldMap", difficulty: "easy", kind: "world-highlight-name", type: "世界地図 → 国名" },
  { id: "world-click-location", scope: "worldMap", difficulty: "medium", kind: "world-click-location", type: "国名 → 地図クリック" },
  { id: "world-location-truefalse", scope: "worldMap", difficulty: "medium", kind: "world-location-truefalse", type: "国名 → 地図 ○×" },

  { id: "world-capital-forward", scope: "worldCapitals", difficulty: "easy", kind: "world-capital-forward", type: "国 → 首都" },
  { id: "world-capital-reverse", scope: "worldCapitals", difficulty: "medium", kind: "world-capital-reverse", type: "首都 → 国" },
  { id: "world-region-forward", scope: "worldCapitals", difficulty: "easy", kind: "world-region-forward", type: "国 → 地域" },
  { id: "world-region-truefalse", scope: "worldCapitals", difficulty: "medium", kind: "world-region-truefalse", type: "地域 ○×" },
  { id: "world-capital-truefalse", scope: "worldCapitals", difficulty: "easy", kind: "world-capital-truefalse", type: "首都 ○×" },
  { id: "world-capital-region", scope: "worldCapitals", difficulty: "think", kind: "world-capital-region", type: "首都 → 地域" },

  { id: "world-flag-name", scope: "flags", difficulty: "easy", kind: "world-flag-name", type: "国旗 → 国名" },
  { id: "world-name-flag", scope: "flags", difficulty: "easy", kind: "world-name-flag", type: "国名 → 国旗" },
  { id: "world-flag-capital", scope: "flags", difficulty: "think", kind: "world-flag-capital", type: "国旗 → 首都" },
];

// 誤答を全国・全世界から無作為に選ぶと、離れすぎた選択肢になりがちです。
// 4択や○×の誤答には、まず下の「混同しやすい近い区分」を使います。
// 区分の考え方を変えたい場合は、この2か所だけを編集してください。
const JAPAN_REGION_CONFUSABLES = {
  "北海道": ["東北"],
  "東北": ["北海道", "関東", "中部"],
  "関東": ["東北", "中部"],
  "中部": ["関東", "近畿", "東北"],
  "近畿": ["中部", "中国", "四国"],
  "中国": ["近畿", "四国", "九州・沖縄"],
  "四国": ["中国", "近畿", "九州・沖縄"],
  "九州・沖縄": ["中国", "四国"],
};

const WORLD_REGION_CONFUSABLES = {
  "東アジア": ["東南アジア", "南アジア"],
  "東南アジア": ["東アジア", "南アジア", "オセアニア"],
  "南アジア": ["東アジア", "東南アジア"],
  "ヨーロッパ": ["北アメリカ", "アフリカ"],
  "北アメリカ": ["南アメリカ", "ヨーロッパ"],
  "南アメリカ": ["北アメリカ", "アフリカ"],
  "アフリカ": ["ヨーロッパ", "南アメリカ", "南アジア"],
  "オセアニア": ["東南アジア", "東アジア"],
};

// 自習プリントの「特徴を選ぼう」で使う基本事項です。
// 文を直すときは、各地方の配列の中だけを編集してください。
const REGION_FEATURES = {
  "北海道": [
    "北海道地方は、北海道の1道だけでできている",
    "日本で最も北にある都道府県は北海道である",
    "北海道の道庁所在地は札幌市である",
    "北海道は日本で最も面積が大きい都道府県である",
    "北海道地方は東北地方より北にある",
  ],
  "東北": [
    "東北地方は6県でできている",
    "山形県は東北地方にある",
    "宮城県の県庁所在地は仙台市である",
    "青森県は本州の最も北にある県である",
    "福島県の県庁所在地は福島市である",
  ],
  "関東": [
    "関東地方は1都6県でできている",
    "東京都と神奈川県は関東地方にある",
    "群馬県の県庁所在地は前橋市である",
    "千葉県の県庁所在地は千葉市である",
    "東京都庁は新宿区にある",
  ],
  "中部": [
    "中部地方は9県でできている",
    "長野県と山梨県は中部地方にある",
    "愛知県の県庁所在地は名古屋市である",
    "新潟県は中部地方にある",
    "石川県の県庁所在地は金沢市である",
  ],
  "近畿": [
    "近畿地方は2府5県でできている",
    "このアプリでは三重県を近畿地方に入れる",
    "滋賀県の県庁所在地は大津市である",
    "京都府と大阪府は近畿地方にある",
    "兵庫県の県庁所在地は神戸市である",
  ],
  "中国": [
    "中国地方は5県でできている",
    "鳥取県と島根県は中国地方にある",
    "広島県の県庁所在地は広島市である",
    "岡山県の県庁所在地は岡山市である",
    "山口県は中国地方にある",
  ],
  "四国": [
    "四国地方は4県でできている",
    "徳島県と香川県は四国地方にある",
    "香川県の県庁所在地は高松市である",
    "愛媛県の県庁所在地は松山市である",
    "高知県は四国地方にある",
  ],
  "九州・沖縄": [
    "九州・沖縄地方は8県でできている",
    "沖縄県は九州・沖縄地方に入る",
    "福岡県の県庁所在地は福岡市である",
    "熊本県の県庁所在地は熊本市である",
    "沖縄県の県庁所在地は那覇市である",
  ],
};

const PRINT_WORDING = {
  goal: "地図を見ながら、地方・都道府県・県庁所在地の基本を自分で確かめよう。",
  mapHint: "地図の番号を見て書こう。だいたいでOK。予想でもOK。",
  warmup: "聞いたことがある都道府県名（　　　　　　　　　）　全部知らなくてもOK",
};

const WORLD_PRINT_WORDING = {
  goal: "地図を見ながら、主要国・首都・地域・国旗の基本を自分で確かめよう。",
  mapHint: "番号の国名を書こう。だいたいの位置が分かればOK。予想でもOK。",
  warmup: "聞いたことがある国名（　　　　　　　　　）　全部知らなくてもOK",
};
