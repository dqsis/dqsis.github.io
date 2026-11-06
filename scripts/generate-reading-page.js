#!/usr/bin/env node
/* ------------------------------------------------------------------
   Builds reading.html — every book I have read, newest first —
   from the Book Reflections folder in my Obsidian vault:

     MOC - Book Reflections.md               ← books since 2025
     Reading History - Goodreads Archive.md  ← frozen pre-vault history

   Run this after filing a new book reflection:
     node scripts/generate-reading-page.js

   Override the vault folder with BOOKS_DIR=/path/to/folder.
   Output is plain static HTML, safe to commit and serve as-is.
   ------------------------------------------------------------------ */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'reading.html');
const BOOKS_DIR = process.env.BOOKS_DIR ||
  path.join(os.homedir(), 'Documents', 'DQSIS_vault_001', 'Life 2.0', 'Book reflections');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function read(name) {
  return fs.readFileSync(path.join(BOOKS_DIR, name), 'utf8');
}

function cells(line) {
  return line.split(/(?<!\\)\|/).slice(1, -1).map(c => c.trim());
}

// "Rating: 4.5/5" anywhere in a reflection note or archive cell
function parseRating(text) {
  const m = text.match(/(\d(?:\.5)?)\/5/);
  return m ? +m[1] : 0;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// MOC rows: | Mon | [[YYYYMMDD - Title - Author\|Display title]] | Author |
function vaultBooks() {
  return read('MOC - Book Reflections.md').split('\n')
    .filter(l => l.includes('[['))
    .map(cells)
    .filter(c => c.length === 3)
    .map(([, link, author]) => {
      const m = link.match(/\[\[(\d{4})(\d{2})(\d{2}) - .*?\\\|(.+?)\]\]/);
      if (!m) return null;
      const note = link.match(/\[\[(.+?)\\\|/)[1] + '.md';
      const rating = parseRating((read(note).match(/^\W*Rating\W*:.*$/mi) || [''])[0]);
      return { year: +m[1], month: +m[2], day: +m[3], title: m[4], author, rating };
    })
    .filter(Boolean);
}

// Archive rows: | 2025-03-14 | Title | Author | 4/5 |  (or just "2014")
function archiveBooks() {
  return read('Reading History - Goodreads Archive.md').split('\n')
    .filter(l => /^\| \d{4}/.test(l))
    .map(cells)
    .map(([date, title, author, rating]) => {
      const m = date.match(/^(\d{4})(?:-(\d{2})-(\d{2}))?/);
      return { year: +m[1], month: m[2] ? +m[2] : 0, day: m[3] ? +m[3] : 0, title, author, rating: parseRating(rating) };
    });
}

const books = [...vaultBooks(), ...archiveBooks()]
  .sort((a, b) => (b.year - a.year) || (b.month - a.month) || (b.day - a.day) || a.title.localeCompare(b.title));

const byYear = new Map();
for (const b of books) {
  if (!byYear.has(b.year)) byYear.set(b.year, []);
  byYear.get(b.year).push(b);
}

const firstYear = books[books.length - 1].year;

function stars(rating) {
  if (!rating) return '';
  const full = Math.floor(rating);
  const half = rating % 1 ? '½' : '';
  return `${'★'.repeat(full)}${half}<span class="star-empty">${'★'.repeat(5 - full - (half ? 1 : 0))}</span>`;
}

function renderYear([year, list]) {
  const rows = list.map(b => `
      <li class="book">
        <span class="book-month">${b.month ? MONTHS[b.month - 1] : ''}</span>
        <span class="book-title">${escapeHtml(b.title)}</span>
        <span class="book-author">${escapeHtml(b.author)}</span>
        <span class="book-rating"${b.rating ? ` title="${b.rating}/5"` : ''}>${stars(b.rating)}</span>
      </li>`).join('');
  return `
    <section class="year">
      <p class="section-label">${year} <span class="year-count">· ${list.length} ${list.length === 1 ? 'book' : 'books'}</span></p>
      <ol class="book-list">${rows}
      </ol>
    </section>`;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reading · DQSIS</title>
<meta name="description" content="Every book Dimitrios Kiousis has read since ${firstYear}, newest first.">
<link rel="stylesheet" href="styles/style.css">
<link rel="icon" type="image/png" href="/images/groupworkout_icon.png">
<style>
  .year { margin-bottom: 2.5rem; }
  .year-count { color: var(--mid); }
  .book-list { list-style: none; }
  .book {
    display: grid;
    grid-template-columns: 2.5rem 1fr auto 4.5rem;
    gap: 0 1rem;
    align-items: baseline;
    padding: 0.45rem 0;
    border-bottom: 1px dashed var(--panel);
    font-size: 0.85rem;
  }
  .book-month { color: var(--mid); font-size: 0.75rem; }
  .book-title { color: var(--ink); }
  .book-author { color: var(--mid); font-size: 0.78rem; text-align: right; }
  .book-rating { color: var(--terracotta); font-size: 0.72rem; letter-spacing: 0.08em; text-align: right; white-space: nowrap; }
  .star-empty { color: var(--panel); }
  @media (max-width: 520px) {
    .book { grid-template-columns: 2.5rem 1fr auto; }
    .book-author { grid-column: 2; grid-row: 2; text-align: left; }
    .book-rating { grid-column: 3; grid-row: 1; }
  }
  .chart { margin-bottom: 2.5rem; position: relative; }
  .chart svg { display: block; width: 100%; height: 180px; overflow: visible; }
  .chart .bar { fill: var(--terracotta); }
  .chart .bar.dim { opacity: 0.35; }
  .chart .hit { fill: transparent; cursor: default; }
  .chart .axis { stroke: var(--border); stroke-width: 1; }
  .chart .grid { stroke: var(--panel); stroke-width: 1; stroke-dasharray: 2 3; }
  .chart text { font-family: var(--font-body); font-size: 10px; fill: var(--mid); }
  .chart text.val { fill: var(--ink-2); }
  .chart-tip {
    position: absolute; pointer-events: none; display: none;
    background: var(--bg); border: 1px solid var(--border);
    padding: 0.25rem 0.5rem; font-size: 0.75rem; color: var(--ink); white-space: nowrap;
    transform: translate(-50%, -100%);
  }
  .chart-tip span { color: var(--mid); }
  .chart-note {
    margin-top: 1.5rem; padding-left: 1rem; border-left: 2px solid var(--border);
    font-size: 0.85rem; color: var(--mid); line-height: 1.7; max-width: 480px;
  }
  .chart-note em { color: var(--ink-2); }
  .chart-note cite { display: block; font-size: 0.72rem; font-style: normal; margin-bottom: 0.75rem; }
  .chart-note cite::before { content: '— '; color: var(--pink); }
</style>
</head>
<body>
<div class="page">

  <header class="site-header">
    <a href="https://dqsis.com" class="site-logo">
      <img src="images/groupworkout_icon.png" alt="DQSIS logo">
      <span class="site-logo-name">DQSIS
        <span class="site-logo-sub">Dimitrios Kiousis</span>
      </span>
    </a>
    <a href="index.html" class="site-nav">← Home</a>
  </header>

  <div class="header">
    <p class="eyebrow">Reading</p>
    <h1 class="title">Books I have <em>read</em>.</h1>
    <p class="subtitle">${books.length} books since ${firstYear}, newest first. Some years go better than others.</p>
  </div>

  <section class="chart" id="books-chart" aria-label="Books read per year">
    <p class="section-label">Books per year</p>
    <svg role="img" aria-label="Bar chart of books read per year since ${firstYear}"></svg>
    <div class="chart-tip"></div>
    <blockquote class="chart-note">
      <p><em>Some books are to be tasted, others to be swallowed, and some few to be chewed and digested.</em></p>
      <cite>Francis Bacon, Of Studies</cite>
      <p>The bars count books, not what stayed with me. One slow book that changed my mind is worth a shelf of fast ones I have forgotten.</p>
    </blockquote>
  </section>
${[...byYear].map(renderYear).join('')}

  <footer class="site-footer">DQSIS · Dimitrios Kiousis</footer>

</div>
<script>
(function () {
  var counts = {};
  document.querySelectorAll('.year .section-label').forEach(function (el) {
    var m = el.textContent.match(/(\d{4})\D+(\d+) book/);
    if (m) counts[+m[1]] = +m[2];
  });
  var years = Object.keys(counts).map(Number);
  if (!years.length) return;
  var first = Math.min.apply(null, years), last = Math.max.apply(null, years);
  var data = [];
  for (var y = first; y <= last; y++) data.push({ year: y, n: counts[y] || 0 });
  var max = Math.max.apply(null, data.map(function (d) { return d.n; }));
  var peak = data.filter(function (d) { return d.n === max; }).pop();
  var top = Math.ceil(max / 10) * 10;
  var current = data[data.length - 1].year === new Date().getFullYear() ? data[data.length - 1] : null;

  var wrap = document.getElementById('books-chart');
  var svg = wrap.querySelector('svg'), tip = wrap.querySelector('.chart-tip');
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    svg.appendChild(e);
    return e;
  }

  function draw() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var W = svg.clientWidth, H = 180, L = 24, B = 20, T = 14;
    var plotW = W - L, plotH = H - B - T;
    var slot = plotW / data.length, bw = Math.max(2, slot - 2);
    var yPos = function (v) { return T + plotH - (v / top) * plotH; };

    for (var g = 10; g <= top; g += 10) {
      el('line', { class: 'grid', x1: L, x2: W, y1: yPos(g), y2: yPos(g) });
      el('text', { x: L - 6, y: yPos(g) + 3, 'text-anchor': 'end' }, g);
    }
    el('line', { class: 'axis', x1: L, x2: W, y1: yPos(0), y2: yPos(0) });

    var bars = [];
    data.forEach(function (d, i) {
      var x = L + i * slot + 1;
      var h = yPos(0) - yPos(d.n);
      bars.push(el('rect', { class: 'bar', x: x, y: yPos(d.n), width: bw, height: h }));
      var showYear = d.year === first || d.year === last ||
        (d.year % 5 === 0 && d.year - first > 2 && last - d.year > 2);
      if (d === current) el('text', { x: x + bw, y: H - 4, 'text-anchor': 'end' }, d.year + ' so far');
      else if (showYear) el('text', { x: x + bw / 2, y: H - 4, 'text-anchor': 'middle' }, d.year);
      if (d === peak || d.year === last) {
        el('text', { class: 'val', x: x + bw / 2, y: yPos(d.n) - 4, 'text-anchor': 'middle' }, d.n);
      }
      var hit = el('rect', { class: 'hit', x: L + i * slot, y: T, width: slot, height: plotH });
      hit.addEventListener('mouseenter', function () {
        bars.forEach(function (b, j) { b.classList.toggle('dim', j !== i); });
        tip.innerHTML = d.year + ' <span>·</span> ' + d.n + ' book' + (d.n === 1 ? '' : 's') +
          (d === current ? ' <span>so far</span>' : '');
        tip.style.left = (x + bw / 2) + 'px';
        tip.style.top = (svg.offsetTop + yPos(d.n) - 6) + 'px';
        tip.style.display = 'block';
      });
      hit.addEventListener('mouseleave', function () {
        bars.forEach(function (b) { b.classList.remove('dim'); });
        tip.style.display = 'none';
      });
    });
  }
  draw();
  window.addEventListener('resize', draw);
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT_PATH, html);
console.log(`wrote ${path.relative(ROOT, OUT_PATH)} (${books.length} books)`);
