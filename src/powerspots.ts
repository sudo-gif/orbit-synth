// 占いの結果(太陽星座・日主の五行・ライフパスナンバー)に応じて、
// その人に響きそうなパワースポットを提案する。

export type PowerSpot = {
  name: string;
  place: string;
  description: string;
  elements: string[]; // 四柱推命: 木火土金水
  signs: number[]; // 西洋占星術: 0=牡羊座...11=魚座
  numbers: number[]; // 数秘術: ライフパスナンバー
};

const SPOTS: PowerSpot[] = [
  { name: "伊勢神宮", place: "三重県", description: "太陽の力が宿る、始まりと再生の地。迷ったときに立ち返る場所。", elements: ["火"], signs: [0, 4], numbers: [1, 9] },
  { name: "出雲大社", place: "島根県", description: "目に見えない縁を結ぶ、静かな力の地。人と人との絆を整える。", elements: ["水"], signs: [6, 11], numbers: [2, 6] },
  { name: "高野山", place: "和歌山県", description: "深い森に抱かれた、内省と浄化の山。心を鎮めたいときに。", elements: ["土"], signs: [5, 9], numbers: [4, 7] },
  { name: "屋久島", place: "鹿児島県", description: "太古から生き続ける森。生命そのものの力強さに触れられる場所。", elements: ["木"], signs: [1, 3], numbers: [6, 9] },
  { name: "富士山", place: "山梨県・静岡県", description: "揺るがない軸を持つ山。意志を固めたいときに力を貸してくれる。", elements: ["土", "火"], signs: [4, 9], numbers: [1, 8] },
  { name: "隠岐諸島", place: "島根県", description: "海に浮かぶ孤独の島々。余計なものを手放し、自分に還る場所。", elements: ["水"], signs: [7, 11], numbers: [7, 11] },
  { name: "恐山", place: "青森県", description: "死者と対話する霊場。見えないものと向き合う力をくれる。", elements: ["水"], signs: [7], numbers: [7, 9] },
  { name: "高千穂峡", place: "宮崎県", description: "神話が生まれた渓谷。物語を始める勇気を後押ししてくれる。", elements: ["火"], signs: [8], numbers: [3, 5] },
  { name: "白川郷", place: "岐阜県", description: "人と自然が静かに調和する里。暮らしのリズムを取り戻す場所。", elements: ["土"], signs: [1], numbers: [4, 6] },
  { name: "竹田城跡", place: "兵庫県", description: "雲海に浮かぶ、天空の城跡。物事を少し高いところから見つめ直せる。", elements: ["金"], signs: [10], numbers: [5, 11] },
  { name: "知床", place: "北海道", description: "手つかずの自然が残る、再生の最果て。すべてを一度リセットしたいときに。", elements: ["水", "木"], signs: [11], numbers: [9, 22] },
  { name: "熊野古道", place: "和歌山県", description: "歩くことで心身が整っていく、祈りの道。一歩ずつ進む力をくれる。", elements: ["土"], signs: [5], numbers: [4, 7] },
  { name: "立山黒部", place: "富山県", description: "天と地のあいだにそびえる峰。視野を大きく広げたいときに。", elements: ["金"], signs: [9, 10], numbers: [8, 22] },
  { name: "宮島・厳島神社", place: "広島県", description: "海に浮かぶ鳥居。相反するものが調和する美しさを思い出させてくれる。", elements: ["水"], signs: [6], numbers: [2, 6] },
  { name: "白神山地", place: "青森県・秋田県", description: "手つかずのブナ林。根源的な静けさに立ち返る場所。", elements: ["木"], signs: [3], numbers: [6, 9] },
  { name: "セドナ", place: "アメリカ・アリゾナ州", description: "赤い大地が渦を巻く、情熱の地。眠っていた力を呼び覚ます。", elements: ["火"], signs: [0], numbers: [1, 8] },
  { name: "ストーンヘンジ", place: "イギリス", description: "太古の暦が刻まれた環状列石。巡る時間の中に身を置く場所。", elements: ["土"], signs: [9], numbers: [4, 22] },
  { name: "マチュピチュ", place: "ペルー", description: "雲の上に築かれた都。地上を離れ、天に近づく感覚をくれる。", elements: ["火"], signs: [8], numbers: [3, 33] },
];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SpotTag = { element?: string; sign?: number; number?: number };

export function pickPowerSpot(tag: SpotTag, seedStr: string): PowerSpot {
  const matched = SPOTS.filter(
    (s) =>
      (tag.element !== undefined && s.elements.includes(tag.element)) ||
      (tag.sign !== undefined && s.signs.includes(tag.sign)) ||
      (tag.number !== undefined && s.numbers.includes(tag.number))
  );
  const pool = matched.length > 0 ? matched : SPOTS;
  const rand = mulberry32(hashString(`${seedStr}#spot`));
  return pool[Math.floor(rand() * pool.length)];
}
