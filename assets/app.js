/* ==========================================================================
   SECNOTES — 应用逻辑
   路由 / 渲染 / 进度存储 / 全局检索面板
   无框架、无构建，直接跑在浏览器里
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (v) { return MD.esc(v); };

  var CATS = window.CATEGORIES || [];
  var NOTES = (window.LIBRARY && window.LIBRARY.notes) || [];
  var ARSENAL = window.ARSENAL || { tools: [], labs: [], toolCats: [], labCats: [] };
  var STAGES = (window.ROADMAP && window.ROADMAP.stages) || [];
  var BUNDLE = window.NOTES_BUNDLE || {};

  var noteById = {};
  NOTES.forEach(function (n) { noteById[n.id] = n; });
  var catById = {};
  CATS.forEach(function (c) { catById[c.id] = c; });

  var LEVELS = { 1: '基础', 2: '进阶', 3: '高阶' };

  var main = $('#main');
  var view = $('#view');
  var currentRoute = { name: 'dashboard' };
  var lastRestoredNote = null;
  var scrollTimer = null;

  /* ------------------------------------------------------------------ */
  /* 状态                                                                */
  /* ------------------------------------------------------------------ */

  var KEY = 'secnotes.v1';

  function blankState() {
    return {
      notes: {},
      tasks: {},
      days: {},
      labs: [],
      levels: {},
      levelNotes: {},
      customSeries: [],
      ui: { theme: 'dark', lastNote: null },
    };
  }

  function loadState() {
    var base = blankState();
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return base;
      var s = JSON.parse(raw);
      base.notes = s.notes || {};
      base.tasks = s.tasks || {};
      base.days = s.days || {};
      base.labs = Array.isArray(s.labs) ? s.labs : [];
      base.levels = (s.levels && typeof s.levels === 'object') ? s.levels : {};
      base.levelNotes = (s.levelNotes && typeof s.levelNotes === 'object') ? s.levelNotes : {};
      base.customSeries = Array.isArray(s.customSeries) ? s.customSeries : [];
      base.ui = Object.assign(base.ui, s.ui || {});
      return base;
    } catch (e) {
      return base;
    }
  }

  var state = loadState();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式忽略 */ }
  }

  function peek(id) {
    return state.notes[id] || { s: 'none', fav: 0, v: 0, t: 0, p: 0, ck: {} };
  }

  function rec(id) {
    if (!state.notes[id]) state.notes[id] = { s: 'none', fav: 0, v: 0, t: 0, p: 0, ck: {} };
    return state.notes[id];
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function touchDay() {
    var k = dkey(new Date());
    state.days[k] = (state.days[k] || 0) + 1;
  }

  function streak() {
    var n = 0;
    var d = new Date();
    if (!state.days[dkey(d)]) d.setDate(d.getDate() - 1);
    while (state.days[dkey(d)]) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function relTime(ts) {
    if (!ts) return '';
    var diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 86400000 * 7) return Math.floor(diff / 86400000) + ' 天前';
    var d = new Date(ts);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function stats() {
    var total = NOTES.length, done = 0, learning = 0, fav = 0, started = 0;
    NOTES.forEach(function (n) {
      var r = state.notes[n.id];
      if (!r) return;
      if (r.s === 'done') done++;
      if (r.s === 'learning') learning++;
      if (r.s && r.s !== 'none') started++;
      if (r.fav) fav++;
    });
    var tTotal = 0, tDone = 0;
    STAGES.forEach(function (s) {
      s.items.forEach(function (it) {
        tTotal++;
        if (state.tasks[it.id] && state.tasks[it.id].d) tDone++;
      });
    });
    return {
      total: total, done: done, learning: learning, fav: fav, started: started,
      pct: total ? Math.round((done / total) * 100) : 0,
      taskTotal: tTotal, taskDone: tDone,
      taskPct: tTotal ? Math.round((tDone / tTotal) * 100) : 0,
      streak: streak(),
      days: Object.keys(state.days).length,
    };
  }

  function catStats(catId) {
    var total = 0, done = 0, learning = 0;
    NOTES.forEach(function (n) {
      if (n.category !== catId) return;
      total++;
      var s = peek(n.id).s;
      if (s === 'done') done++;
      if (s === 'learning') learning++;
    });
    return { total: total, done: done, learning: learning };
  }

  /* ------------------------------------------------------------------ */
  /* 路由                                                                */
  /* ------------------------------------------------------------------ */

  function parseRoute() {
    var raw = (location.hash || '').replace(/^#\/?/, '');
    var qi = raw.indexOf('?');
    var path = qi === -1 ? raw : raw.slice(0, qi);
    var params;
    try { params = new URLSearchParams(qi === -1 ? '' : raw.slice(qi + 1)); }
    catch (e) { params = { get: function () { return ''; } }; }

    var parts = path.split('/').filter(Boolean).map(function (p) {
      try { return decodeURIComponent(p); } catch (e) { return p; }
    });

    var r = {
      name: parts[0] || 'dashboard',
      q: params.get('q') || '',
      tab: params.get('tab') || '',
    };
    if (r.name === 'knowledge') r.cat = parts[1] || null;
    if (r.name === 'note') r.id = parts[1] || '';
    return r;
  }

  function go(href) {
    if (location.hash === href) render();
    else location.hash = href;
  }

  function labTab(r) {
    if (r.tab === 'kit') return 'kit';
    if (r.tab === 'levels') return 'levels';
    return 'log';
  }

  /* ------------------------------------------------------------------ */
  /* 通用片段                                                            */
  /* ------------------------------------------------------------------ */

  function statusChip(id) {
    var s = peek(id).s;
    if (s === 'done') return '<span class="nc-state done"><i></i>已掌握</span>';
    if (s === 'learning') return '<span class="nc-state learning"><i></i>学习中</span>';
    return '<span class="nc-state"><i></i>未开始</span>';
  }

  function noteCard(n) {
    var cat = catById[n.category];
    return '<a class="note-card" href="#/note/' + encodeURIComponent(n.id) + '">' +
      '<div class="nc-top">' +
        '<span class="chip">' + esc(cat ? cat.name : n.category) + '</span>' +
        (n.level === 3 ? '<span class="chip warn">高阶</span>' : '') +
      '</div>' +
      '<div class="nc-title">' + esc(n.title) + '</div>' +
      '<div class="nc-sum">' + esc(n.summary || '') + '</div>' +
      '<div class="nc-foot">' +
        '<span>' + n.minutes + ' 分钟</span><span class="sep">·</span>' +
        '<span>' + esc((n.tags || []).slice(0, 2).join(' / ')) + '</span>' +
        statusChip(n.id) +
      '</div>' +
    '</a>';
  }

  function emptyState(text) {
    return '<div class="empty">' + esc(text) + '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* 视图：仪表盘                                                        */
  /* ------------------------------------------------------------------ */

  function greeting() {
    var h = new Date().getHours();
    if (h < 5) return '凌晨了，别熬太狠';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 19) return '下午好';
    return '晚上好';
  }

  function viewDashboard() {
    var st = stats();
    var now = new Date();
    var week = '日一二三四五六';
    var dateStr = now.getFullYear() + ' 年 ' + (now.getMonth() + 1) + ' 月 ' + now.getDate() +
      ' 日 · 星期' + week.charAt(now.getDay());

    var last = state.ui.lastNote && noteById[state.ui.lastNote];
    var resume = last || NOTES[0];

    var recent = NOTES.filter(function (n) { return state.notes[n.id] && state.notes[n.id].t; })
      .sort(function (a, b) { return (state.notes[b.id].t || 0) - (state.notes[a.id].t || 0); })
      .slice(0, 5);

    var favs = NOTES.filter(function (n) { return state.notes[n.id] && state.notes[n.id].fav; }).slice(0, 5);

    var catRows = CATS.filter(function (c) { return catStats(c.id).total > 0; }).map(function (c) {
      var cs = catStats(c.id);
      var pct = cs.total ? Math.round((cs.done / cs.total) * 100) : 0;
      return '<a class="cat-progress" href="#/knowledge/' + c.id + '" style="display:block">' +
        '<div class="cp-top">' +
          '<span class="cp-name">' + esc(c.name) + '</span>' +
          '<span class="cp-num">' + cs.done + '/' + cs.total + ' · ' + pct + '%</span>' +
        '</div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '</a>';
    }).join('');

    var stageCards = STAGES.map(function (s, idx) {
      var d = 0;
      s.items.forEach(function (it) { if (state.tasks[it.id] && state.tasks[it.id].d) d++; });
      var pct = s.items.length ? Math.round((d / s.items.length) * 100) : 0;
      return '<a class="stage-mini-card" href="#/roadmap">' +
        '<h4>' + esc(s.name.replace(/^第.阶段\s*·\s*/, '')) + '</h4>' +
        '<div class="sm-meta">' + esc(s.weeks) + ' · ' + d + '/' + s.items.length + ' 项</div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '</a>';
    }).join('');

    return '' +
    '<section class="hero">' +
      '<div class="hero-eyebrow">' + esc(dateStr) + ' · 连续学习 ' + st.streak + ' 天</div>' +
      '<h1>' + greeting() + '，从哪一条开始？</h1>' +
      '<p>' + st.total + ' 篇笔记、' + CATS.length + ' 个分类，已掌握 ' + st.done + ' 篇。' +
        '选一条主线读下去，比收藏一百篇更有用。</p>' +
      '<div class="hero-actions">' +
        (resume ? '<a class="btn primary" href="#/note/' + encodeURIComponent(resume.id) + '">' +
          (last ? '继续 · ' + esc(resume.title) : '开始第一篇') + '</a>' : '') +
        '<a class="btn" href="#/roadmap">看学习路径</a>' +
        '<a class="btn ghost" href="#/arsenal">工具与靶场</a>' +
      '</div>' +
    '</section>' +

    '<div class="stat-grid">' +
      '<div class="stat"><div class="stat-label">笔记总数</div>' +
        '<div class="stat-value">' + st.total + '<small>篇</small></div>' +
        '<div class="stat-sub">' + CATS.length + ' 个分类</div></div>' +
      '<div class="stat"><div class="stat-label">已掌握</div>' +
        '<div class="stat-value">' + st.done + '<small>篇</small></div>' +
        '<div class="stat-sub">占比 ' + st.pct + '%</div></div>' +
      '<div class="stat"><div class="stat-label">学习中</div>' +
        '<div class="stat-value">' + st.learning + '<small>篇</small></div>' +
        '<div class="stat-sub">收藏 ' + st.fav + ' 篇</div></div>' +
      '<div class="stat"><div class="stat-label">连续学习</div>' +
        '<div class="stat-value">' + st.streak + '<small>天</small></div>' +
        '<div class="stat-sub">累计 ' + st.days + ' 天有记录</div></div>' +
    '</div>' +

    '<div class="cols">' +
      '<div class="panel"><div class="panel-head"><h3>分类进度</h3>' +
        '<span>' + st.done + ' / ' + st.total + '</span></div>' +
        '<div class="panel-body">' + (catRows || emptyState('还没有分类')) + '</div></div>' +

      '<div class="panel"><div class="panel-head"><h3>最近学习</h3>' +
        '<span>' + (recent.length ? '按时间排序' : '') + '</span></div>' +
        '<div class="panel-body">' +
        (recent.length
          ? recent.map(function (n) {
              var s = peek(n.id).s;
              return '<a class="list-row" href="#/note/' + encodeURIComponent(n.id) + '">' +
                '<span class="dot ' + (s === 'done' ? 'done' : s === 'learning' ? 'learning' : '') + '"></span>' +
                '<span class="ttl">' + esc(n.title) + '</span>' +
                '<span class="meta">' + relTime(state.notes[n.id].t) + '</span></a>';
            }).join('')
          : emptyState('还没有学习记录，打开任意一篇笔记就会出现在这里')) +
        '</div></div>' +
    '</div>' +

    '<div class="section-head"><h2>学习路径</h2><a class="more" href="#/roadmap">全部 →</a></div>' +
    '<div class="stage-mini">' + stageCards + '</div>' +

    (favs.length
      ? '<div class="section-head"><h2>收藏</h2><span class="more">' + favs.length + ' 篇</span></div>' +
        '<div class="note-grid">' + favs.map(noteCard).join('') + '</div>'
      : '');
  }

  /* ------------------------------------------------------------------ */
  /* 视图：知识库                                                        */
  /* ------------------------------------------------------------------ */

  function viewKnowledge(cat, q) {
    var catObj = cat ? catById[cat] : null;
    var list = NOTES.filter(function (n) { return !cat || n.category === cat; });

    var pills = '<a class="pill' + (!cat ? ' active' : '') + '" href="#/knowledge">全部 ' + NOTES.length + '</a>' +
      CATS.map(function (c) {
        return '<a class="pill' + (cat === c.id ? ' active' : '') + '" href="#/knowledge/' + c.id + '">' +
          esc(c.short || c.name) + '</a>';
      }).join('');

    return '' +
      '<div class="page-head">' +
        '<div class="kicker">' + (catObj ? 'CATEGORY' : 'KNOWLEDGE BASE') + '</div>' +
        '<h1>' + esc(catObj ? catObj.name : '全部笔记') + '</h1>' +
        '<p>' + esc(catObj ? catObj.desc : '按分类整理的学习笔记。每篇都尽量回答三个问题：原理是什么、怎么验证、怎么修。') + '</p>' +
      '</div>' +
      '<div class="filter-row">' +
        '<label class="filter-input">' +
          '<span class="search-ico">⌕</span>' +
          '<input id="kb-filter" type="search" placeholder="在当前列表里过滤标题、标签…" value="' + esc(q) + '" />' +
        '</label>' +
      '</div>' +
      '<div class="pill-row" style="margin-bottom:18px">' + pills + '</div>' +
      '<div class="note-grid" id="kb-grid">' +
        (list.length ? list.map(noteCard).join('') : emptyState('这个分类下还没有笔记')) +
      '</div>';
  }

  function initKnowledgeFilter() {
    var input = $('#kb-filter');
    var grid = $('#kb-grid');
    if (!input || !grid) return;
    var cards = $$('.note-card', grid);
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (card) {
        var text = card.textContent.toLowerCase();
        var hit = !q || text.indexOf(q) !== -1;
        card.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      var old = $('.empty', grid);
      if (!shown && !old) {
        var d = document.createElement('div');
        d.className = 'empty';
        d.textContent = '没有匹配的笔记，试试别的关键词';
        grid.appendChild(d);
      } else if (shown && old) {
        old.remove();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* 视图：阅读页                                                        */
  /* ------------------------------------------------------------------ */

  function viewNote(id) {
    var n = noteById[id];
    if (!n) {
      return '<div class="page-head"><h1>笔记不存在</h1>' +
        '<p>可能是链接过期，或者这篇笔记的 id 变了。</p></div>' +
        '<a class="btn" href="#/knowledge">返回知识库</a>';
    }

    var cat = catById[n.category];
    var r = peek(n.id);
    var seg = '<div class="seg" id="note-seg">' +
      '<button data-act="status" data-s="none"' + (r.s === 'none' ? ' class="on"' : '') + '>未开始</button>' +
      '<button data-act="status" data-s="learning"' + (r.s === 'learning' ? ' class="on"' : '') + '>学习中</button>' +
      '<button data-act="status" data-s="done"' + (r.s === 'done' ? ' class="on"' : '') + '>已掌握</button>' +
      '</div>';

    var siblings = NOTES.filter(function (x) { return x.category === n.category; });
    var idx = siblings.findIndex(function (x) { return x.id === n.id; });
    var prev = idx > 0 ? siblings[idx - 1] : null;
    var next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

    return '' +
    '<div class="note-wrap">' +
      '<div class="reader-head">' +
        '<div class="reader-crumb">' +
          '<a href="#/knowledge">知识库</a><span>/</span>' +
          '<a href="#/knowledge/' + n.category + '">' + esc(cat ? cat.name : n.category) + '</a>' +
        '</div>' +
        '<h1>' + esc(n.title) + '</h1>' +
        '<div class="reader-meta">' +
          '<span class="chip accent">' + esc(LEVELS[n.level] || '基础') + '</span>' +
          '<span>' + n.minutes + ' 分钟</span><span class="sep">·</span>' +
          '<span>更新于 ' + esc(n.updated) + '</span><span class="sep">·</span>' +
          '<span>已读 ' + (r.v || 0) + ' 次</span>' +
          (n.tags || []).map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('') +
        '</div>' +
        '<div class="reader-tools">' + seg +
          '<button class="btn" data-act="fav" id="fav-btn">' + (r.fav ? '★ 已收藏' : '☆ 收藏') + '</button>' +
          '<button class="btn ghost" data-act="print">打印 / 存 PDF</button>' +
          '<button class="btn ghost" data-act="copy-link">复制链接</button>' +
        '</div>' +
      '</div>' +
      '<div class="reader-grid">' +
        '<article class="md" id="note-body"><p style="color:var(--text-3)">正在加载正文…</p></article>' +
        '<aside class="toc" id="toc"><div class="toc-title">本页目录</div><div id="toc-list"></div></aside>' +
      '</div>' +
      '<nav class="note-nav">' +
        (prev ? '<a href="#/note/' + encodeURIComponent(prev.id) + '"><span class="nn-dir">← 上一篇</span>' +
          '<span class="nn-title">' + esc(prev.title) + '</span></a>' : '<span style="flex:1"></span>') +
        (next ? '<a class="next" href="#/note/' + encodeURIComponent(next.id) + '"><span class="nn-dir">下一篇 →</span>' +
          '<span class="nn-title">' + esc(next.title) + '</span></a>' : '') +
      '</nav>' +
    '</div>';
  }

  function paintNote(note) {
    var target = $('#note-body');
    if (!target) return;

    var raw = null;
    if (location.protocol !== 'file:') {
      // 走服务器时直接读文件，改了 md 刷新即可生效
      fetch('content/' + encodeURI(note.file)).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      }).then(function (text) {
        renderBody(text);
      }).catch(function () {
        renderBody(BUNDLE[note.id] || '');
      });
    } else {
      renderBody(BUNDLE[note.id] || '');
    }

    function renderBody(text) {
      target.innerHTML = MD.render(text, {
        resolve: function (id) { return noteById[id] || null; },
      });
      buildTOC();
      applyChecks(note.id);
      restoreScroll(note.id);
    }
  }

  function buildTOC() {
    var list = $('#toc-list');
    if (!list) return;
    var heads = $$('#note-body h2, #note-body h3');
    if (!heads.length) {
      var toc = $('#toc');
      if (toc) toc.style.display = 'none';
      return;
    }
    list.innerHTML = heads.map(function (h) {
      return '<a href="#' + h.id + '" data-id="' + h.id + '" class="' + (h.tagName === 'H3' ? 'lv3' : '') + '">' +
        esc(h.textContent) + '</a>';
    }).join('');

    list.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      e.preventDefault();
      var el = document.getElementById(a.dataset.id);
      if (el) {
        var top = el.getBoundingClientRect().top + main.scrollTop - 74;
        main.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  }

  function updateTOCActive() {
    var links = $$('#toc-list a');
    if (!links.length) return;
    var activeId = links[0].dataset.id;
    links.forEach(function (a) {
      var el = document.getElementById(a.dataset.id);
      if (!el) return;
      if (el.getBoundingClientRect().top <= 130) activeId = a.dataset.id;
    });
    links.forEach(function (a) {
      a.classList.toggle('active', a.dataset.id === activeId);
    });
  }

  function applyChecks(id) {
    var r = state.notes[id];
    if (!r || !r.ck) return;
    $$('.md-task').forEach(function (cb) {
      if (Object.prototype.hasOwnProperty.call(r.ck, cb.dataset.k)) {
        cb.checked = !!r.ck[cb.dataset.k];
      }
      var li = cb.closest('li');
      if (li) li.classList.toggle('checked', cb.checked);
    });
  }

  function restoreScroll(id) {
    if (lastRestoredNote === id) return;
    lastRestoredNote = id;
    var r = state.notes[id];
    requestAnimationFrame(function () {
      var max = main.scrollHeight - main.clientHeight;
      main.scrollTop = r && r.p > 0.02 ? r.p * max : 0;
    });
  }

  function saveScroll() {
    if (currentRoute.name !== 'note' || !currentRoute.id) return;
    if (!state.notes[currentRoute.id]) return;
    var max = main.scrollHeight - main.clientHeight;
    var p = max > 0 ? main.scrollTop / max : 0;
    state.notes[currentRoute.id].p = Math.round(p * 100) / 100;
  }

  /* ------------------------------------------------------------------ */
  /* 视图：学习路径                                                      */
  /* ------------------------------------------------------------------ */

  function viewRoadmap() {
    var total = 0, done = 0;
    var html = STAGES.map(function (s, i) {
      var d = 0;
      s.items.forEach(function (it) { if (state.tasks[it.id] && state.tasks[it.id].d) d++; });
      total += s.items.length;
      done += d;
      var pct = s.items.length ? Math.round((d / s.items.length) * 100) : 0;

      return '<section class="stage" data-stage="' + s.id + '">' +
        '<div class="stage-head">' +
          '<span class="stage-idx">' + (i + 1) + '</span>' +
          '<div><h3>' + esc(s.name) + '</h3><div class="stage-goal">' + esc(s.goal) + '</div></div>' +
          '<span class="stage-pct"><b data-pct>' + pct + '%</b> · ' + d + '/' + s.items.length + '</span>' +
        '</div>' +
        '<div class="stage-body">' +
          s.items.map(function (it) {
            var on = !!(state.tasks[it.id] && state.tasks[it.id].d);
            return '<label class="task' + (on ? ' done' : '') + '">' +
              '<input type="checkbox" class="road-task" data-task="' + it.id + '"' + (on ? ' checked' : '') + ' />' +
              '<span class="task-text">' + esc(it.text) + '</span>' +
              (it.note && noteById[it.note]
                ? '<a class="task-note" href="#/note/' + encodeURIComponent(it.note) + '">笔记 →</a>'
                : '') +
            '</label>';
          }).join('') +
        '</div>' +
      '</section>';
    }).join('');

    var pctAll = total ? Math.round((done / total) * 100) : 0;

    return '' +
      '<div class="page-head">' +
        '<div class="kicker">ROADMAP</div>' +
        '<h1>学习路径</h1>' +
        '<p>四个阶段、' + total + ' 个动作。勾选即记录进度，任务右侧的「笔记」可以直接跳到对应笔记。</p>' +
      '</div>' +
      '<div class="panel" style="margin-bottom:20px">' +
        '<div class="panel-body" style="padding:16px 18px">' +
          '<div class="cp-top"><span class="cp-name">整体进度</span>' +
            '<span class="cp-num" id="road-pct">' + done + '/' + total + ' · ' + pctAll + '%</span></div>' +
          '<div class="bar"><i id="road-bar" style="width:' + pctAll + '%"></i></div>' +
        '</div>' +
      '</div>' +
      html;
  }

  function refreshRoadmapProgress() {
    var total = 0, done = 0;
    STAGES.forEach(function (s) {
      var d = 0;
      s.items.forEach(function (it) {
        total++;
        if (state.tasks[it.id] && state.tasks[it.id].d) d++;
      });
      done += d;
      var el = $('[data-stage="' + s.id + '"]');
      if (!el) return;
      var pct = s.items.length ? Math.round((d / s.items.length) * 100) : 0;
      var b = $('[data-pct]', el);
      if (b) b.textContent = pct + '%';
      var bar = $('.bar > i', el);
      if (bar) bar.style.width = pct + '%';
      var pctEl = $('.stage-pct', el);
      if (pctEl) pctEl.innerHTML = '<b data-pct>' + pct + '%</b> · ' + d + '/' + s.items.length;
    });
    var all = total ? Math.round((done / total) * 100) : 0;
    var rb = $('#road-bar');
    if (rb) rb.style.width = all + '%';
    var rp = $('#road-pct');
    if (rp) rp.textContent = done + '/' + total + ' · ' + all + '%';
  }

  /* ------------------------------------------------------------------ */
  /* 视图：工具与靶场                                                    */
  /* ------------------------------------------------------------------ */

  function viewArsenal(tab, q) {
    var isLab = tab === 'lab';
    var toolCats = ARSENAL.toolCats || [];
    var labCats = ARSENAL.labCats || [];
    var cats = isLab ? labCats : toolCats;

    var tabs = '<div class="seg" style="margin-bottom:18px">' +
      '<a class="' + (!isLab ? 'on' : '') + '" href="#/arsenal?tab=tool" style="padding:6px 14px;border-radius:6px;font-size:12.5px">' +
        '工具 ' + (ARSENAL.tools || []).length + '</a>' +
      '<a class="' + (isLab ? 'on' : '') + '" href="#/arsenal?tab=lab" style="padding:6px 14px;border-radius:6px;font-size:12.5px">' +
        '靶场 ' + (ARSENAL.labs || []).length + '</a>' +
    '</div>';

    var chips = '<div class="pill-row" id="ars-cats">' +
      '<button class="pill active" data-cat="*">全部</button>' +
      cats.map(function (c) {
        return '<button class="pill" data-cat="' + c.id + '">' + esc(c.name) + '</button>';
      }).join('') +
    '</div>';

    var body = isLab ? labGrid(ARSENAL.labs || []) : toolGrid(ARSENAL.tools || []);

    return '' +
      '<div class="page-head">' +
        '<div class="kicker">ARSENAL</div>' +
        '<h1>' + (isLab ? '靶场资源' : '渗透工具') + '</h1>' +
        '<p>' + (isLab
          ? '练手的地方。在线平台练思路，本地靶场练链路 —— 别在没有授权的目标上试任何工具。'
          : '按用途分组的常用工具，附带安装命令。命令点一下就复制，装完先看 help 再对着靶场用。') + '</p>' +
      '</div>' +
      tabs +
      '<div class="filter-row">' +
        '<label class="filter-input">' +
          '<span class="search-ico">⌕</span>' +
          '<input id="ars-filter" type="search" placeholder="过滤名称、描述、标签…" value="' + esc(q) + '" />' +
        '</label>' +
        chips +
      '</div>' +
      '<div id="ars-grid">' + body + '</div>';
  }

  function toolGrid(tools) {
    if (!tools.length) return emptyState('还没有工具');
    return '<div class="tool-grid">' + tools.map(function (t) {
      var cat = (ARSENAL.toolCats || []).filter(function (c) { return c.id === t.cat; })[0];
      return '<div class="tool-card" data-cat="' + esc(t.cat) + '" data-search="' +
        esc((t.name + ' ' + t.desc + ' ' + (t.tags || []).join(' ')).toLowerCase()) + '">' +
        '<div class="tc-head"><span class="tc-name">' + esc(t.name) + '</span>' +
          '<span class="tc-cat">' + esc(cat ? cat.name : t.cat) + '</span></div>' +
        '<div class="tc-desc">' + esc(t.desc) + '</div>' +
        '<div class="tc-install"><code>' + esc(t.install) + '</code>' +
          '<button data-act="copy-text" data-text="' + esc(t.install) + '">复制</button></div>' +
        '<div class="tc-foot">' +
          (t.tags || []).map(function (tag) { return '<span class="chip">' + esc(tag) + '</span>'; }).join('') +
          '<a class="chip accent" href="' + esc(t.url) + '" target="_blank" rel="noopener noreferrer" ' +
            'style="margin-left:auto">文档 ↗</a>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function labGrid(labs) {
    if (!labs.length) return emptyState('还没有靶场');
    return '<div class="tool-grid">' + labs.map(function (l) {
      return '<a class="lab-card" data-cat="' + esc(l.cat) + '" data-search="' +
        esc((l.name + ' ' + l.desc + ' ' + (l.tags || []).join(' ')).toLowerCase()) + '" ' +
        'href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<h4>' + esc(l.name) + '</h4>' +
        '<p>' + esc(l.desc) + '</p>' +
        '<div class="lab-meta">' +
          '<span class="chip accent">' + esc(l.level) + '</span>' +
          (l.tags || []).map(function (tag) { return '<span class="chip">' + esc(tag) + '</span>'; }).join('') +
        '</div>' +
      '</a>';
    }).join('') + '</div>';
  }

  function initArsenalFilter() {
    var input = $('#ars-filter');
    var grid = $('#ars-grid');
    var cats = $('#ars-cats');
    if (!grid) return;
    var activeCat = '*';

    function apply() {
      var q = input ? input.value.trim().toLowerCase() : '';
      var cards = $$('[data-cat]', grid);
      var shown = 0;
      cards.forEach(function (card) {
        var okCat = activeCat === '*' || card.dataset.cat === activeCat;
        var okText = !q || (card.dataset.search || '').indexOf(q) !== -1;
        var show = okCat && okText;
        card.style.display = show ? '' : 'none';
        if (show) shown++;
      });
      var old = $('.empty', grid);
      if (!shown && !old) {
        var d = document.createElement('div');
        d.className = 'empty';
        d.textContent = '没有匹配的条目，换个关键词试试';
        grid.appendChild(d);
      } else if (shown && old) {
        old.remove();
      }
    }

    if (input) input.addEventListener('input', apply);

    if (cats) {
      cats.addEventListener('click', function (e) {
        var b = e.target.closest('.pill');
        if (!b) return;
        $$('.pill', cats).forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        activeCat = b.dataset.cat;
        apply();
      });
    }
    apply();
  }

  /* ------------------------------------------------------------------ */
  /* 视图：关于                                                          */
  /* ------------------------------------------------------------------ */

  function viewAbout() {
    var st = stats();
    return '' +
    '<div class="page-head">' +
      '<div class="kicker">MAINTENANCE</div>' +
      '<h1>关于与维护</h1>' +
      '<p>站点是纯静态的：所有正文是 Markdown 文件，进度存在浏览器本地。没有后端、没有账号、没有外部依赖。</p>' +
    '</div>' +

    '<div class="prose">' +
      '<h2>目录结构</h2>' +
      '<pre><code>ctf/\n' +
      '├── index.html              单页入口\n' +
      '├── start.bat / start.sh    本地起服务（双击即用）\n' +
      '├── assets/\n' +
      '│   ├── style.css           全部样式（含明暗主题）\n' +
      '│   ├── app.js              路由、渲染、进度存储\n' +
      '│   ├── markdown.js         极简 Markdown 渲染\n' +
      '│   ├── search.js           内存检索索引\n' +
      '│   ├── lab.js              实战台：靶场记录\n' +
      '│   └── toolbox.js          编解码 / 哈希 / JWT / CIDR\n' +
      '├── content/\n' +
      '│   ├── categories.js       分类（手工维护）\n' +
      '│   ├── library.js          笔记索引（自动生成）\n' +
      '│   ├── notes-bundle.js     全文兜底包（自动生成）\n' +
      '│   ├── tools.js            工具与靶场（手工维护）\n' +
      '│   ├── roadmap.js          学习路径（手工维护）\n' +
      '│   ├── cheats.js           实战速查片段（手工维护）\n' +
      '│   ├── levels.js           关卡包定义（手工维护）\n' +
      '│   └── notes/              正文，按分类分子目录\n' +
      '│       ├── basics/  recon/  web/\n' +
      '│       └── auth/    post/   report/  labs/\n' +
      '└── tools/build-index.js    扫描 notes 生成索引\n' +
      '</code></pre>' +

      '<h2>加一篇新笔记（三步）</h2>' +
      '<ol>' +
        '<li>在 <code>content/notes/&lt;分类&gt;/</code> 下新建 <code>xxx.md</code>，开头写 front-matter：' +
          '<pre><code>---\n' +
          'title: 标题\n' +
          'category: web\n' +
          'tags: [SSRF, 内网]\n' +
          'summary: 一句话摘要\n' +
          'level: 2\n' +
          'order: 6\n' +
          'updated: 2026-10-27\n' +
          '---</code></pre></li>' +
        '<li>运行 <code>node tools/build-index.js</code> 重新生成索引</li>' +
        '<li>刷新页面。笔记内可以用 <code>[[另一篇的 id]]</code> 做双向跳转</li>' +
      '</ol>' +
      '<p>如果只改已有笔记的正文，不用重新生成索引 —— 服务模式下会直接读 <code>.md</code> 文件，刷新即可。</p>' +

      '<h2>实战台怎么用</h2>' +
      '<p>「实战台」分三块：<b>靶场记录</b>、<b>关卡</b>、<b>速查与工具</b>。</p>' +
      '<ul>' +
        '<li>靶场记录：点「新建记录」填四件事——从哪进的、用了什么凭据、怎么提权、卡在哪。' +
          '卡片点开即编辑，删除在抽屉左下角。</li>' +
        '<li>关卡：选一个关卡包点「一键添加」，整包关卡自动生成，一关一格。' +
          '<b>点格子会打开题面</b>——每关都有「这关考什么」和一条提示（默认折叠，防止剧透），' +
          '下面的输入框记自己的 payload 与卡点，自动保存。' +
          '想快速打卡就 <b>Shift + 点击</b>，不打开面板直接标记通关。</li>' +
        '<li>题面按常见版本整理，不同版本可能略有差异；自定义关卡包的题面留空，' +
          '直接在「我的解法」里写题目也行。</li>' +
        '<li>「导出 Markdown」会生成带 front-matter 的复盘笔记，' +
          '放进 <code>content/notes/labs/</code> 再跑一次索引脚本，这条记录就并入知识库了。</li>' +
        '<li>速查与工具：编解码、哈希、JWT 解析、网段计算、速查片段。' +
          '全部在浏览器本地完成，不联网、不上传。</li>' +
      '</ul>' +

      '<h2>部署</h2>' +
      '<p>不能直接双击 <code>index.html</code> 吗？能打开界面，但正文走 <code>fetch</code> 时需要 http 协议。' +
        '所以推荐用附带的脚本起一个本地服务：</p>' +
      '<pre><code># Windows：双击 start.bat\n# macOS / Linux / WSL：\n./start.sh\n\n# 或者任意静态服务器\npython -m http.server 8787 --bind 127.0.0.1</code></pre>' +
      '<p>然后访问 <code>http://127.0.0.1:8787</code>。整个目录可以直接 <code>git init</code> 做版本管理，' +
        '也可以扔到任意静态托管上（注意：个人笔记不要公开）。</p>' +

      '<h2>进度数据</h2>' +
      '<p>进度存在浏览器 <code>localStorage</code> 的 <code>secnotes.v1</code> 里，包含每篇的状态、收藏、' +
        '阅读位置、勾选清单、路径任务，以及实战台的靶场记录。换电脑或清缓存前先导出。</p>' +
      '<p style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">' +
        '<button class="btn" data-act="export">导出进度 JSON</button>' +
        '<button class="btn" data-act="import">导入进度 JSON</button>' +
        '<input type="file" id="import-file" accept="application/json" hidden />' +
      '</p>' +
      '<p style="font-size:12.5px;color:var(--text-3)">当前：' + st.total + ' 篇笔记中已掌握 ' + st.done +
        ' 篇，路径任务完成 ' + st.taskDone + '/' + st.taskTotal + '，累计 ' + st.days + ' 天有学习记录。</p>' +

      '<h2>快捷键</h2>' +
      '<dl class="kv">' +
        '<dt>Ctrl / ⌘ + K</dt><dd>打开全局检索</dd>' +
        '<dt>/</dt><dd>在非输入状态下打开检索</dd>' +
        '<dt>↑ ↓ / ↵</dt><dd>检索面板内选择与打开</dd>' +
        '<dt>Esc</dt><dd>关闭检索 / 收起移动端导航</dd>' +
      '</dl>' +

      '<h2>设计取舍</h2>' +
      '<ul>' +
        '<li><b>不用框架</b>：没有 npm 依赖、没有构建产物，五年后打开仍然能跑。</li>' +
        '<li><b>不用数据库</b>：个人学习数据量小，localStorage 足够；用导出/导入解决迁移。</li>' +
        '<li><b>Markdown 即内容</b>：正文和界面解耦，随时可以把 notes 目录搬到别的工具里。</li>' +
        '<li><b>索引可重建</b>：<code>library.js</code> 是生成物，删掉重跑脚本即可，不会丢内容。</li>' +
      '</ul>' +

      '<div class="danger-zone">' +
        '<h3>危险操作</h3>' +
        '<p>清空会删除全部学习状态（笔记文件不受影响），且无法撤销。</p>' +
        '<button class="btn danger" data-act="reset">清空全部进度</button>' +
      '</div>' +

      '<h2 style="margin-top:36px">免责声明</h2>' +
      '<p style="color:var(--text-3);font-size:12.5px">本站仅用于个人学习与授权范围内的安全测试。' +
        '所有技术内容不构成对任何具体系统的攻击指导；对未授权目标进行探测或入侵可能触犯法律。' +
        '靶场请使用公开练习平台或自建环境。</p>' +
    '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* 渲染主流程                                                          */
  /* ------------------------------------------------------------------ */

  function render() {
    var r = parseRoute();
    currentRoute = r;

    if (r.name === 'note' && noteById[r.id]) {
      // 访问计数先落库，页面上的"已读 N 次"才是本次的准确值
      var entry = state.notes[r.id] = state.notes[r.id] || { s: 'none', fav: 0, v: 0, t: 0, p: 0, ck: {} };
      entry.v = (entry.v || 0) + 1;
      entry.t = Date.now();
      state.ui.lastNote = r.id;
      touchDay();
      save();
      view.innerHTML = viewNote(r.id);
      paintNote(noteById[r.id]);
    } else if (r.name === 'note') {
      view.innerHTML = viewNote(r.id);
    } else if (r.name === 'lab') { view.innerHTML = Lab.view(labTab(r)); }
    else if (r.name === 'knowledge') view.innerHTML = viewKnowledge(r.cat, r.q);
    else if (r.name === 'roadmap') view.innerHTML = viewRoadmap();
    else if (r.name === 'arsenal') view.innerHTML = viewArsenal(r.tab === 'lab' ? 'lab' : 'tool', r.q);
    else if (r.name === 'about') view.innerHTML = viewAbout();
    else view.innerHTML = viewDashboard();

    if (r.name === 'knowledge') initKnowledgeFilter();
    if (r.name === 'arsenal') initArsenalFilter();
    if (r.name === 'lab') Lab.mount(labTab(r));

    renderChrome(r);
    updateNavActive(r);
    closeSidebar();
  }

  function renderChrome(r) {
    var st = stats();
    var crumb = '';
    var title = 'SECNOTES · 渗透学习台';

    buildNav();
    if (r.name === 'knowledge') {
      var c = r.cat ? catById[r.cat] : null;
      crumb = '<a href="#/knowledge">知识库</a>';
      if (c) crumb += '<span class="sep">/</span><b>' + esc(c.name) + '</b>';
    } else if (r.name === 'note') {
      var n = noteById[r.id];
      var nc = n ? catById[n.category] : null;
      crumb = '<a href="#/knowledge">知识库</a>' +
        (nc ? '<span class="sep">/</span><a href="#/knowledge/' + nc.id + '">' + esc(nc.name) + '</a>' : '') +
        (n ? '<span class="sep">/</span><b>' + esc(n.title) + '</b>' : '');
      if (n) title = n.title + ' · SECNOTES';
    } else if (r.name === 'roadmap') {
      crumb = '<b>学习路径</b>';
      title = '学习路径 · SECNOTES';
    } else if (r.name === 'lab') {
      var LAB_TAB = { kit: '速查与工具', levels: '关卡', log: '靶场记录' };
      var tabKey = labTab(r);
      crumb = '<a href="#/lab">实战台</a><span class="sep">/</span><b>' + LAB_TAB[tabKey] + '</b>';
      title = LAB_TAB[tabKey] + ' · SECNOTES';
    } else if (r.name === 'arsenal') {
      crumb = '<b>工具与靶场</b>';
      title = '工具与靶场 · SECNOTES';
    } else if (r.name === 'about') {
      crumb = '<b>关于与维护</b>';
      title = '关于与维护 · SECNOTES';
    } else {
      crumb = '<b>仪表盘</b>';
    }

    $('#top-crumb').innerHTML = crumb;
    document.title = title;

    $('#side-cats').innerHTML = CATS.map(function (c, i) {
      var cs = catStats(c.id);
      var active = (r.name === 'knowledge' && r.cat === c.id) ||
        (r.name === 'note' && noteById[r.id] && noteById[r.id].category === c.id);
      return '<a class="cat-item' + (active ? ' active' : '') + '" href="#/knowledge/' + c.id + '">' +
        '<span class="cat-idx">' + (i + 1 < 10 ? '0' : '') + (i + 1) + '</span>' +
        '<span class="cat-name">' + esc(c.name) + '</span>' +
        '<span class="cat-count">' + (cs.done ? cs.done + '/' : '') + cs.total + '</span>' +
      '</a>';
    }).join('');

    $('#side-progress').innerHTML =
      '<div class="sp-row"><span>掌握进度</span><b>' + st.done + ' / ' + st.total + '</b></div>' +
      '<div class="bar"><i style="width:' + st.pct + '%"></i></div>';

    updateNavActive(r);
  }

  function updateNavActive(r) {
    var map = { dashboard: 'dashboard', knowledge: 'knowledge', note: 'knowledge', lab: 'lab', roadmap: 'roadmap', arsenal: 'arsenal', about: 'about' };
    var active = map[r.name] || 'dashboard';
    $$('#nav .nav-item').forEach(function (a) {
      a.classList.toggle('active', a.dataset.nav === active);
    });
  }

  function buildNav() {
    var st = stats();
    var items = [
      { id: 'dashboard', label: '仪表盘', href: '#/', badge: '' },
      { id: 'knowledge', label: '知识库', href: '#/knowledge', badge: st.total },
      { id: 'lab', label: '实战台', href: '#/lab', badge: (state.labs || []).length },
      { id: 'roadmap', label: '学习路径', href: '#/roadmap', badge: st.taskDone + '/' + st.taskTotal },
      { id: 'arsenal', label: '工具与靶场', href: '#/arsenal', badge: (ARSENAL.tools || []).length + (ARSENAL.labs || []).length },
      { id: 'about', label: '关于与维护', href: '#/about', badge: '' },
    ];
    $('#nav').innerHTML = items.map(function (it) {
      return '<a class="nav-item" data-nav="' + it.id + '" href="' + it.href + '">' +
        '<span class="nav-label">' + it.label + '</span>' +
        (it.badge !== '' ? '<span class="badge">' + it.badge + '</span>' : '') +
      '</a>';
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* 检索面板                                                            */
  /* ------------------------------------------------------------------ */

  var palette = $('#palette');
  var pInput = $('#palette-input');
  var pResults = $('#palette-results');
  var pItems = [];
  var pIndex = 0;

  var KIND_LABEL = { note: '笔记', tool: '工具', lab: '靶场', series: '关卡包', task: '路径任务' };

  function openPalette(prefill) {
    palette.hidden = false;
    pInput.value = prefill || '';
    renderPalette(pInput.value);
    setTimeout(function () { pInput.focus(); pInput.select(); }, 10);
  }

  function closePalette() {
    palette.hidden = true;
    pItems = [];
    pIndex = 0;
  }

  function renderPalette(q) {
    var html = '';
    pItems = [];

    if (!q.trim()) {
      var recent = NOTES.filter(function (n) { return state.notes[n.id] && state.notes[n.id].t; })
        .sort(function (a, b) { return (state.notes[b.id].t || 0) - (state.notes[a.id].t || 0); })
        .slice(0, 4);

      html += '<div class="pr-group">快捷入口</div>';
      [
        { title: '仪表盘', sub: '总览与最近学习', href: '#/', icon: '→' },
        { title: '知识库', sub: '全部分类与笔记', href: '#/knowledge', icon: '→' },
        { title: '学习路径', sub: '四阶段任务清单', href: '#/roadmap', icon: '→' },
        { title: '工具与靶场', sub: '按用途索引', href: '#/arsenal', icon: '→' },
      ].forEach(function (it) {
        html += prItem(it.icon, it.title, it.sub, it.href);
      });

      if (recent.length) {
        html += '<div class="pr-group">最近学习</div>';
        recent.forEach(function (n) {
          var c = catById[n.category];
          html += prItem('记', n.title, c ? c.name : n.category, '#/note/' + encodeURIComponent(n.id));
        });
      }
      pResults.innerHTML = html;
      bindPaletteItems();
      return;
    }

    var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    var results = Search.query(q, 16);

    if (!results.length) {
      pResults.innerHTML = '<div class="empty">没有找到「' + esc(q) + '」，换个关键词试试</div>';
      pItems = [];
      return;
    }

    var groups = { note: [], series: [], tool: [], lab: [], task: [] };
    results.forEach(function (r) { (groups[r.kind] || groups.note).push(r); });

    // 分组顺序按各组最高分排，避免弱相关的分组压在强结果前面
    var order = ['note', 'series', 'tool', 'lab', 'task'].filter(function (k) { return groups[k].length; });
    order.sort(function (a, b) { return groups[b][0].score - groups[a][0].score; });

    order.forEach(function (kind) {
      html += '<div class="pr-group">' + KIND_LABEL[kind] + '</div>';
      groups[kind].forEach(function (r) {
        var sub = r.snippet
          ? Search.highlight(r.snippet, tokens)
          : Search.highlight(r.sub, tokens);
        html += prItem(r.icon, Search.highlight(r.title, tokens), sub, r.href, true);
      });
    });

    pResults.innerHTML = html;
    bindPaletteItems();
  }

  function prItem(icon, title, sub, href, allowHtml) {
    var idx = pItems.length;
    pItems.push({ href: href, title: title });
    return '<div class="pr-item" data-idx="' + idx + '" data-href="' + esc(href) + '">' +
      '<span class="pr-ico">' + esc(icon || '·') + '</span>' +
      '<div class="pr-main"><div class="pr-title">' + title + '</div>' +
      '<div class="pr-sub">' + sub + '</div></div></div>';
  }

  function bindPaletteItems() {
    var nodes = $$('.pr-item', pResults);
    pIndex = 0;
    nodes.forEach(function (node, i) {
      node.addEventListener('mouseenter', function () {
        pIndex = i;
        paintSelection();
      });
      node.addEventListener('click', function () {
        closePalette();
        go(node.dataset.href);
      });
    });
    paintSelection();
  }

  function paintSelection() {
    $$('.pr-item', pResults).forEach(function (n, i) {
      n.classList.toggle('sel', i === pIndex);
      if (i === pIndex && n.scrollIntoView) n.scrollIntoView({ block: 'nearest' });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 全局事件                                                            */
  /* ------------------------------------------------------------------ */

  function handleAction(el) {
    var act = el.dataset.act;

    if (act === 'copy' || act === 'copy-text') {
      var text = el.dataset.text || '';
      if (!text) {
        var wrap = el.closest('.code-wrap');
        var code = wrap ? $('pre code', wrap) : null;
        text = code ? code.textContent : '';
      }
      copyText(text, el);
      return;
    }

    if (act === 'status') {
      var id = currentRoute.id;
      if (!id) return;
      var r = rec(id);
      r.s = el.dataset.s;
      r.t = Date.now();
      save();
      $$('#note-seg button').forEach(function (b) { b.classList.toggle('on', b === el); });
      renderChrome(currentRoute);
      return;
    }

    if (act === 'fav') {
      var nid = currentRoute.id;
      if (!nid) return;
      var nr = rec(nid);
      nr.fav = nr.fav ? 0 : 1;
      el.textContent = nr.fav ? '★ 已收藏' : '☆ 收藏';
      save();
      return;
    }

    if (act === 'print') { window.print(); return; }

    if (act === 'copy-link') {
      copyText(location.href, el);
      return;
    }

    if (act === 'export') { exportProgress(); return; }

    if (act === 'import') {
      var input = $('#import-file');
      if (input) input.click();
      return;
    }

    if (act === 'reset') {
      var ok = window.confirm('确定清空全部学习进度？\n笔记文件不会受影响，但状态、收藏、勾选将无法恢复。');
      if (!ok) return;
      state = blankState();
      save();
      render();
      return;
    }
  }

  function flash(el, text) {
    var old = el.textContent;
    el.textContent = text;
    setTimeout(function () { el.textContent = old; }, 1200);
  }

  function copyText(text, el) {
    var done = function () { flash(el, '已复制'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else {
      fallbackCopy(text);
      done();
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  function exportProgress() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'secnotes-progress-' + dkey(new Date()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function importProgress(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object' || !data.notes) throw new Error('bad format');
        state = {
          notes: data.notes || {},
          tasks: data.tasks || {},
          days: data.days || {},
          labs: Array.isArray(data.labs) ? data.labs : [],
          levels: (data.levels && typeof data.levels === 'object') ? data.levels : {},
          levelNotes: (data.levelNotes && typeof data.levelNotes === 'object') ? data.levelNotes : {},
          customSeries: Array.isArray(data.customSeries) ? data.customSeries : [],
          ui: Object.assign(blankState().ui, data.ui || {}),
        };
        save();
        applyTheme();
        render();
        window.alert('导入成功：' + Object.keys(state.notes).length + ' 条笔记状态，' +
          Object.keys(state.tasks).length + ' 条任务记录，' + state.labs.length + ' 条实战记录。');
      } catch (e) {
        window.alert('导入失败：文件不是有效的进度备份。');
      }
    };
    reader.readAsText(file);
  }

  function applyTheme() {
    var theme = state.ui.theme || 'dark';
    document.documentElement.dataset.theme = theme;
    var icon = $('#theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☾' : '☀';
  }

  function closeSidebar() {
    var sb = $('#sidebar');
    var mask = $('#sidebar-mask');
    if (sb) sb.classList.remove('open');
    if (mask) mask.hidden = true;
  }

  /* ------------------------------------------------------------------ */
  /* 事件绑定                                                            */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (el) handleAction(el);
    });

    document.addEventListener('change', function (e) {
      var cb = e.target;

      if (cb.classList && cb.classList.contains('md-task')) {
        var id = currentRoute.id;
        if (!id) return;
        var r = rec(id);
        r.ck = r.ck || {};
        r.ck[cb.dataset.k] = cb.checked;
        var li = cb.closest('li');
        if (li) li.classList.toggle('checked', cb.checked);
        touchDay();
        save();
        return;
      }

      if (cb.classList && cb.classList.contains('road-task')) {
        var tid = cb.dataset.task;
        state.tasks[tid] = { d: cb.checked ? 1 : 0, t: Date.now() };
        var label = cb.closest('.task');
        if (label) label.classList.toggle('done', cb.checked);
        touchDay();
        save();
        refreshRoadmapProgress();
        return;
      }

      if (cb.id === 'import-file' && cb.files && cb.files[0]) {
        importProgress(cb.files[0]);
        cb.value = '';
      }
    });

    main.addEventListener('scroll', function () {
      if (currentRoute.name !== 'note') return;
      if (scrollTimer) return;
      scrollTimer = requestAnimationFrame(function () {
        scrollTimer = null;
        updateTOCActive();
        saveScroll();
      });
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
      var mod = e.ctrlKey || e.metaKey;
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (palette.hidden) openPalette('');
        else closePalette();
        return;
      }

      if (e.key === 'Escape') {
        if (window.Lab && Lab.isDrawerOpen()) { Lab.closeDrawer(); return; }
        if (!palette.hidden) { closePalette(); return; }
        closeSidebar();
        return;
      }

      if (!palette.hidden) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (pItems.length) { pIndex = (pIndex + 1) % pItems.length; paintSelection(); }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (pItems.length) { pIndex = (pIndex - 1 + pItems.length) % pItems.length; paintSelection(); }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          var item = pItems[pIndex];
          if (item) { closePalette(); go(item.href); }
        }
        return;
      }

      if (e.key === '/' && !typing) {
        e.preventDefault();
        openPalette('');
      }
    });

    pInput.addEventListener('input', function () { renderPalette(pInput.value); });

    palette.addEventListener('click', function (e) {
      if (e.target === palette) closePalette();
    });

    $('#search-trigger').addEventListener('click', function () { openPalette(''); });

    $('#theme-btn').addEventListener('click', function () {
      state.ui.theme = state.ui.theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      save();
    });

    $('#menu-btn').addEventListener('click', function () {
      var sb = $('#sidebar');
      var mask = $('#sidebar-mask');
      sb.classList.add('open');
      mask.hidden = false;
    });

    $('#sidebar-mask').addEventListener('click', closeSidebar);

    window.addEventListener('hashchange', function () {
      render();
      main.scrollTo({ top: 0 });
    });

    window.addEventListener('beforeunload', function () {
      saveScroll();
      save();
    });

    var saveTimer = null;
    main.addEventListener('scroll', function () {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 800);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ */
  /* 启动                                                                */
  /* ------------------------------------------------------------------ */

  function boot() {
    buildNav();
    applyTheme();
    bindEvents();

    // 供 lab.js / toolbox.js 访问的状态与小工具
    window.SECNOTES = {
      get state() { return state; },
      save: save,
      refresh: render,
      go: go,
      esc: esc,
      notes: NOTES,
      noteById: noteById,
      catById: catById,
    };

    Search.build();

    if (location.protocol === 'file:' && !location.hash) {
      // file:// 下 fetch 不可用，正文走 bundle 兜底，这里只提示一下
      console.info('[SECNOTES] 以 file:// 打开，正文使用内置全文包。建议运行 start.bat 使用本地服务。');
    }

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
