// 世界の国データ（主要33か国）
// id は assets/world.svg の中の <path id="..."> と対応しています（国名記号=ISOコード）。
// 国を追加したいときは、
//   1. assets/world.svg に国の path があるか確認する（無ければ追加は難しい）
//   2. この配列に1行増やす
//   3. WORLD_REGIONS に新しい地域があれば追加する
// だけでOKです。
//
// name     : 国名
// capital  : 首都
// flag     : 国旗（絵文字。画像を使わないので読み込みが軽い）
// region   : 地域区分（東アジア/東南アジア/南アジア/ヨーロッパ/北アメリカ/南アメリカ/アフリカ/オセアニア）

const WORLD_COUNTRIES = [
  // 東アジア
  { id: "jp", name: "日本", capital: "東京", flag: "🇯🇵", region: "東アジア" },
  { id: "cn", name: "中国", capital: "北京", flag: "🇨🇳", region: "東アジア" },
  { id: "kr", name: "韓国", capital: "ソウル", flag: "🇰🇷", region: "東アジア" },
  { id: "mn", name: "モンゴル", capital: "ウランバートル", flag: "🇲🇳", region: "東アジア" },

  // 東南アジア
  { id: "th", name: "タイ", capital: "バンコク", flag: "🇹🇭", region: "東南アジア" },
  { id: "vn", name: "ベトナム", capital: "ハノイ", flag: "🇻🇳", region: "東南アジア" },
  { id: "ph", name: "フィリピン", capital: "マニラ", flag: "🇵🇭", region: "東南アジア" },
  { id: "id", name: "インドネシア", capital: "ジャカルタ", flag: "🇮🇩", region: "東南アジア" },
  { id: "my", name: "マレーシア", capital: "クアラルンプール", flag: "🇲🇾", region: "東南アジア" },
  { id: "sg", name: "シンガポール", capital: "シンガポール", flag: "🇸🇬", region: "東南アジア" },

  // 南アジア
  { id: "in", name: "インド", capital: "ニューデリー", flag: "🇮🇳", region: "南アジア" },
  { id: "pk", name: "パキスタン", capital: "イスラマバード", flag: "🇵🇰", region: "南アジア" },
  { id: "bd", name: "バングラデシュ", capital: "ダッカ", flag: "🇧🇩", region: "南アジア" },

  // ヨーロッパ
  { id: "gb", name: "イギリス", capital: "ロンドン", flag: "🇬🇧", region: "ヨーロッパ" },
  { id: "fr", name: "フランス", capital: "パリ", flag: "🇫🇷", region: "ヨーロッパ" },
  { id: "de", name: "ドイツ", capital: "ベルリン", flag: "🇩🇪", region: "ヨーロッパ" },
  { id: "it", name: "イタリア", capital: "ローマ", flag: "🇮🇹", region: "ヨーロッパ" },
  { id: "es", name: "スペイン", capital: "マドリード", flag: "🇪🇸", region: "ヨーロッパ" },
  { id: "ru", name: "ロシア", capital: "モスクワ", flag: "🇷🇺", region: "ヨーロッパ" },
  { id: "nl", name: "オランダ", capital: "アムステルダム", flag: "🇳🇱", region: "ヨーロッパ" },
  { id: "ch", name: "スイス", capital: "ベルン", flag: "🇨🇭", region: "ヨーロッパ" },

  // 北アメリカ
  { id: "us", name: "アメリカ", capital: "ワシントンD.C.", flag: "🇺🇸", region: "北アメリカ" },
  { id: "ca", name: "カナダ", capital: "オタワ", flag: "🇨🇦", region: "北アメリカ" },
  { id: "mx", name: "メキシコ", capital: "メキシコシティ", flag: "🇲🇽", region: "北アメリカ" },

  // 南アメリカ
  { id: "br", name: "ブラジル", capital: "ブラジリア", flag: "🇧🇷", region: "南アメリカ" },
  { id: "ar", name: "アルゼンチン", capital: "ブエノスアイレス", flag: "🇦🇷", region: "南アメリカ" },
  { id: "pe", name: "ペルー", capital: "リマ", flag: "🇵🇪", region: "南アメリカ" },
  { id: "co", name: "コロンビア", capital: "ボゴタ", flag: "🇨🇴", region: "南アメリカ" },

  // アフリカ
  { id: "eg", name: "エジプト", capital: "カイロ", flag: "🇪🇬", region: "アフリカ" },
  // 南アフリカは行政首都プレトリア・立法首都ケープタウン・司法首都ブルームフォンテーンの
  // 3つの首都を持つが、日本の教科書・地図帳ではプレトリアが標準的に採用されているためこれを使用
  { id: "za", name: "南アフリカ", capital: "プレトリア", flag: "🇿🇦", region: "アフリカ" },
  { id: "ke", name: "ケニア", capital: "ナイロビ", flag: "🇰🇪", region: "アフリカ" },

  // オセアニア
  { id: "au", name: "オーストラリア", capital: "キャンベラ", flag: "🇦🇺", region: "オセアニア" },
  { id: "nz", name: "ニュージーランド", capital: "ウェリントン", flag: "🇳🇿", region: "オセアニア" },
];

const WORLD_REGIONS = [
  "東アジア", "東南アジア", "南アジア", "ヨーロッパ",
  "北アメリカ", "南アメリカ", "アフリカ", "オセアニア",
];
