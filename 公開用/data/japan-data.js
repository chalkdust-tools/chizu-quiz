// 都道府県データ
// id は assets/japan.svg の中の <path id="..."> と対応しています。
// 新しい情報を直すときは、この配列の中身だけ書きかえればOKです。
//
// name     : 都道府県名
// capital  : 県庁所在地
// region   : 地方区分（北海道 / 東北 / 関東 / 中部 / 近畿 / 中国 / 四国 / 九州・沖縄）

const JAPAN_PREFECTURES = [
  { id: "hokkaido", name: "北海道", capital: "札幌市", region: "北海道" },

  { id: "aomori", name: "青森県", capital: "青森市", region: "東北" },
  { id: "iwate", name: "岩手県", capital: "盛岡市", region: "東北" },
  { id: "miyagi", name: "宮城県", capital: "仙台市", region: "東北" },
  { id: "akita", name: "秋田県", capital: "秋田市", region: "東北" },
  { id: "yamagata", name: "山形県", capital: "山形市", region: "東北" },
  { id: "fukushima", name: "福島県", capital: "福島市", region: "東北" },

  { id: "ibaraki", name: "茨城県", capital: "水戸市", region: "関東" },
  { id: "tochigi", name: "栃木県", capital: "宇都宮市", region: "関東" },
  { id: "gunma", name: "群馬県", capital: "前橋市", region: "関東" },
  { id: "saitama", name: "埼玉県", capital: "さいたま市", region: "関東" },
  { id: "chiba", name: "千葉県", capital: "千葉市", region: "関東" },
  { id: "tokyo", name: "東京都", capital: "新宿区", region: "関東" },
  { id: "kanagawa", name: "神奈川県", capital: "横浜市", region: "関東" },

  { id: "niigata", name: "新潟県", capital: "新潟市", region: "中部" },
  { id: "toyama", name: "富山県", capital: "富山市", region: "中部" },
  { id: "ishikawa", name: "石川県", capital: "金沢市", region: "中部" },
  { id: "fukui", name: "福井県", capital: "福井市", region: "中部" },
  { id: "yamanashi", name: "山梨県", capital: "甲府市", region: "中部" },
  { id: "nagano", name: "長野県", capital: "長野市", region: "中部" },
  { id: "gifu", name: "岐阜県", capital: "岐阜市", region: "中部" },
  { id: "shizuoka", name: "静岡県", capital: "静岡市", region: "中部" },
  { id: "aichi", name: "愛知県", capital: "名古屋市", region: "中部" },

  { id: "mie", name: "三重県", capital: "津市", region: "近畿" },
  { id: "shiga", name: "滋賀県", capital: "大津市", region: "近畿" },
  { id: "kyoto", name: "京都府", capital: "京都市", region: "近畿" },
  { id: "osaka", name: "大阪府", capital: "大阪市", region: "近畿" },
  { id: "hyogo", name: "兵庫県", capital: "神戸市", region: "近畿" },
  { id: "nara", name: "奈良県", capital: "奈良市", region: "近畿" },
  { id: "wakayama", name: "和歌山県", capital: "和歌山市", region: "近畿" },

  { id: "tottori", name: "鳥取県", capital: "鳥取市", region: "中国" },
  { id: "shimane", name: "島根県", capital: "松江市", region: "中国" },
  { id: "okayama", name: "岡山県", capital: "岡山市", region: "中国" },
  { id: "hiroshima", name: "広島県", capital: "広島市", region: "中国" },
  { id: "yamaguchi", name: "山口県", capital: "山口市", region: "中国" },

  { id: "tokushima", name: "徳島県", capital: "徳島市", region: "四国" },
  { id: "kagawa", name: "香川県", capital: "高松市", region: "四国" },
  { id: "ehime", name: "愛媛県", capital: "松山市", region: "四国" },
  { id: "kochi", name: "高知県", capital: "高知市", region: "四国" },

  { id: "fukuoka", name: "福岡県", capital: "福岡市", region: "九州・沖縄" },
  { id: "saga", name: "佐賀県", capital: "佐賀市", region: "九州・沖縄" },
  { id: "nagasaki", name: "長崎県", capital: "長崎市", region: "九州・沖縄" },
  { id: "kumamoto", name: "熊本県", capital: "熊本市", region: "九州・沖縄" },
  { id: "oita", name: "大分県", capital: "大分市", region: "九州・沖縄" },
  { id: "miyazaki", name: "宮崎県", capital: "宮崎市", region: "九州・沖縄" },
  { id: "kagoshima", name: "鹿児島県", capital: "鹿児島市", region: "九州・沖縄" },
  { id: "okinawa", name: "沖縄県", capital: "那覇市", region: "九州・沖縄" },
];

const JAPAN_REGIONS = [
  "北海道", "東北", "関東", "中部", "近畿", "中国", "四国", "九州・沖縄",
];
