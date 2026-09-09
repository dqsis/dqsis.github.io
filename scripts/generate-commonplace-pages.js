#!/usr/bin/env node
/* ------------------------------------------------------------------
   Builds a standalone, shareable permalink page for every entry in
   experiments/commonplace/entries.json — the same data the index page
   (experiments/commonplace-book.html) renders in the browser.

   Run this after editing entries.json:
     node scripts/generate-commonplace-pages.js

   Output: experiments/commonplace/<slug>.html (one flat file per
   entry, plain static HTML — no server, no build step, safe to
   commit and serve as-is from GitHub Pages).
   ------------------------------------------------------------------ */
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://dqsis.com';
const ROOT = path.join(__dirname, '..');
const COMMONPLACE_DIR = path.join(ROOT, 'experiments', 'commonplace');
const ENTRIES_PATH = path.join(COMMONPLACE_DIR, 'entries.json');

const entries = JSON.parse(fs.readFileSync(ENTRIES_PATH, 'utf8'));

function paragraphs(text) {
  return text.split('\n\n').map(p => `<p>${p}</p>`).join('');
}

function stripHtml(text) {
  return text.replace(/<[^>]+>/g, '');
}

function escapeAttr(text) {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function metaDescription(entry) {
  const plain = stripHtml(entry.reflection).replace(/\s+/g, ' ').trim();
  return plain.length > 200 ? plain.slice(0, 197) + '…' : plain;
}

function renderEntry(e) {
  return `
    <article class="entry" id="entry-${e.slug}">
      <div class="entry-head">
        <div class="entry-kind">${e.kind}</div>
        <a class="permalink" href="../commonplace-book.html#entry-${e.slug}">Full list →</a>
      </div>
      <h2 class="entry-title">${e.title}</h2>
      <div class="passage${e.quote ? ' quote' : ''}">${paragraphs(e.passage)}</div>
      <div class="source">${e.source}</div>
      <div class="reflection-label">Note</div>
      <div class="reflection">${paragraphs(e.reflection)}</div>
      <div class="entry-tags">${e.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
    </article>`;
}

function renderPage(e) {
  const pageTitle = `${e.title} — DQSIS Commonplace Book`;
  const description = escapeAttr(metaDescription(e));
  const pageUrl = `${SITE_URL}/experiments/commonplace/${e.slug}.html`;
  const ogImage = `${SITE_URL}/images/groupworkout_icon.png`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${pageTitle}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${pageUrl}" />

  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeAttr(e.title)}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${ogImage}" />
  <meta name="twitter:card" content="summary" />

  <link rel="stylesheet" href="../../styles/style.css" />
  <link rel="stylesheet" href="../commonplace/commonplace.css" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--stone); color: var(--ink); font-family: var(--font-body); font-size: 15px; line-height: 1.6; }
    .site-header { max-width: 760px; margin: 0 auto; padding: 20px 40px; }
    .wrap { max-width: 760px; margin: 0 auto; padding: 32px 40px 80px; }
    .back-link {
      display: inline-block;
      font-size: 0.78rem;
      letter-spacing: 0.02em;
      color: var(--olive);
      text-decoration: none;
      margin-bottom: 24px;
      border-bottom: 1px solid color-mix(in srgb, var(--olive) 35%, transparent);
    }
    .back-link:hover { color: var(--terracotta); border-bottom-color: var(--terracotta); }
    .page-footer { text-align: center; padding: 32px; font-size: 0.72rem; color: var(--olive); border-top: 1px solid var(--sand); }
    @media (max-width: 600px) {
      .site-header, .wrap { padding-left: 20px; padding-right: 20px; }
    }
  </style>
</head>
<body>

<header class="site-header">
  <a href="${SITE_URL}" class="site-logo">
    <img src="../../images/groupworkout_icon.png" alt="DQSIS logo">
    <span class="site-logo-name">DQSIS<span class="site-logo-sub">Dimitrios Kiousis</span></span>
  </a>
  <span class="site-nav">Experiments</span>
</header>

<div class="wrap">
  <a class="back-link" href="../commonplace-book.html">← All passages &amp; marginalia</a>
  ${renderEntry(e)}
</div>

<footer class="page-footer">DQSIS · A commonplace book · kept and annotated by Dimitrios Kiousis</footer>

</body>
</html>
`;
}

fs.mkdirSync(COMMONPLACE_DIR, { recursive: true });

for (const e of entries) {
  const outPath = path.join(COMMONPLACE_DIR, `${e.slug}.html`);
  fs.writeFileSync(outPath, renderPage(e));
  console.log('wrote', path.relative(ROOT, outPath));
}
