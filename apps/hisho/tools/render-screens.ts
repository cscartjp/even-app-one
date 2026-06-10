/**
 * 画面プレビュー生成ツール
 *
 * アプリの実コード（toDisplayData / 各画面の display・action）をそのまま実行し、
 * 到達可能な全画面状態とジェスチャー遷移を BFS で列挙して、
 * 自己完結の HTML ビューア (preview/index.html) に焼き込む。
 *
 * 実行: bun run tools/render-screens.ts
 *
 * ※ ロジックを複製しないので、アプリを直せばプレビューも追従する（再生成するだけ）。
 */
import { readFileSync } from 'node:fs'
import { createScreenMapper } from 'even-toolkit/glass-router'
import type { DisplayLine, GlassAction } from 'even-toolkit/types'
import { defaultOrigin, defaultOriginLabel } from '../src/data/shops'
import { stations } from '../src/data/stations'
import {
  gourmetNearbyView,
  type NearbyView,
} from '../src/glass/screens/gourmet-nearby'
import { onGlassAction, toDisplayData } from '../src/glass/selectors'
import type { AppSnapshot } from '../src/glass/shared'

// __APP_VERSION__ は Vite define（build）でのみ注入される。
// このプレビューは Vite を介さず bun で実行するため、build と同じく app.json の
// version を globalThis に供給し、statusBarLines が実バージョンを描画できるようにする。
const previewGlobal = globalThis as { __APP_VERSION__?: string }
const previewAppVersion = JSON.parse(
  readFileSync(`${import.meta.dir}/../app.json`, 'utf-8'),
).version
// vite.config と同じ「非空文字列必須」契約を踏襲（不正なら HISHO vundefined を出さず throw）
if (typeof previewAppVersion !== 'string' || previewAppVersion.length === 0) {
  throw new Error('apps/hisho/app.json の version が不正です（非空の文字列が必要）')
}
previewGlobal.__APP_VERSION__ = previewAppVersion

// AppGlasses.tsx と同じルート定義・画面マッピング
const GLASS_ROUTES = {
  home: '/',
  train: '/train',
  gourmet: '/gourmet',
  gourmetNearby: '/gourmet/nearby',
  station: '/station',
} as const

const deriveScreen = createScreenMapper(
  [
    { pattern: GLASS_ROUTES.home, screen: 'home' },
    { pattern: GLASS_ROUTES.train, screen: 'train' },
    { pattern: GLASS_ROUTES.gourmetNearby, screen: 'gourmetNearby' },
    { pattern: GLASS_ROUTES.gourmet, screen: 'gourmet' },
    { pattern: GLASS_ROUTES.station, screen: 'station' },
  ],
  'home',
)

const menuItems = [
  { label: '電車情報', path: GLASS_ROUTES.train },
  { label: 'グルメ情報', path: GLASS_ROUTES.gourmet },
]

/**
 * プレビュー用の AppSnapshot を組み立てる。
 * AppGlasses.tsx と同じ優先順位で origin / originLabel を解決する:
 * - selectedStation が非 null → stations マスタから座標を引き、originLabel は駅名
 * - null → 従来どおり defaultOrigin / defaultOriginLabel
 */
function snapshot(
  selectedGenre: string | null,
  selectedStation: string | null,
): AppSnapshot {
  let origin = defaultOrigin
  let originLabel = defaultOriginLabel
  if (selectedStation !== null) {
    const st = stations.find((s) => s.name === selectedStation)
    if (st) {
      origin = { lat: st.lat, lon: st.lon }
      originLabel = selectedStation
    }
  }
  return {
    menuItems,
    flashPhase: false,
    origin,
    originLabel,
    selectedGenre,
    selectedStation,
  }
}

interface State {
  path: string
  hi: number
  genre: string | null
  /** 手動選択駅名。null は「自動」モード */
  station: string | null
}

/** 状態を一意なIDにする。区切り文字衝突を避けるため JSON 配列で表現する */
const id = (s: State) => JSON.stringify([s.path, s.hi, s.genre, s.station])

/** 状態を実コードの toDisplayData に通して表示行を得る。
 *  先頭行が statusBarLine（"HISHO" から始まる行）であれば除去する。
 *  モック側は statusbar を CSS div で描画するため、lines には含めない。 */
function render(s: State): DisplayLine[] {
  const lines = toDisplayData(snapshot(s.genre, s.station), {
    screen: deriveScreen(s.path),
    highlightedIndex: s.hi,
  }).lines
  if (lines.length > 0 && lines[0].text.startsWith('HISHO')) {
    return lines.slice(1)
  }
  return lines
}

const ACTIONS: Record<string, GlassAction> = {
  tap: { type: 'SELECT_HIGHLIGHTED' },
  up: { type: 'HIGHLIGHT_MOVE', direction: 'up' },
  down: { type: 'HIGHLIGHT_MOVE', direction: 'down' },
  back: { type: 'GO_BACK' },
}

/** 1 ジェスチャー適用後の状態を、実 action ＋ useGlasses の挙動どおりに計算 */
function apply(s: State, action: GlassAction): State {
  let path = s.path
  let genre = s.genre
  let station = s.station
  const ctx = {
    navigate: (p: string) => {
      path = p
    },
    setGenre: (g: string | null) => {
      genre = g
    },
    setStation: (name: string | null) => {
      station = name
    },
  }
  const nav = { screen: deriveScreen(s.path), highlightedIndex: s.hi }
  const newNav = onGlassAction(action, nav, snapshot(s.genre, s.station), ctx)

  const newScreen = deriveScreen(path)
  // useGlasses: 画面が変わったら highlightedIndex は 0 にリセットされる
  let hi = newScreen !== nav.screen ? 0 : newNav.highlightedIndex
  // genre は近い順画面でのみ意味を持つ（状態爆発を防ぐため正規化）
  if (newScreen !== 'gourmetNearby') genre = null
  if (hi < 0) hi = 0
  return { path, hi, genre, station }
}

/**
 * gourmetNearby のみ split 表示用の NearbyView（title/count/list/sel/detail）を
 * フラットに持つ（design-mock.html の JSON 構造と同形）。他画面は lines のみ。
 */
interface Node extends Partial<NearbyView> {
  id: string
  screen: string
  lines: DisplayLine[]
  trans: Record<string, string>
}

// 到達可能状態を BFS で列挙
const start: State = { path: '/', hi: 0, genre: null, station: null }
const nodes = new Map<string, Node>()
const seen = new Set<string>([id(start)])
const queue: State[] = [start]

while (queue.length) {
  const s = queue.shift() as State
  const trans: Record<string, string> = {}
  for (const [key, action] of Object.entries(ACTIONS)) {
    const ns = apply(s, action)
    const nid = id(ns)
    trans[key] = nid
    if (!seen.has(nid)) {
      seen.add(nid)
      queue.push(ns)
    }
  }
  const screen = deriveScreen(s.path)
  // gourmetNearby は split 表示: lines の代わりに NearbyView をフラット展開。
  // 0件（view が null）は従来どおり text の lines にフォールバック
  const view =
    screen === 'gourmetNearby'
      ? gourmetNearbyView(snapshot(s.genre, s.station), {
          screen,
          highlightedIndex: s.hi,
        })
      : null
  nodes.set(id(s), {
    id: id(s),
    screen,
    lines: view ? [] : render(s),
    trans,
    ...(view ?? {}),
  })
}

// 実機で最初に出る起動（スプラッシュ）画面を先頭に注入。
// glass-router の画面ではないので手動で足し、どのジェスチャーでもホームへ進む。
const homeId = id(start)
const splashId = '__splash__'
nodes.set(splashId, {
  id: splashId,
  screen: 'splash',
  lines: [],
  trans: { tap: homeId, up: homeId, down: homeId, back: homeId },
})

const data = {
  startId: splashId,
  generatedAt: new Date().toISOString(),
  version: previewGlobal.__APP_VERSION__,
  nodes: Object.fromEntries(nodes),
}

// <script> ブロックを途中終了させない・行区切り文字も壊さないよう JSON をエスケープ。
// < は JSON.parse で '<' に戻るので埋め込みデータの意味は変わらない。
const safeJson = JSON.stringify(data)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029')
const html = buildHtml(safeJson)
await Bun.write(`${import.meta.dir}/../preview/index.html`, html)
console.log(
  `生成完了: preview/index.html （${nodes.size} 画面状態 / ${data.generatedAt}）`,
)

/** 焼き込んだ JSON を読み込んで操作する自己完結プレビュー HTML を組み立てる */
function buildHtml(json: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hisho — 画面プレビュー (Even G2)</title>
<style>
  :root{ --g0:#04140a; --g-dim:#2f7d3a; --g:#7dfc7a; --g-hot:#c9ffc4; }
  *{ box-sizing:border-box; }
  body{ margin:0; background:#0b0f0c; color:#cfe9cf;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .wrap{ max-width:760px; margin:0 auto; padding:24px 16px 60px; }
  h1{ font-size:18px; font-weight:600; margin:0 0 2px; }
  .sub{ color:#7f9a7f; font-size:12px; margin:0 0 20px; }
  .screen-name{ text-align:center; color:#9fe39f; font-size:13px; letter-spacing:.08em; margin:0 0 8px; }

  /* G2 ディスプレイ: 576×288, 4bit 緑階調を模した黒地に緑 */
  .glass{
    width:576px; height:288px; margin:0 auto; position:relative;
    background:radial-gradient(120% 140% at 50% 0%, #06180c 0%, #031007 70%, #020a05 100%);
    border:1px solid #173d1f; border-radius:14px; overflow:hidden;
    box-shadow:0 0 0 6px #0c1a0f, 0 18px 50px rgba(0,0,0,.6), inset 0 0 60px rgba(40,160,60,.06);
    padding:8px 14px;
    font-family:"SF Mono",ui-monospace,Menlo,Consolas,monospace;
    display:flex; flex-direction:column;
  }
  /* 常時表示ステータスバー（macOS メニューバー風・1行ぶん = 28.8px） */
  .statusbar{
    position:relative; z-index:1; flex:none;
    height:28.8px; line-height:28.8px;
    display:flex; justify-content:space-between; align-items:center;
    border-bottom:1px solid #1f5a2a;
    font-size:15px; white-space:pre; overflow:hidden;
  }
  .statusbar .app{ color:var(--g-hot); font-weight:700; letter-spacing:.14em;
    text-shadow:0 0 8px rgba(120,250,120,.5); }
  .statusbar .clock{ color:var(--g-dim); letter-spacing:.04em; }
  #screen{ flex:1; min-height:0; position:relative; }
  /* 走査線っぽい質感 */
  .glass::after{ content:""; position:absolute; inset:0; pointer-events:none;
    background:repeating-linear-gradient(0deg, rgba(0,0,0,0) 0 3px, rgba(0,0,0,.10) 3px 4px); }
  .rows{ position:relative; z-index:1; height:100%; display:flex; flex-direction:column; }
  .row{ height:28.8px; line-height:28.8px; white-space:pre; font-size:18px;
    color:var(--g); text-shadow:0 0 6px rgba(90,230,90,.45); overflow:hidden; }
  .row.dim{ color:var(--g-dim); text-shadow:none; }
  .row.sep{ color:#1f5a2a; text-shadow:none; }
  .row.hot{ color:#04140a; background:var(--g); border-radius:4px;
    text-shadow:none; font-weight:600; padding:0 4px; margin:0 -4px; }

  /* グルメ（近い順）: 左右分割（左=店舗リスト / 右=選択店舗の詳細） */
  .nb-head{ display:flex; justify-content:space-between; border-bottom:1px solid #1f5a2a; }
  .nb-head .count{ color:var(--g-dim); text-shadow:none; }
  .nb-body{ flex:1; min-height:0; display:flex; }
  .nb-list{ width:55%; border-right:1px solid #1f5a2a; padding:2px 8px 0 0; }
  .nb-detail{ flex:1; min-width:0; padding:2px 0 0 12px; }
  .nb-detail .nb-name{ color:var(--g-hot); white-space:normal; height:auto;
    max-height:57.6px; overflow:hidden; word-break:break-all; }

  /* 起動（スプラッシュ）画面 */
  .splash{ position:relative; z-index:1; height:100%; display:flex;
    flex-direction:column; align-items:center; justify-content:center; gap:14px; }
  .splash .logo{ font-size:54px; font-weight:700; letter-spacing:.12em;
    color:var(--g-hot); text-shadow:0 0 16px rgba(120,250,120,.6); }
  .splash .tag{ font-size:16px; color:var(--g-dim); letter-spacing:.2em; }
  .splash .hint{ position:absolute; bottom:8px; font-size:13px; color:#2f7d3a;
    letter-spacing:.1em; }

  .scale{ display:flex; justify-content:center; }
  .scaler{ transform:scale(1.18); transform-origin:top center; margin-bottom:70px; }

  .legend{ text-align:center; color:#6f8a6f; font-size:11px; margin:6px 0 20px; }
  .controls{ display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
  button{ background:#11331a; color:#bdf0bd; border:1px solid #2a6b36; border-radius:10px;
    padding:10px 16px; font-size:14px; cursor:pointer; min-width:128px; }
  button:hover{ background:#16431f; }
  button:active{ transform:translateY(1px); }
  button small{ display:block; color:#79a979; font-size:10px; margin-top:2px; font-weight:400; }
  .meta{ text-align:center; color:#5f7a5f; font-size:11px; margin-top:22px; }
  kbd{ background:#16431f; border:1px solid #2a6b36; border-radius:4px; padding:1px 6px; font-size:11px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Hisho — 画面プレビュー</h1>
  <p class="sub">Even G2 ディスプレイ（576×288・4bit 緑階調）の見え方を再現。アプリの実コードから自動生成。</p>

  <div class="screen-name" id="screenName"></div>
  <div class="scale"><div class="scaler">
    <div class="glass">
      <div class="statusbar">
        <span class="app" id="appLabel">HISHO</span>
        <span class="clock" id="clock"></span>
      </div>
      <div id="screen"></div>
    </div>
  </div></div>

  <div class="legend">テンプルのタッチパッド操作を再現： 上/下スワイプ＝選択移動、タップ＝決定、ダブルタップ＝戻る</div>

  <div class="controls">
    <button id="b-up">⬆ 上スワイプ<small>選択を上へ</small></button>
    <button id="b-down">⬇ 下スワイプ<small>選択を下へ</small></button>
    <button id="b-tap">● タップ<small>決定 / 開く</small></button>
    <button id="b-back">⟲ ダブルタップ<small>戻る</small></button>
  </div>

  <p class="meta">
    キーボード: <kbd>↑</kbd><kbd>↓</kbd> スワイプ ・ <kbd>Enter</kbd> タップ ・ <kbd>Backspace</kbd> 戻る<br>
    <span id="genAt"></span> 時点の生成（電車の「あと◯分」は生成時刻基準）。起動画面→ホーム→電車／グルメと進めます。
  </p>
</div>

<script id="data" type="application/json">${json}</script>
<script>
  const DATA = JSON.parse(document.getElementById('data').textContent);
  const NAMES = { splash:'起動画面', home:'ホーム', train:'電車（時刻表）', gourmet:'グルメ（ジャンル選択）', gourmetNearby:'グルメ（近い順）', station:'駅選択' };
  const PREFIX = '  ';
  let cur = DATA.startId;

  function rowClass(l){
    if(l.style==='separator') return 'sep';
    if(l.inverted) return 'hot';
    if(l.style==='meta') return 'dim';
    return '';
  }
  function rowText(l){
    if(l.style==='separator') return PREFIX + '─'.repeat(27);
    if(l.inverted) return '▶ ' + l.text;
    return PREFIX + l.text;
  }
  function render(){
    const node = DATA.nodes[cur];
    document.getElementById('screenName').textContent = NAMES[node.screen] || node.screen;
    const screen = document.getElementById('screen');
    if(node.screen === 'splash'){
      screen.innerHTML =
        '<div class="splash">'+
          '<div class="logo">HISHO</div>'+
          '<div class="tag">あなたのスマート秘書</div>'+
          '<div class="hint">▶ タップで開始</div>'+
        '</div>';
      return;
    }
    if(node.screen === 'gourmetNearby' && node.list){
      renderNearby(node, screen);
      return;
    }
    screen.innerHTML = '';
    const rows = document.createElement('div');
    rows.className = 'rows';
    for(let i=0;i<9;i++){
      const l = node.lines[i];
      const div = document.createElement('div');
      div.className = 'row ' + (l ? rowClass(l) : '');
      div.textContent = l ? rowText(l) : '';
      rows.appendChild(div);
    }
    screen.appendChild(rows);
  }
  // 表示幅（全角=2, 半角=1）でカウントし、超過分は「…」で省略する
  function dispW(s){ let w=0; for(const ch of s) w += ch.codePointAt(0)>0xff ? 2 : 1; return w; }
  function truncW(s, max){
    if(dispW(s) <= max) return s;
    let w=0, out='';
    for(const ch of s){
      const cw = ch.codePointAt(0)>0xff ? 2 : 1;
      if(w + cw > max - 1) break;
      out += ch; w += cw;
    }
    return out + '…';
  }
  // グルメ（近い順）: 左=店舗リスト / 右=選択店舗の詳細。選択移動で右ペインのみ更新。
  // 長い店名は左で省略し、右ペイン1行目に正式名称をフル表示（最大2行折返し）。
  const NAME_W = 18; // 左リストで店名に割ける表示幅（全角9文字相当）
  // 実機 gourmet-nearby.ts の SPLIT_MAX_VISIBLE と一致させる（多件数ジャンルで
  // 選択行を可視窓内に保つ）。slidingWindowStart も実機ロジックの移植
  const SPLIT_MAX_VISIBLE = 7;
  function slidingWindowStart(hi, total, maxVisible){
    if(total <= maxVisible) return 0;
    return Math.max(0, Math.min(hi - Math.floor(maxVisible / 2), total - maxVisible));
  }
  function renderNearby(node, screen){
    screen.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'rows';
    const head = document.createElement('div');
    head.className = 'row nb-head';
    const title = document.createElement('span');
    title.textContent = PREFIX + node.title;
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = node.count;
    head.append(title, count);
    root.appendChild(head);
    const body = document.createElement('div');
    body.className = 'nb-body';
    const list = document.createElement('div');
    list.className = 'nb-list';
    const start = slidingWindowStart(node.sel, node.list.length, SPLIT_MAX_VISIBLE);
    node.list.slice(start, start + SPLIT_MAX_VISIBLE).forEach((s, j) => {
      const i = start + j;
      const div = document.createElement('div');
      div.className = 'row' + (i === node.sel ? ' hot' : '');
      div.textContent = (i === node.sel ? '▶ ' : PREFIX) +
        s.mark + ' ' + truncW(s.name, NAME_W) + ' ' + s.dist;
      list.appendChild(div);
    });
    const detail = document.createElement('div');
    detail.className = 'nb-detail';
    // 1行目=正式名称(最明・最大2行)、2行目=営業状況(明)、以降=補足(暗)
    const name = document.createElement('div');
    name.className = 'row nb-name';
    name.textContent = node.detail.name;
    detail.appendChild(name);
    const status = document.createElement('div');
    status.className = 'row';
    status.textContent = node.detail.status;
    detail.appendChild(status);
    if(node.detail.tel){
      const tel = document.createElement('div');
      tel.className = 'row dim';
      tel.textContent = 'TEL ' + node.detail.tel;
      detail.appendChild(tel);
    }
    node.detail.notes.forEach(text => {
      const div = document.createElement('div');
      div.className = 'row dim';
      div.textContent = text;
      detail.appendChild(div);
    });
    body.append(list, detail);
    root.appendChild(body);
    screen.appendChild(root);
  }
  function go(key){
    const node = DATA.nodes[cur];
    const next = node.trans[key];
    if(next && DATA.nodes[next]) cur = next;
    render();
  }
  document.getElementById('b-up').onclick = ()=>go('up');
  document.getElementById('b-down').onclick = ()=>go('down');
  document.getElementById('b-tap').onclick = ()=>go('tap');
  document.getElementById('b-back').onclick = ()=>go('back');
  document.addEventListener('keydown', e=>{
    if(e.key==='ArrowUp'){ go('up'); e.preventDefault(); }
    else if(e.key==='ArrowDown'){ go('down'); e.preventDefault(); }
    else if(e.key==='Enter'){ go('tap'); e.preventDefault(); }
    else if(e.key==='Backspace'){ go('back'); e.preventDefault(); }
  });
  document.getElementById('genAt').textContent = new Date(DATA.generatedAt).toLocaleString('ja-JP');
  // ステータスバーのアプリ名にバージョンを併記（アプリの statusBarLines と表記を一致させる）
  document.getElementById('appLabel').textContent = 'HISHO v' + DATA.version;

  // 常時表示バーの時計（macOS メニューバー風: 2026年6月7日（日） 16:03）
  function updateClock(){
    const d = new Date();
    const w = ['日','月','火','水','木','金','土'][d.getDay()];
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    document.getElementById('clock').textContent =
      d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日（'+w+'） '+hh+':'+mm;
  }
  updateClock();
  setInterval(updateClock, 1000);

  render();
</script>
</body>
</html>
`
}
