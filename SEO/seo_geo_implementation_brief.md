# Implementation Brief: SEO + GEO-Optimised Site for a Commercial Landscape Estimating Business (Victoria, AU)

## For the executing agent

You are building and configuring a website and content system for a commercial landscape tendering and estimating consultancy operating across Victoria, Australia. The goal is to rank on Google and get cited by AI engines (ChatGPT, Perplexity, Gemini, Google AI Overviews, Copilot, Claude) for commercial landscape estimating and tendering queries.

This brief is self-contained. Follow it in order. Where it says **CONFIRM**, stop and get a human decision before proceeding.

Business facts you may use:
- Services: quantity takeoffs, priced Bills of Quantities (BOQs), tender submissions, scope and contract review, variation pricing, quoting.
- Customers: commercial landscape subcontractors bidding drawing-based tenders.
- Coverage regions: Melbourne, Geelong, Ballarat, Bendigo, Gippsland (all Victoria).
- Do NOT invent or assume a brand name; use `{{BRAND_NAME}}` where one is needed.

---

## Phase 0 — Stack decision (CONFIRM before building)

**Recommendation: Astro + Tailwind, deployed to Vercel or Cloudflare Pages, content in Markdown/MDX.**

Rationale: Astro ships zero-JS static HTML by default, the single most important property for GEO. AI crawlers do not reliably execute JavaScript, so client-rendered SPAs are invisible to them. Astro also gives fast Core Web Vitals, built-in sitemap and RSS, trivial JSON-LD injection, and file-based content collections a non-technical owner can later edit.

Alternative if the owner needs a non-developer CMS: **WordPress + a lightweight block theme + Rank Math** (schema/sitemaps) on managed hosting. Heavier and slower but self-editable.

Do NOT use a client-rendered React/Vue SPA with no SSR/SSG. Do NOT keep the current hand-rolled static HTML site (no content collections, no schema pipeline, no sitemap automation).

**CONFIRM:** stack (Astro vs WordPress), and the production domain (recommend a `.com.au`).

---

## Phase 1 — Project scaffold (Astro path)

1. Initialise: `npm create astro@latest` -> minimal/empty template, TypeScript strict.
2. Integrations: `@astrojs/sitemap`, `@astrojs/tailwind`, `@astrojs/mdx`, `@astrojs/rss`.
3. Set `site: 'https://{{DOMAIN}}'` in `astro.config.mjs` (required for absolute sitemap URLs).
4. Content collections in `src/content/`:
   - `services/` — one MDX per service (6 files)
   - `locations/` — one MDX per region (5 files)
   - `guides/` — pillar + cluster articles
   - `caseStudies/` — case studies
   Define a Zod schema per collection in `src/content/config.ts` enforcing: `title`, `description` (<=155 chars), `datePublished`, `dateModified`, `author`, `faq` (array of `{q, a}`), `schemaType`, `primaryKeyword`, `internalLinks`.
5. URL architecture (clean, stable, keyword-relevant):
   - `/services/<service-slug>/`
   - `/locations/<region-slug>/`
   - `/guides/<pillar-slug>/` and `/guides/<pillar-slug>/<cluster-slug>/`
   - `/case-studies/<slug>/`
   - `/about/`, `/contact/`
6. Global `<BaseHead>` component outputs per page: `<title>` (<=60 chars), meta description, canonical, Open Graph, Twitter card, and a JSON-LD slot.

---

## Phase 2 — Technical SEO/GEO foundations (do BEFORE any content)

### 2.1 robots.txt (`public/robots.txt`)
Explicitly ALLOW AI search/retrieval crawlers. Do not rely on defaults.

```
# --- Traditional search ---
User-agent: Googlebot
Allow: /
User-agent: Bingbot
Allow: /

# --- AI retrieval / search bots (power live citations) ---
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: GPTBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Perplexity-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: Claude-User
Allow: /
User-agent: Google-Extended
Allow: /

# --- Everyone else ---
User-agent: *
Allow: /
Disallow: /*?*utm
Disallow: /thank-you/

Sitemap: https://{{DOMAIN}}/sitemap-index.xml
```
This is a lead-gen marketing site, so allowing training crawlers (GPTBot, ClaudeBot, Google-Extended) is intentional: brand presence in training data helps and there is no meaningful downside.

### 2.2 Cloudflare / CDN (if used)
Cloudflare now blocks AI crawlers by default; robots.txt alone will NOT unblock them.
- Dashboard -> Security -> Bots -> **AI Crawl Control**: set **Search** and **Agent** categories to **Allow**. (Training may be Allow or Block per owner; recommend Allow.)
- Confirm no WAF/managed rule is challenging these user agents.
- Do NOT enable the "Block AI Bots" one-click toggle.

### 2.3 Verification (run and record results)
Each bot must return HTTP 200 with no `noindex`:
```
curl -A "PerplexityBot" -I https://{{DOMAIN}}/
curl -A "OAI-SearchBot" -I https://{{DOMAIN}}/
curl -A "ClaudeBot"     -I https://{{DOMAIN}}/
curl -A "Googlebot"     -I https://{{DOMAIN}}/
```
Confirm rendered HTML contains body content WITHOUT JS execution:
```
curl -s https://{{DOMAIN}}/services/quantity-takeoffs/ | grep -c "takeoff"
```
Must return > 0. If 0, content is client-rendered — fix before continuing.

### 2.4 Sitemaps, indexing, analytics
- Ensure `@astrojs/sitemap` emits `sitemap-index.xml`; reference it in robots.txt.
- Register **Google Search Console** and **Bing Webmaster Tools**; submit sitemap to both.
- Enable **IndexNow** (Bing) so publishes/updates ping instantly. Required for Copilot citation eligibility (Copilot can only cite what Bing has indexed).
- Install **GA4**; create an "AI referrers" exploration matching referral hosts: `chatgpt.com`, `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com`, `claude.ai`.

### 2.5 Core Web Vitals guardrails
- No render-blocking JS; defer/inline critical CSS.
- All images: explicit width/height, `loading="lazy"` below the fold, AVIF/WebP, `<img>` not CSS backgrounds for content imagery.
- Targets on 4G mobile: LCP < 2.5s, INP < 200ms, CLS < 0.1. Verify with PageSpeed Insights post-deploy.

---

## Phase 3 — Structured data (JSON-LD, server-rendered on every relevant page)

Validate every type in BOTH Google Rich Results Test and Bing Markup Validator (Bing is stricter; Copilot skips malformed schema Google tolerates).

### 3.1 Sitewide Organization/LocalBusiness (in `<head>` of every page)
```json
{
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "@id": "https://{{DOMAIN}}/#organization",
  "name": "{{BRAND_NAME}}",
  "url": "https://{{DOMAIN}}",
  "telephone": "{{PHONE}}",
  "email": "{{EMAIL}}",
  "areaServed": [
    {"@type":"City","name":"Melbourne"},
    {"@type":"City","name":"Geelong"},
    {"@type":"City","name":"Ballarat"},
    {"@type":"City","name":"Bendigo"},
    {"@type":"AdministrativeArea","name":"Gippsland"}
  ],
  "serviceType": "Commercial landscape estimating and tendering",
  "audience": {"@type":"BusinessAudience","name":"Commercial landscape subcontractors"},
  "sameAs": ["{{LINKEDIN_URL}}","{{GBP_URL}}","{{DIRECTORY_URLS}}"]
}
```

### 3.2 Service pages
`Service`, with `provider` linked by `@id` to the org above, plus `areaServed`.

### 3.3 Guides / blog
`Article` with nested `author` `Person` (real name + credentials + `sameAs` to LinkedIn).

### 3.4 How-to guides
Add `HowTo` with ordered `step` items.

### 3.5 Any page with an FAQ block
`FAQPage` mirroring the on-page Q&A exactly.

### 3.6 Sitewide
`BreadcrumbList`.

Implement as a reusable Astro component `<Schema type={...} data={...} />` so each page declares its type via frontmatter (`schemaType`) and the component emits valid JSON-LD. Never hardcode duplicated blocks.

---

## Phase 4 — Page content spec (the answer-first template)

Every guide/service page MUST follow this structure. It is the mechanism by which both Google featured snippets and AI citations are won.

1. **H1** = the exact question or topic, in the user's words.
2. **Direct answer block** immediately under H1: 2-3 sentences (~40-60 words), self-contained, leads with the answer (BLUF / inverted pyramid). This is the block AI extracts.
3. **Question-led H2/H3s** phrased as a landscaper would ask ("How do you measure a softscape takeoff from drawings?").
4. **2-3 sentence paragraphs**, each section quotable out of context. Apply the "quotability test": could this paragraph be lifted verbatim into an AI answer and still make sense?
5. **Concrete specifics in every section**: named sources, dated statistics, expert quotes, step lists, comparison tables. Highest-leverage GEO tactics per the Princeton GEO study (statistics/quotations/citations lift citation rate; keyword stuffing does not).
6. **Clear definitions** ("A Bill of Quantities is..."). Definition-form sentences are cited disproportionately.
7. **FAQ block**: 5+ real questions, ~40-word answers, mirrored in `FAQPage` schema.
8. **One clear CTA** in active voice ("Get your tender priced").
9. **Internal links**: every cluster links up to its pillar and sideways to 2-3 siblings; pillar links down to all clusters.

Length: cluster/how-to 1,200-2,000 words; pillar 3,000-5,000. Extractable density beats raw length.

Frontmatter each content file must supply: `title`, `description`, `datePublished`, `dateModified`, `author`, `schemaType`, `faq[]`, `primaryKeyword`, `internalLinks[]`.

---

## Phase 5 — Content build order & keyword map

Build money pages first (they must exist before content marketing drives traffic), then pillars.

**Service pages (6):** quantity-takeoffs, priced-boqs, tender-submissions, scope-contract-review, variation-pricing, quoting. Buyer-intent keywords (e.g. "commercial landscape estimating services", "landscape takeoff services Victoria", "priced BOQ landscaping").

**Location pages (5):** one per region with genuinely unique local content (regional project types, local council/tender context). NOT templated duplicates (Google demotes doorway pages).

**Pillar clusters (build over 6-12 months):**
- Pillar 1 — *How to price commercial landscape work* -> clusters: pricing a tender, softscape vs hardscape, per-m2 rates, pricing maintenance, pricing retaining walls, pricing turf/topsoil/mulch quantities.
- Pillar 2 — *Quantity takeoffs & BOQs* -> clusters: what is a BOQ, measuring takeoffs from drawings, reading landscape architect drawings, takeoff software, common takeoff errors.
- Pillar 3 — *Tendering & bidding for landscape subcontractors* -> clusters: how to read a tender scope, EstimateOne landscaping tenders, improving win rate, tender submission checklist.
- Pillar 4 — *Scope, contracts & variations* -> clusters: handling variations, scope gaps, contract review basics.

**Case studies (2 to start):** real, specific outcomes.

Cadence for the content pipeline: 2-4 articles/month after the initial money-page + Pillar-1 batch ships together.

---

## Phase 6 — Off-site & entity (produce as a checklist deliverable; do not auto-submit)

Generate a checklist file the owner executes (these require real business identity):
- Google Business Profile: service-area business, all 5 regions, categories, verified.
- Consistent NAP across AU directories: Localsearch, TrueLocal, Hotfrog, StartLocal, Yellow Pages.
- Industry: Landscaping Victoria (Master Landscapers) listing; EstimateOne profile; ICN Gateway.
- LinkedIn company page (distinct Copilot/B2B signal) + founder profile with `sameAs`.
- Wikidata entry once notability supports it.
- One piece of original research (e.g. "Victorian commercial landscape cost benchmark") for links + AI citations.
- Authentic Reddit/community participation (major Perplexity/AI-Overview citation source; do not spam).

---

## Phase 7 — Measurement setup (deliver configured dashboards + a runbook)

- GSC + Bing Webmaster Tools: rankings, impressions, clicks, coverage.
- Bing Webmaster Tools **AI Performance report**: first-party AI citation data; check monthly.
- GA4 AI-referrer exploration (Phase 2.4).
- **Share-of-model runbook**: a fixed set of 20-50 "golden prompts" (e.g. "who does commercial landscape estimating in Melbourne", "how do I get a landscape tender priced in Victoria"). Run monthly across ChatGPT, Perplexity, Gemini, Copilot, AI Overviews; log mention/citation yes-no and position. Track the trend, not single runs (AI output is non-deterministic).
- Realistic timeline: 3-6 months to meaningful movement. Perplexity reflects new content fastest; ChatGPT (training) lags.

---

## Phase 8 — Acceptance criteria (self-check before handing back)

- [ ] All AI-bot curl checks return 200, no noindex.
- [ ] `curl` without JS returns body content on 3 sample pages (SSR/SSG confirmed).
- [ ] sitemap-index.xml generated, referenced in robots.txt, submitted to GSC + Bing.
- [ ] IndexNow active.
- [ ] Every page type emits valid JSON-LD passing Google + Bing validators (paste results).
- [ ] 6 service + 5 location pages live, each with unique content + Service/LocalBusiness schema.
- [ ] Pillar 1 + >=6 clusters live, each following the Phase 4 answer-first template with FAQ schema.
- [ ] LCP < 2.5s / INP < 200ms / CLS < 0.1 on mobile (paste PageSpeed scores).
- [ ] GA4 + GSC + Bing verified.
- [ ] Off-site checklist + share-of-model runbook + golden-prompt list delivered as files.

---

## Constraints (do not violate)
- No client-rendered-only content.
- No keyword stuffing, doorway/duplicate location pages, or auto-posted spam to Reddit/directories.
- Sentence case, plain Australian English, no em dashes, no hype in all site copy.
