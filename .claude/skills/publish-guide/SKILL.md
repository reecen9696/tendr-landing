---
name: publish-guide
description: Publish SEO/GEO articles to the Tendr site, or write new ones. Use when the user drops an HTML article in SEO/blogs, asks to publish or build the blog/guides/locations pages, asks to write a new guide or location page, or reports a build failure or a broken link on gotendr.com. Also covers adding a pillar or section, and the rules about never publishing unverified rates or turnaround claims.
---

# Publishing to the Tendr guides system

Static HTML site at `site/`, deployed to Vercel, served at **www.gotendr.com**.
Articles are HTML fragments; `site/build.mjs` wraps them into full pages and
regenerates the hubs, indexes, sitemap and robots.

## The pipeline

```
SEO/blogs/*.html        INBOX      drop articles here, no folders needed
SEO/blogs/published/    FILED      moved here automatically on a clean build
site/guides/            GENERATED  never hand-edit
site/locations/         GENERATED  never hand-edit
```

An article's own `URL slug:` decides its page URL and where the source is filed.
**Anything left in `SEO/blogs/` has not shipped.** That is the whole status check.

## To publish

```bash
cd site && node build.mjs        # build, then file the inbox
cd site && node build.mjs --check  # validate only, move nothing
```

Nothing is written and nothing is moved if there is an error, so a bad article
cannot half-publish. Then commit and push. To deploy:

```bash
cd site && vercel deploy --prod --yes
```

Verify afterwards. `curl` is unavailable in this sandbox, use node:

```bash
node -e '(async()=>{for(const p of ["/guides","/locations"]){
  const r=await fetch("https://www.gotendr.com"+p);console.log(r.status,p);}})()'
```

## Article format

```html
<!--
     URL slug: /guides/pricing/how-to-price-a-commercial-landscape-tender
     Title tag (<=60 chars): How to Price a Commercial Landscape Tender (2026)
     Meta description (150-160): One or two lines, may wrap.
-->
<script type="application/ld+json"> ... BlogPosting ... </script>
<script type="application/ld+json"> ... FAQPage ... </script>
<main><article> ... </article></main>
```

Fields fall back to the `<h1>`, the JSON-LD, and the file path if absent.
`{{DOMAIN}}` is substituted. Placeholders inside JSON-LD are stripped with their
key, so `"sameAs": ["{{AUTHOR_LINKEDIN}}"]` vanishes rather than shipping.

Recognised URLs: `/guides/<pillar>/<slug>` and `/locations/<slug>`.
Pillars: `pricing`, `takeoffs`, `tendering`, `variations`, `contracts`.
Add a pillar or section in `PILLARS` / `SECTIONS` at the top of `site/build.mjs`
**before** adding an article that needs it, or the build rejects the article.

## Writing a new article

Structure is the mechanism that wins citations, so follow it exactly:

1. `<h1>` is the question in the reader's own words.
2. `<p class="answer">` immediately under it: 2 to 3 sentences, 40 to 60 words,
   answering outright before any context. This is the passage AI assistants
   extract, and it is styled to stand out for readers too.
3. Question-led `<h2>`s ("How do you apply rates to a landscape BOQ?", not "Rates").
4. Short paragraphs, each one quotable out of context on its own.
5. Definitions in definition form: "A Bill of Quantities is...".
6. An FAQ of 5+ real questions, ~40-word answers, mirrored **word for word** in
   `FAQPage` schema. The build fails on any mismatch, because Google drops the
   rich result for schema that does not match the page.
7. A `#takeaways` list at the end.

1,200 to 2,000 words for a cluster article, 3,000 to 5,000 for a pillar.
Extractable density beats word count.

House style: sentence case, plain Australian English, no em dashes, no hype.

## Links

Link by real URL even when the target does not exist yet. The build unwraps a
missing target and warns, so nothing ships pointing at a 404, and the link goes
live by itself once the page exists. `/contact` is rewritten to `/#book`.

Currently unwrapped and worth knowing: `/services/*` pages are referenced by
several articles but have not been built.

## Never publish an unverified number

Tendr sells pricing accuracy. A wrong rate, fee, turnaround or review count in a
guide costs more than a missing one, and these are customer-facing commitments.

Two real cases: an article shipped with `{{INDICATIVE_RATE}}` in a rate table,
replaced with a table of what drives each rate; and the Melbourne page claimed a
24-hour takeoff turnaround that appears nowhere else on the site, aligned to the
home page's "we confirm the date up front" wording.

If content needs a figure that is not confirmed, either restructure it to teach
the method instead of the number, or leave the placeholder in and let the build
fail. Ask; never estimate. The same applies to `AggregateRating` schema for the
"5.0 from 40+ reviews" claim: not until the Google Business Profile is verified.

## Build errors

Exit 1, nothing written or moved:

| Error | Fix |
|---|---|
| unreplaced `{{PLACEHOLDER}}` in body | supply the real value, or restructure the content |
| FAQ question/answer not on the page | make schema match the visible text exactly |
| invalid JSON-LD | fix the JSON |
| no `<h1>` / meta description | add to the comment header |
| `BlogPosting` with no `datePublished` | add it (location and service pages are exempt) |
| unknown section or pillar | add it to `SECTIONS` / `PILLARS` first |
| duplicate URL | two sources claim one `URL slug:` |

## Gotchas

- Nav and footer are read out of `site/index.html` at build time. Change them
  there, never in the generated pages.
- Canonical host is `https://www.gotendr.com`. The apex 307-redirects to it.
  `SITE.origin` in `build.mjs` and every URL in `index.html` must agree, or the
  schema `@id`s split into two Organization entities.
- Article styles live in `site/css/article.css`, loaded only on these pages so
  the landing page CSS payload is untouched. Tokens come from `styles.css`.
- `robots.txt` is generated. Add crawlers to `AI_AGENTS` in `build.mjs`, not by
  editing the file.
- A new section index is an orphan until something links to it. Add it to the
  nav or footer in `index.html`.
