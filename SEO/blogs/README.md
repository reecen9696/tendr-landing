# Publishing pipeline

```
SEO/blogs/*.html            <- INBOX. Drop new articles here.
SEO/blogs/published/        <- Filed automatically once they build clean.
```

## To publish

1. Drop the HTML file anywhere in `SEO/blogs/` (no folders needed)
2. `cd site && node build.mjs`
3. Commit and push

The file's own `URL slug:` decides where the page lands and where the source gets
filed, so the inbox needs no structure. After a clean build the inbox is empty
again, which means **anything sitting in `SEO/blogs/` has not shipped yet**.

Nothing is written and nothing is moved if the build finds an error, so a bad
article can never half-publish.

`node build.mjs --check` validates without writing or moving anything.

## What gets generated

Into `site/`, all overwritten every build — never hand-edit them:

- a page per article, at its declared URL
- pillar hubs (`/guides/pricing`, `/guides/tendering`, ...)
- section indexes (`/guides`, `/locations`)
- `sitemap.xml` and `robots.txt`

Head, meta, Open Graph, canonical, breadcrumbs and JSON-LD are all generated.
Nav and footer are read out of `site/index.html` at build time, so they cannot
drift from the landing page.

## Article format

A fragment, not a full page:

```html
<!--
     URL slug: /guides/pricing/how-to-price-a-commercial-landscape-tender
     Title tag (<=60 chars): How to Price a Commercial Landscape Tender (2026)
     Meta description (150-160): A step-by-step guide to pricing a commercial
       landscape tender in Victoria: takeoffs, rates, preliminaries and the BOQ.
-->

<script type="application/ld+json"> ... BlogPosting ... </script>
<script type="application/ld+json"> ... FAQPage ... </script>

<main><article> ... </article></main>
```

Every field falls back: title to the `<h1>`, description to the JSON-LD, URL to
the file path. Supplying them explicitly is better, since the title tag and the
`<h1>` should usually differ.

Sections currently recognised: `/guides/<pillar>/<slug>` and `/locations/<slug>`.
Pillars: `pricing`, `takeoffs`, `tendering`, `variations`, `contracts`. To add a
pillar or a section, edit `PILLARS` or `SECTIONS` at the top of `site/build.mjs`
before adding the article.

Use `{{DOMAIN}}` for full URLs. Any other `{{PLACEHOLDER}}` left in the body
fails the build on purpose; in JSON-LD it is stripped along with the key, so a
`"sameAs": ["{{AUTHOR_LINKEDIN}}"]` disappears rather than shipping literally.

## Links

Link to other pages by their real URL even if the page does not exist yet. The
build unwraps a link whose target is missing and warns, so nothing ever ships
pointing at a 404, and the link becomes live by itself once the target is added.

`/contact` is rewritten to `/#book` automatically.

## What the build refuses to ship

Exit code 1, nothing written, nothing moved:

- an unreplaced `{{PLACEHOLDER}}` in the body
- invalid JSON-LD
- an `FAQPage` entry whose question or answer is not on the visible page
- a missing `<h1>`, meta description, or a `BlogPosting` with no `datePublished`
- an unknown section or pillar, or two articles claiming the same URL

Warnings that still build: title over 60 characters, meta description outside
100 to 160, no `.answer` block, unwrapped links.

## Structure that earns citations

The build cannot check this, and it is the part that matters.

- `<h1>` is the question in the reader's own words
- `<p class="answer">` directly under it: 2 to 3 sentences, 40 to 60 words,
  answering outright before any context. This is what AI assistants extract.
- Question-led `<h2>`s, short paragraphs, each quotable out of context
- Definitions in definition form ("A Bill of Quantities is...")
- An FAQ of 5+ questions with ~40-word answers, mirrored exactly in `FAQPage`
- A `#takeaways` section at the end

1,200 to 2,000 words for a cluster article, 3,000 to 5,000 for a pillar.
Extractable density beats word count.

## Never

Publish a rate, price, turnaround or review count that has not been confirmed.
Tendr sells pricing accuracy, and a wrong number in a guide costs more than a
missing one. Leave the placeholder in and let the build fail.
