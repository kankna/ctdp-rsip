/* 链与树 · CTDP × RSIP 自控工程台 —— 全部逻辑跑在本地，数据存 localStorage */
(function () {
  'use strict';

  /* ==================== 工具 ==================== */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dstr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function tsOf(dateStr) {
    var p = dateStr.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).getTime();
  }
  function daysBetween(a, b) { return Math.round((tsOf(b) - tsOf(a)) / 86400000); }
  function hhmm(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return pad(m) + ':' + pad(s);
  }
  function hhmmss(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }
  function clock(ts) {
    var d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }

  /* ==================== 状态 ==================== */
  var KEY = 'ctdp-rsip-v1';

  function blank() {
    return {
      v: 1, theme: 'dark', seat: '', mainChain: [], best: 0, aux: [], verdicts: [],
      session: null, auxSession: null, nodes: [], lastAdd: '', freeze: null, wins: {},
      pillars: [], pads: [], pillar: 0, shieldUsed: 0, scars: []
    };
  }
  var S = blank();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) S = Object.assign(blank(), JSON.parse(raw));
    } catch (e) { S = blank(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('本地存储写入失败，可能是浏览器隐私模式', 'bad'); }
  }

  /* ==================== 主题 ==================== */
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function applyTheme() {
    var t = S.theme || 'dark';
    var real = t === 'auto' ? ((mq && mq.matches) ? 'light' : 'dark') : t;
    document.documentElement.setAttribute('data-theme', real);
    $$('[data-theme-set]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-set') === t));
    });
    if (window.__redraw) window.__redraw();
  }
  $$('[data-theme-set]').forEach(function (b) {
    b.addEventListener('click', function () {
      S.theme = b.getAttribute('data-theme-set'); save(); applyTheme();
    });
  });
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (S.theme === 'auto') applyTheme(); });

  /* ==================== 提示与弹层 ==================== */
  function toast(msg, kind, ms) {
    var w = $('#toast-wrap');
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    w.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, (ms || 2000));
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, (ms || 2000) + 320);
  }

  var modalResolve = null;
  function modal(opts) {
    // opts: {title, body(html), actions:[{label, value, cls}]}
    return new Promise(function (resolve) {
      modalResolve = resolve;
      $('#modal-title').textContent = opts.title || '确认';
      $('#modal-body').innerHTML = opts.body || '';
      var acts = $('#modal-actions');
      acts.innerHTML = '';
      (opts.actions || []).forEach(function (a) {
        var b = document.createElement('button');
        b.className = 'btn ' + (a.cls || '');
        b.textContent = a.label;
        b.addEventListener('click', function () { closeModal(a.value); });
        acts.appendChild(b);
      });
      $('#modal-mask').classList.remove('hidden');
    });
  }
  function closeModal(v) {
    $('#modal-mask').classList.add('hidden');
    if (modalResolve) { modalResolve(v); modalResolve = null; }
  }
  $('#modal-mask').addEventListener('click', function (e) {
    if (e.target === $('#modal-mask')) closeModal(null);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('#modal-mask').classList.contains('hidden')) closeModal(null);
  });

  /* ==================== 解锁阶梯 ==================== */
  // 唯一的驱动轴是主链的历史最好成绩。台阶只上不下 —— 断链归零也不会把已开的格子收回去。
  var LEVELS = [
    { lv: 1, at: 0, name: '点火', hint: '神圣座位 · 主链 · 判决', why: '起点就给全一个闭环：锁定标志物、专注、完成后把节点记进链条。违规只有两个出口 —— 清零，或永久允许。' },
    { lv: 2, at: 1, name: '响指', hint: '辅助链 · 15 分钟预约', why: '主链跑通一次了，这时候才给你那个几乎零成本的启动信号：先只承诺十五分钟后开始。' },
    { lv: 3, at: 3, name: '国策树', hint: '第二代协议 · RSIP', why: '第一代跑通了，才轮到去改边界条件 —— 找到有效干预节点，把定式组织成一棵会自己修剪的树。' },
    { lv: 4, at: 6, name: '隔舱与复盘', hint: '水密隔舱 · 赢麻了', why: '链条长到怕断的时候，容错和复盘才有意义：只冻结受影响的隔舱，别让一次意外掀掉整棵树。' }
  ];

  function best() { return S.best || 0; }
  function unlocked() {
    var b = best(), lv = 1;
    LEVELS.forEach(function (L) { if (b >= L.at) lv = L.lv; });
    return lv;
  }
  function levelOf(n) { return LEVELS[n - 1] || LEVELS[0]; }

  /* ==================== 导航 ==================== */
  var PAGE_TITLES = {};
  function go(tab) {
    var tb = $('.tab[data-tab="' + tab + '"]');
    if (tb && tb.classList.contains('locked')) {
      var need = parseInt(tb.getAttribute('data-lv'), 10), L = levelOf(need);
      toast('还锁着 —— 主链撑到 #' + L.at + ' 才开「' + L.name + '」', 'warn', 2800);
      return;
    }
    $$('.tab').forEach(function (t) { t.classList.toggle('on', t.getAttribute('data-tab') === tab); });
    $$('.page').forEach(function (p) { p.classList.toggle('on', p.id === 'page-' + tab); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tab === 'model' && window.__drawChart) window.__drawChart();
  }
  $$('.tab').forEach(function (t) {
    t.addEventListener('click', function () { go(t.getAttribute('data-tab')); });
  });
  window.__go = go;

  /* ==================== 原理页：双曲贴现积分模型 ==================== */
  // 模型参数：经定性标定，使「短视到一定程度 -> 刷手机反超」这一结论能真的出现
  var M = {
    PLAY_A: 3.6, PLAY_T: 0.8,          // 刷手机：即时愉悦
    GUILT_A: 1.2, GUILT_T0: 2.5, GUILT_S: 1.5,  // 刷手机：滞后出现的愧疚
    SW_A: 4.0, SW_T: 0.22,             // 专注：切换成本 / 枯燥
    GAIN_A: 2.6, RISE: 0.9, FALL: 3.5  // 专注：渐起的正收益
  };
  function Vplay(t) {
    return M.PLAY_A * Math.exp(-t / M.PLAY_T)
      - M.GUILT_A * Math.exp(-Math.pow(t - M.GUILT_T0, 2) / (2 * M.GUILT_S * M.GUILT_S));
  }
  function Vstudy(t, pomo) {
    var base = -M.SW_A * Math.exp(-t / M.SW_T)
      + M.GAIN_A * (1 - Math.exp(-t / M.RISE)) * Math.exp(-t / M.FALL);
    if (!pomo) return base;
    // 番茄钟：把「中途放弃的沉没成本」非线性压缩到当下 —— 削平近端负值，换成一格之内必须撑住的即时约束
    return base + M.SW_A * Math.exp(-t / M.SW_T) - 1.4 * Math.exp(-t / 0.22) + 1.5 * Math.exp(-t / 0.5);
  }
  function Wf(t, k) { return 1 / (1 + k * t); }
  function integrate(f, k, tmax) {
    var dt = 0.01, s = 0;
    for (var t = 0; t < tmax; t += dt) {
      s += (f(t) * Wf(t, k) + f(t + dt) * Wf(t + dt, k)) / 2 * dt;
    }
    return s;
  }

  var sliderK = $('#k-slider'), sliderT = $('#tmax-slider'), pomoBox = $('#pomo-toggle');
  // 对数映射：滑到底 ≈ 完全理性，滑到顶 ≈ 极度短视
  sliderK.min = '-3.5'; sliderK.max = '2.1'; sliderK.step = '0.01'; sliderK.value = '1.16';
  function curK() { return Math.exp(parseFloat(sliderK.value)); }

  var lastModel = { play: 0, study: 0, k: 0 };

  function drawChart() {
    var cv = $('#chart');
    if (!cv || !cv.getBoundingClientRect().width) return;
    var dpr = window.devicePixelRatio || 1;
    var W0 = cv.clientWidth, H0 = 300;
    cv.width = Math.round(W0 * dpr); cv.height = Math.round(H0 * dpr);
    cv.style.height = H0 + 'px';
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W0, H0);

    var css = getComputedStyle(document.documentElement);
    var cLine = css.getPropertyValue('--line2').trim() || '#22262c';
    var cInk3 = css.getPropertyValue('--ink3').trim() || '#6e767f';
    var cPlay = css.getPropertyValue('--danger').trim() || '#c2604f';
    var cStudy = css.getPropertyValue('--ok').trim() || '#7fa86a';
    var cW = css.getPropertyValue('--ink3').trim() || '#6e767f';
    var cBrand = css.getPropertyValue('--brand').trim() || '#d8a45c';

    var k = curK(), tmax = parseFloat(sliderT.value);
    var pomo = pomoBox.checked;
    var padL = 34, padR = 12, padT = 14, padB = 24;
    var plotW = W0 - padL - padR, plotH = H0 - padT - padB;

    // 纵轴范围
    var minV = 0, maxV = 0;
    for (var t = 0; t <= tmax; t += 0.05) {
      minV = Math.min(minV, Vplay(t), Vstudy(t, pomo));
      maxV = Math.max(maxV, Vplay(t), Vstudy(t, pomo));
    }
    var pad = (maxV - minV) * 0.12 || 1;
    minV -= pad; maxV += pad;

    function X(t) { return padL + t / tmax * plotW; }
    function Y(v) { return padT + (maxV - v) / (maxV - minV) * plotH; }

    // 网格
    g.strokeStyle = cLine; g.lineWidth = 1;
    g.font = '10px ' + (css.getPropertyValue('--mono') || 'monospace');
    g.fillStyle = cInk3;
    for (var i = 0; i <= 4; i++) {
      var yy = padT + plotH * i / 4;
      g.beginPath(); g.moveTo(padL, yy); g.lineTo(W0 - padR, yy); g.stroke();
    }
    var stepT = tmax <= 6 ? 1 : (tmax <= 12 ? 2 : 4);
    for (var tt = 0; tt <= tmax; tt += stepT) {
      g.strokeStyle = cLine;
      g.beginPath(); g.moveTo(X(tt), padT); g.lineTo(X(tt), padT + plotH); g.stroke();
      g.fillStyle = cInk3; g.textAlign = 'center';
      g.fillText(tt + 'h', X(tt), H0 - 8);
    }

    // 权重曲线 W(τ)（缩放到画布内，示意用）
    var wmax = 1, wmin = Wf(tmax, k);
    g.strokeStyle = cW; g.globalAlpha = .55; g.lineWidth = 1.4;
    g.beginPath();
    for (var t2 = 0; t2 <= tmax; t2 += 0.05) {
      var frac = (Wf(t2, k) - wmin) / (wmax - wmin || 1);
      var yv = padT + plotH - frac * plotH * 0.9 - plotH * 0.05;
      t2 === 0 ? g.moveTo(X(t2), yv) : g.lineTo(X(t2), yv);
    }
    g.stroke(); g.globalAlpha = 1;

    // 零线
    if (minV < 0 && maxV > 0) {
      g.strokeStyle = cLine; g.lineWidth = 1.2; g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(padL, Y(0)); g.lineTo(W0 - padR, Y(0)); g.stroke();
      g.setLineDash([]);
    }

    function curve(f, color) {
      g.strokeStyle = color; g.lineWidth = 2.1; g.lineJoin = 'round';
      g.beginPath();
      for (var x = 0; x <= tmax; x += 0.03) {
        var v = f(x), px = X(x), py = Y(v);
        x === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
      }
      g.stroke();
      // 填充到零线
      g.save();
      g.globalAlpha = .07; g.fillStyle = color;
      g.lineTo(X(tmax), Y(0)); g.lineTo(X(0), Y(0)); g.closePath(); g.fill();
      g.restore();
    }
    curve(Vplay, cPlay);
    curve(function (t) { return Vstudy(t, pomo); }, cStudy);

    // 近端高权重区标记
    g.fillStyle = cBrand; g.globalAlpha = .10;
    g.fillRect(padL, padT, plotW * (tmax ? Math.min(0.18, 2 / tmax) : .1) * (plotW ? 1 : 1) * plotW / plotW, plotH);
    g.globalAlpha = 1;
    g.fillStyle = cBrand; g.font = '10px system-ui'; g.textAlign = 'left';
    g.fillText('W(τ) 最高的区段', padL + 6, padT + 12);

    lastModel = { play: integrate(Vplay, k, tmax), study: integrate(function (t) { return Vstudy(t, pomo); }, k, tmax), k: k };
  }

  function refreshModel() {
    var k = curK();
    $('#k-val').textContent = k.toFixed(2);
    $('#tmax-val').textContent = parseInt(sliderT.value, 10) + ' h';
    drawChart();
    var p = lastModel.play, s = lastModel.study;
    $('#ro-play').textContent = p.toFixed(3);
    $('#ro-study').textContent = s.toFixed(3);
    var d = s - p;
    $('#ro-ratio').textContent = (d >= 0 ? '+' : '') + d.toFixed(3);
    var v = $('#verdict');
    if (d > 0) {
      v.className = 'verdict win';
      v.innerHTML = '当前短视程度下，<b>专注的积分更高</b> —— 理性占上风。把 k 往右推，你会亲眼看着它翻过去。';
    } else {
      v.className = 'verdict lose';
      v.innerHTML = '这就是短视陷阱：<b>哪怕你完全清楚哪边是对的，积分结果仍然是刷手机更高</b>。这不是意志力问题，是 W(τ) 的形状问题。';
    }
  }
  window.__drawChart = drawChart;
  window.__redraw = function () { if ($('#page-model').classList.contains('on')) refreshModel(); };

  sliderK.addEventListener('input', refreshModel);
  sliderT.addEventListener('input', refreshModel);
  pomoBox.addEventListener('change', refreshModel);
  window.addEventListener('resize', function () {
    if ($('#page-model').classList.contains('on')) drawChart();
  });

  /* ---------- 增益对比 ---------- */
  var GAINS = [
    { name: '远期奖励', sub: '画大饼 / 完成后给自己奖励', band: [0.62, 1.0], gain: '×1.05', cls: 'down' },
    { name: '远期惩罚', sub: '玩手机后去跑步 / 写检讨', band: [0.62, 1.0], gain: '×1.05', cls: 'down' },
    { name: '励志口号', sub: '"Just do it"「你始终是有选择的」', band: [0, 1.0], gain: '×1.00', cls: 'down' },
    { name: '近期惩罚', sub: '锁手机 / 找人监督', band: [0, 0.14], gain: '×1.4', cls: 'up' },
    { name: '番茄钟', sub: '非线性压缩：把沉没成本打包到当下', band: [0, 0.30], gain: '×2.1', cls: 'up' },
    { name: 'CTDP', sub: '近端压缩 + 判例约束 + 时间平移', band: [0, 0.22], gain: '×3.2', cls: 'up' },
    { name: 'RSIP', sub: '不改单次 V(τ)，改的是边界条件', band: [0, 1.0], gain: '量级不同', cls: 'up' }
  ];
  function renderGains() {
    var box = $('#gain-list');
    box.innerHTML = GAINS.map(function (g) {
      var l = (g.band[0] * 100).toFixed(0), w = ((g.band[1] - g.band[0]) * 100).toFixed(0);
      var color = g.cls === 'up' ? 'var(--ok)' : 'var(--danger)';
      return '<div class="gain-item">' +
        '<div class="gname">' + esc(g.name) + '</div>' +
        '<div class="gtrack" style="background:linear-gradient(to right,color-mix(in srgb,var(--brand) 16%,var(--sunk)),var(--sunk))">' +
        '<div class="gbar" style="left:' + l + '%;width:' + Math.max(6, +w) + '%;background:' + color + '"></div>' +
        '<div class="glabel">' + esc(g.sub) + '</div>' +
        '</div>' +
        '<div class="gval ' + g.cls + '">' + esc(g.gain) + '</div>' +
        '</div>';
    }).join('');
  }

  /* ==================== 通用 ==================== */
  function logTo(sel, time, text, tag, danger) {
    var box = $(sel);
    if (!box) return;
    var el = document.createElement('div');
    el.className = 'log-item' + (danger ? ' danger' : '');
    el.innerHTML = '<b>' + esc(time) + '</b><span class="lt">' + esc(text) + '</span>'
      + (tag ? '<span class="tag">' + esc(tag) + '</span>' : '');
    box.insertBefore(el, box.firstChild);
    while (box.children.length > 40) box.removeChild(box.lastChild);
  }
  function emptyTo(box, text) {
    if (box && !box.children.length) box.innerHTML = '<div class="empty">' + esc(text) + '</div>';
  }

  /* ==================== 一、神圣座位 ==================== */
  function renderSeat() {
    $('#seat-input').value = S.seat || '';
    $('#seat-note').innerHTML = S.seat
      ? '当前标志物：<b>' + esc(S.seat) + '</b> —— 一旦触发，就必须以最好的状态完成一次专注。'
      : '还没有设定标志物。没有标志物，链条就没有锚点。';
  }
  $('#btn-save-seat').addEventListener('click', function () {
    var v = $('#seat-input').value.trim();
    if (!v) { toast('先写下一个具体的标志物', 'warn'); return; }
    var first = !S.seat;
    S.seat = v; save(); renderSeat();
    if (first) logTo('#main-log', clock(Date.now()), '标志物锁定：' + v, '座位');
    toast('标志物已锁定');
  });

  /* ==================== 二、主链 ==================== */
  function todayStr() { return dstr(); }
  function chainNodes() { return S.mainChain || (S.mainChain = []); }

  function renderChain() {
    var today = todayStr(), list = chainNodes();
    var todays = list.filter(function (n) { return dstr(new Date(n.t)) === today; }).length;
    $('#main-count').textContent = list.length;
    $('#stat-best').textContent = S.best || 0;
    $('#stat-today').textContent = todays;
    $('#stat-total').textContent = S.total || 0;
    renderPillar(); renderRelief(); renderShield(); renderMini();
  }

  /* ==================== 二·B、链柱（创世纪方块） ==================== */
  // 方块不是收藏品，是承重块。驱动力来自"会失去"，不是"能得到"。
  var SHOW_MAX = 60;      // 主视图永远只留当前这一段，更早的封成地层
  var PAD_MAX = 14;       // 垫块最多在柱底显示这么多层

  function curPillar() { return S.pillar || 0; }
  function pillarNodes(p) {
    if (p === curPillar()) return chainNodes();
    var hit = (S.pillars || []).filter(function (x) { return x.p === p; })[0];
    return hit ? (hit.blocks || []) : [];
  }
  function pillarPads(p) {
    return (S.pads || []).filter(function (x) { return (x.p || 0) === p; });
  }
  function tierOf(i) {
    return i >= 30 ? ' obsidian' : (i >= 7 ? ' deep' : '');
  }
  function daysOfChain() {
    var d = {};
    chainNodes().forEach(function (n) { d[dstr(new Date(n.t))] = 1; });
    return Object.keys(d).length;
  }
  // 护盾按"有落块的天数"攒，一天多块不加进度 —— 稀缺是为了让柱子有分量
  function shieldHave() { return Math.min(2, Math.floor(daysOfChain() / 7)); }
  function shieldAvail() { return Math.max(0, shieldHave() - (S.shieldUsed || 0)); }
  function scarAt(p, i) {
    return (S.scars || []).some(function (s) { return s.p === p && s.i === i; });
  }
  function minsOf(n) { return Math.max(1, Math.round((n.sec || (n.dur || 0) * 60) / 60)); }

  function renderPillar() {
    var box = $('#pillar');
    if (!box) return;
    var p = curPillar(), list = pillarNodes(p), pads = pillarPads(p);
    box.innerHTML = '';

    pads.slice(-PAD_MAX).forEach(function () {
      var d = document.createElement('div');
      d.className = 'blk pad';
      d.title = '辅助链的垫块 —— 响指换来的，不单独计数';
      box.appendChild(d);
    });

    if (!list.length) {
      for (var g = 0; g < 3; g++) {
        var gh = document.createElement('div');
        gh.className = 'blk ghost';
        box.appendChild(gh);
      }
    } else {
      var hide = Math.max(0, list.length - SHOW_MAX);
      if (hide > 0) {
        var st = document.createElement('div');
        st.className = 'blk stratum';
        st.title = '更早的 ' + hide + ' 块已封成地层 —— 想看得导出记录';
        box.appendChild(st);
      }
      list.forEach(function (n, i) {
        if (i < hide) return;
        var d = document.createElement('div');
        d.className = 'blk' + tierOf(i) + ((i + 1) % 10 === 0 ? ' tick' : '')
          + (scarAt(p, i) ? ' scar' : '');
        d.setAttribute('data-i', i);
        d.setAttribute('data-p', p);
        d.title = '第 ' + (i + 1) + ' 块 · ' + dstr(new Date(n.t))
          + (n.m ? ' · 「' + n.m + '」' : '');
        box.appendChild(d);
      });
      var top = box.lastChild;
      if (top && top.classList) top.classList.add('new');
    }
    renderStageNote(list.length, p);
  }

  function renderStageNote(len, p) {
    var note = $('#stage-note');
    if (!note) return;
    if (!len) {
      note.innerHTML = '柱子还没开始长。<b>第一块最重</b> —— 它证明这套东西能转起来。';
    } else if (len === 1) {
      note.innerHTML = '第 1 块落地了。<b>从现在起，你有的可以失去。</b>';
    } else if (shieldAvail() > 0) {
      note.innerHTML = '柱高 <b>' + len + '</b>。你手上还有护盾 —— 但那道裂会一直留着，别当成免死金牌。';
    } else {
      note.innerHTML = '柱高 <b>' + len + '</b>，越往上越不敢断。清零的时候方块不会消失 —— 它们会站进下面的遗迹里。';
    }
  }

  function renderRelief() {
    var box = $('#relief');
    if (!box) return;
    var ps = (S.pillars || []);
    if (!ps.length) {
      box.innerHTML = '<span class="none">还没有断过。这是你的第一根柱 —— 它现在还在长。</span>';
      return;
    }
    box.innerHTML = '';
    ps.slice(-16).forEach(function (x) {
      var h = Math.max(12, Math.min(88, (x.n || 0) * 7));
      var el = document.createElement('div');
      el.className = 'ruin';
      el.title = (x.at || '') + ' 断 · 当时高 ' + (x.n || 0) + ' 块 · ' + (x.reason || '');
      el.innerHTML = '<div class="col" style="height:' + h + 'px"></div>'
        + '<b>' + (x.n || 0) + '</b>'
        + '<span>' + esc(String(x.at || '').slice(5)) + '</span>';
      box.appendChild(el);
    });
  }

  function renderShield() {
    var el = $('#shield-slot');
    if (!el) return;
    var n = shieldAvail(), days = daysOfChain();
    if (n > 0) {
      var s = '', i;
      for (i = 0; i < n; i++) s += '◆ ';
      el.className = 'shield-on';
      el.innerHTML = '护盾 ' + s;
    } else {
      el.className = 'shield-off';
      el.innerHTML = days < 14
        ? '护盾 —（再连 ' + (7 - (days % 7)) + ' 天攒 1 层）'
        : '护盾 —（本柱已用尽）';
    }
  }

  function renderMini() {
    var box = $('#ov-mini');
    var cap = $('#ov-mini-cap'), rb = $('#ov-ruins'), rc = $('#ov-ruins-cap');
    if (box) {
      var list = pillarNodes(curPillar()), pads = pillarPads(curPillar());
      box.innerHTML = '';
      pads.slice(-8).forEach(function () {
        var d = document.createElement('div'); d.className = 'mini-blk pad'; box.appendChild(d);
      });
      var hide = Math.max(0, list.length - 40);
      list.forEach(function (n, i) {
        if (i < hide) return;
        var d = document.createElement('div');
        d.className = 'mini-blk' + tierOf(i) + ((i + 1) % 10 === 0 ? ' tick' : '');
        box.appendChild(d);
      });
      if (!list.length && !pads.length) box.innerHTML = '<div class="mini-blk"></div>';
      if (cap) cap.textContent = '当前柱 · ' + list.length + ' 块';
    }
    if (rb) {
      rb.innerHTML = '';
      var ps = (S.pillars || []).slice(-12);
      ps.forEach(function (x) {
        var d = document.createElement('div');
        d.className = 'mini-ruin';
        d.style.height = Math.max(8, Math.min(56, (x.n || 0) * 5)) + 'px';
        d.title = (x.at || '') + ' 断 · 高 ' + (x.n || 0);
        rb.appendChild(d);
      });
      if (!ps.length) rb.innerHTML = '<span class="mini-cap">—</span>';
      if (rc) rc.textContent = '遗迹 · ' + (S.pillars || []).length + ' 根断柱';
    }
  }

  /* 点一块看铭文 */
  document.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== document.body && !(t.className && String(t.className).indexOf('blk') === 0)) t = t.parentNode;
    if (!t || t === document.body) return;
    var si = t.getAttribute && t.getAttribute('data-i');
    if (si == null) return;
    var p = parseInt(t.getAttribute('data-p'), 10) || 0;
    var i = parseInt(si, 10);
    var n = pillarNodes(p)[i];
    if (!n) return;
    var box = $('#epitaph');
    if (!box) return;
    var last = (p === curPillar() && i === pillarNodes(p).length - 1);
    box.classList.remove('hidden');
    box.innerHTML = '<b>第 ' + (i + 1) + ' 块</b>'
      + (n.m ? ' · 铭文「' + esc(n.m) + '」' : ' · 还没有刻字')
      + '<br><span class="mono">' + dstr(new Date(n.t)) + ' ' + clock(n.t) + '</span>'
      + ' · ' + esc(n.unit || '未记兵种') + ' · ' + minsOf(n) + ' 分钟'
      + (scarAt(p, i) ? '<br><span style="color:var(--danger)">这一段是拿护盾换下来的 —— 那道裂永远留着。</span>' : '')
      + (last ? '<br><span class="void">这是柱顶那块。再落一块，它就不在最上面了。</span>' : '');
    var cr = $('#carve-row');
    if (cr) { carveIdx = i; $('#carve-input').value = n.m || ''; cr.classList.remove('hidden'); }
  });

  var carveIdx = -1;
  $('#btn-carve').addEventListener('click', function () {
    var v = ($('#carve-input').value || '').trim().slice(0, 4);
    var list = pillarNodes(curPillar());
    if (carveIdx < 0 || !list[carveIdx]) { toast('先落一块，再给它刻字', 'warn'); return; }
    list[carveIdx].m = v;
    save();
    $('#carve-row').classList.add('hidden');
    renderChain();
    toast(v ? '刻上了：「' + v + '」' : '没刻字 —— 这块只记日期。');
  });

  function renderSession() {
    var box = $('#session-box'), btn = $('#btn-start-session');
    if (S.session) {
      box.classList.remove('hidden');
      btn.classList.add('hidden');
      $('#session-hint').textContent = '专注中 · ' + S.session.unit + ' · 目标 ' + S.session.dur + ' 分钟';
    } else {
      box.classList.add('hidden');
      btn.classList.remove('hidden');
    }
  }

  function startSession() {
    if (S.session) return;
    if (!S.seat) {
      toast('先锁定标志物 —— 没有座位就没有触发点', 'warn');
      go('ctdp');
      $('#seat-input').focus();
      return;
    }
    var dur = parseInt($('#dur-select').value, 10);
    var unit = $('#unit-select').value;
    S.session = { start: Date.now(), dur: dur, unit: unit };
    save(); renderSession();
    logTo('#main-log', clock(Date.now()), '触发标志 · 开始 ' + dur + ' 分钟「' + unit + '」', '进行中');
    toast('链条已推进到最后一个节点，撑住这一格');
  }

  function endSession() {
    S.session = null;
    save(); renderSession();
  }

  $('#btn-start-session').addEventListener('click', startSession);

  $('#btn-finish').addEventListener('click', function () {
    if (!S.session) return;
    var sec = Math.floor((Date.now() - S.session.start) / 1000);
    var s = S.session;
    if (sec < 60) {
      modal({
        title: '这一格太短了',
        body: '<p>刚过了 ' + sec + ' 秒。神圣座位要的是「以最好的状态完成一次专注」，不是坐一下就记一个节点。</p>'
          + '<p class="warnbox">要么接着坐满，要么按<b>下必为例</b>当场判决：清零，或永久允许。</p>',
        actions: [{ label: '接着坐', value: null, cls: 'ghost' }, { label: '去判决', value: 'judge', cls: 'danger-ghost' }]
      }).then(function (v) { if (v === 'judge') violate(); });
      return;
    }
    var before = unlocked();
    var todaysBefore = chainNodes().filter(function (n) {
      return dstr(new Date(n.t)) === todayStr();
    }).length;
    chainNodes().push({ t: Date.now(), unit: s.unit, dur: s.dur, sec: sec, p: curPillar(), m: '' });
    S.total = (S.total || 0) + 1;
    if (chainNodes().length > (S.best || 0)) S.best = chainNodes().length;
    endSession();
    renderChain(); renderLadder();
    logTo('#main-log', clock(Date.now()), '最好的状态 · 完成 ' + hhmm(s.sec) + '（' + s.unit + '）', '#' + chainNodes().length);
    carveIdx = chainNodes().length - 1;
    $('#carve-input').value = '';
    $('#carve-row').classList.remove('hidden');
    var after = unlocked();
    if (after > before) celebrate(after);
    else if (todaysBefore > 0) toast('第 ' + chainNodes().length + ' 块落地。今天已经落过了 —— 它不加护盾进度。', 'warn', 2600);
    else toast('第 ' + chainNodes().length + ' 块落地 —— 顺手给它刻两个字');
  });

  $('#btn-violate').addEventListener('click', function () { violate(); });

  /* 下必为例：违规只有两个出口 */
  function violate() {
    var list = chainNodes();
    if (!list.length && !S.session) { toast('链条还是空的，先攒几个节点', 'warn'); return; }
    var sh = shieldAvail();
    var acts = [
      { label: '整条链清零', value: 'reset', cls: 'danger-ghost' },
      { label: '永久允许该行为', value: 'allow', cls: 'stretch' },
      { label: '先不判决，回去坐着', value: null, cls: 'ghost' }
    ];
    if (sh > 0) acts.splice(1, 0, { label: '用掉一层护盾 · 保住这根柱', value: 'shield', cls: 'ok' });
    modal({
      title: '下必为例 · 违规判决',
      body: '<p>规则里没有「这次算了」这一项。你现在必须做个了断，并接受它的后果：</p>'
        + '<p><b>整条链清零</b> —— 当前 ' + list.length + ' 块归零。但方块不消失，它们会变成一根断柱，'
        + '站进遗迹里，刻着今天的日期和高度。新柱从第 1 块重开。</p>'
        + (sh > 0 ? '<p><b>用掉一层护盾</b> —— 柱保住了，但那一段会永久封一道红封条。'
          + '护盾一共只有 ' + sh + ' 层，用一层少一层。这是储君继承制，不是免死金牌。</p>' : '')
        + '<p><b>永久允许该行为</b> —— 链条不清零，但这一类行为从此被正式划出规则之外。'
        + '它会进判例簿，如实降低链条的约束力。</p>'
        + '<div class="warnbox">' + (sh > 0 ? '三个出口都不舒服' : '两个出口都不舒服')
        + '，这就是这个协议的全部设计。</div>',
      actions: acts
    }).then(function (v) {
      if (v === 'reset') {
        resetChain();
      } else if (v === 'shield') {
        var idx = chainNodes().length - 1;
        S.scars = S.scars || [];
        S.scars.push({
          p: curPillar(), i: idx, at: todayStr(),
          why: (S.session ? S.session.unit : '中断')
        });
        S.shieldUsed = (S.shieldUsed || 0) + 1;
        S.session = null;
        save(); renderChain(); renderSession();
        logTo('#main-log', clock(Date.now()),
          '用掉一层护盾 —— 柱保住了，第 ' + (idx + 1) + ' 块封了一道裂', '护盾', true);
        toast('护盾碎了。柱子还在，那道裂会一直留着。', 'warn', 3000);
      } else if (v === 'allow') {
        var what = S.session ? S.session.unit : '这次中断';
        S.verdicts = S.verdicts || [];
        S.verdicts.push({ t: Date.now(), kind: 'allow', what: what });
        // 永久允许 -> 该行为被划出规则，链条约束力下降一档
        S.allowance = (S.allowance || 0) + 1;
        S.session = null;
        save(); renderChain(); renderSession(); renderVerdicts();
        logTo('#main-log', clock(Date.now()), '判决：永久允许「' + what + '」', '判例', true);
        toast('已记入判例簿，约束力下调一档', 'bad');
      }
    });
  }

  /* 清零：封柱，不删块。断柱永存，新柱另起。 */
  function resetChain() {
    var list = chainNodes(), n = list.length;
    if (n > 0) {
      S.pillars = S.pillars || [];
      S.pillars.push({
        p: curPillar(), n: n, at: todayStr(),
        reason: '下必为例 · 清零', blocks: list.slice()
      });
      S.mainChain = [];
      S.pillar = curPillar() + 1;
      S.shieldUsed = 0;
      S.session = null;
      save();
      $('#carve-row').classList.add('hidden');
      $('#epitaph').classList.add('hidden');
      renderChain(); renderSession();
      logTo('#main-log', clock(Date.now()),
        '判决：整条链清零 —— ' + n + ' 块封存为第 ' + curPillar() + ' 根断柱', '清零', true);
      toast('柱断了。方块没消失，它们在下面的遗迹里。新柱从第 1 块重开。', 'warn', 3600);
    } else {
      S.session = null;
      save(); renderChain(); renderSession();
      toast('链条本来就是空的 —— 但这次违规记下了。');
    }
  }

  /* ==================== 四、判例簿 ==================== */
  function renderVerdicts() {
    var box = $('#verdict-log');
    box.innerHTML = '';
    (S.verdicts || []).slice().reverse().forEach(function (v) {
      var el = document.createElement('div');
      el.className = 'log-item danger';
      el.innerHTML = '<b>' + esc(dstr(new Date(v.t))) + '</b>'
        + '<span class="lt">' + esc(v.kind === 'allow' ? '永久允许：' + v.what : '递归熄灭：' + v.what) + '</span>'
        + '<span class="tag">' + esc(v.kind === 'allow' ? '豁免' : '熄灭') + '</span>';
      box.appendChild(el);
    });
    emptyTo(box, '还没有判例。这意味着你至今没有开过任何一个后门。');
  }

  /* ==================== 三、辅助链（预约 15 分钟） ==================== */
  var AUX_MIN = 15;
  function renderAux() {
    var list = S.aux || (S.aux = []);
    $('#aux-count').textContent = list.filter(function (a) { return a.ok; }).length;
    var box = $('#aux-box'), btn = $('#btn-aux');
    if (S.auxSession) { box.classList.remove('hidden'); btn.classList.add('hidden'); }
    else { box.classList.add('hidden'); btn.classList.remove('hidden'); }
  }
  function snap() {
    if (S.auxSession) return;
    S.auxSession = { start: Date.now(), until: Date.now() + AUX_MIN * 60000 };
    save(); renderAux();
    logTo('#aux-log', clock(Date.now()), '打响指 · 预约 ' + AUX_MIN + ' 分钟后开始', '生效中');
    toast('信号已发出。这 15 分钟里你要做的就是坐到座位上。');
  }
  function auxDone() {
    if (!S.auxSession) return;
    S.aux = S.aux || [];
    S.aux.push({ t: Date.now(), ok: true, sec: Math.floor((Date.now() - S.auxSession.start) / 1000) });
    S.pads = S.pads || [];
    S.pads.push({ t: Date.now(), p: curPillar() });
    S.auxSession = null;
    save(); renderAux(); renderChain();
    logTo('#aux-log', clock(Date.now()), '已触发标志 —— 现在去开主链', '成功');
    toast('辅助链走通，柱底垫了一块。接着点「触发标志 · 开始一次专注」。');
  }
  function auxFail(auto) {
    if (!S.auxSession) return;
    var spent = Math.floor((Date.now() - S.auxSession.start) / 1000);
    S.aux = S.aux || [];
    S.aux.push({ t: Date.now(), ok: false, sec: spent });
    S.auxSession = null;
    save(); renderAux();
    logTo('#aux-log', clock(Date.now()), (auto ? '超时未触发标志' : '主动放弃预约') + '（' + hhmm(spent) + '）', '断链', true);
    toast(auto ? '15 分钟到了，这次预约没兑现' : '预约已作废', 'bad');
  }
  $('#btn-aux').addEventListener('click', snap);
  $('#btn-aux-done').addEventListener('click', auxDone);
  $('#btn-aux-fail').addEventListener('click', function () { auxFail(false); });

  /* ==================== 五、国策库 ==================== */
  var LIB = [
    { name: '在家吃完饭后必须尽快洗碗', lever: '掐断拖延窗口',
      desc: '把「待会儿再洗」这个决策点直接删掉。餐桌区不会积累成一座山，也不会在深夜变成压在胸口的事。' },
    { name: '进门先换鞋', lever: '单一动作替换',
      desc: '门槛处一个不需要判断的动作，把「外面」和「家里」两种状态干脆地分开。' },
    { name: '睡前把手机放到客厅充电', lever: '改边界条件',
      desc: '不跟「再刷五分钟」的意志力较劲，直接让手机不在伸手可及的范围内。' },
    { name: '起床后立刻叠被子', lever: '首胜效应',
      desc: '一天的第一个动作是「完成」，而不是「再躺一会儿」。' },
    { name: '书桌上只留当前任务要用的东西', lever: '降低切换成本',
      desc: '视野里每多一件杂物，就多一个把你拽走的入口。' },
    { name: '想刷手机前先站起来喝一杯水', lever: '插入缓冲',
      desc: '在冲动和动作之间塞进三十秒，让近端权重最高的那一瞬过去。' },
    { name: '每天刷短视频不超过 40 分钟', lever: '设上限而非戒断',
      desc: '完全禁止的规则活不长；有额度、可计数的规则才守得住。' },
    { name: '【赢麻了】睡前记三条喜报', lever: '重构体感',
      desc: '把「我今天什么都没做成」这种失真的体感，用确实发生过的事顶回去。' }
  ];

  function findNode(id) {
    var ns = S.nodes || [];
    for (var i = 0; i < ns.length; i++) if (ns[i].id === id) return ns[i];
    return null;
  }
  function kidsOf(id) { return (S.nodes || []).filter(function (n) { return n.parent === id; }); }
  function rootsOf() { return (S.nodes || []).filter(function (n) { return !n.parent; }); }
  function subtree(id) {
    var out = [], stack = [id];
    while (stack.length) {
      var cur = stack.pop();
      var n = findNode(cur);
      if (!n) continue;
      out.push(n);
      kidsOf(cur).forEach(function (c) { stack.push(c.id); });
    }
    return out;
  }
  function canAdd() { return S.lastAdd !== todayStr(); }

  function addNode(name, desc, lever, parent) {
    if (!canAdd()) {
      toast('今天已经种过一条了 —— 每天最多加一个，规则要活得久，不是种得多', 'warn');
      return false;
    }
    if (!name) { toast('先给它起个名字', 'warn'); return false; }
    S.nodes = S.nodes || [];
    S.nodes.push({
      id: uid(), name: name, desc: desc || '', lever: lever || '自定义',
      parent: parent || '', state: 'live', streak: 0, last: '', born: todayStr()
    });
    S.lastAdd = todayStr();
    save(); renderLib(); renderTree(); renderTreeMeta(); renderParents();
    logTo('#main-log', clock(Date.now()), '种下国策：' + name, '节点');
    toast('已种下：「' + name + '」');
    return true;
  }

  function renderTreeMeta() {
    var el = $('#add-status');
    if (canAdd()) { el.className = 'pill'; el.textContent = '今日可添加：1 条'; }
    else { el.className = 'pill warn'; el.textContent = '今天已种下一条 · 明日再来'; }
  }

  function renderParents() {
    var sel = $('#parent-select');
    var cur = sel.value;
    sel.innerHTML = '<option value="">挂到：新建一个根分支</option>';
    (S.nodes || []).forEach(function (n) {
      if (n.state === 'off') return;
      var o = document.createElement('option');
      o.value = n.id;
      o.textContent = '挂到：' + n.name;
      sel.appendChild(o);
    });
    if (cur && findNode(cur)) sel.value = cur;
  }

  function renderLib() {
    var box = $('#doctrine-lib');
    box.innerHTML = '';
    LIB.forEach(function (d) {
      var used = (S.nodes || []).some(function (n) { return n.name === d.name; });
      var el = document.createElement('div');
      el.className = 'dcard' + (used ? ' used' : '');
      el.innerHTML = '<h4>' + esc(d.name) + '</h4>'
        + '<p>' + esc(d.desc) + '</p>'
        + '<span class="lever">杠杆 · ' + esc(d.lever) + '</span>'
        + '<button class="btn' + (used ? '' : ' primary') + '"' + (used ? ' disabled' : '') + '>'
        + (used ? '已种下' : '种下') + '</button>';
      el.querySelector('button').addEventListener('click', function () { addNode(d.name, d.desc, d.lever, ''); });
      box.appendChild(el);
    });
  }

  /* ==================== 六、国策树 ==================== */
  function renderTree() {
    var box = $('#tree');
    box.innerHTML = '';
    var rs = rootsOf();
    if (!rs.length) {
      box.innerHTML = '<div class="empty">树还是空的。从上面挑一条最没难度的定式种下去 —— 越容易活下来，它越会往根部长。</div>';
      return;
    }
    rs.forEach(function (n) { box.appendChild(nodeWrap(n)); });
  }

  function nodeWrap(n) {
    var wrap = document.createElement('div');
    wrap.className = 'tnode';
    wrap.appendChild(cardFor(n));
    kidsOf(n.id).forEach(function (c) { wrap.appendChild(nodeWrap(c)); });
    return wrap;
  }

  function cardFor(n) {
    var today = todayStr();
    var off = n.state === 'off';
    var frozen = isFrozen(n.id);
    var done = n.last === today && !off;
    var root = !n.parent;

    var d = document.createElement('div');
    d.className = 'tcard' + (root ? ' root' : '') + (frozen ? ' frozen' : '') + (done ? ' done' : '');
    if (off) d.style.opacity = '.45';

    var badges = '';
    if (root) badges += '<span class="badge root">根</span>';
    if (frozen) badges += '<span class="badge frozen">冻结中</span>';
    if (off) badges += '<span class="badge">已熄灭</span>';
    else if (n.streak) badges += '<span class="badge">连续 ' + n.streak + ' 天</span>';

    var prog = 0;
    if (!off && n.streak) prog = Math.min(100, n.streak / 7 * 100);

    d.innerHTML = '<div class="tmain">'
      + '<div class="ttitle">' + esc(n.name) + badges + '</div>'
      + '<div class="tsub">' + esc(n.desc || ('杠杆 · ' + n.lever)) + '</div>'
      + (prog ? '<div class="iprog"><i style="width:' + prog + '%"></i></div>' : '')
      + '</div>'
      + '<div class="tacts"></div>';

    var acts = d.querySelector('.tacts');
    if (!off) {
      acts.appendChild(mini('✓', done ? '今天已完成' : '今天打卡', done ? 'on' : '', function () { checkIn(n.id); }));
      acts.appendChild(mini('×', '这条破了 → 递归熄灭子树', 'x', function () { failNode(n.id); }));
    }
    acts.appendChild(mini('⌫', '从树上移除这一条', 'x', function () { removeNode(n.id); }));
    return d;
  }

  function mini(label, title, cls, fn) {
    var b = document.createElement('button');
    b.className = 'mini' + (cls ? ' ' + cls : '');
    b.title = title;
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  function checkIn(id) {
    var n = findNode(id);
    if (!n || n.state === 'off') return;
    var today = todayStr();
    if (n.last === today) { toast('今天已经打过了', 'warn'); return; }
    n.streak = (n.last && daysBetween(n.last, today) === 1) ? (n.streak || 0) + 1 : 1;
    n.last = today;
    save(); renderTree();
    toast('「' + n.name + '」连续 ' + n.streak + ' 天');
  }

  function removeNode(id) {
    var n = findNode(id);
    if (!n) return;
    var sub = subtree(id);
    modal({
      title: '移除节点',
      body: '<p>要把「' + esc(n.name) + '」从树上摘掉吗？</p>'
        + (sub.length > 1 ? '<p>它下面还有 ' + (sub.length - 1) + ' 条子国策，会一起消失。</p>' : ''),
      actions: [{ label: '移除', value: 'yes', cls: 'danger-ghost' }, { label: '算了', value: null, cls: 'ghost' }]
    }).then(function (v) {
      if (v !== 'yes') return;
      var ids = sub.map(function (x) { return x.id; });
      S.nodes = (S.nodes || []).filter(function (x) { return ids.indexOf(x.id) < 0; });
      if (S.freeze) S.freeze.ids = (S.freeze.ids || []).filter(function (x) { return ids.indexOf(x) < 0; });
      save(); renderTree(); renderLib(); renderTreeMeta(); renderParents(); renderFreeze();
      toast('已移除');
    });
  }

  function failNode(id) {
    var n = findNode(id);
    if (!n || n.state === 'off') return;
    var sub = subtree(id);
    modal({
      title: '递归熄灭',
      body: '<p>你判定「' + esc(n.name) + '」没能守住。</p>'
        + '<p>按递归回溯规则，它<b>整棵子树</b>一起熄灭 —— 这次要作废 ' + sub.length + ' 条：</p>'
        + '<p style="font-size:13px;color:var(--ink3)">' + sub.map(function (x) { return '· ' + esc(x.name); }).join('<br>') + '</p>'
        + '<div class="warnbox">熄灭不是惩罚，是调试。这一格的设计有问题，删掉它比硬撑更科学 —— 系统整体回滚，明天从更靠根部的地方重新长。</div>',
      actions: [
        { label: '确认熄灭这 ' + sub.length + ' 条', value: 'yes', cls: 'danger-ghost' },
        { label: '再撑一天', value: null, cls: 'ghost' }
      ]
    }).then(function (v) {
      if (v !== 'yes') return;
      sub.forEach(function (x) { x.state = 'off'; x.offAt = todayStr(); });
      S.verdicts = S.verdicts || [];
      S.verdicts.push({ t: Date.now(), kind: 'extinguish', what: n.name + '（' + sub.length + ' 条）' });
      save(); renderTree(); renderVerdicts();
      toast('已熄灭 ' + sub.length + ' 条国策', 'bad');
    });
  }

  /* ==================== 七、水密隔舱 ==================== */
  function freezeActive() { return !!(S.freeze && !S.freeze.settled); }
  function isFrozen(id) { return !!(freezeActive() && (S.freeze.ids || []).indexOf(id) >= 0); }

  function renderFreeze() {
    var st = $('#freeze-status'), pick = $('#freeze-picker'), endBtn = $('#btn-freeze-end');
    var f = S.freeze, live = (S.nodes || []).filter(function (n) { return n.state !== 'off'; });

    if (freezeActive()) {
      var expired = f.until < todayStr();
      st.className = 'pill frozen';
      st.textContent = expired ? ('已到期 · ' + f.until + ' · 待结算') : ('冻结中 · 至 ' + f.until);
      endBtn.classList.remove('hidden');
    } else {
      st.className = 'pill';
      st.textContent = '未启用';
      endBtn.classList.add('hidden');
    }

    pick.innerHTML = '';
    if (freezeActive()) {
      (f.ids || []).forEach(function (id) {
        var n = findNode(id);
        if (!n) return;
        var lab = document.createElement('label');
        lab.className = 'frozen-tag';
        lab.textContent = n.name;
        pick.appendChild(lab);
      });
      return;
    }
    if (!live.length) {
      pick.innerHTML = '<span class="hint">树里还没有节点，没什么可冻结的。</span>';
      return;
    }
    live.forEach(function (n) {
      var lab = document.createElement('label');
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = n.id;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(n.name));
      pick.appendChild(lab);
    });
  }

  $('#btn-freeze-start').addEventListener('click', function () {
    if (freezeActive()) { toast('已经在冻结中，先结算上一次', 'warn'); return; }
    var until = $('#freeze-until').value;
    if (!until) { toast('先选一个解冻日期', 'warn'); return; }
    if (until <= todayStr()) { toast('解冻日期要排在今天之后', 'warn'); return; }
    var ids = $$('#freeze-picker input[type=checkbox]').filter(function (c) { return c.checked; })
      .map(function (c) { return c.value; });
    if (!ids.length) { toast('至少勾一条要冻结的国策', 'warn'); return; }
    S.freeze = { until: until, ids: ids, start: todayStr(), settled: false, notified: false };
    save(); renderFreeze(); renderTree();
    logTo('#main-log', clock(Date.now()), '申请水密隔舱冻结 ' + ids.length + ' 条，至 ' + until, '冻结');
    toast('已冻结 ' + ids.length + ' 条。到期当天要一次性重新满足。');
  });

  $('#btn-freeze-end').addEventListener('click', function () { settleFreeze(); });

  function settleFreeze(auto) {
    var f = S.freeze;
    if (!f || f.settled) return;
    var names = (f.ids || []).map(function (id) { var n = findNode(id); return n ? n.name : ''; })
      .filter(function (x) { return x; });
    modal({
      title: '水密隔舱 · 解冻结算',
      body: '<p>' + names.length + ' 条国策被冻结到 <b>' + esc(f.until) + '</b>。'
        + '按规则，解冻当天必须<b>一次性重新满足</b>它们，否则照常熄灭。</p>'
        + '<p style="font-size:13px;color:var(--ink3)">' + names.map(function (x) { return '· ' + esc(x); }).join('<br>') + '</p>'
        + (auto ? '<div class="warnbox">冻结期已经结束，这个结算不能再拖了。</div>' : ''),
      actions: [
        { label: '今天全部重新满足了', value: 'ok', cls: 'ok' },
        { label: '没做到 · 照规则熄灭', value: 'kill', cls: 'danger-ghost' }
      ]
    }).then(function (v) {
      if (!v) return;
      if (v === 'ok') {
        f.settled = true;
        (f.ids || []).forEach(function (id) {
          var n = findNode(id);
          if (n && n.state !== 'off') { n.last = todayStr(); n.streak = (n.streak || 0) + 1; }
        });
        logTo('#main-log', clock(Date.now()), '解冻结算：' + (f.ids || []).length + ' 条全部重新满足', '恢复');
        toast('隔舱已解冻，节点全部恢复');
      } else {
        (f.ids || []).forEach(function (id) { var n = findNode(id); if (n) n.state = 'off'; });
        f.settled = true;
        S.verdicts = S.verdicts || [];
        S.verdicts.push({ t: Date.now(), kind: 'extinguish', what: '解冻未履行（' + names.length + ' 条）' });
        logTo('#main-log', clock(Date.now()), '解冻结算：未重新满足，' + names.length + ' 条熄灭', '熄灭', true);
        toast('冻结期没能兑现，相关国策已熄灭', 'bad');
      }
      save(); renderFreeze(); renderTree(); renderVerdicts();
    });
  }

  /* 自定义国策 */
  $('#btn-custom-add').addEventListener('click', function () {
    var name = $('#custom-name').value.trim();
    var desc = $('#custom-desc').value.trim();
    var parent = $('#parent-select').value;
    if (addNode(name, desc, '自定义', parent)) {
      $('#custom-name').value = '';
      $('#custom-desc').value = '';
    }
  });

  /* ==================== 八、赢麻了 ==================== */
  function todayWins() {
    S.wins = S.wins || {};
    var d = todayStr();
    if (!S.wins[d] || typeof S.wins[d] !== 'object') S.wins[d] = { items: [], title: '', level: '' };
    if (!S.wins[d].items) S.wins[d].items = [];
    return S.wins[d];
  }

  function renderWins() {
    var d = todayStr(), w = todayWins();
    $('#wins-date').textContent = '今天 ' + d + ' · 用最大的那条给这一天命名';
    $('#wins-count').textContent = w.items.length + ' 条';

    var box = $('#win-list');
    box.innerHTML = '';
    w.items.slice().reverse().forEach(function (it) {
      var el = document.createElement('div');
      el.className = 'log-item';
      el.innerHTML = '<b>' + esc(it.k || '') + '</b><span class="lt">' + esc(it.text) + '</span>';
      var del = document.createElement('button');
      del.className = 'mini x';
      del.title = '删掉这条';
      del.textContent = '⌫';
      del.addEventListener('click', function () {
        w.items = w.items.filter(function (x) { return x !== it; });
        save(); renderWins();
      });
      el.appendChild(del);
      box.appendChild(el);
    });
    emptyTo(box, '还没记。哪怕只是「把碗洗了」，也写下来 —— 它确实发生过。');

    $('#win-title').value = w.title || '';
    $$('#level-row .btn.level').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-level') === w.level);
    });
    renderHistory();
  }

  function renderHistory() {
    var box = $('#win-history');
    box.innerHTML = '';
    var days = Object.keys(S.wins || {}).filter(function (d) {
      var w = S.wins[d];
      return w && (w.title || w.level || (w.items && w.items.length));
    }).sort().reverse();
    if (!days.length) { box.innerHTML = '<div class="empty">还没有战报。今天先记一条。</div>'; return; }
    days.slice(0, 40).forEach(function (d) {
      var w = S.wins[d];
      var el = document.createElement('div');
      el.className = 'log-item';
      el.innerHTML = '<b>' + esc(d) + '</b>'
        + '<span class="lt">' + esc(w.title || (w.items && w.items[0] ? w.items[0].text : '—')) + '</span>'
        + (w.level ? '<span class="tag">' + esc(w.level) + '</span>' : '')
        + '<span class="tag">' + ((w.items || []).length) + ' 条</span>';
      box.appendChild(el);
    });
  }

  $('#btn-win-add').addEventListener('click', function () {
    var v = $('#win-input').value.trim();
    if (!v) { toast('写一条再记', 'warn'); return; }
    var w = todayWins();
    w.items.push({ text: v, k: clock(Date.now()), t: Date.now() });
    $('#win-input').value = '';
    save(); renderWins();
    toast('喜报 +1');
  });
  $('#win-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('#btn-win-add').click();
  });

  $$('#level-row .btn.level').forEach(function (b) {
    b.addEventListener('click', function () {
      var w = todayWins();
      var lv = b.getAttribute('data-level');
      w.level = (w.level === lv) ? '' : lv;
      save(); renderWins();
    });
  });

  $('#win-title').addEventListener('change', function () {
    var w = todayWins();
    if (w.title) { toast('这一天已经命名过了 —— 命名是判例，不是备忘录', 'warn'); renderWins(); return; }
    var v = $('#win-title').value.trim();
    if (!v) return;
    w.title = v;
    save(); renderHistory();
    toast('今天叫：' + v);
  });

  /* ==================== 九、概览与备份 ==================== */
  function renderOverview() {
    $('#ov-nodes').textContent = (S.nodes || []).length;
    $('#ov-chain').textContent = S.total || 0;
    var days = {};
    function mark(t) { if (t) days[dstr(new Date(t))] = 1; }
    (S.mainChain || []).forEach(function (n) { mark(n.t); });
    (S.aux || []).forEach(function (n) { mark(n.t); });
    (S.nodes || []).forEach(function (n) { if (n.last) days[n.last] = 1; });
    Object.keys(S.wins || {}).forEach(function (d) {
      var w = S.wins[d];
      if (w && ((w.items && w.items.length) || w.title || w.level)) days[d] = 1;
    });
    $('#ov-days').textContent = Object.keys(days).length;
  }

  $('#btn-export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'ctdp-rsip-' + todayStr() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    toast('已导出：ctdp-rsip-' + todayStr() + '.json');
  });

  $('#btn-import').addEventListener('click', function () { $('#import-file').click(); });

  $('#import-file').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var data;
      try { data = JSON.parse(r.result); } catch (err) { toast('这个文件不是本站导出的 JSON', 'bad'); return; }
      if (!data || typeof data !== 'object') { toast('文件内容对不上', 'bad'); return; }
      modal({
        title: '导入记录',
        body: '<p>导入会<b>覆盖这台设备上现有的全部记录</b>，包括链条、判例、国策树和战报。</p>'
          + '<p>导出的文件里有 ' + ((data.nodes || []).length) + ' 条国策、'
          + ((data.mainChain || []).length) + ' 个当前链节点。</p>'
          + '<div class="warnbox">覆盖之后旧记录找不回来。要先把现在这份导出留底吗？</div>',
        actions: [
          { label: '确认覆盖', value: 'yes', cls: 'danger-ghost' },
          { label: '取消', value: null, cls: 'ghost' }
        ]
      }).then(function (v) {
        if (v !== 'yes') return;
        S = Object.assign(blank(), data);
        save(); applyTheme(); renderAll();
        toast('已导入记录');
      });
    };
    r.readAsText(f);
    e.target.value = '';
  });

  $('#btn-wipe').addEventListener('click', function () {
    modal({
      title: '清空全部记录',
      body: '<p>链条、判例、国策树、战报会<b>全部清空</b>，回到刚打开这个页面的状态。</p>'
        + '<div class="warnbox">清空之后这台设备上就找不回来了。要留底的话先点「导出记录」。</div>',
      actions: [
        { label: '确认清空', value: 'yes', cls: 'danger-ghost' },
        { label: '取消', value: null, cls: 'ghost' }
      ]
    }).then(function (v) {
      if (v !== 'yes') return;
      var keep = { v: 1, theme: S.theme };
      S = Object.assign(blank(), keep);
      save(); renderAll();
      toast('已清空');
    });
  });

  /* ==================== 十、心跳 ==================== */
  function tick() {
    var now = Date.now();

    if (S.session) {
      var used = Math.floor((now - S.session.start) / 1000);
      $('#session-timer').textContent = hhmmss(used);
      var left = S.session.dur * 60 - used;
      if (left > 0) {
        $('#session-hint').textContent = '专注中 · ' + S.session.unit
          + ' · 还差 ' + hhmm(Math.max(0, left)) + ' 到 ' + S.session.dur + ' 分钟';
      } else if (!S.session.over) {
        S.session.over = true; save();
        $('#session-hint').textContent = '已经坐满 ' + S.session.dur + ' 分钟 —— 可以点「完成」记节点了。';
        toast('时间到：这一格已经撑满', 'warn');
      }
    }

    if (S.auxSession) {
      var rest = Math.max(0, Math.floor((S.auxSession.until - now) / 1000));
      $('#aux-timer').textContent = hhmm(rest);
      if (rest <= 0) auxFail(true);
    }

    if (freezeActive() && S.freeze.until < todayStr() && !S.freeze.notified) {
      S.freeze.notified = true;
      save(); renderFreeze(); renderTree();
      settleFreeze(true);
    }
  }

  /* ==================== 解锁：阶梯与上锁 ==================== */
  function renderLadder() {
    var box = $('#ladder');
    if (!box) return;
    var b = best(), lv = unlocked();
    box.innerHTML = '';
    LEVELS.forEach(function (L) {
      var on = lv >= L.lv, cur = (L.lv === lv + 1);
      var el = document.createElement('div');
      el.className = 'step' + (on ? ' on' : '') + (cur ? ' cur' : '');
      el.innerHTML = '<span class="sn">' + L.lv + '</span>'
        + '<b class="sm">' + esc(L.name) + '</b>'
        + '<span class="sh">' + esc(L.hint) + '</span>'
        + '<span class="sq">' + (on
          ? '已开启'
          : (L.at <= 0 ? '' : '还差 #' + Math.max(0, L.at - b) + '（需 #' + L.at + '）')) + '</span>';
      box.appendChild(el);
    });
  }

  function applyLocks() {
    var lv = unlocked();
    Array.prototype.slice.call(document.querySelectorAll('[data-lv]')).forEach(function (el) {
      var need = parseInt(el.getAttribute('data-lv'), 10);
      if (!need) return;
      var ok = lv >= need, isTab = el.classList.contains('tab');
      var isBox = !isTab && el.tagName !== 'SECTION' && el.tagName !== 'LI' && el.tagName !== 'P';
      el.classList.toggle('locked', !ok);
      el.setAttribute('aria-disabled', String(!ok));
      if (isTab) return;
      var veil = el.querySelector(':scope > .lock-veil');
      if (!ok && isBox && !veil) {
        var v = document.createElement('div');
        v.className = 'lock-veil';
        v.innerHTML = '<b>' + esc(levelOf(need).name) + ' 还没解锁</b>'
          + '<span>主链撑到 #' + levelOf(need).at + ' 就开这一格 —— 现在是 #' + best() + '</span>';
        el.insertBefore(v, el.firstChild);
        el.classList.add('blk');
      } else if (ok && veil) {
        el.removeChild(veil);
        el.classList.remove('blk');
      }
    });
  }

  function celebrate(lv) {
    var L = levelOf(lv);
    renderLadder(); applyLocks();
    toast('解锁 · ' + L.name, 'warn', 3200);
    var goLv = lv === 3 ? '去国策页看看' : (lv === 4 ? '去复盘看看' : '好');
    modal({
      title: '解锁 · ' + L.name,
      body: '<p>' + esc(L.why) + '</p>'
        + '<p class="note">这一格开了：<b>' + esc(L.hint) + '</b>。</p>'
        + '<p class="hint">原理页里对应的那一条也一起亮了 —— 解锁哪一步，才讲哪一步的道理。</p>',
      actions: [{ label: goLv, value: lv, cls: 'primary' }, { label: '先不了', value: null, cls: 'ghost' }]
    }).then(function (v) {
      if (v === 3) go('rsip'); else if (v === 4) go('wins');
    });
  }

  /* ==================== 启动 ==================== */
  function renderAll() {
    renderSeat(); renderChain(); renderSession(); renderAux();
    renderVerdicts(); renderLib(); renderTree(); renderTreeMeta(); renderParents();
    renderFreeze(); renderWins(); renderOverview(); renderGains();
    renderLadder(); applyLocks();
  }

  load();
  applyTheme();
  renderAll();
  tick();
  setInterval(tick, 1000);
  go('model');
})();
