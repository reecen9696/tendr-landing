# Adding a guide

## The short version

1. Drop the article HTML into `content/guides/<pillar>/<slug>.html`
2. Run `node build.mjs` from the `site` directory
3. Commit and push

Everything else is generated: the page head, meta tags, Open Graph, canonical,
nav, footer, breadcrumbs, the pillar hub page, the `/guides` index, `sitemap.xml`
and `robots.txt`. Do not hand-edit anything under `guides/` — it is overwritten
on every build.

The pillar is the folder name. Four exist: `pricing`, `takeoffs`, `tendering`,
`contracts`. To add a fifth, add it to `PILLARS` in `build.mjs` first, otherwise
the build will reject the article.

## What an article file looks like

A fragment, not a full page. Three parts, in this order:

```html
<!--
     URL slug: /guides/pricing/how-to-price-a-commercial-landscape-tender
     Title tag (<=60 chars): How to Price a Commercial Landscape Tender (2026)
     Meta description (150-160): A step-by-step guide to pricing a commercial
       landscape tender in Victoria: takeoffs, rates, preliminaries, margin
       and the BOQ, from a working estimator.
-->

<script type="application/ld+json"> ... BlogPosting ... </script>
<script type="application/ld+json"> ... BreadcrumbList ... </script>
<script type="application/ld+json"> ... FAQPage ... </script>

<main>
  <article>
    ...
  </article>
</main>
```

Every field has a fallback, so an article with no comment header still builds:
the title falls back to the `<h1>`, the description to the JSON-LD, the URL to
the file path. Supplying them explicitly is better, because the title tag and
the `<h1>` should usually differ.

Use `{{DOMAIN}}` anywhere a full URL is needed; the build substitutes it. Any
other `{{PLACEHOLDER}}` left in the body fails the build on purpose.

## Structure that earns citations

This is the part that actually matters, and the build cannot check it for you.

- **`<h1>`** is the question, in the words a landscaper would use.
- **`<p class="answer">`** sits directly under the `<h1>`: 2 to 3 sentences,
  40 to 60 words, answering the question outright before any context. This is
  the passage AI assistants lift, and it is styled to stand out for readers too.
- **Question-led `<h2>`s.** "How do you apply rates to a landscape BOQ?", not
  "Rates".
- **Short paragraphs, each quotable out of context.** If a paragraph would not
  make sense lifted into an AI answer on its own, split it.
- **Definitions in definition form.** "A Bill of Quantities is..." — these are
  cited disproportionately often.
- **Concrete specifics**: named sources, dated figures, step lists, tables.
- **An FAQ section** of 5 or more real questions with roughly 40-word answers,
  mirrored exactly in `FAQPage` schema.
- **A `#takeaways` section** at the end.

Length: 1,200 to 2,000 words for a cluster article, 3,000 to 5,000 for a pillar.
Density of extractable blocks beats raw word count.

## Internal links

Link to other guides by their real URL, for example
`/guides/takeoffs/how-to-measure-a-landscape-takeoff`.

If the target does not exist yet, the build unwraps the link to plain text and
warns, so nothing ever ships pointing at a 404. When you later add that article,
the link becomes live on the next build with no edit needed. Write the links you
want as though everything already exists.

A link to a non-guide page that does not exist is a hard error, not a warning.

## What the build refuses to ship

`node build.mjs` exits non-zero, writing nothing, on:

- an unreplaced `{{PLACEHOLDER}}` in the body
- invalid JSON-LD
- an `FAQPage` entry whose question or answer is not on the visible page
  (Google drops the rich result for mismatched FAQ schema, so this must match)
- a missing `<h1>`, meta description, or `datePublished`
- an internal link to a page that does not exist
- an unknown pillar, or two articles claiming the same URL

It warns, but still builds, on a title over 60 characters, a meta description
outside 100 to 160 characters, a missing `.answer` block, and unwrapped links to
guides that do not exist yet.

Run `node build.mjs --check` to validate without writing anything.
