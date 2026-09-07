// Builds the /guides and /locations sections from HTML article sources.
//
//   node build.mjs          build, then move newly published sources out of the inbox
//   node build.mjs --check  validate only, move nothing, write nothing
//
// Drop an article anywhere in SEO/blogs/ and run it. The source is a fragment: a
// metadata comment declaring its URL, its JSON-LD blocks, and a <main>. Its own
// "URL slug:" decides where it lands, so the inbox needs no folder structure.
//
// On a clean build each inbox file is moved to SEO/blogs/published/<its url>.html,
// so the inbox always shows exactly what has not shipped yet. Everything around
// the content (head, nav, footer, breadcrumbs, hubs, sitemap, robots) is generated
// here, and nav and footer are read out of index.html so they cannot drift.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, renameSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const CHECK_ONLY = process.argv.includes('--check');

// Sources live outside the deployed directory, so nothing has to be excluded
// from the upload and a source file can never be served by accident.
const INBOX = join(dir, '..', 'SEO', 'blogs');
const PUBLISHED = join(INBOX, 'published');

// ---------------------------------------------------------------- config ----

const SITE = {
  origin: 'https://www.gotendr.com',
  brand: 'Tendr',
  locale: 'en-AU',
  lang: 'en-AU',
  ogImage: '/assets/og-image.jpg',
  logo: '/assets/logo.svg',
  email: 'reece@gotendr.com',
  telephone: '+61487028339',
};

// Top-level sections. An article's URL decides which one it belongs to.
const SECTIONS = {
  guides: {
    label: 'Guides',
    h1: 'Estimating and tendering guides',
    title: 'Estimating and Tendering Guides | Tendr',
    description: 'Practical guides on pricing, quantity takeoffs, bills of quantities and tendering for commercial landscape subcontractors, written by working estimators.',
    lead: 'Practical, no-fluff guides on pricing, measuring and tendering commercial landscape work. Written by the estimators who price these packages every week.',
    grouped: true,
  },
  locations: {
    label: 'Locations',
    h1: 'Where we price tenders',
    title: 'Commercial Landscape Estimating by Location | Tendr',
    description: 'Commercial landscape tender estimating, quantity takeoffs and priced bills of quantities, by region across Australia.',
    lead: 'We price commercial landscape tenders Australia-wide. These pages cover the regions we work in most.',
    grouped: false,
  },
};

// Links to pages that do not exist yet. Rewritten rather than unwrapped, because
// the target genuinely exists, just at a different address.
const LINK_REWRITES = {
  '/contact': '/#book',
};

// Pillars are the third URL segment under /guides. Add one before its first article.
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
  variations: {
    name: 'Variations',
    heading: 'Scope, contracts and variations',
    blurb: 'Where scope gaps hide, what to check before signing, and how to price a variation so it gets paid.',
  },
  contracts: {
    name: 'Scope and contracts',
    heading: 'Scope and contract review',
    blurb: 'Reading the conditions of contract, and the clauses worth arguing about before you sign.',
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

/**
 * Drops any JSON-LD value still holding a {{PLACEHOLDER}}, and any array or key
 * left empty by that. Articles ship with things like "sameAs": ["{{AUTHOR_LINKEDIN}}"]
 * for values we do not have, and a literal placeholder in structured data is worse
 * than an absent property.
 */
function stripPlaceholders(node) {
  if (Array.isArray(node)) {
    const kept = node.map(stripPlaceholders).filter((v) => v !== undefined);
    return kept.length ? kept : undefined;
  }
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      const cleaned = stripPlaceholders(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  if (typeof node === 'string' && /\{\{[\s\S]*?\}\}/.test(node)) return undefined;
  return node;
}

/** Pulls out every JSON-LD block, parsed. Invalid JSON is a build error. */
function parseJsonLd(src, file) {
  const nodes = [];
  const re = /<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src))) {
    try {
      nodes.push(stripPlaceholders(JSON.parse(m[1])));
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

  const segments = url.split('/').filter(Boolean);
  // A single-segment URL (/about, /contact) is a standalone page: no section
  // index, no pillar, no siblings. Anything deeper belongs to a section.
  const standalone = segments.length === 1;
  const article = {
    file,
    path,
    url,
    standalone,
    section: standalone ? null : (segments[0] || null),
    // /guides/<pillar>/<slug> has a pillar; /locations/<slug> does not.
    pillar: segments[0] === 'guides' && segments.length > 2 ? segments[1] : null,
    title: header.title_tag || (posting && posting.headline) || (h1 ? text(h1) : ''),
    heading: h1 ? text(h1) : '',
    description: header.meta_description || (posting && posting.description) || '',
    image: (posting && posting.image) || SITE.origin + SITE.ogImage,
    datePublished: (posting && posting.datePublished) || '',
    dateModified: (posting && posting.dateModified)
      || (posting && posting.datePublished)
      || statSync(path).mtime.toISOString(),
    isArticle: Boolean(posting),
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
  // Only article-type pages have a publication date; a location or service page
  // is not dated content and should not claim to be.
  if (article.isArticle && !article.datePublished)
    fail(file, 'no datePublished in the BlogPosting JSON-LD');
  if (!article.standalone && (!article.section || !SECTIONS[article.section]))
    fail(file, `URL "${article.url}" is not in a known section (${Object.keys(SECTIONS).join(', ')}); add it to SECTIONS in build.mjs`);
  if (article.section === 'guides' && !article.pillar)
    fail(file, `guide URL "${article.url}" has no pillar segment; expected /guides/<pillar>/<slug>`);
  if (article.pillar && !PILLARS[article.pillar])
    fail(file, `unknown pillar "${article.pillar}", add it to PILLARS in build.mjs`);

  // An unreplaced template placeholder must never reach production.
  const stray = [...new Set(article.body.match(/\{\{[\s\S]*?\}\}/g) || [])]
    .map((p) => (p.length > 70 ? p.slice(0, 67).replace(/\s+/g, ' ') + '...}}' : p.replace(/\s+/g, ' ')));
  if (stray.length) fail(file, `unreplaced placeholder(s) in the body:\n      ${stray.join('\n      ')}`);

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

  // Internal links are resolved rather than failed: articles legitimately link to
  // pages that are planned but not built yet. resolveLinks() unwraps those so
  // nothing ships pointing at a 404, and warns so the backlog stays visible.
}

// ------------------------------------------------------------- rendering ----

const CTA = `    <aside class="guides-cta">
      <h2>Would rather not price it yourself?</h2>
      <p>Send us the drawings and we will measure the quantities, price them to your rates and hand back a submission-ready tender. Fixed fee, quoted up front.</p>
      <a class="btn btn-primary btn-lg" href="/#book">Book a call</a>
    </aside>`;

/**
 * Resolves every internal link in the body against what actually exists.
 *
 *   - a known page            -> normalised to the canonical no-trailing-slash form
 *   - a LINK_REWRITES entry   -> rewritten (/contact -> /#book)
 *   - anything else internal  -> unwrapped to plain text, with a warning
 *
 * Unwrapping matters because these articles cross-link to pages that are planned
 * but not built yet (service pages, guides still to be written). Shipping those as
 * live links would mean 404s, which is a real ranking negative; dropping them means
 * the page is clean today and the link appears by itself once the target exists.
 */
function resolveLinks(article, urls) {
  let body = article.body;
  const pending = new Set();

  const resolve = (href) => {
    const [rawPath, hash] = String(href).split('#');
    if (!rawPath) return href;                       // pure in-page anchor
    const target = normalisePath(rawPath);
    if (LINK_REWRITES[target]) return LINK_REWRITES[target];
    if (urls.has(target)) return target + (hash ? '#' + hash : '');
    return null;                                     // does not exist
  };

  // A "Related guides:" line is filtered to what exists, or dropped entirely.
  body = body.replace(/<p>\s*Related guides:([\s\S]*?)<\/p>\s*/i, (whole, inner) => {
    const links = [...inner.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
      .map(([, href, label]) => [resolve(href), label.trim()])
      .filter(([href]) => href);
    if (!links.length) return '';
    const list = links.map(([href, label]) => `<a href="${href}">${label}</a>`).join(',\n        ');
    return `<p>\n        Related guides:\n        ${list}.\n      </p>\n`;
  });

  body = body.replace(/<a href="(\/[^"]*)"([^>]*)>([\s\S]*?)<\/a>/g, (whole, href, attrs, label) => {
    const target = resolve(href);
    if (target) return `<a href="${target}"${attrs}>${label}</a>`;
    pending.add(normalisePath(href.split('#')[0]));
    return label;
  });

  if (pending.size) {
    warn(article.file, `unwrapped ${pending.size} link(s) to pages that do not exist yet: ${[...pending].sort().join(', ')}`);
  }

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

  // Source nodes drop their own @context; they live inside this graph now. A node
  // sharing an @id with a base node (a page adding detail to the Organization)
  // is merged into it rather than emitted twice.
  const graph = [...base];
  for (const node of nodes) {
    const copy = { ...node };
    delete copy['@context'];
    // Point the author entity at the page that actually carries the bio.
    if (copy.author && copy.author.url === `${SITE.origin}/`) {
      copy.author = { ...copy.author, url: `${SITE.origin}/about` };
    }
    const existing = copy['@id'] && graph.find((n) => n['@id'] === copy['@id']);
    if (existing) Object.assign(existing, copy);
    else graph.push(copy);
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}

function renderHead({ title, description, url, image, extraCss = [], graph, type = 'article', published, modified, noindex = false }) {
  const abs = (p) => (/^https?:/.test(p) ? p : SITE.origin + p);
  return `  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${SITE.origin}${url}">
  <meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}">
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

${graph ? `  <script type="application/ld+json">
${graph}
  </script>
` : ''}`;
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

/**
 * " | Tendr" suffix, unless the title already names the brand (several sources
 * set a title_tag that does) or the result would run past the ~65 chars
 * Google renders.
 */
const withBrand = (title) => {
  if (new RegExp(`\\b${SITE.brand}\\b`, 'i').test(title)) return title;
  const suffixed = `${title} | ${SITE.brand}`;
  return suffixed.length > 65 ? title : suffixed;
};

/**
 * Article sources carry a visible "Guides > Pillar > Title" trail above the H1.
 * The trail is dropped from the page and kept only as BreadcrumbList JSON-LD,
 * which is what Google actually reads for the breadcrumb in a search result.
 */
const stripBreadcrumb = (html) =>
  html.replace(/\s*<nav aria-label="Breadcrumb">[\s\S]*?<\/nav>/, '');

function renderArticle(article, chrome, urls) {
  const body = stripBreadcrumb(resolveLinks(article, urls));
  const graph = graphFor(article.jsonld, article.url, article.title, article.description);

  const head = renderHead({
    title: withBrand(article.title),
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
      <span class="eyebrow">${esc(pillar.name)}</span>
      <h1>${esc(pillar.heading)}</h1>
      <p class="guides-lead">${esc(pillar.blurb)}</p>
    </header>
    <section class="guide-group">
      <ul class="guide-list" role="list">${cards}
      </ul>
    </section>
${CTA}
  </main>`;

  return renderPage({ head, chrome, main, bodyClass: 'page-article' });
}

/** Shared card markup for the section indexes and the pillar hubs. */
const cardsFor = (items) => items.map((a) => `
          <li class="guide-card">
            <h3><a href="${a.url}">${esc(a.heading || a.title)}</a></h3>
            <p>${esc(summarise(a))}</p>
${a.isArticle ? `
            <p class="guide-card-meta">
              <time datetime="${a.dateModified.slice(0, 10)}">${formatDate(a.dateModified)}</time>
            </p>` : ''}
          </li>`).join('');

/** Section index: /guides groups by pillar, /locations is a flat list. */
function renderSectionIndex(slug, articles, chrome) {
  const section = SECTIONS[slug];
  const url = `/${slug}`;

  let groups;
  if (section.grouped) {
    const byPillar = new Map();
    for (const a of articles) {
      const key = a.pillar || 'other';
      if (!byPillar.has(key)) byPillar.set(key, []);
      byPillar.get(key).push(a);
    }
    groups = [...byPillar.entries()]
      .sort((x, y) => Object.keys(PILLARS).indexOf(x[0]) - Object.keys(PILLARS).indexOf(y[0]))
      .map(([pillarSlug, items]) => {
        const pillar = PILLARS[pillarSlug] || { heading: 'Other guides', blurb: '' };
        return `
        <section class="guide-group">
          <h2><a href="/guides/${pillarSlug}">${esc(pillar.heading)}</a></h2>
          ${pillar.blurb ? `<p class="guide-group-blurb">${esc(pillar.blurb)}</p>` : ''}
          <ul class="guide-list" role="list">${cardsFor(items)}
          </ul>
        </section>`;
      }).join('\n');
  } else {
    groups = `
        <section class="guide-group">
          <ul class="guide-list" role="list">${cardsFor(articles)}
          </ul>
        </section>`;
  }

  const graph = graphFor([
    {
      '@type': 'CollectionPage',
      '@id': `${SITE.origin}${url}#collection`,
      name: section.h1,
      description: section.description,
      isPartOf: { '@id': `${SITE.origin}/#website` },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: articles.map((a, i) => ({
          '@type': 'ListItem', position: i + 1, url: SITE.origin + a.url, name: a.heading || a.title,
        })),
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.origin}/` },
        { '@type': 'ListItem', position: 2, name: section.label, item: SITE.origin + url },
      ],
    },
  ], url, section.h1, section.description);

  const head = renderHead({
    title: section.title,
    description: section.description,
    url, image: SITE.ogImage, extraCss: ['/css/article.css'], graph, type: 'website',
  });

  const main = `  <main class="article-page guides-index">
    <header class="guides-hero">
      <span class="eyebrow">${esc(section.label)}</span>
      <h1>${esc(section.h1)}</h1>
      <p class="guides-lead">${esc(section.lead)}</p>
    </header>
${groups}
${CTA}
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

function renderLlms(articles, sections, pillars) {
  const line = (url, name, desc) => `- [${name}](${SITE.origin}${url})${desc ? `: ${desc}` : ''}`;
  const standalone = articles.filter((a) => a.standalone);

  const clusters = [...pillars.entries()].map(([slug, items]) => {
    const pillar = PILLARS[slug];
    return `### ${pillar.name}\n\n${pillar.blurb}\n\n`
      + [line(`/guides/${slug}`, pillar.heading, ''),
         ...items.map((a) => line(a.url, a.heading || a.title, a.description))].join('\n');
  }).join('\n\n');

  return `# ${SITE.brand}

> ${SITE.brand} is an Australian estimating and tendering consultancy for commercial
> landscape subcontractors. We measure quantities off the drawings, price them to
> the client's rates, and hand back a submission-ready tender.

Contact: ${SITE.email} | ${SITE.telephone}

## Pages

${[line('/', `${SITE.brand} - tender estimating for commercial landscapers`, ''),
   ...standalone.map((a) => line(a.url, a.heading || a.title, a.description)),
   ...[...sections.keys()].map((slug) => line(`/${slug}`, SECTIONS[slug].h1, SECTIONS[slug].description))].join('\n')}

## Guides

${clusters}
`;
}

function renderNotFound(chrome) {
  const head = renderHead({
    title: `Page not found | ${SITE.brand}`,
    description: 'That page does not exist. Browse the estimating and tendering guides, or get in touch.',
    url: '/404',
    image: SITE.ogImage,
    extraCss: ['/css/article.css'],
    graph: null,
    type: 'website',
    noindex: true,
  });

  return renderPage({
    head,
    chrome,
    bodyClass: 'page-article',
    main: `  <main class="article-page guides-index">
    <header class="guides-hero">
      <span class="eyebrow">404</span>
      <h1>That page does not exist</h1>
      <p class="guides-lead">The link may be out of date. The guides index lists everything we have published, or you can talk to an estimator directly.</p>
    </header>
${CTA}
  </main>`,
  });
}

function renderSitemap(articles, sections, pillars) {
  const today = new Date().toISOString().slice(0, 10);
  const newest = (list) => list.reduce((m, a) => {
    const d = (a.dateModified || a.datePublished || '').slice(0, 10);
    return d && d > m ? d : m;
  }, '1970-01-01') || today;

  const entries = [
    { loc: '/', lastmod: today, changefreq: 'monthly', priority: '1.0' },
    ...articles.filter((a) => a.standalone).map((a) => ({
      loc: a.url,
      lastmod: (a.dateModified || a.datePublished).slice(0, 10),
      changefreq: 'monthly',
      priority: '0.8',
    })),
    ...[...sections.entries()].map(([slug, items]) => ({
      loc: `/${slug}`,
      lastmod: newest(items),
      changefreq: 'weekly',
      priority: '0.8',
    })),
    ...[...pillars.entries()].map(([slug, items]) => ({
      loc: `/guides/${slug}`,
      lastmod: newest(items),
      changefreq: 'weekly',
      priority: '0.6',
    })),
    ...articles.filter((a) => !a.standalone).map((a) => ({
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

// Inbox is the flat top level of SEO/blogs. Subfolders are deliberately skipped,
// so needs-input/ can park an article that is not ready without failing the build.
const inboxFiles = readdirSync(INBOX)
  .filter((f) => f.endsWith('.html'))
  .sort()
  .map((f) => join(INBOX, f));
const publishedFiles = walk(PUBLISHED);
const inboxSet = new Set(inboxFiles);

const articles = [...publishedFiles, ...inboxFiles].map(parseArticle).filter(Boolean);
articles.sort((a, b) => (b.datePublished || '').localeCompare(a.datePublished || ''));

// Group by section, then by pillar within /guides.
const bySection = new Map();
for (const a of articles) {
  if (!a.section || !SECTIONS[a.section]) continue;
  if (!bySection.has(a.section)) bySection.set(a.section, []);
  bySection.get(a.section).push(a);
}
const orderedSections = new Map(
  [...bySection.entries()].sort((x, y) => Object.keys(SECTIONS).indexOf(x[0]) - Object.keys(SECTIONS).indexOf(y[0]))
);

const pillars = new Map();
for (const a of articles) {
  if (!a.pillar || !PILLARS[a.pillar]) continue;
  if (!pillars.has(a.pillar)) pillars.set(a.pillar, []);
  pillars.get(a.pillar).push(a);
}
const orderedPillars = new Map(
  [...pillars.entries()].sort((x, y) => Object.keys(PILLARS).indexOf(x[0]) - Object.keys(PILLARS).indexOf(y[0]))
);

// Everything that will exist after this build, so links can resolve against it.
const urls = new Set([
  ...articles.map((a) => a.url),
  ...[...orderedSections.keys()].map((slug) => `/${slug}`),
  ...[...orderedPillars.keys()].map((slug) => `/guides/${slug}`),
]);
const known = { paths: new Set(['/', ...urls]) };

for (const a of articles) validate(a, known);

const seen = new Set();
for (const a of articles) {
  if (seen.has(a.url)) fail(a.file, `duplicate URL, already produced by another source: ${a.url}`);
  seen.add(a.url);
}

if (errors.length) {
  console.error(`\nBuild failed with ${errors.length} error(s). Nothing was written or moved.\n`);
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
  writes.push([join(dir, a.url.replace(/^\//, ''), 'index.html'), renderArticle(a, chrome, known.paths)]);
}
for (const [slug, items] of orderedPillars) {
  writes.push([join(dir, 'guides', slug, 'index.html'), renderPillar(slug, items, chrome)]);
}
for (const [slug, items] of orderedSections) {
  writes.push([join(dir, slug, 'index.html'), renderSectionIndex(slug, items, chrome)]);
}
writes.push([join(dir, 'sitemap.xml'), renderSitemap(articles, orderedSections, orderedPillars)]);
writes.push([join(dir, 'robots.txt'), renderRobots()]);
// llms.txt is the emerging convention for handing an assistant a map of the site
// in one fetch; 404.html is what Cloudflare Pages serves for an unmatched path.
writes.push([join(dir, 'llms.txt'), renderLlms(articles, orderedSections, orderedPillars)]);
writes.push([join(dir, '404.html'), renderNotFound(chrome)]);

if (CHECK_ONLY) {
  console.log(`check ok: ${articles.length} article(s), ${writes.length} file(s) would be written`);
  if (inboxFiles.length) console.log(`${inboxFiles.length} inbox file(s) would move to published/`);
} else {
  for (const [path, content] of writes) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }

  // Only once the build is known good: file the inbox away, so the inbox always
  // shows exactly what has not shipped yet.
  const moved = [];
  for (const a of articles) {
    if (!inboxSet.has(a.path)) continue;
    const dest = join(PUBLISHED, a.url.replace(/^\//, '') + '.html');
    mkdirSync(dirname(dest), { recursive: true });
    renameSync(a.path, dest);
    moved.push([relative(join(dir, '..'), a.path), relative(join(dir, '..'), dest)]);
  }

  console.log(`built ${articles.length} page(s):`);
  for (const [slug] of orderedSections) console.log(`  - /${slug} (section index)`);
  for (const slug of orderedPillars.keys()) console.log(`  - /guides/${slug} (pillar hub)`);
  for (const a of articles) console.log(`  - ${a.url}`);
  console.log(`  - sitemap.xml, robots.txt, llms.txt, 404.html`);

  if (moved.length) {
    console.log(`\nfiled ${moved.length} source(s) out of the inbox:`);
    for (const [from, to] of moved) console.log(`  ${from}\n    -> ${to}`);
  }
}

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
