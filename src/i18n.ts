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
  nextTile: { en: "Your tile", zh: "当前地块", ja: "いまのタイル" },
  newGame: { en: "New game", zh: "新游戏", ja: "新しいゲーム" },
  menu: { en: "Menu", zh: "菜单", ja: "メニュー" },
  townOption: { en: "New town", zh: "新城镇", ja: "新しい町" },
  townOptionHint: { en: "Pick a mode and build forever", zh: "选一个模式，无限建造", ja: "モードを選んで、どこまでも" },
  themeRandom: { en: "Surprise me", zh: "随机", ja: "おまかせ" },
  themeRandom_desc: { en: "Let the bricks decide", zh: "交给积木决定", ja: "ブロックにおまかせ" },
  dailyOption: { en: "Daily challenge", zh: "每日挑战", ja: "デイリーチャレンジ" },
  dailyOptionHint: { en: "Same %d tiles for everyone today", zh: "今天所有人同样的 %d 块地块", ja: "今日はみんな同じ %d 枚" },
  confirmNewTown: {
    en: "Start a new town? Your current town will be replaced.",
    zh: "要开始新城镇吗？当前城镇会被替换。",
    ja: "新しい町を始めますか？いまの町は置き換えられます。",
  },
  loading: { en: "Unpacking the bricks…", zh: "正在倒出积木…", ja: "ブロックを広げています…" },
  share: { en: "Share", zh: "分享", ja: "共有" },
  backToTown: { en: "My town", zh: "回到我的城镇", ja: "自分の町へ" },
  tilesLeft: { en: "%d tiles left", zh: "剩 %d 块", ja: "残り %d 枚" },
  dailyDone: { en: "Daily challenge complete!", zh: "今日挑战完成！", ja: "デイリー達成！" },
  bestToday: { en: "Today's best: %d", zh: "今日最佳：%d", ja: "今日のベスト：%d" },
  playAgain: { en: "Try again", zh: "再挑战一次", ja: "もう一度" },
  dailyAgainTitle: { en: "Today's challenge is done", zh: "今日挑战已完成", ja: "今日のデイリーは達成済み" },
  dailyAgainBody: {
    en: "The daily tiles come in a fixed order, so another run draws exactly the same tiles. Today's best: %d",
    zh: "每日挑战的地块顺序是固定的，再来一局会抽到完全一样的地块。今日最佳：%d",
    ja: "デイリーのタイルの順番は固定なので、もう一度遊ぶとまったく同じタイルが出ます。今日のベスト：%d",
  },
  dailyAgainNewTown: { en: "New town instead", zh: "开新城镇", ja: "新しい町を始める" },
  shareResult: { en: "Share result", zh: "分享成绩", ja: "結果を共有" },
  photoDaily: { en: "%s daily challenge", zh: "%s 每日挑战", ja: "%s のデイリー" },
  viewingDaily: { en: "Daily challenge · %s", zh: "每日挑战 · %s", ja: "デイリー · %s" },
  tryDaily: { en: "Play today's", zh: "挑战今天", ja: "今日に挑戦" },
  resultStats: { en: "%d loops · %d lines · %d roads finished", zh: "环线 %d · 铁路 %d · 修好的道路 %d", ja: "環状線 %d · 路線 %d · 完成した道路 %d" },
  helpBtn: { en: "How to play", zh: "玩法说明", ja: "遊び方" },
  tut1: { en: "This is your tile. Drag it onto the map, or tap an empty spot next to your town.", zh: "这是你的地块。把它拖到地图上，或者点一下城镇旁边的空位。", ja: "これがあなたのタイル。マップにドラッグするか、町の隣の空きマスをタップしよう。" },
  tut2: { en: "Tap the tile to turn it — on the map too, wherever you see ↻. Matching edges score points; a green glow means they match.", zh: "点地块就能旋转，放到地图上后看到 ↻ 也可以点它来转。边对上就得分，亮起绿光表示对上了。", ja: "タイルをタップで回転。マップ上で ↻ が出ているときもタップで回せます。辺がそろうと得点、緑に光ればそろった印。" },
  tut3: { en: "Happy with it? Press ✓ to place it, or ✕ to put it back.", zh: "满意了就点 ✓ 放下，不想放就点 ✕。", ja: "決まったら ✓ で置こう。やめるなら ✕。" },
  tut4: { en: "Finished railways get trains, closed roads get cars, meadows fill with animals. There's no ending — build at your own pace!", zh: "修好的铁路会有火车，封闭的道路会有汽车，草地会有小动物。没有终点，慢慢建造吧！", ja: "完成した線路には列車、閉じた道路には車、草原には動物。終わりはないので、のんびり作ろう！" },
  tutNext: { en: "Next", zh: "下一步", ja: "次へ" },
  tutSkip: { en: "Skip", zh: "跳过", ja: "スキップ" },
  tutDone: { en: "Start building", zh: "开始建造", ja: "はじめる" },
  timeAuto: { en: "Time: day & night", zh: "时间：昼夜交替", ja: "時間：昼夜サイクル" },
  timeDay: { en: "Time: always day", zh: "时间：固定白天", ja: "時間：ずっと昼" },
  timeNight: { en: "Time: always night", zh: "时间：固定夜晚", ja: "時間：ずっと夜" },
  feedback: { en: "Feedback", zh: "反馈", ja: "フィードバック" },
  feedbackIntro: { en: "Ideas, bugs, anything — it goes straight to the maker.", zh: "想法、bug、随便聊聊——会直接发给作者。", ja: "アイデアやバグなど、なんでも作者に直接届きます。" },
  feedbackPlaceholder: { en: "What would you like to tell us?", zh: "想说点什么？", ja: "どんなことでもどうぞ" },
  feedbackEmail: { en: "Your email (optional, for a reply)", zh: "你的邮箱（选填，方便回复）", ja: "メールアドレス（任意・返信用）" },
  feedbackSend: { en: "Send", zh: "发送", ja: "送信" },
  feedbackSending: { en: "Sending…", zh: "发送中…", ja: "送信中…" },
  feedbackThanks: { en: "Thank you! Message sent.", zh: "谢谢！已经收到了。", ja: "ありがとう！送信しました。" },
  feedbackFailed: { en: "Couldn't send it right now.", zh: "暂时没发出去。", ja: "いまは送信できませんでした。" },
  feedbackByMail: { en: "Send by email instead", zh: "改用邮件发送", ja: "メールで送る" },
  feedbackEmpty: { en: "Write a few words first.", zh: "先写点内容吧。", ja: "まずは内容を書いてください。" },
  feedbackWait: { en: "Just sent one — try again in a minute.", zh: "刚刚发过一条，过一分钟再试吧。", ja: "送ったばかりです。1分後にどうぞ。" },
  musicOn: { en: "Music: on", zh: "音乐：开", ja: "音楽：オン" },
  musicOff: { en: "Music: off", zh: "音乐：关", ja: "音楽：オフ" },
  photoMode: { en: "Photo mode", zh: "拍照模式", ja: "撮影モード" },
  savePhoto: { en: "Save photo", zh: "保存照片", ja: "写真を保存" },
  exitPhoto: { en: "Done", zh: "退出", ja: "終了" },
  photoSaved: { en: "Photo saved", zh: "照片已保存", ja: "写真を保存しました" },
  photoStats: { en: "%d points · %d tiles", zh: "%d 分 · %d 块", ja: "%d 点 · %d タイル" },
  linkCopied: { en: "Link copied — send it to a friend", zh: "链接已复制，发给朋友看看吧", ja: "リンクをコピーしました。友だちに送ってみよう" },
  copyThisLink: { en: "Copy this link", zh: "复制这个链接", ja: "このリンクをコピー" },
  badLink: { en: "That town link couldn't be opened", zh: "这个城镇链接打不开", ja: "この町のリンクは開けませんでした" },
  viewing: { en: "You're visiting a friend's town", zh: "你正在参观朋友的小镇", ja: "友だちの町を見学中" },
  replay: { en: "Replay", zh: "回放", ja: "リプレイ" },
  skip: { en: "Skip", zh: "跳过", ja: "スキップ" },
  buildOwn: { en: "Build my own", zh: "建我自己的", ja: "自分の町を作る" },
  place: { en: "Place", zh: "放置", ja: "置く" },
  trainArrived: { en: "All aboard!", zh: "火车来啦！", ja: "列車が来た！" },
  roadOpened: { en: "Road open!", zh: "道路通车！", ja: "道路が開通！" },
  loopDone: { en: "🚂 Loop complete +%d", zh: "🚂 环线完成 +%d", ja: "🚂 環状線完成 +%d" },
  lineDone: { en: "🚂 Line complete +%d", zh: "🚂 线路完成 +%d", ja: "🚂 路線完成 +%d" },
  cancel: { en: "Cancel", zh: "取消", ja: "やめる" },
  perfect: { en: "Perfect!", zh: "完美！", ja: "パーフェクト！" },
  tile_grass: { en: "Meadow", zh: "草地", ja: "草原" },
  tile_road_straight: { en: "Straight road", zh: "直路", ja: "まっすぐな道" },
  tile_road_curve: { en: "Road bend", zh: "弯路", ja: "曲がり道" },
  tile_road_t: { en: "T-junction", zh: "丁字路口", ja: "T字路" },
  tile_road_cross: { en: "Crossroads", zh: "十字路口", ja: "十字路" },
  tile_rail_straight: { en: "Straight track", zh: "直轨", ja: "まっすぐな線路" },
  tile_rail_curve: { en: "Track bend", zh: "弯轨", ja: "カーブ線路" },
  tile_station: { en: "Station", zh: "车站", ja: "駅" },
  tile_station_plaza: { en: "Town station", zh: "小镇车站", ja: "町の駅" },
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
  tile_road_end: { en: "Dead end", zh: "尽头路", ja: "行き止まり" },
  next: { en: "Next", zh: "下一块", ja: "次" },
  discard: { en: "Skip", zh: "放弃", ja: "パス" },
  discardHint: { en: "Skip this tile (X)", zh: "放弃这一块（X 键）", ja: "このタイルをパス（X キー）" },
  discardProgress: { en: "Skip in %d", zh: "再放 %d 块可放弃", ja: "あと %d 枚でパス" },
  tile_zoo: { en: "Zoo", zh: "动物园", ja: "動物園" },
  tile_farm: { en: "Farm", zh: "牧场", ja: "牧場" },
  tile_police: { en: "Police station", zh: "警察局", ja: "警察署" },
  tile_beach: { en: "Lakeside beach", zh: "湖边沙滩", ja: "湖畔のビーチ" },
  hint_zoo: { en: "Opens when its road joins a finished road", zh: "接上修好的道路后开张", ja: "完成した道路につながると開園" },
  hint_farm: { en: "Needs 2+ meadows next to it", zh: "挨着 2 块以上草地才热闹", ja: "隣に草原が 2 つ以上必要" },
  hint_police: { en: "Patrols once its road is finished", zh: "道路修好后开始巡逻", ja: "道路が完成するとパトロール開始" },
  hint_beach: { en: "Needs a lake or river next to it", zh: "要挨着湖泊或河流", ja: "湖か川の隣に置こう" },
  open_zoo: { en: "🦁 The zoo is open!", zh: "🦁 动物园开张了！", ja: "🦁 動物園がオープン！" },
  open_farm: { en: "🐄 The farm comes alive!", zh: "🐄 牧场热闹起来了！", ja: "🐄 牧場がにぎやかに！" },
  open_police: { en: "🚓 Police on patrol!", zh: "🚓 警察开始巡逻！", ja: "🚓 パトロール開始！" },
  open_beach: { en: "🏖️ Beach day!", zh: "🏖️ 沙滩开放了！", ja: "🏖️ ビーチがオープン！" },
  tile_pool: { en: "Lake", zh: "湖泊", ja: "湖" },
  theme_classic: { en: "Classic", zh: "经典", ja: "クラシック" },
  theme_classic_desc: { en: "A bit of everything", zh: "什么都有一点", ja: "なんでも少しずつ" },
  theme_metropolis: { en: "Metropolis", zh: "繁华都市", ja: "大都会" },
  theme_metropolis_desc: { en: "Towers everywhere", zh: "高楼林立", ja: "ビルが立ち並ぶ" },
  theme_railway: { en: "Railway country", zh: "铁路之乡", ja: "鉄道の里" },
  theme_railway_desc: { en: "Tracks criss-cross the land — loops come easy", zh: "铁轨纵横，环线更好修", ja: "線路だらけ。環状線を作りやすい" },
  theme_waterside: { en: "Waterside", zh: "湖光水乡", ja: "水の郷" },
  theme_waterside_desc: { en: "Rivers and lakes all around", zh: "河流湖泊遍布", ja: "川と湖がいっぱい" },
  theme_countryside: { en: "Countryside", zh: "田园牧歌", ja: "のどかな田園" },
  theme_countryside_desc: { en: "Meadows and lots of animals", zh: "草地多，小动物多", ja: "草原と動物がいっぱい" },
  theme_crossroads: { en: "Crossroads", zh: "交通枢纽", ja: "交通の要所" },
  theme_crossroads_desc: { en: "Junctions everywhere, busy streets", zh: "路口密集，车来车往", ja: "交差点だらけで車がいっぱい" },
  theme_village: { en: "Quiet village", zh: "宁静小镇", ja: "静かな村" },
  theme_village_desc: { en: "Cottages and low houses", zh: "低矮民居为主", ja: "小さな家が中心" },
  themeIntro: { en: "This world: %s", zh: "本局主题：%s", ja: "今回の世界：%s" },
  tile_level_crossing: { en: "Level crossing", zh: "平交道口", ja: "踏切" },
  tile_road_bridge: { en: "Road bridge", zh: "公路桥", ja: "道路橋" },
  tile_rail_bridge: { en: "Rail bridge", zh: "铁路桥", ja: "鉄橋" },
  tile_lm_market: { en: "Market", zh: "市集", ja: "マーケット" },
  tile_lm_xmas: { en: "Christmas square", zh: "圣诞广场", ja: "クリスマス広場" },
  tile_lm_garden: { en: "Flower garden", zh: "花园", ja: "花の庭園" },
  tile_lm_church: { en: "Bell tower", zh: "教堂钟楼", ja: "鐘楼の教会" },
  tile_lm_lighthouse: { en: "Lighthouse", zh: "灯塔", ja: "灯台" },
  tile_lm_watermill: { en: "Watermill", zh: "水车磨坊", ja: "水車小屋" },
  tile_lm_stage: { en: "Open-air stage", zh: "露天舞台", ja: "野外ステージ" },
  tile_lm_windmill: { en: "Windmill", zh: "风车", ja: "風車" },
  tile_lm_castle: { en: "Castle", zh: "城堡", ja: "お城" },
  tile_lm_sports: { en: "Sports field", zh: "运动场", ja: "運動場" },
  tile_lm_lumber: { en: "Lumber mill", zh: "伐木场", ja: "製材所" },
  tile_lm_gingerbread: { en: "Gingerbread house", zh: "姜饼屋", ja: "ジンジャーブレッドハウス" },
  tile_lm_tavern: { en: "Tavern", zh: "酒馆", ja: "酒場" },
  bonus_market: { en: "+1 per nearby house or town tile", zh: "周围每块房屋或城市 +1", ja: "周りの家・町 1 枚ごとに +1" },
  bonus_xmas: { en: "+3 per finished railway", zh: "每条完成的铁路 +3", ja: "完成した路線 1 本ごとに +3" },
  bonus_garden: { en: "+2 per nearby park, +1 per meadow", zh: "周围每块公园 +2、草地 +1", ja: "周りの公園 +2・草原 +1" },
  bonus_church: { en: "+1 per tile of its town", zh: "所在城区每格 +1", ja: "つながる町 1 マスごとに +1" },
  bonus_lighthouse: { en: "+1 per tile of its water", zh: "相连水域每格 +1", ja: "つながる水辺 1 マスごとに +1" },
  bonus_watermill: { en: "+3 per linked bridge on its river", zh: "所在河流每座接通的桥 +3", ja: "同じ川のつながった橋ごとに +3" },
  bonus_stage: { en: "+3 per working special within 2 tiles", zh: "两格内每个运转中的特殊建筑 +3", ja: "2 マス以内の稼働中の施設ごとに +3" },
  bonus_windmill: { en: "+1 per nearby meadow", zh: "周围每块草地 +1", ja: "周りの草原 1 枚ごとに +1" },
  bonus_castle: { en: "+1 per tile of its town", zh: "所在城区每格 +1", ja: "つながる町 1 マスごとに +1" },
  bonus_sports: { en: "+1 per 5 tiles of its road", zh: "所在道路每 5 格 +1", ja: "つながる道路 5 マスごとに +1" },
  bonus_lumber: { en: "+1 per nearby meadow, +1 more per forest", zh: "周围每块草地 +1，森林再 +1", ja: "周りの草原 +1・森はさらに +1" },
  bonus_gingerbread: { en: "+2 per nearby tile with no mismatch", zh: "周围每块没有错配的地块 +2", ja: "周りのズレのないタイルごとに +2" },
  bonus_tavern: { en: "+1 per home on its road", zh: "所在道路上每户人家 +1", ja: "つながる道路の家ごとに +1" },
  quest_road_closed: { en: "Close off a road network of %d tiles", zh: "修好一个 %d 格的封闭道路网", ja: "%d マスの道路網を閉じよう" },
  quest_rail_done: { en: "Finish a railway of %d tiles", zh: "完成一条 %d 格的铁路", ja: "%d マスの路線を完成させよう" },
  quest_park: { en: "Build %d park(s) ringed by town", zh: "建 %d 个被城市围绕的公园", ja: "町に囲まれた公園を %d つ" },
  quest_city_closed: { en: "Wall in a town of %d tiles", zh: "封闭一片 %d 格的城区", ja: "%d マスの町を囲もう" },
  quest_river_lake: { en: "Run %d river tiles into a pond", zh: "让 %d 段河流汇入池塘", ja: "池に川を %d マスつなごう" },
  quest_bridge: { en: "Link up %d bridge(s) on both ends", zh: "架起 %d 座两头接通的桥", ja: "両端のつながった橋を %d 本" },
  quest_special_on: { en: "Get %d special building(s) working", zh: "让 %d 个特殊建筑运转", ja: "特別な施設を %d つ稼働させよう" },
  quest_meadow_size: { en: "Grow a meadow of %d tiles", zh: "连成 %d 块草地", ja: "草原を %d マスつなげよう" },
  quest_city_size: { en: "Grow a town of %d tiles", zh: "连成 %d 格的城区", ja: "町を %d マスに広げよう" },
  quest_road_size: { en: "Grow a road network of %d tiles", zh: "连成 %d 格的道路网", ja: "道路網を %d マスに広げよう" },
  quest_forest: { en: "Place %d grass tiles", zh: "放置 %d 块纯草地", ja: "草地タイルを %d 枚置こう" },
  quest_clean_streak: { en: "%d placements in a row with no mismatch", zh: "连续 %d 次没有错配", ja: "ズレなしで %d 回連続" },
  quest_big_hand: { en: "Score %d in a single placement", zh: "一手拿到 %d 分", ja: "1 手で %d 点取ろう" },
  quests: { en: "Quests", zh: "任务", ja: "クエスト" },
  questReward: { en: "Reward: %s", zh: "奖励：%s", ja: "報酬：%s" },
  questDone: { en: "Quest complete! %s + 1 skip", zh: "任务完成！获得 %s + 1 次放弃", ja: "クエスト達成！%s + パス 1 回" },
  questDoneNext: { en: "Quest complete! %s comes next + 1 skip", zh: "任务完成！%s 将作为下一块 + 1 次放弃", ja: "クエスト達成！次は %s + パス 1 回" },
  landmarks: { en: "Landmarks", zh: "地标", ja: "ランドマーク" },
  landmarkHint: { en: "Tap a landmark to place it now; your tile waits", zh: "点地标可以现在放下，当前地块会保留", ja: "ランドマークをタップで今置ける。いまのタイルはそのまま" },
  landmarkLabel: { en: "Landmark", zh: "地标", ja: "ランドマーク" },
  questSkip: { en: "1 skip", zh: "1 次放弃", ja: "パス 1 回" },
  questHowTitle: { en: "How to do it", zh: "怎么完成", ja: "達成のしかた" },
  questExample: { en: "For example", zh: "示例", ja: "たとえば" },
  questRewardTitle: { en: "Reward", zh: "奖励", ja: "報酬" },
  gotIt: { en: "Got it", zh: "知道了", ja: "わかった" },
  how_road_closed: {
    en: "Join roads until every end is capped — by a dead end, cottage, town gate or a loop back. The closed network needs at least %d tiles. Only networks finished after the quest appears count.",
    zh: "把道路连起来，让每个路口都有收尾：尽头路、小房子、城门，或者绕回来连成环。封闭后的道路网至少要 %d 格。只算接到任务之后新修好的。",
    ja: "道路をつないで、すべての端を行き止まり・小さな家・町の入口でふさぐか、ぐるっとつなげよう。閉じた道路網が %d マス以上で達成。クエストが出てから完成したものだけ数えます。",
  },
  how_rail_done: {
    en: "Lay track with a station at both ends, or close it into a loop. The finished line needs at least %d tiles.",
    zh: "铺一条两头都是车站的铁路，或者绕成一个环线。完成的线路至少要 %d 格。",
    ja: "両端が駅の路線か、ぐるっと一周する環状線を作ろう。%d マス以上で達成。",
  },
  how_park: {
    en: "A park is an all-grass tile (meadow or lake) with tiles on all four sides, at least three of them town or cottages. Build %d new one(s).",
    zh: "公园是一块四条边都是草的地块（草地或湖泊），四个方向都放了地块，而且其中至少 3 块是城市或房屋。需要新建 %d 个。",
    ja: "公園＝四辺とも草のタイル（草原か湖）。上下左右すべてにタイルがあり、そのうち 3 つ以上が町か家。新しく %d つ作ろう。",
  },
  how_city_closed: {
    en: "Every town edge must meet another town edge, with no gaps, enclosing at least %d tiles.",
    zh: "城市的每条边都要和城市边接上，不留缺口，围成至少 %d 格的城区。",
    ja: "町の辺をすべて町の辺とつなげて、すき間なく %d マス以上を囲もう。",
  },
  how_river_lake: {
    en: "Start from a pond (the tile with a single water edge) and connect at least %d river tiles to it — straight, bend and bridges all count. The round lake with grass on every side cannot join a river.",
    zh: "从池塘（只有一条边是水的地块）出发，沿着水边连起至少 %d 段河流，直河、弯河、桥都算。四面都是草的湖泊接不上河流，不算。",
    ja: "池（水の辺が 1 つだけのタイル）から、川を %d マス以上つなげよう。まっすぐ・曲がり・橋も数えます。四辺が草の丸い湖は川とつながりません。",
  },
  how_bridge: {
    en: "Place a road or rail bridge and connect road or track to both of its ends. Build %d.",
    zh: "放一座公路桥或铁路桥，桥两头的道路或铁轨都要接上。需要 %d 座。",
    ja: "道路橋か鉄橋を置いて、両端に道路か線路をつなげよう。%d 本必要です。",
  },
  how_special_on: {
    en: "Zoo and police: link their road into a closed road network. Farm: put 2+ meadows next to it. Beach: put it next to a pond, lake or river. Get %d new one(s) working.",
    zh: "动物园、警察局：让它的道路接进一个封闭的道路网；农场：旁边挨着 2 块以上草地；沙滩：挨着池塘、湖泊或河流。需要让 %d 个新的运转起来。",
    ja: "動物園・警察署：道路を閉じた道路網につなぐ。牧場：草原を 2 つ以上となりに。ビーチ：池・湖・川のとなりに。新しく %d つ稼働させよう。",
  },
  how_meadow_size: {
    en: "Meadows, lakes and ponds join when grass edge meets grass edge. Grow the largest patch to %d tiles.",
    zh: "草地、湖泊、池塘之间只要草边对着草边就算连在一起。让最大的一片达到 %d 块。",
    ja: "草原・湖・池は、草の辺どうしが向き合うとつながります。いちばん大きなまとまりを %d マスに。",
  },
  how_city_size: {
    en: "Town tiles join through town edges. Grow one connected town to %d tiles — it doesn't need to be closed.",
    zh: "城市地块通过城市边相连。让一片相连的城区达到 %d 格，不需要封闭。",
    ja: "町タイルは町の辺でつながります。ひとつながりの町を %d マスに。閉じなくても OK。",
  },
  how_road_size: {
    en: "Grow one connected road network to %d tiles — it doesn't need to be closed.",
    zh: "让一个相连的道路网达到 %d 格，不需要封闭。",
    ja: "ひとつながりの道路網を %d マスに。閉じなくても OK。",
  },
  how_forest: {
    en: "After the quest appears, place %d plain meadow tiles anywhere.",
    zh: "接到任务后，在任意位置累计放下 %d 块纯草地。",
    ja: "クエストが出てから、草原タイルをどこでもいいので %d 枚置こう。",
  },
  how_clean_streak: {
    en: "Place %d tiles in a row where every touching edge matches. One mismatch resets the count; skipping doesn't.",
    zh: "连续 %d 次放置，所有相邻的边都对上。中间有一次错配就从 0 重新数，放弃不影响。",
    ja: "接する辺がすべてそろう置き方を %d 回連続で。1 回でもズレるとリセット。パスは影響しません。",
  },
  how_big_hand: {
    en: "Score %d points with one placement. Town edges are worth 2, matching all four sides adds a perfect bonus, and finishing a railway adds more.",
    zh: "一次放置拿到 %d 分。城市边每条 2 分，四边全部对上有完美加成，同时完成铁路或环线还会再加分。",
    ja: "1 回の配置で %d 点。町の辺は 1 本 2 点、四辺そろうとパーフェクト加点、路線の完成でさらに加点。",
  },
} satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;

// Shared by gratin-game.com and its subdomains through a parent-domain cookie; localStorage still holds choices made before the cookie existed.
const SHARED_KEY = "gratin:lang";
const LEGACY_KEY = "clickton.lang";
const COOKIE = "gratin_lang";
const COOKIE_DOMAIN = "gratin-game.com";
const FALLBACK: Lang = "ja";
const HTML_LANG: Record<Lang, string> = { en: "en", zh: "zh-CN", ja: "ja" };

const isLang = (v: unknown): v is Lang => typeof v === "string" && (LANGS as readonly string[]).includes(v);

let current: Lang = detect();

function readCookie(): string | null {
  try {
    return document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`))?.[1] ?? null;
  } catch {
    return null;
  }
}

function writeCookie(value: string): void {
  if (typeof document === "undefined") return;
  const host = location.hostname;
  const domain = host === COOKIE_DOMAIN || host.endsWith(`.${COOKIE_DOMAIN}`) ? `; domain=${COOKIE_DOMAIN}` : "";
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${COOKIE}=${value}; path=/; max-age=31536000; samesite=lax${domain}${secure}`;
}

function chosen(): string | null {
  const cookie = readCookie();
  if (cookie) return cookie;
  try {
    return localStorage.getItem(SHARED_KEY) ?? localStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
}

function detect(): Lang {
  const saved = chosen();
  if (saved) return isLang(saved) ? saved : FALLBACK;
  if (typeof navigator === "undefined") return FALLBACK;
  const bases = (navigator.languages?.length ? navigator.languages : [navigator.language]).map((tag) => tag.toLowerCase().split("-")[0]);
  if (bases.includes("ja")) return "ja";
  return bases.find(isLang) ?? FALLBACK;
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  if (typeof document !== "undefined") document.documentElement.lang = HTML_LANG[lang];
}

export function chooseLang(lang: Lang): void {
  writeCookie(lang);
  try {
    localStorage.setItem(SHARED_KEY, lang);
  } catch {}
  setLang(lang);
}

export function watchLang(onChange: (lang: Lang) => void): void {
  const update = () => {
    const next = detect();
    if (next !== current) onChange(next);
  };
  window.addEventListener("storage", (e) => {
    if (e.key === SHARED_KEY || e.key === null) update();
  });
  window.addEventListener("languagechange", () => {
    if (!chosen()) update();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) update();
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) update();
  });
}

export function t(key: StringKey, ...args: (string | number)[]): string {
  let s = STRINGS[key][current];
  for (const a of args) s = s.replace(/%[ds]/, String(a));
  return s;
}

export function hasKey(key: string): key is StringKey {
  return key in STRINGS;
}

export const ALL_STRINGS: Readonly<Record<string, Entry>> = STRINGS;
