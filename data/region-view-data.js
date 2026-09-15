// 地方・地域ごとに「地図のどの範囲を拡大して見せるか」をまとめたデータです。
// 実際のSVG地図の座標（都道府県・国の形）から自動計算した範囲に、
// 隣が少し見えるように余白（パディング）を足してあります。
//
// viewBox は [x, y, 幅, 高さ] の形です。
// 「この地方をもう少し広く見せたい／せまくしたい」ときは、
// この数字を直接調整してください（他のコードを触る必要はありません）。
//
// 日本地図の元のviewBoxは "0 0 438 516"
// 世界地図の元のviewBoxは "0 0 1010 666"
//
// もし新しい地方・地域をここに追加する場合、viewBoxの数字は
// 手作業で計算する必要があります（下のやり方が一番かんたんです）。
// 1. ブラウザの開発者ツールのコンソールで、次のようなコードを実行する
//    （その地方に入る都道府県・国の id を配列で並べてください）
//      const ids = ["pref1", "pref2", ...];
//      let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
//      ids.forEach(id => {
//        const b = document.querySelector('[id="'+id+'"]').getBBox();
//        minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
//        maxX = Math.max(maxX, b.x+b.width); maxY = Math.max(maxY, b.y+b.height);
//      });
//      const pad = 0.25; // 余白の割合（大きくすると周りが広く見える）
//      const w = maxX-minX, h = maxY-minY;
//      [minX-w*pad, minY-h*pad, w+w*pad*2, h+h*pad*2]
// 2. 出てきた4つの数字をそのままこのファイルに追加する
// 3. 追加を忘れても、そのままだと自動的に「全国／全世界」表示になるだけなので、
//    アプリが壊れることはありません。

const JAPAN_REGION_VIEW = {
  "全国": [0, 0, 438, 516],
  "北海道": [282.71, -24.29, 182.09, 160.79],
  "東北": [293.35, 81.56, 82.32, 173.4],
  "関東": [280.1, 198.03, 70.08, 141.84],
  "中部": [213.4, 163.67, 126.26, 139.67],
  "近畿": [197.53, 241.12, 75.89, 80.15],
  "中国": [124.71, 190.09, 105.72, 129.36],
  "四国": [153.06, 277.51, 77.63, 56.97],
  "九州・沖縄": [-36.19, 226.83, 239, 340.88],
};

const WORLD_REGION_VIEW = {
  "全世界": [0, 0, 1010, 666],
  "東アジア": [630.8, 253.59, 304.05, 189.18],
  "東南アジア": [709.98, 371.54, 192.68, 146.38],
  "南アジア": [620.04, 328.39, 153.66, 138.81],
  "西アジア": [520.53, 312.31, 158.44, 125.21],
  // ヨーロッパはロシアの東側（シベリア）まで含めると範囲が広がりすぎるため、
  // ヨーロッパらしく見える範囲を優先し、ロシアは西側だけ画面に入る形にしています。
  "ヨーロッパ": [398.22, 213.55, 154.27, 202.9],
  "北アメリカ": [-81.34, -90.51, 490.15, 614.92],
  "南アメリカ": [213.97, 373.03, 195.9, 329.72],
  "アフリカ": [503.21, 309.24, 107.08, 363.06],
  "オセアニア": [741.98, 452.26, 298.76, 232.99],
};

// ---------- 複数の地方・地域を同時に選んだときの地図表示 ----------
// 選んだ地方・地域がすべて収まる最小の四角形を計算し、それが全体表示の
// 何割くらいの面積になるかで「まとめて拡大」するか「全体表示にする」かを決めます。
// （地方同士が近ければ小さくまとまり拡大表示に、離れていれば四角形が
// 　全体表示に近いくらい大きくなるので、自然に全体表示へ切り替わります）
const REGION_UNION_MAX_AREA_RATIO = 0.6;

function unionRegionViewBox(table, fullKey, regionNames) {
  const full = table[fullKey];
  const names = (regionNames || []).filter((r) => table[r]);
  if (names.length === 0) return full;
  if (names.length === 1) return table[names[0]];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  names.forEach((r) => {
    const [x, y, w, h] = table[r];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });
  const union = [minX, minY, maxX - minX, maxY - minY];

  const unionArea = union[2] * union[3];
  const fullArea = full[2] * full[3];
  if (unionArea / fullArea > REGION_UNION_MAX_AREA_RATIO) return full;
  return union;
}
