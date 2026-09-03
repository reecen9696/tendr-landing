# Off-site and entity checklist

Everything here needs your real business identity, so none of it is automated.
Work down the list in order; it is sorted by leverage, not effort.

Consistent NAP means the exact same name, address and phone on every listing,
character for character. Pick one form now and reuse it verbatim:

```
Tendr
Melbourne, VIC, Australia
0487 028 339
reece@gotendr.com
https://gotendr.com
```

## 1. Do these first (highest leverage)

- [ ] **Google Business Profile.** Set up as a *service-area business*, not a
      storefront. Define the regions you actually service. Primary category
      something like "Construction estimating service" or "Quantity surveyor".
      Verify it. This is the single biggest local-visibility asset in Australia,
      and Gemini and AI Overviews lean on it directly.
- [ ] **Google Search Console.** Verify `gotendr.com`, submit
      `https://gotendr.com/sitemap.xml`, set the country target to Australia.
- [ ] **Bing Webmaster Tools.** Verify the site and import the sitemap from
      Search Console. Copilot cannot cite a page Bing has not indexed, so
      skipping this closes off one engine entirely.
- [ ] **IndexNow.** Enable it in Bing Webmaster Tools so each publish pings Bing
      immediately rather than waiting on a crawl.
- [ ] **Cloudflare AI Crawl Control**, if the domain is behind Cloudflare.
      Security → Bots → AI Crawl Control, set **Search** and **Agent** to Allow.
      `robots.txt` alone does not unblock these; the CDN blocks them first.
      Do not turn on the one-click "Block AI Bots" toggle.
- [ ] **LinkedIn company page**, plus your founder profile linked to it. This is
      a distinct Copilot and B2B ranking signal, LinkedIn being Microsoft-owned.

## 2. The 5.0-from-40-reviews claim

The home page states a 5.0 rating from 40+ Google reviews. Once the Google
Business Profile is verified, add `AggregateRating` schema pointing at it so
that claim is machine-readable and eligible for stars in results.

Until the profile is live and the review count is verifiable, leave the schema
off. Unverifiable review markup is a manual-action risk, and it is the kind of
thing Google checks.

## 3. Industry directories and associations

These are the hyper-relevant links that outperform generic high-authority ones.

- [ ] **EstimateOne** profile. This is where your customers already are.
- [ ] **ICN Gateway** profile.
- [ ] **Landscaping Victoria (Master Landscapers)** membership and listing, if
      you are pursuing the Victorian market specifically.
- [ ] **Australian directories** for NAP consistency: Localsearch, TrueLocal,
      Hotfrog, StartLocal, Yellow Pages.

## 4. Author and entity signals

- [ ] **Author bio page** for Reece with real credentials, years estimating, and
      `Person` schema. Articles already carry a `Person` author node, but it
      currently has no `sameAs` because there is no LinkedIn URL on file. Send
      me the LinkedIn URL and I will wire it into `SITE` in `build.mjs`.
- [ ] **About page** heavy on first-hand experience: how many tenders priced,
      what trades, what dollar value. Google's 2026 updates put first-hand
      Experience above the other three E-E-A-T letters.
- [ ] **`sameAs` links** tying the site, GBP, LinkedIn and directory profiles
      together so the engines resolve them as one entity.
- [ ] **Wikidata entry**, once there is enough third-party coverage to support
      notability. Not before.

## 5. Content assets worth the effort

- [ ] **Two case studies** with specific, real outcomes. Named trade, package
      value, what was found in the takeoff, what the result was. This is the
      scarcest and least copyable signal you have, and no competitor or AI can
      manufacture it.
- [ ] **One piece of original research.** A "Victorian commercial landscape cost
      benchmark", published annually from the tenders you have priced (
      aggregated and anonymised). Original data earns more AI citations and
      better links than any other content type. This is the single highest-value
      item on this list after the Google Business Profile.
- [ ] **Genuine Reddit and forum participation.** Reddit is the most-cited
      domain on Perplexity and a major AI Overviews source. Answer real
      questions in r/landscaping, r/AusConstruction and similar as a working
      estimator. Do not drop links. This takes 6 to 12 months to matter and
      cannot be shortcut or automated, but it is durable once built.
- [ ] **SourceBottle** (Australian) and Connectively for expert commentary that
      earns trade-publication links.

## 6. Positioning question to settle

The site currently positions as Australia-wide. The SEO research assumed a
Victoria-only business and recommends five Victorian location pages.

Those are mutually exclusive. Location pages only work if each one has genuinely
unique local content; five templated variants are doorway pages and get demoted.
Decide which you are before building them:

- **Australia-wide** (current site copy): skip location pages, compete on
  service pages and guides.
- **Victoria-first**: build five real location pages with actual regional
  content, and change the home page copy to match.
