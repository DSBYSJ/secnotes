/* ==========================================================================
   全局检索：启动时把笔记、工具、靶场、任务建成内存索引
   量级预期：几百篇笔记 → 毫秒级；上千篇仍可用
   ========================================================================== */
window.Search = (function () {
  'use strict';

  var docs = [];
  var built = false;

  function stripMd(md) {
    return String(md)
      .replace(/^---[\s\S]*?\n---/, ' ')
      .replace(/```[\w+#.\-]*/g, ' ')
      .replace(/`/g, ' ')
      .replace(/!?\[\[?([^\]]*)\]?\]\([^)]*\)/g, '$1')
      .replace(/[#>*_~|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function push(kind, id, title, sub, tags, body, href, icon) {
    var tagStr = (tags || []).join(' ');
    docs.push({
      kind: kind,
      id: id,
      title: title,
      sub: sub || '',
      tags: tags || [],
      hay: (title + ' ' + tagStr + ' ' + (sub || '')).toLowerCase(),
      body: (body || '').toLowerCase(),
      href: href,
      icon: icon,
    });
  }

  function build() {
    if (built) return;
    built = true;

    var catName = {};
    (window.CATEGORIES || []).forEach(function (c) { catName[c.id] = c.name; });

    var notes = (window.LIBRARY && window.LIBRARY.notes) || [];
    notes.forEach(function (n) {
      var raw = (window.NOTES_BUNDLE && window.NOTES_BUNDLE[n.id]) || '';
      // 去掉 front-matter 与首个 H1，避免摘要里重复标题
      var cleaned = raw.replace(/^---[\s\S]*?\n---/, '').replace(/^#\s+.+$/m, '');
      push('note', n.id, n.title, catName[n.category] || n.category, n.tags,
        stripMd(cleaned) + ' ' + (n.summary || ''), '#/note/' + encodeURIComponent(n.id), '记');
    });

    var arsenal = window.ARSENAL || {};
    (arsenal.tools || []).forEach(function (t) {
      push('tool', t.name, t.name, '工具 · ' + (t.cat || ''), t.tags, t.desc + ' ' + (t.install || ''),
        '#/arsenal?q=' + encodeURIComponent(t.name), '具');
    });
    (arsenal.labs || []).forEach(function (l) {
      push('lab', l.name, l.name, '靶场 · ' + (l.level || ''), l.tags, l.desc,
        '#/arsenal?tab=lab&q=' + encodeURIComponent(l.name), '靶');
    });

    var stages = (window.ROADMAP && window.ROADMAP.stages) || [];
    stages.forEach(function (s) {
      s.items.forEach(function (it) {
        push('task', it.id, it.text, '学习路径 · ' + s.name, [], '', '#/roadmap', '✓');
      });
    });

    var presets = (window.LEVELS && window.LEVELS.presets) || [];
    var custom = (window.SECNOTES && window.SECNOTES.state && window.SECNOTES.state.customSeries) || [];
    presets.concat(custom).forEach(function (s) {
      push('series', s.id, s.name, '关卡包 · ' + (s.group || '自定义'), s.tags,
        (s.desc || '') + ' ' + (s.tags || []).join(' '), '#/lab?tab=levels', '关');
    });
  }

  function countOccurrences(hay, needle, cap) {
    var n = 0, i = 0;
    while (n < cap) {
      i = hay.indexOf(needle, i);
      if (i === -1) break;
      n++;
      i += needle.length;
    }
    return n;
  }

  function makeSnippet(doc, tokens) {
    var text = doc.body || doc.sub || '';
    if (!text) return '';
    var idx = -1;
    for (var i = 0; i < tokens.length; i++) {
      var p = text.indexOf(tokens[i]);
      if (p !== -1 && (idx === -1 || p < idx)) idx = p;
    }
    if (idx === -1) return text.slice(0, 80);
    var start = Math.max(0, idx - 34);
    var end = Math.min(text.length, idx + 96);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }

  function query(q, limit) {
    build();
    var raw = String(q == null ? '' : q).trim().toLowerCase();
    if (!raw) return [];
    var tokens = raw.split(/\s+/).filter(Boolean);
    var out = [];

    docs.forEach(function (d) {
      var score = 0;
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        var s = 0;

        var ti = d.title.toLowerCase().indexOf(t);
        if (ti !== -1) s += ti === 0 ? 18 : 13;
        if (d.tags.join(' ').toLowerCase().indexOf(t) !== -1) s += 8;
        if (d.sub.toLowerCase().indexOf(t) !== -1) s += 6;
        if (d.hay.indexOf(t) !== -1) s += 4;

        var occ = countOccurrences(d.body, t, 4);
        if (occ) s += 2 + occ;

        if (!s) return; // 所有词都必须命中
        score += s;
      }
      if (d.title.toLowerCase().indexOf(raw) !== -1) score += 10;
      if (d.kind === 'note') score += 2;

      out.push({ doc: d, score: score, snippet: makeSnippet(d, tokens) });
    });

    out.sort(function (a, b) { return b.score - a.score || a.doc.title.length - b.doc.title.length; });
    return out.slice(0, limit || 20).map(function (r) {
      return {
        kind: r.doc.kind, id: r.doc.id, title: r.doc.title, sub: r.doc.sub,
        href: r.doc.href, icon: r.doc.icon, score: r.score, snippet: r.snippet,
      };
    });
  }

  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function highlight(text, tokens) {
    if (!tokens || !tokens.length) return MD.esc(text);
    var re = new RegExp('(' + tokens.map(escapeRe).join('|') + ')', 'gi');
    var parts = String(text).split(re);
    return parts.map(function (p, i) {
      return i % 2 ? '<mark>' + MD.esc(p) + '</mark>' : MD.esc(p);
    }).join('');
  }

  return { query: query, highlight: highlight, build: build, stripMd: stripMd };
})();
