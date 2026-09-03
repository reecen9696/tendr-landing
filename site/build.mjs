// Builds the /guides content section from HTML article sources.
//
//   node build.mjs          build, fail on any validation error
//   node build.mjs --check  validate only, write nothing
//
// Drop an article in content/guides/<pillar>/<slug>.html and run it. The source
// is a fragment: a metadata comment, its JSON-LD blocks, and a <main>. Everything
// around it (head, nav, footer, breadcrumbs, sitemap, robots) is generated here,
// so the nav and footer can only ever come from index.html and cannot drift.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const CHECK_ONLY = process.argv.includes('--check');

// ---------------------------------------------------------------- config ----

const SITE = {
  origin: 'https://gotendr.com',
  brand: 'Tendr',
  locale: 'en-AU',
  lang: 'en-AU',
  ogImage: '/assets/og-image.jpg',
  logo: '/assets/logo.svg',
  email: 'reece@gotendr.com',
  telephone: '+61487028339',
};

// Pillars are the second URL segment. Add one here before adding its first article.
const PILLARS = {
  pricing: {
    name: 'Pricing',
    heading: 'Pricing commercial landscape work',
    blurb: 'How to build a price you can stand behind: rates, preliminaries, overhead, margin and contingency.',
  },
  takeoffs: {
    name: 'Takeoffs and BOQs',
    heading: 'Quantity takeoffs and bills of quantities',
    blurb: 'Measuring scope off the drawings, structuring a BOQ, and the errors that cost the most.',
  },
  tendering: {
    name: 'Tendering',
    heading: 'Tendering and bidding',
    blurb: 'Reading a tender scope, putting a submission together, and improving your win rate.',
  },
  contracts: {
    name: 'Scope and contracts',
    heading: 'Scope, contracts and variations',
    blurb: 'Where scope gaps hide, what to check before signing, and how to price a variation properly.',
  },
};

// AI retrieval bots are listed explicitly. These power live citations in ChatGPT,
// Perplexity, Claude and AI Overviews, and several default to blocked at CDN level.
const AI_AGENTS = [
  'Googlebot', 'Bingbot',
  'OAI-SearchBot', 'ChatGPT-User', 'GPTBot',
  'PerplexityBot', 'Perplexity-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
  'Google-Extended', 'Applebot-Extended', 'meta-externalagent',
];

// ------------------------------------------------------------- utilities ----

const errors = [];
const warnings = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Visible text of an HTML fragment, entities resolved, whitespace collapsed. */
const text = (html) => html
  .replace(/<[^>]+>/g, ' ')
  .replace(/&mdash;/g, '-').replace(/&ndash;/g, '-').replace(/&rsaquo;/g, '>')
  .replace(/&middot;/g, '.').replace(/&sup2;/g, '2').replace(/&sup3;/g, '3')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();

/** Every .html under a directory, recursively. */
function walk(root) {
  const out = [];
  const visit = (d) => {
    for (const entry of readdirSync(d).sort()) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) visit(p);
      else if (entry.endsWith('.html')) out.push(p);
    }
  };
  try { visit(root); } catch { /* no content yet */ }
  return out;
}

/** Canonical path form for this site: leading slash, no trailing slash. */
const normalisePath = (p) => ('/' + String(p).trim().replace(/^\/+|\/+$/g, ''));

// ------------------------------------------- shared chrome from index.html ---

/**
 * Nav and footer are lifted out of index.html rather than copied, so the guides
 * pages cannot fall out of sync with the landing page. Relative hrefs become
 * absolute, and in-page anchors are rewritten to point back at the home page.
 */
function loadChrome() {
  const home = readFileSync(join(dir, 'index.html'), 'utf8');

  const slice = (startMarker, endTag) => {
    const start = home.indexOf(startMarker);
    if (start === -1) throw new Error(`index.html: marker not found: ${startMarker}`);
    const end = home.indexOf(endTag, start);
    if (end === -1) throw new Error(`index.html: ${endTag} not found after ${startMarker}`);
    return home.slice(start + startMarker.length, end + endTag.length).trim();
  };

  const absolutise = (html) => html
    .replace(/(src|href)="assets\//g, '$1="/assets/')
    .replace(/href="#/g, 'href="/#')
    .replace(/href="\/"/g, 'href="/"');

  return {
    nav: absolutise(slice('<!-- ================= Navbar ================= -->', '</nav>')),
    footer: absolutise(slice('<!-- ================= Footer ================= -->', '</footer>')),
  };
}

// -------------------------------------------------------- source parsing ----

/**
 * Reads the leading comment block for the fields the SEO article template emits:
 *   URL slug: /guides/pricing/...
 *   Title tag (<=60 chars): ...
 *   Meta description (150-160): ... (may wrap over several lines)
 * A `====` rule line ends a field. Anything not found falls back to the JSON-LD
 * or the document itself, so a plain article with no comment header still builds.
 */
function parseHeader(src) {
  const m = src.match(/^\s*<!--([\s\S]*?)-->/);
  if (!m) return {};

  const fields = {};
  let current = null;
  for (const raw of m[1].split('\n')) {
    const line = raw.trim();
    if (/^=+$/.test(line) || line === '') { current = null; continue; }

    const kv = line.match(/^(URL slug|Title tag|Meta description)[^:]*:\s*(.*)$/i);
    if (kv) {
      current = kv[1].toLowerCase().replace(/\s+/g, '_');
      fields[current] = kv[2].trim();
    } else if (current) {
      fields[current] += ' ' + line;
    }
  }
  for (const k of Object.keys(fields)) fields[k] = fields[k].replace(/\s+/g, ' ').trim();
  return fields;
}

/** Pulls out every JSON-LD block, parsed. Invalid JSON is a build error. */
function parseJsonLd(src, file) {
  const nodes = [];
  const re = /<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src))) {
    try {
      nodes.push(JSON.parse(m[1]));
    } catch (err) {
      fail(file, `invalid JSON-LD: ${err.message}`);
    }
  }
  return nodes;
}

function parseArticle(path) {
  const file = relative(dir, path);
  let src = readFileSync(path, 'utf8');

  src = src.replaceAll('{{DOMAIN}}', SITE.origin.replace(/^https?:\/\//, ''));

  const header = parseHeader(src);
  const jsonld = parseJsonLd(src, file);
  const posting = jsonld.find((n) => /Posting|Article/.test(n['@type'] || ''));

  const bodyMatch = src.match(/<main[^>]*>([\s\S]*)<\/main>/i);
  if (!bodyMatch) { fail(file, 'no <main> element found'); return null; }
  let body = bodyMatch[1];

  // Fall back through header comment -> JSON-LD -> document -> file path.
  const h1 = (src.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  const rel = relative(join(dir, 'content', 'guides'), path);
  const pillarSlug = rel.includes('/') ? rel.split('/')[0] : null;
  const fileSlug = basename(path, '.html');

  const url = normalisePath(
    header.url_slug ||
    (posting && posting.mainEntityOfPage) ||
    (pillarSlug ? `/guides/${pillarSlug}/${fileSlug}` : `/guides/${fileSlug}`)
  ).replace(/^\/?https?:\/\/[^/]+/, '');

  const article = {
    file,
    url,
    pillar: url.split('/')[2] && url.split('/').length > 3 ? url.split('/')[2] : null,
    title: header.title_tag || (posting && posting.headline) || (h1 ? text(h1) : ''),
    heading: h1 ? text(h1) : '',
    description: header.meta_description || (posting && posting.description) || '',
    image: (posting && posting.image) || SITE.origin + SITE.ogImage,
    datePublished: (posting && posting.datePublished) || '',
    dateModified: (posting && posting.dateModified) || (posting && posting.datePublished) || '',
    author: (posting && posting.author && posting.author.name) || SITE.brand,
    jsonld,
    body,
    // The lead answer block is what AI engines extract; surfaced on the index too.
    answer: (() => {
      const a = body.match(/<p class="answer"[^>]*>([\s\S]*?)<\/p>/i);
      return a ? text(a[1]) : '';
    })(),
  };

  return article;
}

// ------------------------------------------------------------ validation ----

function validate(article, known) {
  const { file } = article;

  if (!article.title) fail(file, 'no title (add "Title tag:" to the header comment or an <h1>)');
  else if (article.title.length > 60) warn(file, `title is ${article.title.length} chars, over the 60 char target: "${article.title}"`);

  if (!article.description) fail(file, 'no meta description');
  else if (article.description.length > 160) warn(file, `meta description is ${article.description.length} chars, over the 160 char target`);
  else if (article.description.length < 100) warn(file, `meta description is only ${article.description.length} chars`);

  if (!article.heading) fail(file, 'no <h1>');
  if (!article.answer) warn(file, 'no <p class="answer"> lead block; this is the passage AI engines extract');
  if (!article.datePublished) fail(file, 'no datePublished in the article JSON-LD');
  if (article.pillar && !PILLARS[article.pillar]) fail(file, `unknown pillar "${article.pillar}", add it to PILLARS in build.mjs`);

  // An unreplaced template placeholder must never reach production.
  const stray = [...new Set(article.body.match(/\{\{[A-Za-z0-9_]+\}\}/g) || [])];
  if (stray.length) fail(file, `unreplaced placeholder(s) in the body: ${stray.join(', ')}`);

  // FAQPage schema is only eligible if it mirrors the visible text. Compare the
  // answers loosely (whitespace collapsed) and flag anything that has drifted.
  const faq = article.jsonld.find((n) => n['@type'] === 'FAQPage');
  if (faq) {
    const visible = text(article.body);
    for (const q of faq.mainEntity || []) {
      const answer = q.acceptedAnswer && q.acceptedAnswer.text;
      if (!visible.includes(text(q.name).replace(/\s+/g, ' ')))
        fail(file, `FAQ question in schema is not on the page: "${q.name}"`);
      if (answer && !visible.includes(text(answer)))
        fail(file, `FAQ answer in schema does not match the visible answer for: "${q.name}"`);
    }
  }

  // Internal links that 404 are a real ranking negative, so check every one.
  for (const m of article.body.matchAll(/href="(\/[^"#?]*)/g)) {
    const target = normalisePath(m[1]);
    if (target.startsWith('/guides')) continue; // resolved separately below
    if (!known.paths.has(target)) fail(file, `internal link to a page that does not exist: ${m[1]}`);
  }
}

// ------------------------------------------------------------- rendering ----

/**
 * Links to guides that have not been written yet are unwrapped rather than left
 * to 404. When one is later added, the link lights up on the next build.
 */
function resolveGuideLinks(article, urls) {
  let body = article.body;

  // The "Related guides:" line is filtered down to what exists, or removed.
  body = body.replace(/<p>\s*Related guides:([\s\S]*?)<\/p>\s*/i, (whole, inner) => {
    const links = [...inner.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
      .filter(([, href]) => urls.has(normalisePath(href)));
    if (!links.length) return '';
    const list = links.map(([, href, label]) => `<a href="${normalisePath(href)}">${label.trim()}</a>`).join(',\n        ');
    return `<p>\n        Related guides:\n        ${list}.\n      </p>\n`;
  });

  body = body.replace(/<a href="(\/guides\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (whole, href, label) => {
    const target = normalisePath(href);
    if (urls.has(target)) return `<a href="${target}">${label}</a>`;
    if (target === '/guides') return `<a href="/guides">${label}</a>`;
    warn(article.file, `link to a guide that does not exist yet, unwrapped: ${href}`);
    return label;
  });

  // Strip the authoring comment block; it is instructions to the writer.
  body = body.replace(/^\s*<!--[\s\S]*?-->\s*/, '');
  // JSON-LD moves to <head>, so remove it from the body.
  body = body.replace(/<script\s+type="application\/ld\+json"\s*>[\s\S]*?<\/script>\s*/gi, '');

  return body.trim();
}

/** Organization and WebSite nodes, so each page's graph stands on its own. */
function graphFor(nodes, pageUrl, pageName, pageDescription) {
  const base = [
    {
      '@type': 'Organization',
      '@id': `${SITE.origin}/#organization`,
      name: SITE.brand,
      url: `${SITE.origin}/`,
      logo: { '@type': 'ImageObject', url: SITE.origin + SITE.logo },
      email: SITE.email,
      telephone: SITE.telephone,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE.origin}/#website`,
      url: `${SITE.origin}/`,
      name: SITE.brand,
      inLanguage: SITE.lang,
      publisher: { '@id': `${SITE.origin}/#organization` },
    },
    {
      '@type': 'WebPage',
      '@id': `${SITE.origin}${pageUrl}#webpage`,
      url: SITE.origin + pageUrl,
      name: pageName,
      description: pageDescription,
      inLanguage: SITE.lang,
      isPartOf: { '@id': `${SITE.origin}/#website` },
    },
  ];

  // Source nodes keep their own @context off; they live inside this graph now.
  const rest = nodes.map((n) => {
    const copy = { ...n };
    delete copy['@context'];
    return copy;
  });

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [...base, ...rest] }, null, 2);
}

function renderHead({ title, description, url, image, extraCss = [], graph, type = 'article', published, modified }) {
  const abs = (p) => (/^https?:/.test(p) ? p : SITE.origin + p);
  return `  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${SITE.origin}${url}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="theme-color" content="#0B2026">

  <meta property="og:type" content="${type}">
  <meta property="og:url" content="${SITE.origin}${url}">
  <meta property="og:site_name" content="${SITE.brand}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:locale" content="en_AU">
  <meta property="og:image" content="${abs(image)}">
  <meta property="og:image:alt" content="${esc(title)}">
${published ? `  <meta property="article:published_time" content="${published}">\n` : ''}${modified ? `  <meta property="article:modified_time" content="${modified}">\n` : ''}  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${abs(image)}">

  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400&display=swap" rel="stylesheet">

  <link rel="stylesheet" href="/css/styles.css">
${extraCss.map((c) => `  <link rel="stylesheet" href="${c}">`).join('\n')}

  <script>document.documentElement.classList.add("js");</script>

  <script type="application/ld+json">
${graph}
  </script>
`;
}

function renderPage({ head, chrome, main, bodyClass = '' }) {
  return `<!DOCTYPE html>
<html lang="${SITE.lang}">
<head>
${head}</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>

${chrome.nav}

${main}

${chrome.footer}

  <script src="/js/main.js" defer></script>
</body>
</html>
`;
}

function renderArticle(article, chrome, urls) {
  const body = resolveGuideLinks(article, urls);
  const graph = graphFor(article.jsonld, article.url, article.title, article.description);

  const head = renderHead({
    title: `${article.title} | ${SITE.brand}`.length > 65 ? article.title : `${article.title} | ${SITE.brand}`,
    description: article.description,
    url: article.url,
    image: article.image,
    extraCss: ['/css/article.css'],
    graph,
    type: 'article',
    published: article.datePublished,
    modified: article.dateModified,
  });

  return renderPage({
    head,
    chrome,
    bodyClass: 'page-article',
    main: `  <main class="article-page">\n    ${body}\n  </main>`,
  });
}

/**
 * Pillar hub page. The brief's cluster model needs a page per pillar that links
 * down to every article in it, and that each article's breadcrumb can link up to.
 */
function renderPillar(slug, items, chrome) {
  const pillar = PILLARS[slug];
  const url = `/guides/${slug}`;
  const title = `${pillar.heading} | ${SITE.brand}`;
  const description = pillar.blurb;

  const cards = items.map((a) => `
        <li class="guide-card">
          <h3><a href="${a.url}">${esc(a.heading || a.title)}</a></h3>
          <p>${esc(summarise(a))}</p>
          <p class="guide-card-meta"><time datetime="${a.dateModified.slice(0, 10)}">${formatDate(a.dateModified)}</time></p>
        </li>`).join('');

  const graph = graphFor([
    {
      '@type': 'CollectionPage',
      '@id': `${SITE.origin}${url}#collection`,
      name: pillar.heading,
      description,
      isPartOf: { '@id': `${SITE.origin}/#website` },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: items.map((a, i) => ({
          '@type': 'ListItem', position: i + 1, url: SITE.origin + a.url, name: a.heading || a.title,
        })),
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE.origin}/guides` },
        { '@type': 'ListItem', position: 3, name: pillar.name, item: SITE.origin + url },
      ],
    },
  ], url, pillar.heading, description);

  const head = renderHead({
    title, description, url, image: SITE.ogImage,
    extraCss: ['/css/article.css'], graph, type: 'website',
  });

  const main = `  <main class="article-page guides-index">
    <header class="guides-hero">
      <nav aria-label="Breadcrumb" class="breadcrumb">
        <a href="/">Home</a> &rsaquo; <a href="/guides">Guides</a> &rsaquo; <span>${esc(pillar.name)}</span>
      </nav>
      <span class="eyebrow">${esc(pillar.name)}</span>
      <h1>${esc(pillar.heading)}</h1>
      <p class="guides-lead">${esc(pillar.blurb)}</p>
    </header>
    <section class="guide-group">
      <ul class="guide-list" role="list">${cards}
      </ul>
    </section>
    <aside class="guides-cta">
      <h2>Would rather not price it yourself?</h2>
      <p>Send us the drawings and we will measure the quantities, price them to your rates and hand back a submission-ready tender. Fixed fee, quoted up front.</p>
      <a class="btn btn-primary btn-lg" href="/#book">Book a call</a>
    </aside>
  </main>`;

  return renderPage({ head, chrome, main, bodyClass: 'page-article' });
}

function renderIndex(articles, chrome) {
  const url = '/guides';
  const title = 'Estimating and tendering guides for commercial landscapers';
  const description = 'Practical guides on pricing, quantity takeoffs, bills of quantities and tendering for commercial landscape subcontractors, written by working estimators.';

  const byPillar = new Map();
  for (const a of articles) {
    const key = a.pillar || 'other';
    if (!byPillar.has(key)) byPillar.set(key, []);
    byPillar.get(key).push(a);
  }

  const sections = [...byPillar.entries()]
    .sort((a, b) => Object.keys(PILLARS).indexOf(a[0]) - Object.keys(PILLARS).indexOf(b[0]))
    .map(([slug, items]) => {
      const pillar = PILLARS[slug] || { heading: 'Other guides', blurb: '' };
      const cards = items.map((a) => `
          <li class="guide-card">
            <h3><a href="${a.url}">${esc(a.heading || a.title)}</a></h3>
            <p>${esc(summarise(a))}</p>
            <p class="guide-card-meta">
              <time datetime="${a.dateModified.slice(0, 10)}">${formatDate(a.dateModified)}</time>
            </p>
          </li>`).join('');
      return `
        <section class="guide-group">
          <h2>${esc(pillar.heading)}</h2>
          ${pillar.blurb ? `<p class="guide-group-blurb">${esc(pillar.blurb)}</p>` : ''}
          <ul class="guide-list" role="list">${cards}
          </ul>
        </section>`;
    }).join('\n');

  const graph = graphFor([
    {
      '@type': 'CollectionPage',
      '@id': `${SITE.origin}${url}#collection`,
      name: title,
      description,
      isPartOf: { '@id': `${SITE.origin}/#website` },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: articles.map((a, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: SITE.origin + a.url,
          name: a.heading || a.title,
        })),
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: SITE.origin + url },
      ],
    },
  ], url, title, description);

  const head = renderHead({
    title: 'Estimating and Tendering Guides | Tendr',
    description, url, image: SITE.ogImage, extraCss: ['/css/article.css'], graph, type: 'website',
  });

  const main = `  <main class="article-page guides-index">
    <header class="guides-hero">
      <nav aria-label="Breadcrumb" class="breadcrumb">
        <a href="/">Home</a> &rsaquo; <span>Guides</span>
      </nav>
      <span class="eyebrow">Guides</span>
      <h1>Estimating and tendering guides</h1>
      <p class="guides-lead">
        Practical, no-fluff guides on pricing, measuring and tendering commercial
        landscape work. Written by the estimators who price these packages every week.
      </p>
    </header>
${sections}
    <aside class="guides-cta">
      <h2>Would rather not price it yourself?</h2>
      <p>Send us the drawings and we will measure the quantities, price them to your rates and hand back a submission-ready tender. Fixed fee, quoted up front.</p>
      <a class="btn btn-primary btn-lg" href="/#book">Book a call</a>
    </aside>
  </main>`;

  return renderPage({ head, chrome, main, bodyClass: 'page-article' });
}

/** Card blurb: the lead answer, trimmed to a sentence boundary near 170 chars. */
function summarise(article) {
  const source = article.answer || article.description || '';
  if (source.length <= 180) return source;
  const cut = source.slice(0, 180);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '));
  return (end > 80 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '...');
}

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
};

// ------------------------------------------------------ sitemap / robots ----

function renderSitemap(articles, pillars) {
  const today = new Date().toISOString().slice(0, 10);
  const newest = (list) => list.reduce((m, a) => {
    const d = (a.dateModified || a.datePublished || '').slice(0, 10);
    return d && d > m ? d : m;
  }, '1970-01-01') || today;

  const entries = [
    { loc: '/', lastmod: today, changefreq: 'monthly', priority: '1.0' },
    { loc: '/guides', lastmod: newest(articles), changefreq: 'weekly', priority: '0.8' },
    ...[...pillars.entries()].map(([slug, items]) => ({
      loc: `/guides/${slug}`,
      lastmod: newest(items),
      changefreq: 'weekly',
      priority: '0.6',
    })),
    ...articles.map((a) => ({
      loc: a.url,
      lastmod: (a.dateModified || a.datePublished).slice(0, 10),
      changefreq: 'monthly',
      priority: '0.7',
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url>
    <loc>${SITE.origin}${e.loc === '/' ? '/' : e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
}

function renderRobots() {
  return `# ${SITE.origin}/

# Search and AI retrieval crawlers are allowed explicitly. Several of these
# default to blocked at the CDN layer, so also confirm they are permitted there.
${AI_AGENTS.map((ua) => `User-agent: ${ua}\nAllow: /`).join('\n\n')}

User-agent: *
Allow: /
Disallow: /*?*utm

Sitemap: ${SITE.origin}/sitemap.xml
`;
}

// ------------------------------------------------------------------ main ----

const chrome = loadChrome();
const sources = walk(join(dir, 'content', 'guides'));
const articles = sources.map(parseArticle).filter(Boolean);

articles.sort((a, b) => (b.datePublished || '').localeCompare(a.datePublished || ''));

// Group into pillars first, so pillar hub URLs exist before links are resolved.
const pillars = new Map();
for (const a of articles) {
  if (!a.pillar || !PILLARS[a.pillar]) continue;
  if (!pillars.has(a.pillar)) pillars.set(a.pillar, []);
  pillars.get(a.pillar).push(a);
}
const orderedPillars = new Map(
  [...pillars.entries()].sort((x, y) => Object.keys(PILLARS).indexOf(x[0]) - Object.keys(PILLARS).indexOf(y[0]))
);

const urls = new Set([
  ...articles.map((a) => a.url),
  ...[...orderedPillars.keys()].map((slug) => `/guides/${slug}`),
]);
const known = { paths: new Set(['/', '/guides', ...urls]) };

for (const a of articles) validate(a, known);

const seen = new Set();
for (const a of articles) {
  if (seen.has(a.url)) fail(a.file, `duplicate URL, already produced by another source: ${a.url}`);
  seen.add(a.url);
}

if (errors.length) {
  console.error(`\nBuild failed with ${errors.length} error(s):\n`);
  for (const e of errors) console.error(`  x ${e}`);
  if (warnings.length) {
    console.error(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.error(`  ! ${w}`);
  }
  console.error('');
  process.exit(1);
}

const writes = [];
for (const a of articles) {
  writes.push([join(dir, a.url.replace(/^\//, ''), 'index.html'), renderArticle(a, chrome, urls)]);
}
for (const [slug, items] of orderedPillars) {
  writes.push([join(dir, 'guides', slug, 'index.html'), renderPillar(slug, items, chrome)]);
}
writes.push([join(dir, 'guides', 'index.html'), renderIndex(articles, chrome)]);
writes.push([join(dir, 'sitemap.xml'), renderSitemap(articles, orderedPillars)]);
writes.push([join(dir, 'robots.txt'), renderRobots()]);

if (CHECK_ONLY) {
  console.log(`check ok: ${articles.length} article(s), ${writes.length} file(s) would be written`);
} else {
  for (const [path, content] of writes) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  console.log(`built ${articles.length} article(s):`);
  for (const a of articles) console.log(`  - ${a.url}`);
  for (const slug of orderedPillars.keys()) console.log(`  - /guides/${slug} (pillar hub)`);
  console.log(`  - /guides (index)`);
  console.log(`  - sitemap.xml, robots.txt`);
}

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
