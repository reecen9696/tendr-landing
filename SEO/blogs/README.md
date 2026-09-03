# Note on where articles live

This folder holds the original drafted article. It is **not** what gets built.

Live article sources are in `site/content/guides/<pillar>/<slug>.html`, because
the build script runs from inside `site/` and cannot read outside it.

To publish a new guide, drop the HTML there instead. See
`site/content/README.md` for the format and the workflow.

The copy of `how-to-price-a-commercial-landscape-tender.html` in this folder is
the pre-edit original, kept for reference. The published version differs: the
`{{INDICATIVE_RATE}}` table was replaced with a rate-driver table rather than
shipping invented dollar figures.
