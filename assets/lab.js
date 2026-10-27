/* ==========================================================================
   实战台：靶场记录 + 速查工具
   记录存在 localStorage（state.labs），可导出 Markdown 进知识库
   ========================================================================== */
window.Lab = (function () {
  'use strict';

  var STATUS = {
    todo: { label: '待打', cls: 'todo' },
    doing: { label: '进行中', cls: 'doing' },
    owned: { label: '已通关', cls: 'owned' },
    dropped: { label: '放弃', cls: 'dropped' },
  };
  var STATUS_ORDER = ['todo', 'doing', 'owned', 'dropped'];

  var PLATFORMS = ['HTB', 'TryHackMe', 'VulnHub', '自建靶场', '其他'];
  var DIFFS = ['Easy', 'Medium', 'Hard', 'Insane'];
  var SYSTEMS = ['Linux', 'Windows', 'Web', 'AD', '其他'];

  var filter = { status: 'all', q: '' };
  var drawerOpen = false;
  var editingId = null;

  function S() { return window.SECNOTES; }
  function esc(v) { return window.MD.esc(v); }

  function labs() {
    var st = S();
    return (st && st.state && st.state.labs) || [];
  }

  function byId(id) {
    var list = labs();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function fmtDate(s) {
    if (!s) return '—';
    return s.length >= 10 ? s.slice(5).replace('-', '/') : s;
  }

  function stats() {
    var list = labs();
    var out = { total: list.length, owned: 0, doing: 0, todo: 0, dropped: 0, platforms: {} };
    list.forEach(function (r) {
      if (out[r.status] !== undefined) out[r.status]++;
      out.platforms[r.platform || '其他'] = (out.platforms[r.platform || '其他'] || 0) + 1;
    });
    out.rate = out.total ? Math.round((out.owned / out.total) * 100) : 0;
    return out;
  }

  function tabs(active) {
    var items = [
      { id: 'log', label: '靶场记录', href: '#/lab' },
      { id: 'levels', label: '关卡', href: '#/lab?tab=levels' },
      { id: 'kit', label: '速查与工具', href: '#/lab?tab=kit' },
    ];
    return '<div class="seg" style="margin-bottom:18px">' + items.map(function (it) {
      return '<a' + (it.id === active ? ' class="on"' : '') + ' href="' + it.href + '">' + it.label + '</a>';
    }).join('') + '</div>';
  }

  /* ---------------- 关卡包 ---------------- */

  function seriesList() {
    var presets = (window.LEVELS && window.LEVELS.presets) || [];
    var custom = (S().state.customSeries || []);
    return presets.concat(custom);
  }

  function seriesById(id) {
    var list = seriesList();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function levelsStore() {
    var st = S().state;
    if (!st.levels || typeof st.levels !== 'object') st.levels = {};
    return st.levels;
  }

  function levelState(id) {
    return levelsStore()[id] || null;
  }

  function totalOf(s) {
    return s.kind === 'named' ? (s.items || []).length : Number(s.total) || 0;
  }

  function labelOf(s, i) {
    if (s.kind === 'named') return (s.items || [])[i] || String(i + 1);
    return (s.prefix || '') + (i + 1) + (s.suffix || '');
  }

  function doneCount(s) {
    var st = levelState(s.id);
    return st && st.done ? Object.keys(st.done).length : 0;
  }

  function addSeries(s) {
    var store = levelsStore();
    if (store[s.id]) return store[s.id];
    store[s.id] = { added: Date.now(), done: {} };
    S().save();
    return store[s.id];
  }

  function toggleLevel(series, key) {
    var store = levelsStore();
    if (!store[series.id]) addSeries(series);
    var done = store[series.id].done;
    if (done[key]) delete done[key];
    else done[key] = Date.now();
    S().save();
    return !!done[key];
  }

  function noteStore() {
    var st = S().state;
    if (!st.levelNotes || typeof st.levelNotes !== 'object') st.levelNotes = {};
    return st.levelNotes;
  }

  function levelNote(seriesId, key) {
    var box = noteStore()[seriesId];
    return (box && box[key]) || '';
  }

  function setLevelNote(seriesId, key, text) {
    var store = noteStore();
    if (!store[seriesId]) store[seriesId] = {};
    if (text) store[seriesId][key] = text;
    else delete store[seriesId][key];
    S().save();
  }

  function questionOf(s, idx) {
    var qs = s.questions || [];
    var q = qs[idx];
    return q ? { t: q[0], h: q[1] } : null;
  }

  function levelsSummary() {
    var added = seriesList().filter(function (s) { return levelState(s.id); });
    var total = 0, done = 0;
    added.forEach(function (s) {
      total += totalOf(s);
      done += doneCount(s);
    });
    return { series: added.length, total: total, done: done, rate: total ? Math.round((done / total) * 100) : 0 };
  }

  function lvChips(s) {
    var st = levelState(s.id);
    var done = (st && st.done) || {};
    var total = totalOf(s);
    var html = '';
    for (var i = 0; i < total; i++) {
      var key = String(i);
      var q = questionOf(s, i);
      var tip = labelOf(s, i) + (q ? '：' + q.t : '');
      html += '<button type="button" class="lv-chip' + (done[key] ? ' done' : '') +
        '" data-lv="' + key + '" title="' + esc(tip) + '">' +
        esc(labelOf(s, i)) + '</button>';
    }
    return html;
  }

  function lvCard(s) {
    var st = levelState(s.id);
    var total = totalOf(s);
    var done = doneCount(s);
    var pct = total ? Math.round((done / total) * 100) : 0;
    var isCustom = !!s.custom;

    return '<article class="lv-card" data-series="' + esc(s.id) + '" data-search="' +
        esc((s.name + ' ' + (s.group || '') + ' ' + (s.tags || []).join(' ') + ' ' + (s.desc || '')).toLowerCase()) + '">' +
      '<header class="lv-head">' +
        '<div class="lv-title">' +
          '<h3>' + esc(s.name) + '</h3>' +
          '<span class="chip">' + esc(s.group || '自定义') + '</span>' +
        '</div>' +
        '<span class="lv-count" data-count>' + (st ? done + '/' + total : total + ' 关') + '</span>' +
      '</header>' +
      (s.desc ? '<p class="lv-desc">' + esc(s.desc) + '</p>' : '') +
      '<div class="bar"><i data-bar style="width:' + pct + '%"></i></div>' +
      '<div class="lv-actions">' +
        (st
          ? '<button class="btn ghost" data-lv-toggle>展开关卡</button>' +
            '<button class="btn ghost" data-lv-all>全部标记</button>' +
            '<button class="btn ghost" data-lv-clear>清空</button>'
          : '<button class="btn primary" data-lv-add>一键添加 ' + total + ' 关</button>') +
        (isCustom ? '<button class="btn ghost danger-text" data-lv-remove>移除</button>' : '') +
        (s.url ? '<a class="lv-link" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">靶场 ↗</a>' : '') +
      '</div>' +
      '<div class="lv-grid' + (s.kind === 'named' ? ' named' : '') + '" data-grid hidden></div>' +
    '</article>';
  }

  function levelsView() {
    var list = seriesList();
    var addedIds = {};
    list.forEach(function (s) { if (levelState(s.id)) addedIds[s.id] = 1; });
    var ordered = list.slice().sort(function (a, b) {
      var da = addedIds[a.id] ? 1 : 0, db = addedIds[b.id] ? 1 : 0;
      if (da !== db) return db - da;
      return 0;
    });
    var sum = levelsSummary();

    return '' +
      '<div class="page-head">' +
        '<div class="kicker">LEVELS</div>' +
        '<h1>关卡</h1>' +
        '<p>把小关卡打包进来，一关一格。点开就是题面与提示，打完标记通关，' +
          '顺手把解法记在这关下面。不用一条条建记录——选好关卡包，剩下的自动生成。</p>' +
      '</div>' +

      tabs('levels') +

      '<div class="lab-stats">' +
        '<div class="lab-stat"><span>已添加系列</span><b data-sum="series">' + sum.series + '</b></div>' +
        '<div class="lab-stat"><span>关卡总数</span><b data-sum="total">' + sum.total + '</b></div>' +
        '<div class="lab-stat"><span>已通关</span><b class="accent" data-sum="done">' + sum.done + '</b></div>' +
        '<div class="lab-stat"><span>完成率</span><b data-sum="rate">' + sum.rate + '%</b></div>' +
        '<div class="lab-stat wide"><span>提示</span><b class="small">点格子看题面，Shift + 点击直接标记通关</b></div>' +
      '</div>' +

      '<div class="filter-row">' +
        '<label class="filter-input"><span class="search-ico">⌕</span>' +
          '<input id="lv-q" type="search" placeholder="过滤关卡包名称、标签…" />' +
        '</label>' +
        '<button class="btn" id="lv-custom" type="button">+ 自定义关卡包</button>' +
      '</div>' +

      '<div class="lv-list" id="lv-list">' + ordered.map(lvCard).join('') + '</div>';
  }


  /* ---------------- 列表视图 ---------------- */

  function logView() {
    var st = stats();
    var list = labs();

    var platformLine = Object.keys(st.platforms).map(function (k) {
      return k + ' ' + st.platforms[k];
    }).join(' · ') || '还没有记录';

    var tabsHtml = tabs('log');

    var statusPills = '<div class="pill-row" id="lab-status">' +
      '<button class="pill active" data-status="all">全部 ' + st.total + '</button>' +
      STATUS_ORDER.map(function (s) {
        return '<button class="pill" data-status="' + s + '">' + STATUS[s].label +
          (st[s] ? ' ' + st[s] : '') + '</button>';
      }).join('') +
    '</div>';

    var body = list.length ? list.map(card).join('') : emptyBlock();

    return '' +
      '<div class="page-head">' +
        '<div class="kicker">LAB</div>' +
        '<h1>实战台</h1>' +
        '<p>打过的机器记在这里：从哪进的、怎么提权的、踩了什么坑。' +
          '记录是给自己复习用的，也是求职时唯一拿得出手的过程证据。</p>' +
      '</div>' +

      tabsHtml +

      '<div class="lab-stats">' +
        '<div class="lab-stat"><span>记录</span><b>' + st.total + '</b></div>' +
        '<div class="lab-stat"><span>已通关</span><b class="accent">' + st.owned + '</b></div>' +
        '<div class="lab-stat"><span>进行中</span><b class="warn">' + st.doing + '</b></div>' +
        '<div class="lab-stat"><span>通关率</span><b>' + st.rate + '%</b></div>' +
        '<div class="lab-stat wide"><span>平台分布</span><b class="small">' + esc(platformLine) + '</b></div>' +
      '</div>' +

      '<div class="filter-row">' +
        '<label class="filter-input"><span class="search-ico">⌕</span>' +
          '<input id="lab-q" type="search" placeholder="搜名称、IP、标签、入口点…" />' +
        '</label>' +
        '<button class="btn primary" id="lab-new" type="button">+ 新建记录</button>' +
      '</div>' +
      '<div style="margin-bottom:16px">' + statusPills + '</div>' +
      '<div class="lab-grid" id="lab-grid">' + body + '</div>';
  }

  function card(r) {
    var st = STATUS[r.status] || STATUS.todo;
    var tags = (r.tags || []).map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('');
    var search = [r.name, r.target, (r.tags || []).join(' '), r.entry, r.privesc, r.takeaway, r.platform, r.os]
      .join(' ').toLowerCase();

    return '<article class="lab-rec" data-id="' + esc(r.id) + '" data-status="' + esc(r.status) + '" data-search="' + esc(search) + '">' +
      '<header class="lr-top">' +
        '<span class="lr-dot ' + st.cls + '"></span>' +
        '<h3>' + esc(r.name || '未命名') + '</h3>' +
        '<span class="lr-date">' + esc(fmtDate(r.date)) + '</span>' +
      '</header>' +
      '<div class="lr-chips">' +
        '<span class="chip accent">' + st.label + '</span>' +
        (r.platform ? '<span class="chip">' + esc(r.platform) + '</span>' : '') +
        (r.difficulty ? '<span class="chip">' + esc(r.difficulty) + '</span>' : '') +
        (r.os ? '<span class="chip">' + esc(r.os) + '</span>' : '') +
      '</div>' +
      (r.target ? '<div class="lr-line"><span>目标</span><code>' + esc(r.target) + '</code></div>' : '') +
      (r.entry ? '<div class="lr-line"><span>入口</span><span class="lr-text"><span class="clamp2">' + esc(r.entry) + '</span></span></div>' : '') +
      (r.privesc ? '<div class="lr-line"><span>提权</span><span class="lr-text"><span class="clamp2">' + esc(r.privesc) + '</span></span></div>' : '') +
      '<footer class="lr-foot">' +
        '<div class="lr-tags">' + tags + '</div>' +
        (r.note && S().noteById[r.note]
          ? '<a class="lr-link" href="#/note/' + encodeURIComponent(r.note) + '">相关笔记 →</a>'
          : '<span class="lr-edit">编辑 →</span>') +
      '</footer>' +
    '</article>';
  }

  function emptyBlock() {
    return '<div class="lab-empty">' +
      '<h3>还没有实战记录</h3>' +
      '<p>建议的第一条：在 TryHackMe 或 HTB 上找一台 Easy，打完立刻记四件事——' +
        '怎么找到入口、用了什么凭据、怎么提权、卡在哪。</p>' +
      '<button class="btn primary" id="lab-new-2" type="button">记录第一台</button>' +
    '</div>';
  }

  /* ---------------- 表单抽屉 ---------------- */

  function options(list, current) {
    return list.map(function (v) {
      return '<option value="' + esc(v) + '"' + (v === current ? ' selected' : '') + '>' + esc(v) + '</option>';
    }).join('');
  }

  function blank() {
    return {
      id: '', name: '', platform: 'HTB', difficulty: 'Easy', status: 'todo', date: today(),
      os: 'Linux', target: '', entry: '', privesc: '', takeaway: '', note: '', tags: [],
    };
  }

  function formHtml(r) {
    var notes = S().notes || [];
    var noteOpts = '<option value="">不关联</option>' + notes.map(function (n) {
      return '<option value="' + esc(n.id) + '"' + (n.id === r.note ? ' selected' : '') + '>' + esc(n.title) + '</option>';
    }).join('');

    return '' +
      '<div class="drawer-head">' +
        '<div><h3>' + (r.id ? '编辑记录' : '新建记录') + '</h3>' +
        '<span>只有本地可见，不上传</span></div>' +
        '<button class="icon-btn" data-close="1" type="button" aria-label="关闭">✕</button>' +
      '</div>' +
      '<form class="drawer-form" id="lab-form">' +
        '<label class="df"><span>名称 <i>*</i></span>' +
          '<input name="name" value="' + esc(r.name) + '" placeholder="Forest / Blue / 自建靶场-01" required /></label>' +

        '<div class="df-row">' +
          '<label class="df"><span>平台</span><select name="platform">' + options(PLATFORMS, r.platform) + '</select></label>' +
          '<label class="df"><span>难度</span><select name="difficulty">' + options(DIFFS, r.difficulty) + '</select></label>' +
        '</div>' +

        '<div class="df-row">' +
          '<label class="df"><span>状态</span><select name="status">' +
            STATUS_ORDER.map(function (s) {
              return '<option value="' + s + '"' + (s === r.status ? ' selected' : '') + '>' + STATUS[s].label + '</option>';
            }).join('') + '</select></label>' +
          '<label class="df"><span>日期</span><input name="date" type="date" value="' + esc(r.date) + '" /></label>' +
        '</div>' +

        '<div class="df-row">' +
          '<label class="df"><span>系统</span><select name="os">' + options(SYSTEMS, r.os) + '</select></label>' +
          '<label class="df"><span>目标 IP / 域名</span><input name="target" value="' + esc(r.target) + '" placeholder="10.10.10.161" /></label>' +
        '</div>' +

        '<label class="df"><span>入口点 · 怎么进来的</span>' +
          '<textarea name="entry" rows="3" placeholder="端口 445 的 SMB 匿名共享 → 用户名枚举 → AS-REP Roasting 拿到 hash">' + esc(r.entry) + '</textarea></label>' +

        '<label class="df"><span>提权 / 横向 · 关键一步</span>' +
          '<textarea name="privesc" rows="3" placeholder="SeBackupPrivilege 导出注册表 → 读本地管理员 hash → psexec">' + esc(r.privesc) + '</textarea></label>' +

        '<label class="df"><span>复盘 · 卡在哪、下次怎么更快</span>' +
          '<textarea name="takeaway" rows="3" placeholder="卡在 Kerberoast 的 SPN 枚举，之前一直用错字典；下次先用 GetUserSPNs 再决定方向">' + esc(r.takeaway) + '</textarea></label>' +

        '<div class="df-row">' +
          '<label class="df"><span>关联笔记</span><select name="note">' + noteOpts + '</select></label>' +
          '<label class="df"><span>标签（逗号分隔）</span>' +
            '<input name="tags" value="' + esc((r.tags || []).join(', ')) + '" placeholder="AD, Kerberos" /></label>' +
        '</div>' +

        '<div class="df-hint">导出为 Markdown 后，放到 <code>content/notes/labs/</code> 再跑一次索引脚本，' +
          '这条记录就会变成知识库里的一篇复盘笔记。</div>' +
      '</form>' +
      '<div class="drawer-foot">' +
        '<button class="btn danger" id="lab-del" type="button"' + (r.id ? '' : ' disabled') + '>删除</button>' +
        '<span style="flex:1"></span>' +
        '<button class="btn" id="lab-md" type="button">导出 Markdown</button>' +
        '<button class="btn" data-close="1" type="button">取消</button>' +
        '<button class="btn primary" id="lab-save" type="button">保存</button>' +
      '</div>';
  }

  function ensureDrawer() {
    if (document.getElementById('lab-drawer')) return;
    var mask = document.createElement('div');
    mask.className = 'drawer-mask';
    mask.id = 'lab-mask';
    mask.hidden = true;
    var aside = document.createElement('aside');
    aside.className = 'drawer';
    aside.id = 'lab-drawer';
    document.body.appendChild(mask);
    document.body.appendChild(aside);
    mask.addEventListener('click', closeDrawer);
    // 只绑一次：抽屉元素常驻，内部内容每次替换
    aside.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) closeDrawer();
    });
  }

  function openDrawer(id) {
    ensureDrawer();
    editingId = id || null;
    var rec = id ? byId(id) : null;
    if (!rec) rec = blank();

    var drawer = document.getElementById('lab-drawer');
    var mask = document.getElementById('lab-mask');
    drawer.innerHTML = formHtml(rec);
    mask.hidden = false;
    document.body.classList.add('drawer-open');
    requestAnimationFrame(function () { drawer.classList.add('open'); });
    drawerOpen = true;

    var form = document.getElementById('lab-form');
    var nameInput = form.querySelector('[name="name"]');
    if (nameInput) setTimeout(function () { nameInput.focus(); }, 120);

    document.getElementById('lab-save').addEventListener('click', function () {
      saveForm(form, id);
    });

    document.getElementById('lab-del').addEventListener('click', function () {
      if (!id) return;
      var r = byId(id);
      if (!window.confirm('删除「' + (r ? r.name : '') + '」这条记录？不可恢复。')) return;
      var st = S().state;
      st.labs = labs().filter(function (x) { return x.id !== id; });
      S().save();
      closeDrawer();
      S().refresh();
    });

    document.getElementById('lab-md').addEventListener('click', function () {
      downloadMd(readForm(form, editingId));
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      saveForm(form, id);
    });
  }

  function readForm(form, id) {
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });
    data.id = id || '';
    data.tags = String(data.tags || '').split(/[,，\s]+/).map(function (t) { return t.trim(); }).filter(Boolean);
    return data;
  }

  function saveForm(form, id) {
    var data = readForm(form, id);
    if (!data.name) {
      var n = form.querySelector('[name="name"]');
      n.focus();
      n.style.borderColor = 'var(--danger)';
      return;
    }
    var st = S().state;
    if (!Array.isArray(st.labs)) st.labs = [];

    if (id) {
      for (var i = 0; i < st.labs.length; i++) {
        if (st.labs[i].id === id) {
          st.labs[i] = Object.assign({}, st.labs[i], data, { id: id, updated: Date.now() });
          break;
        }
      }
    } else {
      data.id = 'l' + Date.now().toString(36);
      data.created = Date.now();
      data.updated = Date.now();
      st.labs.unshift(data);
    }
    S().save();
    closeDrawer();
    S().refresh();
  }

  function closeDrawer() {
    var drawer = document.getElementById('lab-drawer');
    var mask = document.getElementById('lab-mask');
    if (!drawer || !mask) return;
    drawer.classList.remove('open');
    mask.hidden = true;
    document.body.classList.remove('drawer-open');
    drawerOpen = false;
    setTimeout(function () {
      if (!drawer.classList.contains('open')) drawer.innerHTML = '';
    }, 220);
  }

  /* ---------------- 导出 ---------------- */

  function download(name, text) {
    var blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function downloadMd(r) {
    var name = (r.name || 'lab').replace(/[\\/:*?"<>|\s]+/g, '-');
    var lines = [];
    lines.push('---');
    lines.push('title: ' + (r.name || '未命名') + (r.platform ? ' · ' + r.platform : ''));
    lines.push('category: labs');
    lines.push('tags: [' + [(r.platform || ''), (r.os || '')].concat(r.tags || []).filter(Boolean).join(', ') + ']');
    lines.push('summary: ' + [r.platform, r.difficulty, STATUS[r.status] && STATUS[r.status].label]
      .filter(Boolean).join(' · '));
    lines.push('level: 2');
    lines.push('updated: ' + (r.date || today()));
    lines.push('---');
    lines.push('');
    lines.push('# ' + (r.name || '未命名'));
    lines.push('');
    lines.push('| 项 | 值 |');
    lines.push('| --- | --- |');
    lines.push('| 平台 | ' + (r.platform || '—') + ' |');
    lines.push('| 难度 | ' + (r.difficulty || '—') + ' |');
    lines.push('| 状态 | ' + ((STATUS[r.status] || {}).label || '—') + ' |');
    lines.push('| 系统 | ' + (r.os || '—') + ' |');
    lines.push('| 目标 | ' + (r.target || '—') + ' |');
    lines.push('| 日期 | ' + (r.date || '—') + ' |');
    lines.push('');
    lines.push('## 入口');
    lines.push('');
    lines.push(r.entry || '_待补充_');
    lines.push('');
    lines.push('## 提权 / 横向');
    lines.push('');
    lines.push(r.privesc || '_待补充_');
    lines.push('');
    lines.push('## 复盘');
    lines.push('');
    lines.push(r.takeaway || '_待补充_');
    lines.push('');
    download(name + '.md', lines.join('\n'));
  }

  /* ---------------- 工具视图 ---------------- */

  function kitView() {
    return '' +
      '<div class="page-head">' +
        '<div class="kicker">KIT</div>' +
        '<h1>速查与工具</h1>' +
        '<p>打靶时经常要用的几件事：转个编码、算个哈希、拆个 JWT、看个网段、抄一段命令。' +
          '全部在本地完成，内容不会离开浏览器。</p>' +
      '</div>' +
      '<div class="seg" style="margin-bottom:20px">' +
        '<a href="#/lab">靶场记录</a>' +
        '<a href="#/lab?tab=levels">关卡</a>' +
        '<a class="on" href="#/lab?tab=kit">速查与工具</a>' +
      '</div>' +
      window.Toolbox.html();
  }

  /* ---------------- 挂载 ---------------- */

  function view(tab) {
    closeDrawer();
    if (tab === 'kit') return kitView();
    if (tab === 'levels') return levelsView();
    return logView();
  }

  function mount(tab) {
    var root = document.getElementById('view');
    if (!root) return;

    if (tab === 'kit') {
      window.Toolbox.mount(root);
      return;
    }
    if (tab === 'levels') {
      mountLevels(root);
      return;
    }

    var newBtn = document.getElementById('lab-new');
    if (newBtn) newBtn.addEventListener('click', function () { openDrawer(null); });
    var newBtn2 = document.getElementById('lab-new-2');
    if (newBtn2) newBtn2.addEventListener('click', function () { openDrawer(null); });

    var grid = document.getElementById('lab-grid');
    if (grid) {
      grid.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        var cardEl = e.target.closest('.lab-rec');
        if (!cardEl) return;
        openDrawer(cardEl.dataset.id);
      });
    }

    var q = document.getElementById('lab-q');
    var pills = document.getElementById('lab-status');
    var active = 'all';

    function apply() {
      if (!grid) return;
      var text = q ? q.value.trim().toLowerCase() : '';
      var cards = grid.querySelectorAll('.lab-rec');
      var shown = 0;
      Array.prototype.forEach.call(cards, function (el) {
        var okStatus = active === 'all' || el.dataset.status === active;
        var okText = !text || el.dataset.search.indexOf(text) !== -1;
        var show = okStatus && okText;
        el.style.display = show ? '' : 'none';
        if (show) shown++;
      });
      var empty = grid.querySelector('.empty');
      if (!cards.length) return;
      if (!shown && !empty) {
        var d = document.createElement('div');
        d.className = 'empty';
        d.textContent = '没有匹配的记录';
        grid.appendChild(d);
      } else if (shown && empty) {
        empty.remove();
      }
    }

    if (q) q.addEventListener('input', apply);
    if (pills) {
      pills.addEventListener('click', function (e) {
        var b = e.target.closest('[data-status]');
        if (!b) return;
        active = b.dataset.status;
        Array.prototype.forEach.call(pills.children, function (x) { x.classList.toggle('active', x === b); });
        apply();
      });
    }
  }

  /* ---------------- 关卡挂载 ---------------- */

  function updateLevelSummary() {
    var sum = levelsSummary();
    var map = { series: sum.series, total: sum.total, done: sum.done, rate: sum.rate + '%' };
    Object.keys(map).forEach(function (k) {
      var el = document.querySelector('[data-sum="' + k + '"]');
      if (el) el.textContent = map[k];
    });
  }

  function refreshCard(card, s) {
    var done = doneCount(s);
    var total = totalOf(s);
    var pct = total ? Math.round((done / total) * 100) : 0;
    var count = card.querySelector('[data-count]');
    if (count) count.textContent = done + '/' + total;
    var bar = card.querySelector('[data-bar]');
    if (bar) bar.style.width = pct + '%';
    var grid = card.querySelector('[data-grid]');
    if (grid && grid.childElementCount) {
      var st = levelState(s.id);
      Array.prototype.forEach.call(grid.children, function (chip) {
        chip.classList.toggle('done', !!(st && st.done && st.done[chip.dataset.lv]));
      });
    }
  }

  function openLevel(s, idx) {
    ensureDrawer();
    var drawer = document.getElementById('lab-drawer');
    var mask = document.getElementById('lab-mask');
    if (!drawer || !mask) return;

    var total = totalOf(s);
    idx = Math.max(0, Math.min(total - 1, idx));
    var key = String(idx);
    var st = levelState(s.id);
    var done = !!(st && st.done && st.done[key]);
    var q = questionOf(s, idx);
    var note = levelNote(s.id, key);
    var label = labelOf(s, idx);

    drawer.innerHTML =
      '<div class="drawer-head">' +
        '<div><h3>' + esc(label) + '</h3>' +
          '<span>' + esc(s.name) + ' · 第 ' + (idx + 1) + ' / ' + total + ' 关' +
            (s.group ? ' · ' + esc(s.group) : '') + '</span></div>' +
        '<button class="icon-btn" data-close="1" type="button" aria-label="关闭">✕</button>' +
      '</div>' +
      '<div class="drawer-form">' +
        '<div class="lvd-q">' +
          '<div class="lvd-label">题面</div>' +
          (q ? '<p>' + esc(q.t) + '</p>'
             : '<p class="lvd-empty">这一关没有内置题面，直接在下面写你的题目和解法。</p>') +
        '</div>' +
        (q && q.h
          ? '<details class="lvd-hint"><summary>提示（想不出来再点开）</summary><p>' + esc(q.h) + '</p></details>'
          : '') +
        (s.goal ? '<div class="df-hint">' + esc(s.goal) + '</div>' : '') +
        '<label class="df"><span>我的解法 / 记录</span>' +
          '<textarea id="lvd-note" rows="7" spellcheck="false" ' +
            'placeholder="payload、卡住的点、下次怎么更快">' + esc(note) + '</textarea></label>' +
        '<div class="df-hint">Shift + 点击格子可以直接标记通关，不打开这个面板。</div>' +
      '</div>' +
      '<div class="drawer-foot">' +
        '<button class="btn ghost" id="lvd-prev" type="button"' + (idx === 0 ? ' disabled' : '') + '>← 上一关</button>' +
        '<button class="btn ghost" id="lvd-next" type="button"' + (idx === total - 1 ? ' disabled' : '') + '>下一关 →</button>' +
        '<span style="flex:1"></span>' +
        '<button class="btn primary" id="lvd-toggle" type="button">' +
          (done ? '取消通关' : '标记通关') + '</button>' +
      '</div>';

    mask.hidden = false;
    document.body.classList.add('drawer-open');
    requestAnimationFrame(function () { drawer.classList.add('open'); });
    drawerOpen = true;

    var ta = document.getElementById('lvd-note');
    var timer = null;
    ta.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { setLevelNote(s.id, key, ta.value.trim()); }, 400);
    });
    ta.addEventListener('blur', function () { setLevelNote(s.id, key, ta.value.trim()); });

    document.getElementById('lvd-toggle').addEventListener('click', function () {
      setLevelNote(s.id, key, ta.value.trim());
      toggleLevel(s, key);
      var card = document.querySelector('.lv-card[data-series="' + s.id + '"]');
      if (card) refreshCard(card, s);
      updateLevelSummary();
      openLevel(s, idx);
    });

    document.getElementById('lvd-prev').addEventListener('click', function () { openLevel(s, idx - 1); });
    document.getElementById('lvd-next').addEventListener('click', function () { openLevel(s, idx + 1); });
  }

  function mountLevels(root) {
    var listEl = document.getElementById('lv-list');
    if (!listEl) return;

    function expand(card, s, force) {
      var grid = card.querySelector('[data-grid]');
      var btn = card.querySelector('[data-lv-toggle]');
      if (!grid) return;
      var willOpen = force === undefined ? grid.hidden : force;
      if (willOpen && !grid.childElementCount) grid.innerHTML = lvChips(s);
      grid.hidden = !willOpen;
      if (btn) btn.textContent = willOpen ? '收起关卡' : '展开关卡';
    }

    listEl.addEventListener('click', function (e) {
      var card = e.target.closest('.lv-card');
      if (!card) return;
      var s = seriesById(card.dataset.series);
      if (!s) return;

      // 一键添加：生成整套关卡
      if (e.target.closest('[data-lv-add]')) {
        addSeries(s);
        card.outerHTML = lvCard(s);
        var fresh = listEl.querySelector('[data-series="' + s.id + '"]');
        if (fresh) expand(fresh, s, true);
        updateLevelSummary();
        return;
      }

      if (e.target.closest('[data-lv-toggle]')) {
        expand(card, s);
        return;
      }

      if (e.target.closest('[data-lv-all]')) {
        var st = levelState(s.id);
        if (!st) return;
        var total = totalOf(s);
        for (var i = 0; i < total; i++) {
          if (!st.done[String(i)]) st.done[String(i)] = Date.now();
        }
        S().save();
        refreshCard(card, s);
        updateLevelSummary();
        return;
      }

      if (e.target.closest('[data-lv-clear]')) {
        var st2 = levelState(s.id);
        if (!st2) return;
        if (!window.confirm('清空「' + s.name + '」的全部通关标记？')) return;
        st2.done = {};
        S().save();
        refreshCard(card, s);
        updateLevelSummary();
        return;
      }

      if (e.target.closest('[data-lv-remove]')) {
        if (!window.confirm('移除自定义关卡包「' + s.name + '」？进度一并删除。')) return;
        var stt = S().state;
        stt.customSeries = (stt.customSeries || []).filter(function (x) { return x.id !== s.id; });
        if (stt.levels) delete stt.levels[s.id];
        S().save();
        S().refresh();
        return;
      }

      var chip = e.target.closest('.lv-chip');
      if (chip) {
        if (e.shiftKey) {
          var on = toggleLevel(s, chip.dataset.lv);
          chip.classList.toggle('done', on);
          refreshCard(card, s);
          updateLevelSummary();
        } else {
          openLevel(s, Number(chip.dataset.lv));
        }
      }
    });

    var q = document.getElementById('lv-q');
    if (q) {
      q.addEventListener('input', function () {
        var text = q.value.trim().toLowerCase();
        Array.prototype.forEach.call(listEl.querySelectorAll('.lv-card'), function (el) {
          el.style.display = (!text || el.dataset.search.indexOf(text) !== -1) ? '' : 'none';
        });
      });
    }

    var custom = document.getElementById('lv-custom');
    if (custom) custom.addEventListener('click', openCustomForm);
  }

  function openCustomForm() {
    ensureDrawer();
    var drawer = document.getElementById('lab-drawer');
    var mask = document.getElementById('lab-mask');
    if (!drawer || !mask) return;

    drawer.innerHTML =
      '<div class="drawer-head">' +
        '<div><h3>自定义关卡包</h3><span>按数量自动生成，例如某个 30 关的靶场</span></div>' +
        '<button class="icon-btn" data-close="1" type="button" aria-label="关闭">✕</button>' +
      '</div>' +
      '<form class="drawer-form" id="lv-form">' +
        '<label class="df"><span>名称 <i>*</i></span>' +
          '<input name="name" placeholder="例如：PortSwigger SQL 注入实验" /></label>' +
        '<div class="df-row">' +
          '<label class="df"><span>关卡数量 <i>*</i></span>' +
            '<input name="total" type="number" min="1" max="300" value="20" /></label>' +
          '<label class="df"><span>编号前缀</span>' +
            '<input name="prefix" placeholder="Lab- / 第 / 留空" /></label>' +
        '</div>' +
        '<div class="df-hint">生成后每关一个格子，点一下标记通关，进度自动保存。' +
          '如果要「按名字而不是编号」的关卡包（例如 DVWA 的模块列表），' +
          '直接改 <code>content/levels.js</code> 里的 <code>kind: named</code> 即可。</div>' +
      '</form>' +
      '<div class="drawer-foot">' +
        '<span style="flex:1"></span>' +
        '<button class="btn" data-close="1" type="button">取消</button>' +
        '<button class="btn primary" id="lv-create" type="button">创建</button>' +
      '</div>';

    mask.hidden = false;
    document.body.classList.add('drawer-open');
    requestAnimationFrame(function () { drawer.classList.add('open'); });
    drawerOpen = true;

    var form = document.getElementById('lv-form');
    var nameInput = form.querySelector('[name="name"]');
    setTimeout(function () { nameInput.focus(); }, 120);

    document.getElementById('lv-create').addEventListener('click', function () {
      var name = form.querySelector('[name="name"]').value.trim();
      var total = parseInt(form.querySelector('[name="total"]').value, 10);
      var prefix = form.querySelector('[name="prefix"]').value;

      if (!name) {
        nameInput.focus();
        nameInput.style.borderColor = 'var(--danger)';
        return;
      }
      if (!total || total < 1 || total > 300) {
        window.alert('关卡数量需要在 1–300 之间');
        return;
      }

      var st = S().state;
      st.customSeries = st.customSeries || [];
      var series = {
        id: 'c' + Date.now().toString(36),
        name: name,
        group: '自定义',
        kind: 'numeric',
        total: total,
        prefix: prefix,
        desc: '',
        tags: [],
        custom: true,
      };
      st.customSeries.push(series);
      // 建完即入库，直接生成整套关卡
      addSeries(series);
      S().save();
      closeDrawer();
      S().refresh();
    });
  }

  return {
    view: view,
    mount: mount,
    closeDrawer: closeDrawer,
    isDrawerOpen: function () { return drawerOpen; },
  };
})();
