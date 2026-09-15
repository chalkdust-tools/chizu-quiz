const WORLD_REGIONS = [
  "東アジア", "東南アジア", "南アジア", "ヨーロッパ",
  "北アメリカ", "南アメリカ", "アフリカ", "オセアニア",
];

// mapId は世界地図SVGの国コード、flag は国旗絵文字です。
const COUNTRIES = [
  { id: "JP", mapId: "jp", name: "日本", capital: "東京", region: "東アジア", flag: "🇯🇵" },
  { id: "CN", mapId: "cn", name: "中国", capital: "北京", region: "東アジア", flag: "🇨🇳" },
  { id: "KR", mapId: "kr", name: "韓国", capital: "ソウル", region: "東アジア", flag: "🇰🇷" },
  { id: "KP", mapId: "kp", name: "北朝鮮", capital: "ピョンヤン", region: "東アジア", flag: "🇰🇵" },
  { id: "TW", mapId: "tw", name: "台湾", capital: "台北", region: "東アジア", flag: "🇹🇼" },
  { id: "MN", mapId: "mn", name: "モンゴル", capital: "ウランバートル", region: "東アジア", flag: "🇲🇳" },
  { id: "TH", mapId: "th", name: "タイ", capital: "バンコク", region: "東南アジア", flag: "🇹🇭" },
  { id: "VN", mapId: "vn", name: "ベトナム", capital: "ハノイ", region: "東南アジア", flag: "🇻🇳" },
  { id: "PH", mapId: "ph", name: "フィリピン", capital: "マニラ", region: "東南アジア", flag: "🇵🇭" },
  // 首都移転中のため、インドネシアは当面「首都」形式だけ出題しません。
  { id: "ID", mapId: "id", capitalQuiz: false, name: "インドネシア", capital: "ジャカルタ", region: "東南アジア", flag: "🇮🇩" },
  { id: "SG", mapId: "sg", mapQuiz: false, name: "シンガポール", capital: "シンガポール", region: "東南アジア", flag: "🇸🇬" },
  { id: "MY", mapId: "my", name: "マレーシア", capital: "クアラルンプール", region: "東南アジア", flag: "🇲🇾" },
  { id: "IN", mapId: "in", name: "インド", capital: "ニューデリー", region: "南アジア", flag: "🇮🇳" },
  { id: "PK", mapId: "pk", name: "パキスタン", capital: "イスラマバード", region: "南アジア", flag: "🇵🇰" },
  { id: "BD", mapId: "bd", name: "バングラデシュ", capital: "ダッカ", region: "南アジア", flag: "🇧🇩" },
  { id: "GB", mapId: "gb", name: "イギリス", capital: "ロンドン", region: "ヨーロッパ", flag: "🇬🇧" },
  { id: "FR", mapId: "fr", name: "フランス", capital: "パリ", region: "ヨーロッパ", flag: "🇫🇷" },
  { id: "DE", mapId: "de", name: "ドイツ", capital: "ベルリン", region: "ヨーロッパ", flag: "🇩🇪" },
  { id: "IT", mapId: "it", name: "イタリア", capital: "ローマ", region: "ヨーロッパ", flag: "🇮🇹" },
  { id: "ES", mapId: "es", name: "スペイン", capital: "マドリード", region: "ヨーロッパ", flag: "🇪🇸" },
  // 地域拡大図がユーラシア全体にならないよう、ロシアは拡大範囲の計算から外します。
  { id: "RU", mapId: "ru", printPrimary: false, name: "ロシア", capital: "モスクワ", region: "ヨーロッパ", flag: "🇷🇺" },
  // 全世界地図では小さすぎるため、オランダは地図形式だけ出題しません。
  { id: "NL", mapId: "nl", mapQuiz: false, name: "オランダ", capital: "アムステルダム", region: "ヨーロッパ", flag: "🇳🇱" },
  { id: "GR", mapId: "gr", name: "ギリシャ", capital: "アテネ", region: "ヨーロッパ", flag: "🇬🇷" },
  { id: "PL", mapId: "pl", name: "ポーランド", capital: "ワルシャワ", region: "ヨーロッパ", flag: "🇵🇱" },
  { id: "US", mapId: "us", name: "アメリカ", capital: "ワシントンD.C.", region: "北アメリカ", flag: "🇺🇸" },
  { id: "CA", mapId: "ca", name: "カナダ", capital: "オタワ", region: "北アメリカ", flag: "🇨🇦" },
  { id: "MX", mapId: "mx", name: "メキシコ", capital: "メキシコシティ", region: "北アメリカ", flag: "🇲🇽" },
  { id: "BR", mapId: "br", name: "ブラジル", capital: "ブラジリア", region: "南アメリカ", flag: "🇧🇷" },
  { id: "AR", mapId: "ar", name: "アルゼンチン", capital: "ブエノスアイレス", region: "南アメリカ", flag: "🇦🇷" },
  { id: "CL", mapId: "cl", name: "チリ", capital: "サンティアゴ", region: "南アメリカ", flag: "🇨🇱" },
  { id: "PE", mapId: "pe", name: "ペルー", capital: "リマ", region: "南アメリカ", flag: "🇵🇪" },
  { id: "EG", mapId: "eg", name: "エジプト", capital: "カイロ", region: "アフリカ", flag: "🇪🇬" },
  // 行政府・立法府・司法府の所在地が分かれるため、首都を1つ答える問題からは外します。
  { id: "ZA", mapId: "za", capitalQuiz: false, name: "南アフリカ共和国", capital: "プレトリア", region: "アフリカ", flag: "🇿🇦" },
  { id: "KE", mapId: "ke", name: "ケニア", capital: "ナイロビ", region: "アフリカ", flag: "🇰🇪" },
  { id: "NG", mapId: "ng", name: "ナイジェリア", capital: "アブジャ", region: "アフリカ", flag: "🇳🇬" },
  { id: "ET", mapId: "et", name: "エチオピア", capital: "アディスアベバ", region: "アフリカ", flag: "🇪🇹" },
  { id: "MA", mapId: "ma-", name: "モロッコ", capital: "ラバト", region: "アフリカ", flag: "🇲🇦" },
  { id: "AU", mapId: "au", name: "オーストラリア", capital: "キャンベラ", region: "オセアニア", flag: "🇦🇺" },
  { id: "NZ", mapId: "nz", name: "ニュージーランド", capital: "ウェリントン", region: "オセアニア", flag: "🇳🇿" },
];
