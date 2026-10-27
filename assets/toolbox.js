/* ==========================================================================
   实战工具箱：编解码 / 哈希 / JWT / CIDR / 速查
   纯前端，无外部依赖；只在本地处理你粘贴的内容
   ========================================================================== */
window.Toolbox = (function () {
  'use strict';

  var KIND_LABEL = {
    url: 'URL',
    base64: 'Base64',
    hex: 'Hex',
    html: 'HTML 实体',
    unicode: 'Unicode',
  };

  var ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC_MAP[c]; }); }

  /* ---------------- 编解码 ---------------- */

  function b64Encode(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64Decode(text) {
    var clean = String(text).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    while (clean.length % 4) clean += '=';
    var bin;
    try {
      bin = atob(clean);
    } catch (e) {
      throw new Error('不是合法的 Base64 字符串');
    }
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }

  function toHex(text) {
    var bytes = new TextEncoder().encode(text);
    var out = '';
    for (var i = 0; i < bytes.length; i++) out += ('0' + bytes[i].toString(16)).slice(-2);
    return out;
  }

  function fromHex(text) {
    var clean = String(text).replace(/0x/gi, '').replace(/[\s,;:]/g, '');
    if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('含非十六进制字符');
    if (clean.length % 2) throw new Error('长度为奇数，缺一个半字节');
    var bytes = new Uint8Array(clean.length / 2);
    for (var i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }

  function toHtml(text) {
    return String(text).split('').map(function (ch) {
      if (ESC_MAP[ch]) return ESC_MAP[ch];
      var code = ch.codePointAt(0);
      return code > 127 ? '&#' + code + ';' : ch;
    }).join('');
  }

  function fromHtml(text) {
    return String(text).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (m, body) {
      if (body.charAt(0) === '#') {
        var code = body.charAt(1).toLowerCase() === 'x'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
        return isNaN(code) ? m : String.fromCodePoint(code);
      }
      var named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[body.toLowerCase()];
      return named === undefined ? m : named;
    });
  }

  function toUnicode(text) {
    return String(text).split('').map(function (ch) {
      var code = ch.codePointAt(0);
      if (code < 128) return ch;
      if (code > 0xffff) {
        var hi = Math.floor((code - 0x10000) / 0x400) + 0xd800;
        var lo = ((code - 0x10000) % 0x400) + 0xdc00;
        return '\\u' + hi.toString(16).padStart(4, '0') + '\\u' + lo.toString(16).padStart(4, '0');
      }
      return '\\u' + code.toString(16).padStart(4, '0');
    }).join('');
  }

  function fromUnicode(text) {
    return String(text)
      .replace(/\\u\{([0-9a-fA-F]+)\}/g, function (m, hex) { return String.fromCodePoint(parseInt(hex, 16)); })
      .replace(/\\u([0-9a-fA-F]{4})/g, function (m, hex) { return String.fromCharCode(parseInt(hex, 16)); })
      .replace(/\\x([0-9a-fA-F]{2})/g, function (m, hex) { return String.fromCharCode(parseInt(hex, 16)); });
  }

  function encode(kind, text) {
    switch (kind) {
      case 'url': return encodeURIComponent(text);
      case 'base64': return b64Encode(text);
      case 'hex': return toHex(text);
      case 'html': return toHtml(text);
      case 'unicode': return toUnicode(text);
      default: return text;
    }
  }

  function decode(kind, text) {
    switch (kind) {
      case 'url':
        try { return decodeURIComponent(String(text).replace(/\+/g, ' ')); }
        catch (e) { throw new Error('不是合法的 URL 编码（可能缺少 % 或十六进制不完整）'); }
      case 'base64': return b64Decode(text);
      case 'hex': return fromHex(text);
      case 'html': return fromHtml(text);
      case 'unicode': return fromUnicode(text);
      default: return text;
    }
  }

  /* ---------------- 哈希 ---------------- */

  var HASH_ALGOS = [
    { id: 'SHA-1', label: 'SHA-1' },
    { id: 'SHA-256', label: 'SHA-256' },
    { id: 'SHA-384', label: 'SHA-384' },
    { id: 'SHA-512', label: 'SHA-512' },
  ];

  function hex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  function hashAll(text) {
    if (!window.crypto || !window.crypto.subtle) {
      return Promise.reject(new Error('当前环境不支持 Web Crypto（需要 https 或 localhost）'));
    }
    var data = new TextEncoder().encode(text);
    return Promise.all(HASH_ALGOS.map(function (a) {
      return crypto.subtle.digest(a.id, data);
    })).then(function (bufs) {
      return HASH_ALGOS.map(function (a, i) { return { algo: a.label, value: hex(bufs[i]) }; });
    });
  }

  /* ---------------- JWT ---------------- */

  function b64urlToText(seg) {
    var s = String(seg).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }

  function timeStr(sec) {
    try {
      return new Date(sec * 1000).toLocaleString('zh-CN', { hour12: false });
    } catch (e) { return String(sec); }
  }

  function parseJwt(token) {
    var parts = String(token).trim().split('.');
    if (parts.length < 2) throw new Error('不是 JWT：应为 header.payload.signature 三段');
    var out = { header: null, payload: null, signature: parts[2] || '', notes: [] };
    try { out.header = JSON.parse(b64urlToText(parts[0])); } catch (e) { throw new Error('header 不是合法 JSON'); }
    try { out.payload = JSON.parse(b64urlToText(parts[1])); } catch (e) { throw new Error('payload 不是合法 JSON'); }

    var p = out.payload || {};
    var now = Math.floor(Date.now() / 1000);
    if (typeof p.exp === 'number') {
      out.notes.push(p.exp < now
        ? 'exp：' + timeStr(p.exp) + '（已过期）'
        : 'exp：' + timeStr(p.exp) + '（剩余 ' + Math.round((p.exp - now) / 60) + ' 分钟）');
    }
    if (typeof p.iat === 'number') out.notes.push('iat：' + timeStr(p.iat));
    if (typeof p.nbf === 'number') out.notes.push('nbf：' + timeStr(p.nbf));
    if (out.header && out.header.alg === 'none') out.notes.push('alg=none：实现若不校验签名，可直接伪造');
    if (out.header && out.header.alg && /^HS/.test(out.header.alg)) {
      out.notes.push('对称算法：密钥泄露或弱口令即可伪造，试试 hashcat -m 16500');
    }
    if (out.header && (out.header.jku || out.header.x5u)) out.notes.push('含 jku/x5u：检查是否校验了域名白名单');
    if (out.header && out.header.kid) out.notes.push('含 kid：检查是否被拼进文件路径或 SQL');
    return out;
  }

  /* ---------------- CIDR ---------------- */

  function intToIp(n) {
    n = n >>> 0;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }

  function classify(n) {
    var a = (n >>> 24) & 255, b = (n >>> 16) & 255;
    if (a === 0) return '本网络';
    if (a === 10) return '私有地址';
    if (a === 127) return '环回';
    if (a === 169 && b === 254) return '链路本地 / 云元数据';
    if (a === 172 && b >= 16 && b <= 31) return '私有地址';
    if (a === 192 && b === 168) return '私有地址';
    if (a === 100 && b >= 64 && b <= 127) return '运营商 NAT';
    if (a === 224) return '组播';
    if (a >= 240) return '保留';
    return '公网';
  }

  function parseCidr(input) {
    var m = String(input).trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})(?:\s*\/\s*(\d{1,2}))?$/);
    if (!m) throw new Error('格式示例：10.10.20.0/24 或 192.168.1.10');
    var octets = m[1].split('.').map(Number);
    if (octets.some(function (x) { return x > 255; })) throw new Error('每段必须在 0–255 之间');
    var prefix = m[2] === undefined ? 32 : Number(m[2]);
    if (prefix > 32) throw new Error('掩码必须在 0–32 之间');

    var ipInt = ((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
    var mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    var network = (ipInt & mask) >>> 0;
    var broadcast = (network | (~mask >>> 0)) >>> 0;
    var size = Math.pow(2, 32 - prefix);
    var usable = prefix >= 31 ? size : Math.max(size - 2, 0);

    return {
      input: String(input).trim(),
      ip: octets.join('.'),
      prefix: prefix,
      mask: intToIp(mask),
      network: intToIp(network),
      broadcast: intToIp(broadcast),
      range: prefix >= 31 ? intToIp(network) + ' – ' + intToIp(broadcast)
        : intToIp(network + 1) + ' – ' + intToIp(broadcast - 1),
      size: size,
      usable: usable,
      kind: classify(ipInt),
      isPrivate: /私有|环回|链路本地|运营商 NAT/.test(classify(ipInt)),
    };
  }

  /* ---------------- 视图 ---------------- */

  function html() {
    var kinds = Object.keys(KIND_LABEL).map(function (k, i) {
      return '<button type="button" class="pill' + (i === 0 ? ' active' : '') + '" data-kind="' + k + '">' +
        KIND_LABEL[k] + '</button>';
    }).join('');

    var cats = [];
    (window.CHEATS || []).forEach(function (c) { if (cats.indexOf(c.cat) === -1) cats.push(c.cat); });

    var cheatChips = '<button class="pill active" data-cheat-cat="*">全部</button>' +
      cats.map(function (c) { return '<button class="pill" data-cheat-cat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');

    var cheats = (window.CHEATS || []).map(function (c, i) {
      return '<div class="cheat" data-cat="' + esc(c.cat) + '" data-i="' + i + '" data-search="' +
        esc((c.cat + ' ' + c.title + ' ' + c.code + ' ' + c.note).toLowerCase()) + '">' +
        '<div class="cheat-head"><span class="cheat-cat">' + esc(c.cat) + '</span>' +
        '<span class="cheat-title">' + esc(c.title) + '</span>' +
        '<button class="cheat-copy" data-copy="' + esc(c.code) + '">复制</button></div>' +
        '<pre class="cheat-code">' + esc(c.code) + '</pre>' +
        '<div class="cheat-note">' + esc(c.note) + '</div>' +
      '</div>';
    }).join('');

    return '' +
    '<div class="kit-grid">' +

      // 编解码
      '<section class="kit-card span2">' +
        '<div class="kit-head"><h3>编解码</h3><span>URL / Base64 / Hex / HTML / Unicode</span></div>' +
        '<div class="pill-row" id="tb-kinds" style="margin-bottom:10px">' + kinds + '</div>' +
        '<div class="kit-split">' +
          '<textarea id="tb-input" class="kit-textarea" spellcheck="false" placeholder="粘贴要处理的内容…"></textarea>' +
          '<textarea id="tb-out" class="kit-textarea" spellcheck="false" readonly placeholder="结果出现在这里"></textarea>' +
        '</div>' +
        '<div class="kit-actions">' +
          '<button class="btn primary" id="tb-encode" type="button">编码 →</button>' +
          '<button class="btn" id="tb-decode" type="button">← 解码</button>' +
          '<button class="btn ghost" id="tb-swap" type="button">↔ 互换</button>' +
          '<button class="btn ghost" id="tb-copy" type="button">复制结果</button>' +
          '<span class="kit-hint" id="tb-msg"></span>' +
        '</div>' +
      '</section>' +

      // 哈希
      '<section class="kit-card">' +
        '<div class="kit-head"><h3>哈希</h3><span>本地计算，不上传</span></div>' +
        '<input id="tb-hash-input" class="kit-input" placeholder="输入文本，实时计算…" spellcheck="false" />' +
        '<div id="tb-hash-out" class="hash-list"><div class="kit-hint">输入后自动计算 SHA-1 / 256 / 384 / 512</div></div>' +
        '<div class="kit-hint" style="margin-top:8px">浏览器 Web Crypto 不提供 MD5，需要时用 <code>md5sum</code> 或 <code>certutil -hashfile</code>。</div>' +
      '</section>' +

      // JWT
      '<section class="kit-card">' +
        '<div class="kit-head"><h3>JWT 解析</h3><span>仅解码，不验签</span></div>' +
        '<textarea id="tb-jwt-input" class="kit-textarea sm" spellcheck="false" placeholder="粘贴 eyJhbGci….eyJzdWIi….签名"></textarea>' +
        '<div id="tb-jwt-out" class="jwt-out"><div class="kit-hint">解析后显示 header / payload 与常见缺陷提示</div></div>' +
      '</section>' +

      // CIDR
      '<section class="kit-card span2">' +
        '<div class="kit-head"><h3>网段计算</h3><span>判断内网与可用范围</span></div>' +
        '<input id="tb-cidr-input" class="kit-input" placeholder="10.10.20.0/24" spellcheck="false" />' +
        '<div id="tb-cidr-out" class="cidr-out"><div class="kit-hint">输入后回车或直接看结果</div></div>' +
      '</section>' +

      // 速查
      '<section class="kit-card span2">' +
        '<div class="kit-head"><h3>速查片段</h3><span>点「复制」直接取用</span></div>' +
        '<div class="filter-row" style="margin:0 0 12px">' +
          '<label class="filter-input"><span class="search-ico">⌕</span>' +
            '<input id="tb-cheat-q" type="search" placeholder="过滤：注入、ssrf、nmap…" />' +
          '</label>' +
        '</div>' +
        '<div class="pill-row" id="tb-cheat-cats" style="margin-bottom:14px">' + cheatChips + '</div>' +
        '<div class="cheat-list" id="tb-cheat-list">' + cheats + '</div>' +
      '</section>' +

    '</div>';
  }

  /* ---------------- 绑定 ---------------- */

  function mount(root) {
    if (!root) return;

    var kind = 'url';
    var $ = function (s) { return root.querySelector(s); };

    // --- 编解码 ---
    var kindsEl = $('#tb-kinds');
    if (kindsEl) {
      kindsEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-kind]');
        if (!b) return;
        kind = b.dataset.kind;
        Array.prototype.forEach.call(kindsEl.children, function (x) { x.classList.toggle('active', x === b); });
      });
    }

    function run(fn) {
      var input = $('#tb-input');
      var out = $('#tb-out');
      var msg = $('#tb-msg');
      try {
        out.value = fn(input.value);
        msg.textContent = '';
        msg.className = 'kit-hint';
      } catch (err) {
        out.value = '';
        msg.textContent = '处理失败：' + err.message;
        msg.className = 'kit-hint err';
      }
    }

    var bEnc = $('#tb-encode');
    if (bEnc) bEnc.addEventListener('click', function () { run(function (v) { return encode(kind, v); }); });
    var bDec = $('#tb-decode');
    if (bDec) bDec.addEventListener('click', function () { run(function (v) { return decode(kind, v); }); });
    var bSwap = $('#tb-swap');
    if (bSwap) bSwap.addEventListener('click', function () {
      var input = $('#tb-input'), out = $('#tb-out');
      var tmp = input.value;
      input.value = out.value;
      out.value = tmp;
    });
    var bCopy = $('#tb-copy');
    if (bCopy) bCopy.addEventListener('click', function () {
      var out = $('#tb-out');
      if (!out.value) return;
      copy(out.value, bCopy);
    });

    // --- 哈希 ---
    var hashInput = $('#tb-hash-input');
    var hashOut = $('#tb-hash-out');
    var hashTimer = null;
    function doHash() {
      var v = hashInput.value;
      if (!v) {
        hashOut.innerHTML = '<div class="kit-hint">输入后自动计算 SHA-1 / 256 / 384 / 512</div>';
        return;
      }
      hashAll(v).then(function (rows) {
        hashOut.innerHTML = rows.map(function (r) {
          return '<div class="hash-row"><span class="hash-algo">' + r.algo + '</span>' +
            '<code class="hash-val">' + r.value + '</code>' +
            '<button class="hash-copy" data-copy="' + r.value + '">复制</button></div>';
        }).join('');
      }).catch(function (err) {
        hashOut.innerHTML = '<div class="kit-hint err">' + esc(err.message) + '</div>';
      });
    }
    if (hashInput) {
      hashInput.addEventListener('input', function () {
        clearTimeout(hashTimer);
        hashTimer = setTimeout(doHash, 200);
      });
    }

    // --- JWT ---
    var jwtInput = $('#tb-jwt-input');
    var jwtOut = $('#tb-jwt-out');
    if (jwtInput) {
      jwtInput.addEventListener('input', function () {
        var v = jwtInput.value.trim();
        if (!v) {
          jwtOut.innerHTML = '<div class="kit-hint">解析后显示 header / payload 与常见缺陷提示</div>';
          return;
        }
        try {
          var r = parseJwt(v);
          jwtOut.innerHTML =
            '<div class="jwt-seg"><div class="jwt-label">HEADER</div><pre>' + esc(JSON.stringify(r.header, null, 2)) + '</pre></div>' +
            '<div class="jwt-seg"><div class="jwt-label">PAYLOAD</div><pre>' + esc(JSON.stringify(r.payload, null, 2)) + '</pre></div>' +
            (r.notes.length
              ? '<div class="jwt-notes">' + r.notes.map(function (n) { return '<div class="jwt-note">· ' + esc(n) + '</div>'; }).join('') + '</div>'
              : '');
        } catch (err) {
          jwtOut.innerHTML = '<div class="kit-hint err">' + esc(err.message) + '</div>';
        }
      });
    }

    // --- CIDR ---
    var cidrInput = $('#tb-cidr-input');
    var cidrOut = $('#tb-cidr-out');
    function doCidr() {
      var v = cidrInput.value.trim();
      if (!v) { cidrOut.innerHTML = '<div class="kit-hint">输入后立即显示结果</div>'; return; }
      try {
        var c = parseCidr(v);
        cidrOut.innerHTML = '<dl class="cidr-list">' +
          '<dt>网段</dt><dd>' + esc(c.network) + '/' + c.prefix + '</dd>' +
          '<dt>掩码</dt><dd>' + esc(c.mask) + '</dd>' +
          '<dt>可用范围</dt><dd>' + esc(c.range) + '</dd>' +
          '<dt>广播</dt><dd>' + esc(c.broadcast) + '</dd>' +
          '<dt>主机数</dt><dd>' + c.usable.toLocaleString() + ' 可用 / ' + c.size.toLocaleString() + ' 总计</dd>' +
          '<dt>属性</dt><dd><span class="chip ' + (c.isPrivate ? 'warn' : 'accent') + '">' + esc(c.kind) + '</span></dd>' +
        '</dl>';
      } catch (err) {
        cidrOut.innerHTML = '<div class="kit-hint err">' + esc(err.message) + '</div>';
      }
    }
    if (cidrInput) cidrInput.addEventListener('input', doCidr);

    // --- 速查 ---
    var cheatQ = $('#tb-cheat-q');
    var cheatCats = $('#tb-cheat-cats');
    var cheatList = $('#tb-cheat-list');
    if (cheatList) {
      var activeCat = '*';
      var apply = function () {
        var q = cheatQ ? cheatQ.value.trim().toLowerCase() : '';
        var shown = 0;
        Array.prototype.forEach.call(cheatList.querySelectorAll('.cheat'), function (el) {
          var ok = (activeCat === '*' || el.dataset.cat === activeCat) &&
            (!q || el.dataset.search.indexOf(q) !== -1);
          el.style.display = ok ? '' : 'none';
          if (ok) shown++;
        });
        var empty = cheatList.querySelector('.empty');
        if (!shown && !empty) {
          var d = document.createElement('div');
          d.className = 'empty';
          d.textContent = '没有匹配的片段';
          cheatList.appendChild(d);
        } else if (shown && empty) {
          empty.remove();
        }
      };
      if (cheatQ) cheatQ.addEventListener('input', apply);
      if (cheatCats) {
        cheatCats.addEventListener('click', function (e) {
          var b = e.target.closest('[data-cheat-cat]');
          if (!b) return;
          activeCat = b.dataset.cheatCat;
          Array.prototype.forEach.call(cheatCats.children, function (x) { x.classList.toggle('active', x === b); });
          apply();
        });
      }
    }

    // --- 复制（局部委托） ---
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-copy]');
      if (!btn) return;
      copy(btn.dataset.copy, btn);
    });
  }

  function copy(text, btn) {
    var done = function () {
      var old = btn.textContent;
      btn.textContent = '已复制';
      setTimeout(function () { btn.textContent = old; }, 1100);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        legacyCopy(text); done();
      });
    } else {
      legacyCopy(text); done();
    }
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  return {
    html: html,
    mount: mount,
    encode: encode,
    decode: decode,
    parseCidr: parseCidr,
    parseJwt: parseJwt,
    hashAll: hashAll,
  };
})();
