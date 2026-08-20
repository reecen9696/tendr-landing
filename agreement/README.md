# Tendr — Estimating Services Agreement (branded)

Source of truth is `agreement.template.html`. Everything else is generated.
Both scripts resolve paths relative to this folder, so it can be moved without editing them.

## Files
| File | What it is |
|---|---|
| `Tendr_Estimating_Services_Agreement.pdf` | **Upload this to the e-sign tool.** A4, 3 pages. |
| `agreement.template.html` | Edit the wording/styling here. |
| `agreement.html` | Generated, self-contained (fonts + logo inlined). Preview in a browser. |
| `build.mjs` | `node build.mjs` → regenerates `agreement.html` + the PDF. |
| `pages.mjs` | `node pages.mjs` → renders `preview/page1-3.png` for eyeballing. |
| `fonts.css` | DM Sans 400/500/700 + DM Mono 400/500, base64-embedded so the PDF renders identically anywhere. |
| `logo-navy.svg` | `../site/assets/logo.svg` with the wordmark recoloured to `--navy-800`. |

## Notes
- No ABN appears anywhere in the document. The `ABN` field in the Client details card is the
  client's to fill in.
- Clause bodies are written in plain English using "we"/"you", defined in the opening paragraph.

## Design tokens
Lifted verbatim from `../site/css/styles.css`: `--cta-red #EB1600`, `--navy-800 #1B3139`,
`--navy-900 #0B2026`, `--oat-light #F9F7F4`, `--gray-lines #DCE0E2`, `--radius 2px`,
DM Sans / DM Mono.
