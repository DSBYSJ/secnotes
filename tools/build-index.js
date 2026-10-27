#!/usr/bin/env node
/**
 * 扫描 content/notes 下的 Markdown，生成：
 *   content/library.js      —— 笔记元数据索引（前端读它渲染列表、检索）
 *   content/notes-bundle.js —— 全文兜底包（用 file:// 直接打开时也能读正文）
 *
 * 用法：node tools/build-index.js
 *
 * front-matter 支持的字段：
 *   title    标题（缺省时取正文第一个 # 标题）
 *   tags     [标签, 标签]
 *   summary  一句话摘要（缺省取正文第一段，截 80 字）
 *   level    1 / 2 / 3
 *   minutes  预计阅读分钟数
 *   order    同分类内排序
 *   updated  YYYY-MM-DD
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NOTES_DIR = path.join(ROOT, 'content', 'notes');
const LIB_OUT = path.join(ROOT, 'content', 'library.js');
const BUNDLE_OUT = path.join(ROOT, 'content', 'notes-bundle.js');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.toLowerCase().endsWith('.md')) out.push(full);
  }
  return out;
}

function parseFrontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!mm) continue;
    let value = mm[2].trim();
    if (/^\[.*\]$/.test(value)) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      value = value.replace(/^["']|["']$/g, '');
      if (/^-?\d+$/.test(value)) value = Number(value);
    }
    data[mm[1]] = value;
  }
  return { data, body: raw.slice(m[0].length) };
}

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^[#>\-*+\d.\s|]+/gm, ' ')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const files = walk(NOTES_DIR);
const notes = [];
const bundle = {};
const problems = [];
const seenIds = new Set();

for (const file of files) {
  const rel = path.relative(path.join(ROOT, 'content'), file).replace(/\\/g, '/');
  const raw = fs.readFileSync(file, 'utf8');
  const { data, body } = parseFrontMatter(raw);
  const category = data.category || path.basename(path.dirname(file));

  const h1 = body.match(/^#\s+(.+)$/m);
  const title = data.title || (h1 ? h1[1].trim() : path.basename(file, '.md'));

  let summary = data.summary || '';
  if (!summary) {
    const para = body
      .replace(/^---[\s\S]*?---/, '')
      .split(/\r?\n\r?\n/)
      .map((p) => p.trim())
      .find((p) => p && !p.startsWith('#') && !p.startsWith('>') && !p.startsWith('```'));
    summary = para ? stripMarkdown(para).slice(0, 80) : '';
  }

  // id 优先用文件名（便于 [[wiki-link]] 直接引用），重名时加分类前缀
  let slug = path.basename(file, path.extname(file));
  if (seenIds.has(slug)) slug = `${category}-${slug}`;
  seenIds.add(slug);

  if (!fs.existsSync(path.join(ROOT, 'content', 'notes', category))) {
    problems.push(`分类目录不存在：${rel} → category="${category}"`);
  }

  notes.push({
    id: slug,
    title,
    category,
    tags: Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [],
    summary,
    level: Number(data.level) || 1,
    minutes: Number(data.minutes) || Math.max(3, Math.round(body.length / 500)),
    order: Number(data.order) || 999,
    updated: data.updated || fs.statSync(file).mtime.toISOString().slice(0, 10),
    file: rel,
  });
  bundle[slug] = raw;
}

notes.sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order || a.title.localeCompare(b.title));

const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
const header = `// 本文件由 tools/build-index.js 自动生成，请勿手改。\n// 重新生成：node tools/build-index.js\n// 生成时间：${stamp}\n`;

fs.writeFileSync(
  LIB_OUT,
  `${header}window.LIBRARY = ${JSON.stringify(
    { generatedAt: stamp, count: notes.length, notes },
    null,
    2
  )};\n`,
  'utf8'
);

fs.writeFileSync(
  BUNDLE_OUT,
  `${header}// 用途：file:// 直接打开时 fetch 不可用，用它作为正文兜底。\nwindow.NOTES_BUNDLE = ${JSON.stringify(
    bundle
  )};\n`,
  'utf8'
);

const size = (fs.statSync(BUNDLE_OUT).size / 1024).toFixed(1);
console.log(`✓ 索引已生成：${notes.length} 篇笔记 → content/library.js`);
console.log(`✓ 全文兜底包：content/notes-bundle.js (${size} KB)`);
if (problems.length) {
  console.log('\n⚠ 需要注意：');
  problems.forEach((p) => console.log('  - ' + p));
}
