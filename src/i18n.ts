export type Lang = "en" | "zh" | "ja";
export const LANGS: readonly Lang[] = ["en", "zh", "ja"];

type Entry = Record<Lang, string>;

const STRINGS = {
  gameName: { en: "Clickton", zh: "咔哒镇", ja: "カチッとタウン" },
  tagline: {
    en: "A town that never stops clicking together",
    zh: "一座永远在咔哒声中生长的小镇",
    ja: "カチッとつながり続ける、終わらない町",
  },
  langName: { en: "EN", zh: "中文", ja: "日本語" },
  score: { en: "Score", zh: "分数", ja: "スコア" },
  tiles: { en: "Tiles", zh: "地块", ja: "タイル" },
  holes: { en: "Gaps", zh: "空洞", ja: "すきま" },
  nextTile: { en: "Your tile", zh: "当前地块", ja: "いまのタイル" },
  rotateLeft: { en: "Rotate left", zh: "向左转", ja: "左に回す" },
  rotateRight: { en: "Rotate right", zh: "向右转", ja: "右に回す" },
  newTown: { en: "New town", zh: "新城镇", ja: "新しい町" },
  confirmNewTown: {
    en: "Start a new town? Your current town will be replaced.",
    zh: "要开始新城镇吗？当前城镇会被替换。",
    ja: "新しい町を始めますか？いまの町は置き換えられます。",
  },
  loading: { en: "Unpacking the bricks…", zh: "正在倒出积木…", ja: "ブロックを広げています…" },
  share: { en: "Share", zh: "分享", ja: "共有" },
  shareText: { en: "My brick town scored %d in Clickton!", zh: "我的咔哒镇拿到了 %d 分！", ja: "カチッとタウンで %d 点の町ができた！" },
  linkCopied: { en: "Link copied — send it to a friend", zh: "链接已复制，发给朋友看看吧", ja: "リンクをコピーしました。友だちに送ってみよう" },
  copyThisLink: { en: "Copy this link", zh: "复制这个链接", ja: "このリンクをコピー" },
  badLink: { en: "That town link couldn't be opened", zh: "这个城镇链接打不开", ja: "この町のリンクは開けませんでした" },
  viewing: { en: "You're visiting a friend's town", zh: "你正在参观朋友的小镇", ja: "友だちの町を見学中" },
  replay: { en: "Replay", zh: "回放", ja: "リプレイ" },
  skip: { en: "Skip", zh: "跳过", ja: "スキップ" },
  buildOwn: { en: "Build my own", zh: "建我自己的", ja: "自分の町を作る" },
  helpViewTouch: { en: "Drag to pan · Pinch to zoom and turn", zh: "拖动平移 · 双指缩放和旋转", ja: "ドラッグで移動 · ピンチでズームと回転" },
  helpView: { en: "Drag to pan · Scroll to zoom · Right-drag to turn", zh: "拖动平移 · 滚轮缩放 · 右键拖动旋转视角", ja: "ドラッグで移動 · ホイールでズーム · 右ドラッグで回転" },
  place: { en: "Place", zh: "放置", ja: "置く" },
  trainArrived: { en: "All aboard!", zh: "火车来啦！", ja: "列車が来た！" },
  roadOpened: { en: "Road open!", zh: "道路通车！", ja: "道路が開通！" },
  loopDone: { en: "🚂 Loop complete +%d", zh: "🚂 环线完成 +%d", ja: "🚂 環状線完成 +%d" },
  lineDone: { en: "🚂 Line complete +%d", zh: "🚂 线路完成 +%d", ja: "🚂 路線完成 +%d" },
  cancel: { en: "Cancel", zh: "取消", ja: "やめる" },
  help: {
    en: "Click a spot or drag your tile onto the map · Click the tile or R to rotate · Enter to place, Esc to cancel",
    zh: "点击空位或把地块拖到地图上 · 点地块或按 R 旋转 · Enter 放置，Esc 取消",
    ja: "空きマスをクリックかタイルをドラッグ · タイルをクリックか R で回転 · Enter で置く、Esc でやめる",
  },
  helpTouch: {
    en: "Tap a spot or drag your tile onto the map · Tap the tile to rotate · Drag it to move",
    zh: "点空位或把地块拖到地图上 · 点地块旋转 · 拖动地块换位置",
    ja: "空きマスをタップかタイルをドラッグ · タップで回転 · ドラッグで移動",
  },
  perfect: { en: "Perfect!", zh: "完美！", ja: "パーフェクト！" },
  holeMade: { en: "Gap %d", zh: "空洞 %d", ja: "すきま %d" },
  holeFilled: { en: "Gap filled +%d", zh: "填补空洞 +%d", ja: "すきま解消 +%d" },
  tile_grass: { en: "Meadow", zh: "草地", ja: "草原" },
  tile_road_straight: { en: "Straight road", zh: "直路", ja: "まっすぐな道" },
  tile_road_curve: { en: "Road bend", zh: "弯路", ja: "曲がり道" },
  tile_road_t: { en: "T-junction", zh: "丁字路口", ja: "T字路" },
  tile_road_cross: { en: "Crossroads", zh: "十字路口", ja: "十字路" },
  tile_rail_straight: { en: "Straight track", zh: "直轨", ja: "まっすぐな線路" },
  tile_rail_curve: { en: "Track bend", zh: "弯轨", ja: "カーブ線路" },
  tile_station: { en: "Station", zh: "车站", ja: "駅" },
  tile_station_road: { en: "Station with road", zh: "临街车站", ja: "道のある駅" },
  tile_station_through: { en: "Through station", zh: "中途站", ja: "途中駅" },
  tile_city_edge: { en: "Town edge", zh: "城市边缘", ja: "町のはし" },
  tile_city_corner: { en: "Town corner", zh: "城市转角", ja: "町のかど" },
  tile_city_full: { en: "Town centre", zh: "市中心", ja: "町の中心" },
  tile_city_road: { en: "Town gate", zh: "城门大道", ja: "町の入口" },
  tile_house_road: { en: "Cottage", zh: "小房子", ja: "小さな家" },
  tile_river_straight: { en: "River", zh: "河流", ja: "川" },
  tile_river_curve: { en: "River bend", zh: "河湾", ja: "川の曲がり" },
  tile_lake: { en: "Pond", zh: "池塘", ja: "池" },
  tile_level_crossing: { en: "Level crossing", zh: "平交道口", ja: "踏切" },
  tile_road_bridge: { en: "Road bridge", zh: "公路桥", ja: "道路橋" },
  tile_rail_bridge: { en: "Rail bridge", zh: "铁路桥", ja: "鉄橋" },
} satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;

const STORAGE_KEY = "clickton.lang";
const HTML_LANG: Record<Lang, string> = { en: "en", zh: "zh-CN", ja: "ja" };

let current: Lang = detect();

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (LANGS as string[]).includes(saved)) return saved as Lang;
  } catch {}
  const nav = typeof navigator === "undefined" ? "en" : navigator.language.toLowerCase();
  if (nav.startsWith("zh")) return "zh";
  if (nav.startsWith("ja")) return "ja";
  return "en";
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
  if (typeof document !== "undefined") document.documentElement.lang = HTML_LANG[lang];
}

export function t(key: StringKey, ...args: (string | number)[]): string {
  let s = STRINGS[key][current];
  for (const a of args) s = s.replace("%d", String(a));
  return s;
}

export function hasKey(key: string): key is StringKey {
  return key in STRINGS;
}

export const ALL_STRINGS: Readonly<Record<string, Entry>> = STRINGS;
