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
    <p class="subtitle">${books.length} books since ${firstYear}, newest first. I try to read 2 to 3 per month. Some years go better than others.</p>
  </div>
${[...byYear].map(renderYear).join('')}

  <footer class="site-footer">DQSIS · Dimitrios Kiousis</footer>

</div>
</body>
</html>
`;

fs.writeFileSync(OUT_PATH, html);
console.log(`wrote ${path.relative(ROOT, OUT_PATH)} (${books.length} books)`);
