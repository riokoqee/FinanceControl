# BeliLog visual redesign

Baseline: `28747a6`, 8 November 2026. Release: **2.6.0**. This release changes presentation. The [color inventory](DESIGN_COLOR_AUDIT.md) was recorded before visual source edits; it covers 226 literal-bearing lines, 335 occurrences and 241 distinct color values.

## What changed

Both themes now use the same semantic roles, spacing and radius scales. Navy and warm parchment carry most of the interface; gold highlights primary actions, navigation, streaks and bounties. Teal, amber and coral distinguish success, warnings and errors. Main expense totals remain the largest financial figures and use tabular numerals.

The overview uses seven category patterns as well as names, amounts and colors. Budget status has an icon and short text in RU/EN. Exactly 100% displays “Limit reached” / “Лимит использован”, rather than implying overspending; this is a label and visual-state refinement only. Budget amounts, threshold calculations and the protected model are unchanged.

The tracker, shopping rows, templates, profile and avatar editor share clearer field boundaries, 44px mobile controls and consistent keyboard focus. The mobile calendar retains its seven-row heatmap and keyboard navigation; individual day targets are 44×44px inside its existing horizontal scroll container. The document itself must fit a 360px viewport. The WANTED composition and bounty figures stay intact; rank metal, seals and scorch treatment are refined around the same parchment artwork.

## Files

| File | Change |
| --- | --- |
| `src/styles.css` | Central semantic palette, category and activity tokens, poster pigments, spacing/radii, responsive layout, overview/chart/category cards, tracker/details, profile, calendar and shared controls. |
| `index.html` | Small read-only theme bootstrap resolves saved/system preference before React; existing storage keys, hash routes and asset paths remain. |
| `src/App.tsx` | Browser `theme-color` reads the computed canvas token after existing theme resolution. |
| `src/pages/OverviewPage.tsx` | Category pattern swatches and explicit budget status presentation; preserved selectors, values and callbacks. |
| `src/components/BudgetState.tsx` | Small presentation component for normal, warning, exceeded and exactly-reached labels/icons in both languages. |
| `src/components/ExpenseChart.tsx` | Semantic chart series and selected-bar outline; existing dates, labels and keyboard behavior retained. |
| `src/components/TransactionTable.tsx` | Category color/soft-fill references use shared tokens instead of duplicate literal palettes. |
| `src/components/ShoppingList.css` | Price fields, row spacing, confirmation controls, long-name/error wrapping and keyboard focus. |
| `src/components/ShoppingTemplatesDialog.css` | Matching template cards, 44px controls and primary save treatment. |
| `src/components/AvatarCropper.css` | Tokenized crop overlay plus matching controls and responsive spacing; crop geometry is unchanged. |
| `src/components/StreakBadge.css` | Gold streak treatment, a stronger control boundary and a 44px mobile target. |
| `src/components/StreakBounty.css` | Tokenized fixed-parchment artwork, clearer rank seals/metals, restrained scorch and complete reduced-motion suppression. |
| `src/motion.css` | Existing avatar/card effects refer to semantic tokens; no additional animation workload. |
| `tests/design-browser.mjs` | Additional contrast, 360px layout, touch, theme-first-paint, empty/error/large-list, budget-label and reduced-motion regressions. |
| `tests/run-browser.mjs` | Runs the additional design cases after the five existing suites; existing cases are retained. |
| `docs/DESIGN_COLOR_AUDIT.md` | Complete baseline literal inventory, proposed mappings and final centralization evidence. |
| `docs/DESIGN_REDESIGN.md` | This per-file report, tokens, process, evidence and limitations. |
| `README.md` | Only the design section changed, English first and Russian second. |
| `package.json`, `package-lock.json` | Version metadata becomes 2.6.0; dependencies and resolved packages are unchanged. |

## Palette

The prescribed base values are unchanged. `--border` is a decorative separator; interactive boundaries use the stronger `--control-border` below.

| Token | Dark | Light |
| --- | --- | --- |
| `--bg` | `#0B1520` | `#F4EAD3` |
| `--surface` | `#101D2C` | `#FBF6E9` |
| `--surface-raised` | `#172A3F` | `#FFFDF7` |
| `--border` | `#27405A` | `#DCCDA9` |
| `--text` | `#F1E5CB` | `#101D2C` |
| `--text-muted` | `#9FB0BC` | `#4A5B6B` |
| `--accent` | `#D7B777` | `#D7B777` |
| `--accent-text` | `#D7B777` | `#7F6024` |
| `--on-accent` | `#101D2C` | `#101D2C` |
| `--success` | `#6FB8B6` | `#2F6F6E` |
| `--warning` | `#E6AE55` | `#8F5F0F` |
| `--danger` | `#E27C69` | `#A8442F` |
| `--control-border` | `#5D7790` | `#8A7958` |
| `--focus-ring` | Gold `#D7B777` | Navy `#101D2C` |
| `--chart-food` | `#D7B777` | `#A48032` |
| `--chart-transport` | `#6FB8B6` | `#2F6F6E` |
| `--chart-home` | `#8FA8D6` | `#3F5F99` |
| `--chart-entertainment` | `#B79AD6` | `#6E4F99` |
| `--chart-health` | `#8FCB9B` | `#3F7A4F` |
| `--chart-shopping` | `#E39A6B` | `#B5622F` |
| `--chart-other` | `#9FB0BC` | `#5E6F7C` |

| Supplemental family | Definition / purpose |
| --- | --- |
| `--surface-hover`, `--accent-hover` | 5% parchment mix in dark mode, 5% navy mix in light mode. |
| `--accent-soft`, `--success-soft`, `--warning-soft`, `--danger-soft` | 12%, 10%, 8%, 8% semantic color mixed with surface. |
| `--chart-bar`, `--chart-bar-active`, `--chart-outline` | Success series, housing-color selection and muted outline; selected dates also have labels and keyboard navigation. |
| `--activity-0` … `--activity-4` | Raised empty cell, then 18%, 44%, 72% and 100% success on surface; existing counts and date labels remain. |
| `--featured-*`, `--voyage-*` | Theme-aware total card and fixed navy introduction; parchment text, brighter secondary text and gold accents. |
| `--rank-rookie`, `--rank-rising`, `--rank-supernova`, `--rank-legend` | Muted, success, danger/coral and accent-text for normal rank UI. |
| `--poster-paper`, `--poster-ink`, `--poster-ink-muted` | Fixed artwork colors `#EAD9B3`, `#4D3825`, `#705A40` in both themes. |
| `--poster-frame-*`, `--poster-seal-*` | Fixed-paper rank artwork uses muted metal, teal, coral with gold trim, and legend gold. |
| `--avatar-overlay`, `--crop-guide`, `--crop-mask`, `--crop-grid` | Contrast-aware overlay/guide treatments, independent of the uploaded photo. |
| `--page-texture` | 4% muted pigment on the page background only. |
| `--shadow-*-color` | Soft navy pigments in light mode; transparent panel/control shadows in dark mode. |
| `--radius-sm/md/lg`, `--space-*` | 8/12/16px radii and 4/8px-based spacing. |

All hex/rgb/hsl literals in CSS/TSX are in the central palette block in `src/styles.css`. Even the permitted poster-art exceptions were centralized; no literal exceptions remain. Existing aliases resolve to these roles to preserve incremental compatibility.

## Contrast refinements and scope decisions

- **Light food:** prescribed `#B8923F` has about 2.70:1 contrast against the surface, below the 3:1 graphical requirement. `#A48032` reaches 3.41:1 on surface, 3.61:1 on raised surface and 3.07:1 on the canvas. The dark food value is unchanged.
- **Control edges:** prescribed decorative borders have about 1.59:1 dark / 1.46:1 light contrast on their surfaces. The separate control border reaches at least 3.13:1 dark / 3.54:1 light across applicable normal surfaces. Decorative base borders retain the exact requested values.
- **Warning fill:** the supplemental warning fill uses 8% instead of 10%; the stronger mix caused a text pair to fall just below 4.5:1 in light mode. The base warning token is unchanged.
- **Fixed WANTED parchment:** lightened rank colors intended for dark interface surfaces cannot be reused for tiny lettering on the poster. Rookie metal is `#5E6F7C`, rookie seal lettering is `#4A5B6B` (5.03:1 on paper), rising metal/seal is `#2F6F6E`, and supernova uses brand coral `#C35D4C` (3.02:1 for its graphical star). Opaque paper behind rookie/rising/supernova seals prevents uploaded avatars from changing contrast. The Legend seal uses opaque `#E8CA88` rather than its former translucent `#E8CA88C4`: over a black or navy avatar, the old fill produced only 2.44:1 / 2.63:1 icon contrast. The gold hue, geometry and poster composition remain. Coral in Supernova artwork is the explicit rank-art exception in the prompt.
- **Mobile calendar:** meeting the 44px target requires a wider internal heatmap. The existing scroll container, all dates and keyboard auto-reveal are preserved; no calendar logic changes are needed.
- **Exactly 100% budget:** presentation says the limit is used/reached. It does not change the protected budget model, calculation, saved amount or original progress hooks.

No business/data requirement was relaxed and no existing test was weakened.

## Verification

### Baseline, before source styling changes

| Check | Result |
| --- | --- |
| `npm install` | Passed; 0 reported vulnerabilities; dependency manifests unchanged. |
| `npm test` | 356 passed across 11 files. |
| `npm run build` | Passed. |
| `GITHUB_PAGES=true npm run build` | Passed. |
| `npx playwright install chromium` | Passed; bundled Chromium installed. |
| `npm run test:browser` | 105 passed: 35 general, 16 persistence, 17 purchase confirmation, 12 performance, 25 planning. |
| Before screenshots | 48 PNGs: six areas × two themes × two languages × desktop/mobile. |

### Incremental process

Each styling area was committed separately after unit tests and a production Pages build. The Pages build invokes the same strict TypeScript/Vite production build with the required base path.

| Area | Commit | Unit tests / production build |
| --- | --- | --- |
| Semantic tokens | `43c21c2` | 356 passed / passed. |
| a. Layout, navigation, header | `82524fd` | 356 passed / passed. |
| b. Overview, chart, categories | `555ddf6` | 356 passed / passed. |
| c. Tracker and dialogs | `4bb2e2a` | 356 passed / passed. |
| d. Shopping and templates | `b637f33` | 356 passed / passed. |
| e. Profile and avatar cropper | `a779eac` | 356 passed / passed. |
| f. Calendar, streak, WANTED | `05c04bb` | 356 passed / passed. |
| g. Shared forms, focus, modals, toasts | `d9c0eb0` | 356 passed / passed. |

Intermediate mobile captures found that a themed root selector prevented a responsive sidebar-width variable from taking effect. The layout variable now lives outside the palette selectors; the new browser cases also assert the real mobile viewport scale. Focused design checks also led to 44px demo and shopping-filter targets and removal of an SVG fill transition so chart colors meet contrast immediately after rendering.

### Final release checks

| Release check | Result |
| --- | --- |
| `npm test` | 356 passed. |
| Normal production build | Passed, including strict TypeScript compilation. |
| Pages production build | Passed with `/FinanceControl/`. |
| Browser regression suite | 133 passed: 35 general, 16 persistence, 17 purchase confirmation, 12 performance, 25 planning and 28 design scenarios. |
| New semantic contrast coverage | Passed: 72 token pairs per theme, 144 total, including all four fixed-paper rank seals. |
| Browser console / external requests | No console warnings/errors or external requests in the new design scenarios. |
| Screenshot matrix | 48 before + 48 after; both phases have 32 full-page checks with the expected 1440px/360px width, no document overflow and no page errors. |
| Additional rank captures | Eight crops: four ranks in each theme; correct rank/bounty attributes, opaque seal backgrounds and passing computed seal contrast. |

The five pre-existing browser suites and their assertions remain intact. Product failures were corrected in the styles. The new 1000-item fixture harness was separately corrected to reload after writing storage: same-tab hash navigation alone does not reload persisted data, and the original 50-row assertion remains unchanged.

One earlier full run intermittently missed the purchase-confirmation tap in the existing English/dark/390px case. The unchanged 17-case suite then passed, and 12 exact reproductions all hit the same button at the same vertical position (614.1875px) and passed. The final complete 133-case run also passed. The intermittent cause remains unconfirmed; no speculative business-logic fix or change to the existing test was made. The failed-run, focused recheck and reproduction logs are retained with the local evidence.

Using the same Node/zlib measurement, final entry JavaScript `index-D81IwcyH.js` is **324,968 bytes / 101,378 bytes gzip**, compared with **324,915 / 101,359** at baseline: **+53 bytes raw / +19 bytes gzip**. This measurement covers the entry chunk, not the sum of every lazy module. The existing lazy PDF chunk remains 1,157.46kB / 511.38kB gzip with its pre-existing Vite large-chunk advisory.

## Screenshots and evidence

The screenshot matrix covers **overview, tracker, shopping, profile, WANTED poster and calendar**, each in RU/EN, light/dark, and 1440px desktop/360px mobile: **48 before and 48 after captures**. Each phase includes 32 full-page layout/error checks plus 16 poster/calendar crops. All checked viewport/content widths agree, with no document overflow or page errors. Both phases use the same 8 November 2026 fixture day; the final capture clock is fixed so crossing midnight cannot alter the streak or calendar comparison.

Eight additional final poster crops cover 1-, 7-, 30- and 100-day streaks in both themes. The seal backgrounds are opaque, and computed contrast is 5.03:1 for rookie lettering, 4.16:1 for the rising icon, 3.02:1 for the Supernova icon and 4.14:1 for the Legend icon. The corresponding thresholds are 4.5:1 for lettering and 3:1 for the graphical icons. Axe found zero contrast violations in these rank captures but returned **66 incomplete checks** across the eight complex artwork regions. Those incomplete results are not counted as passes. Explicit color-pair checks and completed visual review provide additional evidence: representative desktop/mobile pages and all four rank crops showed no clipping, overlapping controls or unreadable artwork. This review does not convert incomplete axe results into automated passes.

Local evidence is kept under `test-results/redesign/` (ignored generated artifacts):

- `before/`: the 48 baseline PNGs and capture report.
- `after/`: the final 48 PNGs and capture report.
- `after/ranks/`: eight additional final rank crops and the seal/axe report.
- `comparison.html`: interactive before/after gallery with area, theme, device and language selectors.
- `step2-*.log` and `area-*-unit.log` / `area-*-build.log`: token and per-area gates.
- `baseline-bundles.json`: entry JavaScript baseline, 324,915 bytes / 101,359 bytes gzip.
- `final-bundles.json`: final entry and lazy-chunk measurements.
- `final-browser.log`: the complete passing 133-case run.
- `intermittent-tap-browser.log`, `shopping-tap-recheck.log` and `confirmation-repro.log`: the earlier intermittent failure and unchanged follow-up checks.
- `static-audit.json`: protected-file SHA-256 comparisons, unchanged existing browser suites and color-centralization checks.

Screenshots use isolated browser contexts and stable fixture data, not the user's stored finance records. Generated artifacts are deliberately excluded from the published site and source bundle.

## Unchanged boundaries and limitations

A byte-for-byte comparison with the baseline confirms all 12 protected files are unchanged; README content outside the design block is also identical. The protected modules are unchanged: `storage.ts`, `usePersistentData.ts`, `useProfileDraft.ts`, `finance.ts`, `shopping.ts`, `templates.ts`, `budgets.ts`, `expenses.ts`, `streak.ts`, `pirateRanks.ts`, `pdf.ts`, and `avatar.ts`. Storage keys and formats, PDF output styling and backup format, hash routes, `/FinanceControl/`, local fonts, existing lazy-loading boundaries, 50-row pagination and the 1000-item behavior are preserved. There are no new runtime dependencies, CDNs or remote font requests.

Desktop and mobile checks run in automated Chromium with emulated viewports. Physical iOS/Android hardware and Firefox/Safari are not verified. The repository has no ESLint script; strict TypeScript compilation and browser-console checks cover their configured gates. The production PDF module already generated Vite's large-chunk advisory at baseline; it remains lazy-loaded and its output styling is untouched. Browser tests validate representative computed color pairs and actual UI with axe; they are not a formal certification of every possible user-uploaded image or assistive-technology combination.
