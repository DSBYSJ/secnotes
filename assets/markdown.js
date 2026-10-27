/* ==========================================================================
   极简 Markdown 渲染器（零依赖，够用为止）
   支持：标题 / 段落 / 粗斜体 / 删除线 / 行内代码 / 代码块 / 引用与告警
       无序有序列表（两级嵌套）/ 任务清单 / 表格 / 分割线 / 图片 / 链接 / [[双链]]
   不支持：原始 HTML（出于安全与简洁，一律转义）
   ========================================================================== */
window.MD = (function () {
  'use strict';

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  }

  var ALERTS = { NOTE: 'note', TIP: 'tip', WARNING: 'warning', CAUTION: 'caution', IMPORTANT: 'important' };
  var ALERT_LABEL = { note: '备注', tip: '提示', warning: '警告', caution: '注意', important: '重要' };

  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return 'k' + (h >>> 0).toString(36);
  }

  function slugify(text, used) {
    var base = String(text)
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[`*_~\[\]()#]/g, '')
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    if (!base) base = 'section';
    if (base.length > 48) base = base.slice(0, 48);
    var id = base, n = 2;
    while (used.has(id)) { id = base + '-' + n; n++; }
    used.add(id);
    return id;
  }

  /* ---------------- 行内 ---------------- */

  function inline(text, ctx) {
    var codes = [];
    var s = String(text).replace(/`+([^`\n]+)`+/g, function (m, c) {
      codes.push(c);
      return '\u0000' + (codes.length - 1) + '\u0000';
    });

    s = esc(s);

    // [[笔记 id]] / [[笔记 id|显示文字]]
    s = s.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, function (m, target, label) {
      var note = ctx.resolve ? ctx.resolve(String(target).trim()) : null;
      if (!note) return '<span class="wiki-broken">' + (label || target) + '</span>';
      var txt = label || note.title;
      return '<a class="wiki" href="#/note/' + esc(note.id) + '">' + esc(txt) + '</a>';
    });

    // 图片
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, function (m, alt, src, title) {
      return '<img src="' + src + '" alt="' + alt + '"' + (title ? ' title="' + title + '"' : '') + ' loading="lazy" />';
    });

    // 链接
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, function (m, txt, href, title) {
      var ext = /^https?:\/\//i.test(href);
      return '<a href="' + href + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : '') +
        (title ? ' title="' + title + '"' : '') + '>' + txt + '</a>';
    });

    // 粗体 / 斜体 / 删除线
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

    // 还原行内代码
    s = s.replace(/\u0000(\d+)\u0000/g, function (m, idx) {
      return '<code>' + esc(codes[Number(idx)]) + '</code>';
    });

    return s;
  }

  /* ---------------- 块级 ---------------- */

  var RE_FENCE = /^\s*(`{3,}|~{3,})\s*([\w+#.\-]*)\s*$/;
  var RE_HEAD = /^(#{1,6})\s+(.*)$/;
  var RE_HR = /^\s*([-*_])\s*(\1\s*){2,}$/;
  var RE_QUOTE = /^\s{0,3}>/;
  var RE_LIST = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;
  var RE_TASK = /^\[([ xX])\]\s+([\s\S]*)$/;

  function codeBlock(code, lang) {
    var label = lang || 'text';
    return '<div class="code-wrap" data-lang="' + esc(label) + '">' +
      '<div class="code-bar"><span>' + esc(label) + '</span>' +
      '<button type="button" class="copy-btn" data-act="copy">复制</button></div>' +
      '<pre><code>' + esc(code) + '</code></pre></div>';
  }

  function splitRow(row) {
    var s = String(row).trim();
    if (s.charAt(0) === '|') s = s.slice(1);
    if (s.charAt(s.length - 1) === '|' && s.charAt(s.length - 2) !== '\\') s = s.slice(0, -1);
    var cells = [], cur = '', escaped = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (escaped) {
        cur += ch === '|' ? '|' : '\\' + ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '|') { cells.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (escaped) cur += '\\';
    cells.push(cur);
    return cells.map(function (c) { return c.trim(); });
  }

  function isTableStart(lines, i) {
    if (i + 1 >= lines.length) return false;
    if (lines[i].indexOf('|') === -1) return false;
    var sep = lines[i + 1];
    if (!/^[\s|:\-]+$/.test(sep) || sep.indexOf('-') === -1) return false;
    return splitRow(sep).length >= 2;
  }

  function isBlockStart(lines, i) {
    var line = lines[i];
    if (!line.trim()) return true;
    if (RE_FENCE.test(line) || RE_HEAD.test(line) || RE_HR.test(line)) return true;
    if (RE_QUOTE.test(line) || RE_LIST.test(line)) return true;
    if (isTableStart(lines, i)) return true;
    return false;
  }

  function buildList(items, start, baseIndent, ctx) {
    var ordered = items[start].ordered;
    var tag = ordered ? 'ol' : 'ul';
    var hasTask = items.some(function (it) { return it.task; });
    var html = '<' + tag + (hasTask ? ' class="task-list"' : '') + '>';
    var i = start;

    while (i < items.length && items[i].indent >= baseIndent) {
      var it = items[i];
      if (it.indent > baseIndent) {
        var sub = buildList(items, i, it.indent, ctx);
        html = html.replace(/<\/li>$/, sub.html + '</li>');
        i = sub.next;
        continue;
      }
      var content = inline(it.text, ctx);
      if (it.task) {
        var key = hash(it.text);
        content = '<input type="checkbox" class="md-task" data-k="' + key + '"' +
          (it.checked ? ' checked' : '') + ' /> <span>' + content + '</span>';
      }
      html += '<li>' + content + '</li>';
      i++;
    }
    html += '</' + tag + '>';
    return { html: html, next: i };
  }

  function render(src, opts) {
    opts = opts || {};
    var used = new Set();
    var ctx = { resolve: opts.resolve || null };

    var lines = String(src == null ? '' : src)
      .replace(/\r\n?/g, '\n')
      .replace(/^---\n[\s\S]*?\n---\n?/, '')
      .split('\n');

    var out = '';
    var i = 0;
    var seenH1 = false;

    while (i < lines.length) {
      var line = lines[i];

      if (!line.trim()) { i++; continue; }

      // 代码块
      var m = line.match(RE_FENCE);
      if (m) {
        var fence = m[1];
        var buf = [];
        var j = i + 1;
        var closeRe = new RegExp('^\\s*' + (fence.charAt(0) === '`' ? '`' : '~') + '{' + fence.length + ',}\\s*$');
        while (j < lines.length && !closeRe.test(lines[j])) { buf.push(lines[j]); j++; }
        out += codeBlock(buf.join('\n'), m[2]);
        i = j + 1;
        continue;
      }

      // 标题
      m = line.match(RE_HEAD);
      if (m) {
        var level = m[1].length;
        if (level === 1 && !seenH1) {
          seenH1 = true;
          i++;
          continue; // 正文 H1 与页面标题重复，跳过
        }
        var hLevel = level === 1 ? 2 : level;
        var id = slugify(m[2], used);
        out += '<h' + hLevel + ' id="' + id + '">' + inline(m[2], ctx) + '</h' + hLevel + '>';
        i++;
        continue;
      }

      // 分割线
      if (RE_HR.test(line)) {
        out += '<hr />';
        i++;
        continue;
      }

      // 引用 / 告警
      if (RE_QUOTE.test(line)) {
        var qbuf = [];
        var q = i;
        while (q < lines.length && RE_QUOTE.test(lines[q])) {
          qbuf.push(lines[q].replace(/^\s{0,3}>\s?/, ''));
          q++;
        }
        var type = null;
        var first = qbuf[0] || '';
        var am = first.match(/^\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]\s*$/i);
        if (am) { type = ALERTS[am[1].toUpperCase()]; qbuf.shift(); }

        var inner = render(qbuf.join('\n'), opts);
        if (type) {
          out += '<div class="callout ' + type + '"><span class="co-label">' +
            ALERT_LABEL[type] + '</span>' + inner + '</div>';
        } else {
          out += '<blockquote>' + inner + '</blockquote>';
        }
        i = q;
        continue;
      }

      // 表格
      if (isTableStart(lines, i)) {
        var head = splitRow(line);
        var sep = splitRow(lines[i + 1]);
        var aligns = sep.map(function (c) {
          var l = c.charAt(0) === ':', r = c.charAt(c.length - 1) === ':';
          return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
        });
        var t = i + 2;
        var body = [];
        while (t < lines.length && lines[t].trim() && lines[t].indexOf('|') !== -1 && !RE_HEAD.test(lines[t])) {
          body.push(splitRow(lines[t]));
          t++;
        }
        var thead = '<tr>' + head.map(function (c, k) {
          return '<th' + (aligns[k] ? ' style="text-align:' + aligns[k] + '"' : '') + '>' + inline(c, ctx) + '</th>';
        }).join('') + '</tr>';
        var tbody = body.map(function (row) {
          return '<tr>' + head.map(function (_, k) {
            return '<td' + (aligns[k] ? ' style="text-align:' + aligns[k] + '"' : '') + '>' +
              inline(row[k] == null ? '' : row[k], ctx) + '</td>';
          }).join('') + '</tr>';
        }).join('');
        out += '<div class="table-wrap"><table><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table></div>';
        i = t;
        continue;
      }

      // 列表
      if (RE_LIST.test(line)) {
        var items = [];
        var k = i;
        while (k < lines.length) {
          var lm = lines[k].match(RE_LIST);
          if (lm) {
            var indent = lm[1].replace(/\t/g, '  ').length;
            var text = lm[3];
            var tm = text.match(RE_TASK);
            items.push({
              indent: indent,
              ordered: /\d/.test(lm[2]),
              text: tm ? tm[2] : text,
              task: !!tm,
              checked: !!(tm && tm[1].toLowerCase() === 'x')
            });
            k++;
          } else if (lines[k].trim() && /^\s{2,}/.test(lines[k]) && !RE_FENCE.test(lines[k])) {
            if (items.length) items[items.length - 1].text += ' ' + lines[k].trim();
            k++;
          } else {
            break;
          }
        }
        var built = buildList(items, 0, items[0].indent, ctx);
        out += built.html;
        i = k;
        continue;
      }

      // 段落
      var pbuf = [line];
      var p = i + 1;
      while (p < lines.length && lines[p].trim() && !isBlockStart(lines, p)) {
        pbuf.push(lines[p]);
        p++;
      }
      out += '<p>' + inline(pbuf.join('\n'), ctx) + '</p>';
      i = p;
    }

    return out;
  }

  return { render: render, esc: esc, hash: hash };
})();
