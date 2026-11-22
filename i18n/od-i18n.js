/* =============================================================================
 * od-i18n.js — OurDAISY 図書館：画面の言葉の切り替え（多言語表示）
 * Version: 1.1.0 — 2026-11-22
 *   1.1.0：12言語に対応。つなげて書く文字（クメール語・ミャンマー語など）で、字の間をあけない（あけると字がくずれる）
 *
 * しくみ
 *   ・図書館の画面（index.html）は、今までどおり「やさしい日本語＋英語」で書く。
 *   ・このファイルが、英語の文を「えらんだ言葉」に入れ替える。やさしい日本語は消さない。
 *   ・日本語だけの文（英語がない所）には、うしろに「 / えらんだ言葉」を足す。
 *   ・訳は i18n/<言語>.json（辞書）から読む。辞書にない文は、英語（または日本語）のまま出す。
 *   ・えらべる言語は i18n/index.json で決める。public か reviewed が true の言語が、ふつうの画面に出る。
 *     public＝公開している／reviewed＝その言葉が分かる人の確認がすんだ（控え。確認がすんだら true にする）。
 *     ためすとき：アドレスのうしろに ?odbeta=1 をつけると、確認前の言語もえらべる（?odbeta=0 でもどす）。
 *   ・?lang=pt のように言語を指定して開ける（チラシのQR用）。
 *
 * 守ること
 *   ・言語をえらんでいない人・日本語と英語の人には、何もしない（今までと同じ画面）。
 *   ・本の中身（#lr-page）・本の名前・説明・入力した文字にはさわらない。
 *   ・登録などでシートに入る値（value・data-v）は変えない。表示だけを入れ替える。
 * ============================================================================= */
(function () {
'use strict';
if (window.OD_I18N) return;

var VERSION = '1.2.0';
var LS_LANG = 'od_ui_lang', LS_BETA = 'od_i18n_beta', LS_MAN = 'od_i18n_manifest_v1', LS_DICT = 'od_i18n_dict_v1_';
var JA_RE = /[぀-ヿ㐀-鿿]/;
var FONT_CDN = 'https://cdn.jsdelivr.net/npm/@fontsource/';
var FONT_VER = '5.3.0';

// 言語の一覧（図書館の言語タブと同じ順）。tab＝本の一覧の言語タブの名前
var LANGS = [
  { c: 'lo', n: 'ພາສາລາວ',          ja: 'ラオス<ruby>語<rt>ご</rt></ruby>',       tab: 'Lao',        font: 'lao',        range: 'U+0E80-0EFF' },
  { c: 'km', n: 'ភាសាខ្មែរ',         ja: 'クメール<ruby>語<rt>ご</rt></ruby>',     tab: 'Khmer',      font: 'khmer',      range: 'U+1780-17FF,U+19E0-19FF', tall: 1 },
  { c: 'my', n: 'မြန်မာဘာသာ',       ja: 'ミャンマー<ruby>語<rt>ご</rt></ruby>',   tab: 'Myanmar',    font: 'myanmar',    range: 'U+1000-109F,U+A9E0-A9FF,U+AA60-AA7F', tall: 1 },
  { c: 'ne', n: 'नेपाली',             ja: 'ネパール<ruby>語<rt>ご</rt></ruby>',     tab: 'Nepali',     font: 'devanagari', range: 'U+0900-097F,U+A8E0-A8FF,U+1CD0-1CFF' },
  { c: 'tl', n: 'Tagalog',           ja: 'タガログ<ruby>語<rt>ご</rt></ruby>',     tab: 'Tagalog' },
  { c: 'vi', n: 'Tiếng Việt',        ja: 'ベトナム<ruby>語<rt>ご</rt></ruby>',     tab: 'Vietnamese' },
  { c: 'pt', n: 'Português',         ja: 'ポルトガル<ruby>語<rt>ご</rt></ruby>',   tab: 'Portuguese' },
  { c: 'id', n: 'Bahasa Indonesia',  ja: 'インドネシア<ruby>語<rt>ご</rt></ruby>', tab: 'Indonesian' },
  { c: 'th', n: 'ภาษาไทย',           ja: 'タイ<ruby>語<rt>ご</rt></ruby>',         tab: 'Thai',       font: 'thai',       range: 'U+0E00-0E7F' },
  { c: 'si', n: 'සිංහල',              ja: 'シンハラ<ruby>語<rt>ご</rt></ruby>',     tab: 'Sinhala',    font: 'sinhala',    range: 'U+0D80-0DFF', tall: 1 },
  { c: 'es', n: 'Español',           ja: 'スペイン<ruby>語<rt>ご</rt></ruby>',     tab: 'Spanish' },
  { c: 'hi', n: 'हिन्दी',              ja: 'ヒンディー<ruby>語<rt>ご</rt></ruby>',   tab: 'Hindi',      font: 'devanagari', range: 'U+0900-097F,U+A8E0-A8FF,U+1CD0-1CFF' }
];
var BY = {}; LANGS.forEach(function (l) { BY[l.c] = l; });
// 図書館の画面で使っている書体の名前（ここに各言語の文字を足す）
var PAGE_FAMILIES = ['M PLUS Rounded 1c', 'Nunito', 'Kaisei Decol', 'OD I18N'];
// さわらない所（本の中身・本の名前など）
var SKIP_SEL = '#lr-page,.book-title,.book-title-jp,.book-desc,.book-credits,.book-meta,.lr-news-b-raw,[data-od-skip],.od-add,.od-lang-ui';
var SKIP_TAG = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, RT: 1, RP: 1, AUDIO: 1, IFRAME: 1 };
var ATTRS = ['placeholder', 'title', 'aria-label'];

var lang = '';            // えらんだ言語（'' ＝えらんでいない／日本語・英語）
var dict = null;          // いまの辞書（文 → 訳）
var manifest = null;      // i18n/index.json
var misses = {};          // 辞書にない文（点検用）
var busy = false;         // 自分の書きかえで、見張りが動かないようにする印
var base = (function () {
  var s = document.currentScript, u = (s && s.src) ? s.src : '';
  return u ? u.replace(/[^\/]*(\?.*)?$/, '') : 'i18n/';
})();

function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
function qs(name) { var m = new RegExp('(?:^|[?&])' + name + '=([^&#]*)').exec(location.search.slice(1)); return m ? decodeURIComponent(m[1]) : null; }
function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }

// ── えらべる言語 ─────────────────────────────────────────────
function beta() { return ls(LS_BETA) === '1'; }
function available(c) {
  if (!manifest || !manifest.langs || !BY[c]) return false;
  var m = manifest.langs[c];
  return !!m && (m.public === true || m.reviewed === true || beta());
}
function availableList() { return LANGS.filter(function (l) { return available(l.c); }); }
// 'pt'・'pt-BR'・'Portuguese' などを言語の記号にそろえる
function toCode(x) {
  x = String(x || '').trim(); if (!x) return '';
  var low = x.toLowerCase();
  if (low === 'ja' || low === 'en' || low === 'none') return 'none';
  var two = low.split(/[-_]/)[0];
  if (two === 'fil') two = 'tl';
  if (BY[two]) return two;
  for (var i = 0; i < LANGS.length; i++) if (LANGS[i].tab.toLowerCase() === low) return LANGS[i].c;
  return '';
}

// ── 辞書を引く ───────────────────────────────────────────────
function lookup(core) {
  if (!dict) return null;
  var k = norm(core); if (!k) return null;
  var v = dict[k];
  if (typeof v === 'string' && v) return v;
  v = xdict[k];                                   // おしらせの訳
  if (typeof v === 'string' && v) return v;
  var nums = [];
  var k2 = k.replace(/\d+(?:[.,]\d+)?/g, function (m) { nums.push(m); return '{' + (nums.length - 1) + '}'; });
  if (nums.length) {
    v = dict[k2];
    if (typeof v === 'string' && v) return v.replace(/\{(\d+)\}/g, function (_, i) { return nums[+i] != null ? nums[+i] : ''; });
  }
  return null;
}
function miss(core) {
  var k = norm(core);
  if (k.length < 2 || k.length > 400 || !/[A-Za-z]{2,}/.test(k) || JA_RE.test(k)) return;
  if (/^(https?:|www\.)|@|^[\d\W_]+$/.test(k)) return;
  misses[k] = (misses[k] || 0) + 1;
}
// 文字列を入れ替える。変わらなければ null
//   ・英語だけの文 → 訳に入れ替える
//   ・「日本語 / English」→ 英語の所だけ入れ替える
function trString(src) {
  var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(src), core = m[2];
  if (!core) return null;
  var hasJa = JA_RE.test(core);
  if (!hasJa) {
    var r = lookup(core);
    if (r != null) return m[1] + r + m[3];
    // 「（ふりがなつきの日本語） / English」の英語の所だけが、1つの文字のかたまりになっているとき
    var lead = /^([\/／]\s*)([\s\S]+)$/.exec(core);
    if (lead) {
      r = lookup(lead[2]);
      if (r != null) return m[1] + lead[1] + r + m[3];
      miss(lead[2]); return null;
    }
  }
  if (/\s\/\s|／/.test(core)) {
    var parts = core.split(/(\s+\/\s+|\s*／\s*)/), ch = false;
    for (var i = 0; i < parts.length; i += 2) {
      var p = parts[i];
      if (!p || JA_RE.test(p)) continue;
      var t = lookup(p);
      if (t != null) { parts[i] = t; ch = true; } else miss(p);
    }
    if (ch) return m[1] + parts.join('') + m[3];
    return null;
  }
  if (!hasJa) miss(core);
  return null;
}

// ── おしらせ（NEWS）の訳 ────────────────────────────────────────
//   GAS の news の返事（tr＝言葉ごとの訳）から、「英語の文 → 訳」の辞書をつくる。
//   画面は今までどおり 日本語＋英語 で出し、英語の所を訳に入れ替える（日本語はそのまま）。
var LS_NEWS = 'od_lr_news_v1';     // 図書館の画面が、おしらせを控えている所
var xdict = {}, newsItems = null;
function buildNewsDict() {
  xdict = {};
  var items = newsItems;
  if (!items) { try { items = JSON.parse(ls(LS_NEWS) || 'null'); } catch (e) { items = null; } }
  if (!lang || !Array.isArray(items)) return;
  items.forEach(function (n) {
    var t = n && n.tr && n.tr[lang];
    if (!t) return;
    if (n.en && t.t) xdict[norm(n.en)] = String(t.t);
    else if (n.ja && t.t) xdict[norm(n.ja)] = String(t.t);            // 英語がないおしらせ：日本語のうしろに訳を足す
    if (n.body_en && t.b) xdict[norm(n.body_en)] = String(t.b);
    else if (n.body_ja && t.b) xdict[norm(n.body_ja)] = String(t.b);
  });
}
function gotNews(items) {
  newsItems = items;
  if (!lang || !dict) return;
  restoreAll(); buildNewsDict(); buildRev(); applyAll();
}

// 訳 → もとの文（画面が、訳したあとの部品を写して使うことがあるため。写しには、もとの文の控えがつかない）
var rev = null;
function buildRev() {
  rev = {};
  if (!dict) return;
  for (var k in dict) if (Object.prototype.hasOwnProperty.call(dict, k) && !JA_RE.test(k)) {
    var v = norm(dict[k]);
    if (v && v !== k && !(v in rev)) rev[v] = k;
  }
  for (var x in xdict) if (Object.prototype.hasOwnProperty.call(xdict, x) && !JA_RE.test(x)) {
    var xv = norm(xdict[x]);
    if (xv && xv !== x && !(xv in rev)) rev[xv] = x;
  }
}
function unString(txt) {
  if (!rev) return null;
  var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(txt), core = m[2];
  if (!core) return null;
  var k = rev[norm(core)];
  if (k) return m[1] + k + m[3];
  var lead = /^([\/／]\s*)([\s\S]+)$/.exec(core);
  if (lead && rev[norm(lead[2])]) return m[1] + lead[1] + rev[norm(lead[2])] + m[3];
  if (/\s\/\s|／/.test(core)) {
    var parts = core.split(/(\s+\/\s+|\s*／\s*)/), ch = false;
    for (var i = 0; i < parts.length; i += 2) { var r = parts[i] && rev[norm(parts[i])]; if (r) { parts[i] = r; ch = true; } }
    if (ch) return m[1] + parts.join('') + m[3];
  }
  return null;
}

// ── 画面を入れ替える ─────────────────────────────────────────
function skipped(el) {
  for (var e = el; e && e.nodeType === 1; e = e.parentNode) {
    if (SKIP_TAG[e.nodeName]) return true;
    if (e.isContentEditable) return true;
  }
  return !!(el && el.closest && el.closest(SKIP_SEL));
}
// 訳を入れた所に、その言語の書体を先頭に足す（画面のどの書体の所でも、文字がくずれないように）
function markFont(el) {
  var L = BY[lang];
  if (!L || !L.font || !el || el.nodeType !== 1 || el.hasAttribute('data-od-ff')) return;
  var ff = '';
  try { ff = getComputedStyle(el).fontFamily || ''; } catch (e) {}
  el.__odFont = el.style.fontFamily || '';
  el.style.fontFamily = '"OD I18N"' + (ff ? ', ' + ff : '');
  el.setAttribute('data-od-ff', '1');
}
function doText(node) {
  var cur = node.nodeValue;
  if (node.__odOut !== undefined && cur !== node.__odOut) { node.__odSrc = undefined; node.__odOut = undefined; }   // 画面が書きかえた
  var src = node.__odSrc !== undefined ? node.__odSrc : cur;
  if (node.__odSrc === undefined && lang && dict) { var back = unString(cur); if (back != null) src = back; }   // 訳したあとの写し
  var out = (lang && dict) ? trString(src) : null;
  if (out == null) {
    if (node.__odSrc !== undefined) { if (cur !== src) node.nodeValue = src; node.__odSrc = undefined; node.__odOut = undefined; }
    return;
  }
  node.__odSrc = src; node.__odOut = out;
  if (cur !== out) node.nodeValue = out;
  markFont(node.parentNode);
}
function doAttrs(el) {
  for (var i = 0; i < ATTRS.length; i++) {
    var a = ATTRS[i];
    if (!el.hasAttribute(a)) continue;
    var st = el.__odA || (el.__odA = {});
    var cur = el.getAttribute(a), rec = st[a];
    if (rec && cur !== rec.out) rec = st[a] = null;
    var src = rec ? rec.src : cur;
    var out = (lang && dict) ? trString(src) : null;
    if (out == null) { if (rec) { el.setAttribute(a, src); st[a] = null; } continue; }
    st[a] = { src: src, out: out };
    if (cur !== out) el.setAttribute(a, out);
    if (a === 'placeholder') markFont(el);
  }
}
// 日本語だけの文（英語がない所）：うしろに「 / 訳」を足す。ふりがなは数えない
function plainJa(el) {
  var s = '';
  (function walk(n) {
    for (var c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) s += c.nodeValue;
      else if (c.nodeType === 1 && c.nodeName !== 'RT' && c.nodeName !== 'RP' && !(c.classList && c.classList.contains('od-add'))) {
        if (c.nodeName === 'BR') s += ' ';
        walk(c);
      }
    }
  })(el);
  return norm(s);
}
function doAdd(el) {
  var old = null;
  for (var c = el.lastChild; c; c = c.previousSibling) if (c.nodeType === 1 && c.classList.contains('od-add')) { old = c; break; }
  var want = null;
  if (lang && dict && el.childNodes.length && el.textContent.length <= 400) {
    var key = plainJa(el);
    if (key && JA_RE.test(key) && key.indexOf(' / ') < 0) want = lookup(key);
  }
  if (want == null) { if (old) old.remove(); return false; }
  if (old) { if (old.__odKey !== want) { old.textContent = want; old.__odKey = want; } markFont(old); return true; }
  var sp = document.createElement('span');
  sp.className = 'od-add'; sp.textContent = want; sp.__odKey = want;
  el.appendChild(sp);
  markFont(sp);
  return true;
}
function walk(root) {
  if (!root) return;
  if (root.nodeType === 3) { if (root.parentNode && !skipped(root.parentNode)) doText(root); return; }
  if (root.nodeType !== 1 || skipped(root)) return;
  (function rec(el, inAdd) {
    if (SKIP_TAG[el.nodeName] || (el.matches && el.matches(SKIP_SEL)) || el.isContentEditable) return;
    doAttrs(el);
    var added = inAdd || ((el.nodeName !== 'BODY' && el.nodeName !== 'HTML') ? doAdd(el) : false);
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) { if (!added) doText(c); }
      else if (c.nodeType === 1) rec(c, added);
    }
  })(root, false);
}
// すべてを、もとの文（やさしい日本語＋英語）にもどす。言語を変える前に、前の言語の辞書で行う
function restoreAll() {
  busy = true;
  try {
    var adds = document.querySelectorAll('.od-add');
    for (var i = 0; i < adds.length; i++) adds[i].remove();
    var ffs = document.querySelectorAll('[data-od-ff]');
    for (var f = 0; f < ffs.length; f++) { ffs[f].style.fontFamily = ffs[f].__odFont || ''; ffs[f].removeAttribute('data-od-ff'); ffs[f].__odFont = undefined; }
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      if (n.__odSrc !== undefined) { if (n.nodeValue !== n.__odSrc) n.nodeValue = n.__odSrc; n.__odSrc = undefined; n.__odOut = undefined; continue; }
      if (!rev || !n.parentNode || skipped(n.parentNode)) continue;
      var back = unString(n.nodeValue);
      if (back != null) n.nodeValue = back;
    }
    var els = document.body.querySelectorAll('[placeholder],[title],[aria-label]');
    for (var j = 0; j < els.length; j++) {
      var st = els[j].__odA; if (!st) continue;
      for (var a in st) if (st[a]) { els[j].setAttribute(a, st[a].src); st[a] = null; }
    }
  } finally { busy = false; }
}
function applyAll() {
  busy = true;
  try { walk(document.body); } finally { busy = false; }
  document.documentElement.setAttribute('data-od-lang', lang || 'none');
  var L = BY[lang];
  document.documentElement.classList.toggle('od-tall', !!(L && L.tall));
  document.documentElement.classList.toggle('od-script', !!(L && L.font));   // 字の間をあけると くずれる文字
  syncUi();
}

// 画面が書きかわったら、その所だけ入れ替える
var pending = [], timer = 0;
function flush() {
  timer = 0;
  var list = pending; pending = [];
  if (!lang || !dict) return;
  busy = true;
  try {
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      if (!n.isConnected) continue;
      if (n.nodeType === 3) { if (n.parentNode && !skipped(n.parentNode)) { if (!addedParent(n.parentNode)) doText(n); } }
      else walk(n);
    }
  } finally { busy = false; }
}
function addedParent(el) {   // 親に「 / 訳」を足し直す（日本語だけの文が書きかわったとき）
  for (var e = el, i = 0; e && e.nodeType === 1 && i < 4; e = e.parentNode, i++) {
    if (e.nodeName === 'BODY') break;
    if (doAdd(e)) return true;
  }
  return false;
}
var observer = new MutationObserver(function (muts) {
  if (busy || !lang || !dict) return;
  for (var i = 0; i < muts.length; i++) {
    var m = muts[i];
    if (m.type === 'childList') {
      for (var j = 0; j < m.addedNodes.length; j++) {
        var a = m.addedNodes[j];
        if (a.nodeType === 1 && a.classList && (a.classList.contains('od-add') || a.classList.contains('od-lang-ui'))) continue;
        pending.push(a);
      }
      if (m.target && m.target.nodeType === 1) pending.push(m.target);
    } else if (m.type === 'characterData') pending.push(m.target);
    else if (m.type === 'attributes') pending.push(m.target);
  }
  if (pending.length && !timer) timer = setTimeout(flush, 0);
});

// ── 書体（各言語の文字を、画面の書体に足す） ───────────────────────
var fontDone = {};
function loadFont(L) {
  if (!L || !L.font || fontDone[L.c]) return;
  fontDone[L.c] = true;
  var css = '';
  ['400', '700'].forEach(function (w) {
    var url = FONT_CDN + 'noto-sans-' + L.font + '@' + FONT_VER + '/files/noto-sans-' + L.font + '-' + L.font + '-' + w + '-normal.woff2';
    PAGE_FAMILIES.forEach(function (fam) {
      css += '@font-face{font-family:"' + fam + '";font-style:normal;font-weight:' + (w === '400' ? '100 599' : '600 900') +
             ';font-display:swap;src:url(' + url + ') format("woff2");unicode-range:' + L.range + ',U+200C-200D,U+25CC}';
    });
  });
  var st = document.createElement('style');
  st.setAttribute('data-od-font', L.c); st.textContent = css;
  document.head.appendChild(st);
}

// ── 辞書を読む ───────────────────────────────────────────────
function getJson(url) {
  return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
}
function loadManifest() {
  var cached = null;
  try { cached = JSON.parse(ls(LS_MAN) || 'null'); } catch (e) {}
  if (cached && cached.langs) manifest = cached;
  return getJson(base + 'index.json').then(function (j) {
    if (j && j.langs) { manifest = j; lsSet(LS_MAN, JSON.stringify(j)); }
  }).catch(function () {});
}
function loadDict(c) {
  var ver = (manifest && manifest.v) || '0', key = LS_DICT + c, cached = null;
  try { cached = JSON.parse(ls(key) || 'null'); } catch (e) {}
  var useCached = cached && cached.t ? Promise.resolve(cached.t) : null;
  var fresh = getJson(base + c + '.json?v=' + encodeURIComponent(ver)).then(function (j) {
    if (!j || !j.t) throw new Error('bad dict');
    lsSet(key, JSON.stringify({ v: ver, t: j.t }));
    return j.t;
  });
  if (useCached && cached.v === ver) { fresh.catch(function () {}); return useCached; }
  return fresh.catch(function (e) { if (useCached) return useCached; throw e; });
}

// ── 言語をえらぶ ─────────────────────────────────────────────
var seq = 0;
function setLang(c, opt) {
  opt = opt || {};
  c = (c && c !== 'none' && available(c)) ? c : '';
  var my = ++seq;
  if (opt.save !== false) lsSet(LS_LANG, c || 'none');
  if (!c) {
    restoreAll(); lang = ''; dict = null; rev = null; xdict = {}; applyAll(); afterChange(opt);
    return Promise.resolve('');
  }
  loadFont(BY[c]);
  return loadDict(c).then(function (t) {
    if (my !== seq) return lang;
    restoreAll();
    lang = c; dict = t; misses = {}; buildNewsDict(); buildRev();
    applyAll(); afterChange(opt);
    return c;
  }).catch(function () {
    if (my !== seq) return lang;
    restoreAll(); lang = ''; dict = null; rev = null; applyAll();      // 辞書が読めないときは、今までの画面のまま
    return '';
  });
}
function afterChange(opt) {
  if (opt.user) { syncTab(true); sendLang(); }
  try { document.dispatchEvent(new CustomEvent('od-i18n-change', { detail: { lang: lang } })); } catch (e) {}
}
// 本の一覧の言語タブを、えらんだ言語に合わせる（その言語の本があるときだけ）
var tabSynced = false;
function syncTab(force) {
  try {
    var L = BY[lang];
    if (!L || typeof _books === 'undefined' || !_books || !_books.length) return;
    if (!force && (tabSynced || _activeLang !== 'ALL')) return;
    if (!_books.some(function (b) { return String(b.lang || '').indexOf(L.tab) === 0; })) return;
    tabSynced = true;
    if (_activeLang === L.tab) return;
    _activeLang = L.tab;
    buildLangTabs(); applyFilters();
  } catch (e) {}
}
// えらんだ言語を会員の記録に残す（ログインしているときだけ。メールの言語に使う）
var sentLang = null;
function sendLang() {
  try {
    if (!window.LR || !LR.token || !LR.token() || typeof SITE_CONFIG === 'undefined') return;
    var v = lang || 'ja';
    if (sentLang === v) return;
    sentLang = v;
    fetch(SITE_CONFIG.GAS_URL, { method: 'POST', mode: 'no-cors',
      body: new URLSearchParams({ action: 'profile', token: LR.token(), lang: v }) }).catch(function () {});
  } catch (e) {}
}

// ── えらぶための部品（ヘッダーのボタン・トップの帯・えらぶ画面） ─────────────
var CSS =
  '.od-add{font-size:.86em;opacity:.9;font-weight:inherit}.od-add::before{content:" / "}' +
  '.lr-tile .od-add,.lr-bar .od-add,.lr-hbtn .od-add,#lr-toasttx .od-add,#lr-busytx .od-add{display:block;font-size:.74em;line-height:1.25}' +
  '.lr-tile .od-add::before,.lr-bar .od-add::before,.lr-hbtn .od-add::before,#lr-toasttx .od-add::before,#lr-busytx .od-add::before{content:""}' +
  '.od-lang-btn{background:#fff;border:2px solid var(--efa-border,#B8D9F0);color:var(--efa-dark,#004070);padding:7px 12px;border-radius:20px;' +
    'font-size:12px;font-weight:800;cursor:pointer;min-height:38px;display:flex;align-items:center;gap:4px;white-space:nowrap;font-family:"OD I18N","Nunito",sans-serif}' +
  '.od-lang-strip{background:#fff;border-bottom:2px solid var(--border,#B8D9F0);padding:12px 12px 14px;text-align:center}' +
  '.od-lang-strip h2{font-size:15px;margin:0 0 8px;color:var(--efa-dark,#004070);font-weight:800}' +
  '.od-lang-strip h2 span{font-size:.8em;opacity:.75;font-family:"Nunito",sans-serif}' +
  '.od-lang-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:820px;margin:0 auto}' +
  '.od-chip{border:2px solid var(--border,#B8D9F0);background:#F7FBFF;color:var(--text,#1A2E45);border-radius:22px;padding:8px 14px;min-height:44px;' +
    'font-size:15px;font-weight:700;cursor:pointer;font-family:"OD I18N","Nunito","M PLUS Rounded 1c",sans-serif;line-height:1.3}' +
  '.od-chip[aria-pressed="true"]{background:var(--efa-accent,#F39800);border-color:var(--efa-accent,#F39800);color:#fff}' +
  '.od-lang-modal{position:fixed;inset:0;z-index:100000;background:rgba(0,40,70,.55);display:none;align-items:center;justify-content:center;padding:14px}' +
  '.od-lang-modal.on{display:flex}' +
  '.od-lang-box{background:#fff;border-radius:20px;max-width:560px;width:100%;max-height:90vh;overflow:auto;padding:18px 16px 16px}' +
  '.od-lang-box h2{font-size:18px;margin:0 0 4px;text-align:center;color:var(--efa-dark,#004070)}' +
  '.od-lang-box p{font-size:13px;margin:0 0 12px;text-align:center;color:var(--text-lt,#546E7A);font-family:"Nunito",sans-serif}' +
  '.od-lang-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}' +
  '.od-tile{border:2px solid var(--border,#B8D9F0);background:#F7FBFF;border-radius:16px;padding:12px 8px;min-height:68px;cursor:pointer;text-align:center;' +
    'font-family:"OD I18N","Nunito","M PLUS Rounded 1c",sans-serif;color:var(--text,#1A2E45)}' +
  '.od-tile b{display:block;font-size:18px;line-height:1.5}' +
  '.od-tile small{display:block;font-size:12px;color:var(--text-lt,#546E7A);font-family:"M PLUS Rounded 1c",sans-serif}' +
  '.od-tile[aria-pressed="true"]{background:#FFF3DC;border-color:var(--efa-accent,#F39800)}' +
  '.od-tile.wide{grid-column:1 / -1;min-height:56px}' +
  '.od-lang-close{display:block;margin:14px auto 0;border:none;background:var(--efa-blue,#0065A4);color:#fff;border-radius:24px;padding:12px 32px;font-size:15px;font-weight:800;cursor:pointer;min-height:48px}' +
  '.od-beta-tag{font-size:10px;background:#888;color:#fff;border-radius:8px;padding:1px 6px;margin-left:4px;vertical-align:middle}' +
  'html.od-tall .en,html.od-tall .lr-en,html.od-tall .rg-en,html.od-tall .en-title,html.od-tall .od-add{line-height:1.9}' +
  'html.od-script body,html.od-script body *{letter-spacing:normal !important}' +
  // せまい画面のヘッダー：ボタンが3つ並んでも、はみ出さないようにする（言語をえらんでいるときだけ）
  'html[data-od-lang]:not([data-od-lang="none"]) .header-controls .od-add{display:block;font-size:.72em;line-height:1.2}' +
  'html[data-od-lang]:not([data-od-lang="none"]) .header-controls .od-add::before{content:""}' +
  'html[data-od-lang]:not([data-od-lang="none"]) .header-controls .lr-shelf-btn{flex-direction:column;gap:0;padding:4px 12px;line-height:1.2}' +
  'html[data-od-lang]:not([data-od-lang="none"]) .btn-logout{white-space:normal;line-height:1.15;text-align:center;max-width:96px;padding:5px 10px}' +
  '@media (max-width:480px){.od-lang-btn .od-lang-name{display:none}.od-lang-btn{padding:7px 10px}}';

var ui = { btn: null, strip: null, modal: null };
function tileHtml(l) {
  var mm = manifest && manifest.langs[l.c], rev = !!mm && (mm.public === true || mm.reviewed === true);
  return '<button type="button" class="od-tile" data-od-c="' + l.c + '" lang="' + l.c + '"><b>' + l.n + (rev ? '' : '<span class="od-beta-tag">β</span>') +
         '</b><small lang="ja">' + l.ja + '</small></button>';
}
function buildUi() {
  var list = availableList();
  [ui.btn, ui.strip, ui.modal].forEach(function (e) { if (e && e.parentNode) e.parentNode.removeChild(e); });
  ui = { btn: null, strip: null, modal: null };
  if (!list.length) return;
  if (!document.getElementById('od-i18n-css')) {
    var st = document.createElement('style'); st.id = 'od-i18n-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  // ヘッダーのボタン
  var hc = document.querySelector('.header-controls');
  if (hc) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'od-lang-btn od-lang-ui'; b.id = 'od-lang-btn';
    b.setAttribute('aria-label', 'ことばを えらぶ / Language');
    b.onclick = openPicker;
    hc.insertBefore(b, hc.firstChild);
    ui.btn = b;
  }
  // トップページの帯
  var hero = document.querySelector('#screen-landing .hero');
  if (hero && hero.parentNode) {
    var s = document.createElement('section');
    s.className = 'od-lang-strip od-lang-ui'; s.setAttribute('aria-label', 'ことばを えらぶ / Language');
    s.innerHTML = '<h2>🌐 ことばを えらぶ <span>/ Choose your language</span></h2><div class="od-lang-chips">' +
      list.map(function (l) { return '<button type="button" class="od-chip" data-od-c="' + l.c + '" lang="' + l.c + '">' + l.n + '</button>'; }).join('') +
      '<button type="button" class="od-chip" data-od-c="none">日本語・English</button></div>';
    s.addEventListener('click', function (e) {
      var t = e.target.closest('[data-od-c]'); if (t) setLang(t.getAttribute('data-od-c'), { user: true });
    });
    hero.parentNode.insertBefore(s, hero.nextSibling);
    ui.strip = s;
  }
  // えらぶ画面
  var m = document.createElement('div');
  m.className = 'od-lang-modal od-lang-ui'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  m.innerHTML = '<div class="od-lang-box"><h2>🌐 ことばを えらぶ</h2><p>Choose your language</p><div class="od-lang-grid">' +
    list.map(tileHtml).join('') +
    '<button type="button" class="od-tile wide" data-od-c="none"><b>日本語・English</b></button></div>' +
    '<button type="button" class="od-lang-close">とじる / Close</button></div>';
  m.addEventListener('click', function (e) {
    var t = e.target.closest('[data-od-c]');
    if (t) { setLang(t.getAttribute('data-od-c'), { user: true }); closePicker(); return; }
    if (e.target === m || e.target.classList.contains('od-lang-close')) closePicker();
  });
  document.body.appendChild(m);
  ui.modal = m;
  syncUi();
}
function syncUi() {
  if (ui.btn) ui.btn.innerHTML = '🌐 <span class="od-lang-name">' + (BY[lang] ? BY[lang].n : 'Language') + '</span>';
  [ui.strip, ui.modal].forEach(function (root) {
    if (!root) return;
    var all = root.querySelectorAll('[data-od-c]');
    for (var i = 0; i < all.length; i++) all[i].setAttribute('aria-pressed', String(all[i].getAttribute('data-od-c') === (lang || 'none')));
  });
}
function openPicker() { if (ui.modal) ui.modal.classList.add('on'); }
function closePicker() { if (ui.modal) ui.modal.classList.remove('on'); }
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePicker(); });

// ── はじめに ────────────────────────────────────────────────
function firstLang() {
  var q = qs('lang');
  if (q !== null) { var c = toCode(q); if (c === 'none') return { c: '', save: true }; if (c && available(c)) return { c: c, save: true }; }
  var s = ls(LS_LANG);
  if (s) return { c: (s !== 'none' && available(s)) ? s : '', save: false };
  var nl = navigator.languages || [navigator.language || ''];
  for (var i = 0; i < nl.length; i++) {
    var d = toCode(nl[i]);
    if (d === 'none') break;                        // 日本語・英語の端末は、今までどおり
    if (d && available(d)) return { c: d, save: false };
  }
  return { c: '', save: false };
}
function start() {
  var qb = qs('odbeta');
  if (qb === '1') lsSet(LS_BETA, '1'); else if (qb === '0') lsSet(LS_BETA, null);
  loadManifest().then(function () {
    buildUi();
    var f = firstLang();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    if (f.c) setLang(f.c, { save: f.save }); else { document.documentElement.setAttribute('data-od-lang', 'none'); }
  });
  // おしらせ：画面が GAS から受け取った返事を、ここでも受け取る（訳の辞書をつくるため）
  if (typeof window.fetchJsonWithRetry === 'function') {
    var origFetch = window.fetchJsonWithRetry;
    window.fetchJsonWithRetry = function (params) {
      var pr = origFetch.apply(this, arguments);
      if (params && params.action === 'news' && pr && pr.then) {
        return pr.then(function (j) { try { if (j && Array.isArray(j.news)) gotNews(j.news); } catch (e) {} return j; });
      }
      return pr;
    };
  }
  // ログインして本の一覧が出たら、言語タブを合わせ、言語を記録する
  if (typeof window.applyFilters === 'function') {
    var orig = window.applyFilters;
    window.applyFilters = function () {
      var r = orig.apply(this, arguments);
      try { if (lang) { syncTab(false); sendLang(); } } catch (e) {}
      return r;
    };
  }
}

window.OD_I18N = {
  version: VERSION,
  get lang() { return lang; },
  langs: LANGS,
  setLang: function (c) { return setLang(c, { user: true }); },
  open: openPicker,
  available: available,
  // 点検用：辞書にない英語の文の一覧
  misses: function () { return Object.keys(misses).sort(); },
  // 点検用：文を1つ訳してみる
  tr: function (s) { return trString(s); }
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
