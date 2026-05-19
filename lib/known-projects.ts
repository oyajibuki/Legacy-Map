export type ArchType = 'genius-dense' | 'clean-minimal' | 'chaotic' | 'evolved' | 'revolutionary';

export interface ProjectInsight {
  id: string;
  name: string;
  year: number;
  creator: string;
  lang: string;
  tags: string[];
  headline: string;
  insight: string;
  funFact: string;
  archType: ArchType;
  detectPatterns: string[]; // substrings matched against node paths (case-insensitive)
}

export const ARCH_STYLES: Record<ArchType, { color: string; bg: string; border: string; badge: string }> = {
  'genius-dense':   { color: '#f472b6', bg: 'rgba(244,114,182,0.08)', border: 'rgba(244,114,182,0.35)', badge: '💎 天才密結合' },
  'clean-minimal':  { color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.35)',  badge: '✨ 美しい設計' },
  'chaotic':        { color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.35)',  badge: '🌀 カオス伝説' },
  'evolved':        { color: '#818cf8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.35)', badge: '🔄 進化の軌跡' },
  'revolutionary':  { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.35)',  badge: '🚀 設計革命' },
};

export const KNOWN_PROJECTS: ProjectInsight[] = [
  {
    id: 'doom',
    name: 'DOOM',
    year: 1993,
    creator: 'John Carmack / id Software',
    lang: 'C',
    tags: ['FPS', 'ゲームエンジン', 'id Software'],
    headline: '155ファイルで地獄を作った天才',
    insight: 'MS-DOS専用として設計。マルチプラットフォーム対応ゼロ。全コードがゲームのためだけに存在する「制約の美」。doomdef.h という神ハブ1本で全システムが繋がる。',
    funFact: '接続密度 3.4本/ファイル。これは現代の cURL（0.6本）の5倍。制約が美しさを生む。',
    archType: 'genius-dense',
    detectPatterns: ['linuxdoom', 'doomdef', 'p_enemy', 'r_bsp', 'i_video'],
  },
  {
    id: 'wolf3d',
    name: 'Wolfenstein 3D',
    year: 1992,
    creator: 'John Carmack / id Software',
    lang: 'C',
    tags: ['FPS', '元祖', 'id Software'],
    headline: 'DOOMを生んだ26ファイルの原点',
    insight: 'レイキャスティングという「なんちゃって3D」技術で世界を驚かせた。DOOMの前年作。26ファイルという圧倒的シンプルさ。この小さな種がFPSというジャンルを生んだ。',
    funFact: '翌年Carmackはこれを捨てて真の3DエンジンDOOMを作る。天才の自己否定。',
    archType: 'genius-dense',
    detectPatterns: ['wolfsrc', 'wl_game', 'wl_main', 'id_vl', 'id_vh'],
  },
  {
    id: 'chocolate-doom',
    name: 'Chocolate Doom',
    year: 1993,
    creator: 'Simon Howard（現代移植）',
    lang: 'C',
    tags: ['FPS', 'ポート', '現代移植'],
    headline: '天才コードを現代人が3倍のファイルで解読した',
    insight: '元DOOMを忠実に現代OSへ移植。Windows/Mac/Linux対応・Heretic/Hexen同梱。オリジナルの155ファイルが500ファイルに膨らんだのは、平台抽象化という「現代の重力」の証明。',
    funFact: 'コアは同じ。外側の345ファイルは全て「移植のための包み紙」。元DOOMのダイヤモンドが岩に埋まった状態。',
    archType: 'evolved',
    detectPatterns: ['chocolate', 'src/doom', 'src/heretic', 'src/hexen', 'doomtype'],
  },
  {
    id: 'quake',
    name: 'Quake',
    year: 1996,
    creator: 'John Carmack & Michael Abrash / id Software',
    lang: 'C',
    tags: ['FPS', '3Dエンジン', 'id Software'],
    headline: '世界初の真3Dエンジン、DOOMから3年',
    insight: 'BSPツリー・ポータルレンダリング・GL対応。DOOMの密な一枚岩からレンダラー分離が始まった。Carmackが「ソフトウェアレンダリングは死んだ」と宣言した作品。',
    funFact: 'Quakeエンジンのライセンスは後にHalf-Life・CounterStrikeを生む。1つのコードベースが産業を変えた。',
    archType: 'genius-dense',
    detectPatterns: ['quakedef', 'gl_model', 'sv_main', 'cl_main', 'r_local'],
  },
  {
    id: 'quake2',
    name: 'Quake II',
    year: 1997,
    creator: 'John Carmack / id Software',
    lang: 'C',
    tags: ['FPS', '3Dエンジン', 'id Software'],
    headline: 'サーバー/クライアント分離、設計思想の転換点',
    insight: 'Quakeからわずか1年。game.dllとエンジンを分離しModコミュニティを解放。DOOMの一枚岩からの脱却が本格化した。',
    funFact: 'Quake2エンジンは後にStar Trek Voyager EliteForce・Soldier of Fortune等100本以上に使われる。',
    archType: 'evolved',
    detectPatterns: ['quake2', 'q_shared', 'game/g_main', 'client/cl_main', 'server/sv_main'],
  },
  {
    id: 'quake3',
    name: 'Quake III Arena',
    year: 1999,
    creator: 'John Carmack / id Software',
    lang: 'C',
    tags: ['FPS', '3Dエンジン', 'id Software', 'シェーダー'],
    headline: '6年でDOOMから完全に別の生き物へ',
    insight: 'シェーダーシステム導入でアーティストがコードなしに表現できる時代へ。vm/（仮想マシン）でゲームロジックをサンドボックス化。DOOMの1300行 p_enemy.c とは別世界。',
    funFact: 'Quake3エンジン（id Tech 3）は2005年にGPLで公開。Call of DutyシリーズはこのDNAを持つ。',
    archType: 'evolved',
    detectPatterns: ['quake3', 'q3_ui', 'cgame', 'qcommon', 'renderer/tr_'],
  },
  {
    id: 'zdoom',
    name: 'ZDoom',
    year: 1996,
    creator: 'Randy Heit（コミュニティ）',
    lang: 'C++',
    tags: ['FPS', 'MOD', 'DOOMポート'],
    headline: 'DOOMをC++で書き直したらこうなった',
    insight: 'DOOMエンジンにC++クラスを導入した最初の大型ポート。クラス導入でレイヤーが分離する一方、600ファイルに膨張。「C++は整理するか、爆発するか」を示す実例。',
    funFact: 'ZDoomの後継GZDoomは今もアクティブ開発中。30年前のDOOMが2024年でも動き続ける理由。',
    archType: 'evolved',
    detectPatterns: ['zdoom', 'zcommon', 'g_level', 'p_acs', 'zscript'],
  },
  {
    id: 'nethack',
    name: 'NetHack',
    year: 1987,
    creator: 'NetHack DevTeam（集合知の怪物）',
    lang: 'C',
    tags: ['ローグライク', '伝説', '難解コード'],
    headline: '37年間、誰も全体を把握していない',
    insight: '1987年から何十人もが少しずつ書き続けた。変数名は1文字。グローバル変数が至る所に。コメントはほぼない。でも動く。「動けばいい」精神の到達点。',
    funFact: '公式の開発者ですら「このコードは理解できない部分がある」と認める。でも37年間プレイし続けられている。',
    archType: 'chaotic',
    detectPatterns: ['nethack', 'hack.h', 'you.h', 'monst.h', 'do_wear'],
  },
  {
    id: 'redis',
    name: 'Redis',
    year: 2009,
    creator: 'Salvatore Sanfilippo（antirez）',
    lang: 'C',
    tags: ['データベース', 'インフラ', '美コード'],
    headline: 'イタリア人1人が書いた「世界で最も美しいCコード」',
    insight: 'src/以下に全機能が凝縮。10万行以下で世界のインフラを支える。コードは詩のように読める。変数名が意味を持ち、関数が短く、コメントが哲学的。',
    funFact: 'antirezは「Redisはコードが美しい状態を保つためにC言語を使い続ける」と明言。Goに移行しないのは美学の問題。',
    archType: 'clean-minimal',
    detectPatterns: ['redis.c', 'aof.c', 'rdb.c', 'ae.c', 'sds.c', 'zmalloc'],
  },
  {
    id: 'wordpress',
    name: 'WordPress',
    year: 2004,
    creator: 'Matt Mullenweg',
    lang: 'PHP',
    tags: ['CMS', 'Web', '世界シェア43%'],
    headline: '世界の43%のサイトを動かすPHPスパゲッティ',
    insight: 'b2というブログソフトのフォークから始まった。wp-includes/に全ての機能が詰め込まれ、グローバル変数とフック地獄。でもこの「混沌」が世界最大のCMSを生んだ。',
    funFact: '「WordPressのコードは最悪だ」という批評は20年続いている。でも世界の43%のWebサイトはこれで動いている。正しくても負けることがある。',
    archType: 'chaotic',
    detectPatterns: ['wp-includes', 'wp-blog-header', 'wp-config', 'wp-settings', 'wp-load'],
  },
  {
    id: 'react',
    name: 'React',
    year: 2013,
    creator: 'Jordan Walke / Meta（Facebook）',
    lang: 'JavaScript',
    tags: ['フレームワーク', 'UI', '革命'],
    headline: 'UIをコンポーネントに分解した革命、v0.3.0',
    insight: '2013年の最初期バージョン。仮想DOMという概念が産声をあげた瞬間のコード。今や世界中で使われるアーキテクチャの、誰も注目していなかった最初の姿。',
    funFact: '発表時「なぜHTMLをJSに書くんだ？」と猛批判された。10年後、それが世界標準になった。',
    archType: 'revolutionary',
    detectPatterns: ['react.js', 'reactdom', 'react/src', 'reconciler', 'renderers/dom'],
  },
  {
    id: 'vue',
    name: 'Vue.js',
    year: 2014,
    creator: 'Evan You（個人）',
    lang: 'JavaScript',
    tags: ['フレームワーク', 'UI', '個人開発'],
    headline: 'Googleエンジニアがシリコンバレーを辞めて1人で作った',
    insight: 'Reactを参考にAngularの良い部分を混ぜ、1人で設計した。シンプルさへのこだわりがコード構造に現れている。企業バックなし・1人・でもReactと並ぶシェアへ。',
    funFact: 'Evan YouはGoogleを退職してパトロン収入だけでVueを作り続けた。個人OSSが企業フレームワークと戦えることを証明。',
    archType: 'clean-minimal',
    detectPatterns: ['vue.js', 'vue/src', 'src/compiler', 'src/observer', 'src/directives'],
  },
  {
    id: 'svelte',
    name: 'Svelte',
    year: 2019,
    creator: 'Rich Harris',
    lang: 'TypeScript',
    tags: ['フレームワーク', 'コンパイラ', '革命'],
    headline: 'ランタイムを捨てたフレームワーク、コンパイラという逆転発想',
    insight: '「フレームワークはコンパイル時に消えるべき」という思想。仮想DOMを持たない。コードは少なく、速く、美しい。TypeScriptで書かれた現代設計の結晶。',
    funFact: 'Svelteのソースは「フレームワーク自体がどう動くか」を学ぶ最高の教材として有名。コードの美しさが評判。',
    archType: 'revolutionary',
    detectPatterns: ['svelte/src', 'packages/svelte', 'compiler/compile', 'runtime/internal'],
  },
  {
    id: 'ruby-early',
    name: 'Ruby（初期）',
    year: 1995,
    creator: 'まつもとゆきひろ（Matz）',
    lang: 'C',
    tags: ['スクリプト言語', '日本発', 'Matz', '個人開発'],
    headline: '日本人が1人で世界標準言語を作った',
    insight: 'eval.c という1本の心臓部に全インタープリタが凝縮。DOOMの doomdef.h と同じ「神ハブ」構造を持つ。100ファイル以下でオブジェクト指向スクリプト言語を実現。Matzが「楽しくプログラミングできる言語を作りたかった」と語る原点のコード。',
    funFact: 'Ruby 1.0は1996年12月25日クリスマスにリリース。Matzが意図的にその日を選んだ。日本発で世界標準になった唯一のプログラミング言語。',
    archType: 'genius-dense',
    detectPatterns: ['ruby.c', 'ruby.h', 'eval.c', 'gc.c', 'parse.y', 'node.h'],
  },
  {
    id: 'curl',
    name: 'cURL',
    year: 1997,
    creator: 'Daniel Stenberg（27年間ほぼ1人）',
    lang: 'C',
    tags: ['ネットワーク', 'インフラ', '長寿OSS'],
    headline: '27年間1人が作り続ける、世界で最も使われるC',
    insight: '1997年から27年。HTTP・FTP・SMTP・SSH…250以上のプロトコル対応。プロトコルハンドラーを独立モジュールに分離したアーキテクチャが長寿の秘密。テストスイートが上部に張り出す「キノコ型」が健全な証。',
    funFact: 'Danielの年収はcURLの寄付のみ。世界のほぼ全てのサーバーとスマートフォンでこのコードが動いているのに。',
    archType: 'clean-minimal',
    detectPatterns: ['lib/curl', 'src/curl', 'lib/http.c', 'lib/ftp.c', 'lib/connect', 'easy.c'],
  },
];

// Detect project from node paths.
// Uses best-score strategy: pick the project with the MOST pattern matches
// (not just the first one with ≥2). This prevents DOOM from winning over
// ChocolateDoom/ZDoom, which contain all of DOOM's source files but also
// have their own unique patterns that score higher.
export function detectKnownProject(nodePaths: string[]): ProjectInsight | null {
  const pathsLower = nodePaths.map(p => p.toLowerCase()).join('\n');
  let best: ProjectInsight | null = null;
  let bestScore = 1; // must beat 1 (i.e. need at least 2 matches to qualify)
  for (const proj of KNOWN_PROJECTS) {
    const score = proj.detectPatterns.filter(pat => pathsLower.includes(pat.toLowerCase())).length;
    if (score > bestScore) {
      bestScore = score;
      best = proj;
    }
  }
  return best;
}
