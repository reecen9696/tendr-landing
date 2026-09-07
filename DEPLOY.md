# Deploying gotendr.com

The site is a plain static directory. `site/` is exactly what gets served — no
build runs on the host, because `node site/build.mjs` writes its output into
`site/` and that output is committed.

Host: **Cloudflare Pages** (free, private repos allowed, custom domains and TLS
included). Deploys happen on every push to `main`.

---

## 1. One-time: create the Pages project

Cloudflare dashboard -> **Workers & Pages** -> **Create** -> **Pages** ->
**Connect to Git** -> pick `reecen9696/tendr-landing`.

Build settings:

| Field | Value |
|---|---|
| Production branch | `main` |
| Framework preset | None |
| Build command | *(leave empty)* |
| Build output directory | `site` |
| Root directory | *(leave empty — repo root)* |

Save and deploy. It publishes to `https://<project>.pages.dev`. Check that URL
works before touching DNS — the Vercel deployment keeps serving the live domain
until the nameservers move, so there is no downtime window here.

`site/_headers` sets the security and cache headers that `vercel.json` used to.

## 2. One-time: move gotendr.com onto Cloudflare DNS

Right now `gotendr.com` uses GoDaddy nameservers (`ns67/ns68.domaincontrol.com`)
and points at Vercel. Move DNS to Cloudflare rather than keeping it at GoDaddy:

- The apex has to resolve to Pages. GoDaddy has no CNAME flattening, so on
  GoDaddy the apex can only be handled by their forwarding service. Cloudflare
  flattens a root CNAME natively.
- `_redirects` in Pages cannot match on hostname, so apex -> www has to be a
  zone-level Redirect Rule, which needs the zone on Cloudflare.
- It makes the DNS records scriptable through the Cloudflare API (see below).

Steps:

1. Cloudflare -> **Add a site** -> `gotendr.com` -> Free plan. Cloudflare scans
   and imports the existing GoDaddy records. **Check the import** — mail records
   in particular (MX, SPF `TXT`, DKIM). Anything missed here breaks email.
2. Cloudflare gives you two nameservers. In GoDaddy: **My Products** ->
   `gotendr.com` -> **DNS** -> **Nameservers** -> **Change** -> **I'll use my
   own nameservers** -> paste both. Propagation is usually under an hour.
3. In the Pages project -> **Custom domains**, add both `gotendr.com` and
   `www.gotendr.com`. Cloudflare writes the CNAME records itself.
4. Delete the leftover Vercel records if the import carried them over: the apex
   `A` records (`216.150.*`) and the `www` CNAME to `*.vercel-dns-016.com`.
5. **Rules** -> **Redirect Rules** -> Create:
   - When: `hostname equals gotendr.com`
   - Then: Dynamic redirect, `concat("https://www.gotendr.com", http.request.uri)`,
     status **301**, preserve query string.

   Canonical tags, `sitemap.xml` and `robots.txt` all point at `www`, so the
   apex must redirect there and not serve a duplicate copy of the site.
6. **SSL/TLS** -> set encryption mode to **Full (strict)** and turn on **Always
   Use HTTPS**.

## 3. After DNS is live

- Delete the Vercel project so it cannot serve a stale copy.
- Google Search Console: the `www.gotendr.com` property stays valid. Resubmit
  `https://www.gotendr.com/sitemap.xml`.
- The `<project>.pages.dev` hostname stays reachable and is a duplicate of the
  site. Every page carries a `rel="canonical"` pointing at `www.gotendr.com`,
  so it will not compete in search, but do not link to it anywhere.

---

## Publishing changes

```sh
cd site
node build.mjs --check   # validate only
node build.mjs           # regenerate guides/hubs/sitemap, empty the inbox
cd .. && git add -A site SEO && git commit && git push
```

Pushing to `main` is the deploy. `.github/workflows/site-check.yml` runs
`build.mjs --check` on every push so a malformed article fails in CI rather
than shipping.

## Managing DNS from the terminal

**Cloudflare** has an official remote MCP server that fronts the whole API,
including DNS records:

```sh
claude mcp add --transport http cloudflare https://mcp.cloudflare.com/mcp
```

Then `/mcp` in Claude Code to run the OAuth flow. Or use the REST API directly
with a scoped token (**My Profile** -> **API Tokens** -> template *Edit zone
DNS*):

```sh
curl https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records \
  -H "Authorization: Bearer $CF_API_TOKEN"
```

**GoDaddy** is not a practical option for this. Their Domains API exists, but
management and DNS endpoints are restricted to accounts holding 10+ domains or
a Discount Domain Club Premier membership, and there is no official GoDaddy MCP
server. This is another reason to move the zone to Cloudflare.
