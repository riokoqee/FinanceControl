# BeliLog visual color audit

Audit captured **before visual source edits**, 2026-11-08, baseline commit `28747a6`. This is the Step 1 inventory; source line numbers refer to that baseline. PDF and protected business/data modules are deliberately excluded.

Scope: all `src/**/*.css` and `src/**/*.tsx`; `README.md`, every component/page, `styles.css`, `motion.css`, and `StreakBounty.css` read for context. No application behavior or styling was edited while preparing this document.

Search: `rg -n '#[[:xdigit:]]{3,8}\b|rgba?\(|hsla?\(' src -g '*.css' -g '*.tsx'`.

Found **226 literal-bearing source lines, 335 literal occurrences, 241 distinct case-normalized values**. Several older declarations are overridden later; those remain in the inventory so hidden fallbacks do not escape migration. No `rgb()` / `rgba()` / `hsl()` / `hsla()` literals were present at baseline.

## Required base tokens

| Semantic token | Dark | Light | Meaning |
| --- | --- | --- | --- |
| `--bg` | `#0B1520` | `#F4EAD3` | Page canvas |
| `--surface` | `#101D2C` | `#FBF6E9` | Panels, tables and forms |
| `--surface-raised` | `#172A3F` | `#FFFDF7` | Raised / grouped content |
| `--border` | `#27405A` | `#DCCDA9` | Decorative panel separators |
| `--text` | `#F1E5CB` | `#101D2C` | Main text and financial totals |
| `--text-muted` | `#9FB0BC` | `#4A5B6B` | Secondary copy |
| `--accent` | `#D7B777` | `#D7B777` | Primary action, active nav, bounty and streak fill |
| `--accent-text` | `#D7B777` | `#7F6024` | Gold text/icon treatment |
| `--on-accent` | `#101D2C` | `#101D2C` | Label on gold fill |
| `--success` | `#6FB8B6` | `#2F6F6E` | Saved / within budget |
| `--warning` | `#E6AE55` | `#8F5F0F` | Limit ≥80% |
| `--danger` | `#E27C69` | `#A8442F` | Error / deletion / over limit |

Keep brand pigments in the central token block: navy `#101D2C`, gold `#D7B777`, parchment `#F1E5CB`, coral `#C35D4C`, teal `#5A9C9B`. Brand pigments must not replace role-sensitive contrast tokens. In particular coral must leave food/chart/nav decorations.

| Category token | Dark | Light |
| --- | --- | --- |
| `--chart-food` | `#D7B777` | `#B8923F` |
| `--chart-transport` | `#6FB8B6` | `#2F6F6E` |
| `--chart-home` | `#8FA8D6` | `#3F5F99` |
| `--chart-entertainment` | `#B79AD6` | `#6E4F99` |
| `--chart-health` | `#8FCB9B` | `#3F7A4F` |
| `--chart-shopping` | `#E39A6B` | `#B5622F` |
| `--chart-other` | `#9FB0BC` | `#5E6F7C` |

## Contrast / implementation notes

- Required base `border` against `surface` is only **1.59:1 dark / 1.46:1 light**. These can remain decorative separators; interactive input/control edges need a separate `--control-border` adjusted to ≥3:1. This is permitted contrast fine-tuning, not a reason to weaken tests.
- Light food `#B8923F` against `#FBF6E9` is **2.70:1**. A meaningful food icon or chart marker needs ≥3:1; fine-tune that token or use a stronger semantic icon treatment. Exact gold fill against light surface is **1.78:1**, so gold controls need a contrasting border, and gold text must use `accent-text` (**5.40:1** on light surface).
- Existing `TransactionTable` synthesizes icon background with `${categoryColors[category]}19`; replace it with category soft tokens (CSS variables cannot be suffixed with hexadecimal alpha). Both table and donut currently duplicate a color map; both must consume the same category tokens.
- Daily bar SVG contains raw coral in `ExpenseChart.tsx`; use non-danger chart series tokens. Existing selected date, labels, `<title>`, keyboard interaction and date select already provide a non-color equivalent and must stay.
- Category donut has category `<title>` labels and adjacent named amounts; ensure all slices have a visible label/marker equivalent, including the categories reached by the existing “more categories” control. Preserve that navigation behavior.
- Category-limit warning at baseline is color-only. Add visual status icon and short status text for normal / ≥80% / over, preserving existing classes, aria labels and progress attributes. This is presentational, not budget logic.
- `App.tsx` writes literal `theme-color` to the browser chrome. Resolve the current semantic CSS surface/bg value after the existing light/dark/system decision; do not change persisted theme behavior or first paint.
- Calendar currently mixes green/gold levels. Use activity-level and activity-border tokens; keep intensity, `data-level`, dates, all accessible count labels, roving keyboard focus and today/selected indicators.
- Interactive calendar day cells will reach 44px minimum on mobile inside the existing horizontally scrolling seven-row heatmap. Preserve all dates, accessible count labels, roving keyboard navigation, auto-reveal, and the scroll container; the larger visual footprint is an allowed design change.
- General UI colors belong in the token block. `transparent`, `currentColor`, `none`, SVG `url(#...)` paint server references, and color values in user-provided images are not raw palette literals.
- No existing browser/unit test asserts palette hex values. Existing contrast tests use axe and selectors that can stay unchanged; retain all test checks and extend them.

## Permitted art exceptions

The prompt explicitly permits literals within **rank-specific WANTED artwork** in `StreakBounty.css`. Scorch pigments, aged paper, fire/embers/ash, metal/seal treatment and reward stamp can retain their art palette if centralizing them reduces clarity; they are isolated behind the poster composition, not form/table surfaces. The table below marks every such baseline source location. Prefer poster-specific custom properties even for those exceptions where practical.

This exception does **not** cover streak card copy, ordinary progress tracks, navigation badges or promotion toasts. Rank progression UI must use semantic `rank-rookie` (muted), `rank-rising` (teal), `rank-supernova` (coral) and `rank-legend` (gold) tokens. Decorative coral in supernova artwork is the requested brand exception to the general error-only coral rule. Keep the existing WANTED composition, rank thresholds, particle count and reduced-motion behavior.

## Complete baseline literal inventory

Mappings are proposed semantic roles. Token families apply to the corresponding fill / boundary / text / shadow within each source declaration; repeated values and roles are collapsed only in display. Final token names may be aligned with the implementation, but every listed raw literal outside the central token block must be removed or documented as poster art.

### `src/App.tsx`
| Baseline line | Literal value(s) | Current purpose | Proposed token(s) |
| --- | --- | --- | --- |
| 255 | `#101D2C`, `#F1E5CB` | browser chrome theme-color | `--surface (read computed value after resolving theme)` |

### `src/components/AvatarCropper.css`
| Baseline line | Literal value(s) | Current purpose | Proposed token(s) |
| --- | --- | --- | --- |
| 15 | `#f1e5cbe8`, `#101d2c90` | avatar crop .avatar-crop-guide | `--crop-guide`, `--crop-mask` |
| 16 | `#f1e5cb50` | avatar crop .avatar-crop-guide::before, .avatar-crop-guide::after | `--crop-grid` |

### `src/components/ExpenseChart.tsx`
| Baseline line | Literal value(s) | Current purpose | Proposed token(s) |
| --- | --- | --- | --- |
| 119 | `#A9493B`, `#C35D4C` | selected / unselected populated daily SVG bar | `--chart-bar-active`, `--chart-bar` |

### `src/components/ShoppingList.css`
| Baseline line | Literal value(s) | Current purpose | Proposed token(s) |
| --- | --- | --- | --- |
| 32 | `#d7b77725` | editable product keyboard focus halo | `--focus-halo` |

### `src/components/StreakBadge.css`
| Baseline line | Literal value(s) | Current purpose | Proposed token(s) |
| --- | --- | --- | --- |
| 4 | `#c35d4c20` | active navigation streak icon fill | `--accent-soft` |

### `src/components/StreakBounty.css`
| Baseline line | Literal value(s) | Current purpose | Proposed token(s) |
| --- | --- | --- | --- |
| 2 | `#957246` | non-art rookie rank progress / promotion | `--rank-rookie` |
| 22 | `#c35d4c15` | streak / toast UI .streak-bounty-eyebrow > svg | `--accent-soft` |
| 43 | `#a57846` | non-art rising rank progress / promotion | `--rank-rising` |
| 44 | `#b28e44` | non-art supernova rank progress / promotion | `--rank-supernova` |
| 45 | `#bd9852` | non-art legend rank progress / promotion | `--rank-legend` |
| 58 | `#b99a5c80`, `#d7b7770f`, `#d7b77705` | streak / toast UI .toast.toast--pirate | `--border-accent`, `--accent-soft` |
| 59 | `#a8803c` | pirate promotion toast icon | `--accent-text` |
| 63 | `#765737` | EXCEPTION: WANTED rank-specific metal / frame | `--poster-rank-frame-* (optional art exception)` |
| 64 | `#76573780` | EXCEPTION: WANTED rank-specific metal / frame | `--poster-rank-frame-* (optional art exception)` |
| 73 | `#4d3825` | WANTED .bounty-poster | `--poster-ink` |
| 74 | `#101d2c1c`, `#5c43251c` | WANTED .bounty-poster | `--poster-art-* (optional art exception)` |
| 86 | `#88603130` | WANTED .bounty-poster-paper | `--poster-art-* (optional art exception)` |
| 87 | `#8860312c` | WANTED .bounty-poster-paper | `--poster-art-* (optional art exception)` |
| 88 | `#6d4d2612` | WANTED .bounty-poster-paper | `--poster-art-* (optional art exception)` |
| 89 | `#ead9b3` | WANTED .bounty-poster-paper | `--poster-paper` |
| 90 | `#c1a679` | WANTED .bounty-poster-paper | `--poster-art-* (optional art exception)` |
| 93 | `#382116`, `#6a421dcc`, `#9d764048`, `#342114`, `#654020d9`, `#93602b70`, `#5b381a99`, `#93602b36`, `#3f2817b3`, `#96642c59`, `#6e4b2533`, `#5b381a33` | EXCEPTION: WANTED scorch / weathering pigment | `--poster-scorch-* (optional art exception)` |
| 96 | `#d8c8a6` | WANTED portrait fallback surface | `--poster-portrait-bg` |
| 98 | `#c7ac755c`, `#e4d3ad` | WANTED .bounty-poster-portrait--hat | `--poster-art-* (optional art exception)`, `--poster-paper` |
| 100 | `#8f493c80`, `#8f493c`, `#ead9b345` | EXCEPTION: WANTED rank seal / stamp pigment | `--poster-seal-* (optional art exception)` |
| 110 | `#705a40` | WANTED .bounty-poster-footer > span:last-child | `--poster-ink` |
| 113 | `#956638`, `#9566388c` | EXCEPTION: WANTED rank-specific metal / frame | `--poster-rank-frame-* (optional art exception)` |
| 114 | `#966238a6`, `#8a552f`, `#dcb77b57`, `#ead9b3`, `#96623838` | EXCEPTION: WANTED rank seal / stamp pigment | `--poster-seal-* (optional art exception)` |
| 115 | `#a9843f`, `#a17c3d99` | EXCEPTION: WANTED rank-specific metal / frame | `--poster-rank-frame-* (optional art exception)` |
| 116 | `#dcb76560` | EXCEPTION: WANTED rank-specific metal / frame | `--poster-rank-frame-* (optional art exception)` |
| 117 | `#9a7436`, `#896224`, `#e5c47c99`, `#ead9b3`, `#a17c3d55` | EXCEPTION: WANTED rank seal / stamp pigment | `--poster-seal-* (optional art exception)` |
| 118 | `#9d7838`, `#ad8a469e` | EXCEPTION: WANTED rank-specific metal / frame | `--poster-rank-frame-* (optional art exception)` |
| 119 | `#e9cb8466`, `#c7a35b40` | EXCEPTION: WANTED rank-specific metal / frame | `--poster-rank-frame-* (optional art exception)` |
| 120 | `#94702f`, `#79571f`, `#e8ca88c4`, `#f0dca4`, `#b08b4559` | EXCEPTION: WANTED rank seal / stamp pigment | `--poster-seal-* (optional art exception)` |
| 121 | `#94702f8c` | EXCEPTION: WANTED rank seal / stamp pigment | `--poster-seal-* (optional art exception)` |
| 122 | `#d3ad5e` | WANTED .bounty-poster[data-rank='supernova']::before, .bounty-poster[data-rank='legend']::before | `--poster-art-* (optional art exception)` |
| 127 | `#9d4d22`, `#dc8736`, `#e9b75b`, `#f1d68a` | EXCEPTION: WANTED rank flame pigment | `--poster-flame-* (optional art exception)` |
| 130 | `#e4a64c`, `#f0d797` | EXCEPTION: WANTED rank flame pigment | `--poster-flame-* (optional art exception)` |
| 131 | `#c58938` | EXCEPTION: WANTED rank ember pigment | `--poster-ember (optional art exception)` |
| 138 | `#7b684f` | EXCEPTION: WANTED rank ash pigment | `--poster-ash (optional art exception)` |
| 145 | `#956638aa`, `#edddba`, `#80552b`, `#4d382518` | EXCEPTION: WANTED rank seal / stamp pigment | `--poster-seal-* (optional art exception)` |
| 146 | `#d6ae5a` | EXCEPTION: WANTED rank spark pigment | `--poster-spark (optional art exception)` |
| 157 | `#101d2c24`, `#5c43251c` | WANTED .bounty-poster:hover | `--poster-art-* (optional art exception)` |

### `src/components/TransactionTable.tsx`
| Baseline line | Literal value(s) | Current purpose | Proposed token(s) |
| --- | --- | --- | --- |
| 43 | `#C35D4C` | food category series / icon | `--chart-food` |
| 44 | `#5A9C9B` | shopping category series / icon | `--chart-shopping` |
| 45 | `#718EAB` | transport category series / icon | `--chart-transport` |
| 46 | `#D7B777` | home category series / icon | `--chart-home` |
| 47 | `#A68469` | entertainment category series / icon | `--chart-entertainment` |
| 48 | `#80B8A3` | health category series / icon | `--chart-health` |
| 49 | `#b7b9b5` | other category series / icon | `--chart-other` |

### `src/motion.css`
| Baseline line | Literal value(s) | Current purpose | Proposed token(s) |
| --- | --- | --- | --- |
| 3 | `#d7b77730` | editable avatar hover / focus halo | `--focus-halo` |
| 4 | `#101d2cb8`, `#f1e5cb` | avatar edit camera overlay | `--avatar-overlay`, `--on-dark` |
| 23 | `#d7b77780`, `#101d2c55` | overview card pointer hover border / shadow | `--border-accent`, `--shadow-hover` |

### `src/pages/OverviewPage.tsx`
| Baseline line | Literal value(s) | Current purpose | Proposed token(s) |
| --- | --- | --- | --- |
| 37 | `#C35D4C` | food category series / icon | `--chart-food` |
| 38 | `#5A9C9B` | shopping category series / icon | `--chart-shopping` |
| 39 | `#718EAB` | transport category series / icon | `--chart-transport` |
| 40 | `#D7B777` | home category series / icon | `--chart-home` |
| 41 | `#A68469` | entertainment category series / icon | `--chart-entertainment` |
| 42 | `#80B8A3` | health category series / icon | `--chart-health` |
| 43 | `#b7b9b5` | other category series / icon | `--chart-other` |

### `src/styles.css`
| Baseline line | Literal value(s) | Current purpose | Proposed token(s) |
| --- | --- | --- | --- |
| 18 | `#101D2C` | light theme token navy | `--brand-navy` |
| 19 | `#D7B777` | light theme token gold | `--accent` |
| 20 | `#F1E5CB` | light theme token parchment | `--brand-parchment` |
| 21 | `#C35D4C` | light theme token coral | `--brand-coral` |
| 22 | `#5A9C9B` | light theme token teal | `--success` |
| 23 | `#f7f2e8` | light theme token canvas | `--bg` |
| 24 | `#fffdf8` | light theme token surface | `--surface` |
| 25 | `#f3eddf` | light theme token surface-muted | `--surface-raised` |
| 26 | `#eee4d1` | light theme token surface-hover | `--surface-hover` |
| 27 | `#101D2C` | light theme token ink | `--text` |
| 28 | `#706653` | light theme token muted | `--text-muted` |
| 29 | `#5d5a50` | light theme token subtle | `--text-secondary` |
| 30 | `#e7dcc7` | light theme token line | `--border` |
| 31 | `#C35D4C` | light theme token accent | `--accent` |
| 32 | `#a44739` | light theme token accent-strong | `--accent-text` |
| 33 | `#f6e7df` | light theme token accent-soft | `--accent-soft` |
| 34 | `#2f7372` | light theme token green | `--success` |
| 35 | `#e8f0e9` | light theme token green-soft | `--success-soft` |
| 36 | `#ad493d` | light theme token danger | `--danger` |
| 37 | `#faeae4` | light theme token danger-soft | `--danger-soft` |
| 38 | `#101d2c28` | light theme token shadow | `--shadow-panel` |
| 39 | `#e9e0cf` | light theme token track | `--track` |
| 40 | `#e9e1d2` | light theme token chart-empty | `--chart-empty` |
| 48 | `#101D2C` | dark theme token canvas | `--bg` |
| 49 | `#172637` | dark theme token surface | `--surface` |
| 50 | `#1d2e40` | dark theme token surface-muted | `--surface-raised` |
| 51 | `#273a4b` | dark theme token surface-hover | `--surface-hover` |
| 52 | `#F1E5CB` | dark theme token ink | `--text` |
| 53 | `#9ba8b3` | dark theme token muted | `--text-muted` |
| 54 | `#bac2c7` | dark theme token subtle | `--text-secondary` |
| 55 | `#2c3b49` | dark theme token line | `--border` |
| 56 | `#D7B777` | dark theme token accent | `--accent` |
| 57 | `#e4c58c` | dark theme token accent-strong | `--accent-text` |
| 58 | `#392f25` | dark theme token accent-soft | `--accent-soft` |
| 59 | `#77b6af` | dark theme token green | `--success` |
| 60 | `#1a383e` | dark theme token green-soft | `--success-soft` |
| 61 | `#ed9989` | dark theme token danger | `--danger` |
| 62 | `#402b2b` | dark theme token danger-soft | `--danger-soft` |
| 63 | `#0008` | dark theme token shadow | `--shadow-panel` |
| 64 | `#2c3e4d` | dark theme token track | `--track` |
| 65 | `#2c3d4b` | dark theme token chart-empty | `--chart-empty` |
| 91 | `#d7b77760` | selected text highlight | `--selection` |
| 113 | `#292e2a` | legacy logo wrapper (later rule makes transparent) | `--surface-raised` |
| 114 | `#fff` | legacy logo fallback glyph | `--text` |
| 146 | `#a44739` | active navigation text / count fill | `--accent-text` |
| 149 | `#a44739`, `#e9c9bb` | active navigation text / count fill | `--accent-text`, `--accent-soft` |
| 150 | `#533c2e` | dark active navigation count fill | `--accent-soft` |
| 155 | `#5a9c9b`, `#5a9c9b10` | local save success dot / halo | `--success`, `--success-soft` |
| 170 | `#d7b77760`, `#f1e5cb`, `#76603e` | avatar fallback border / paper / initials | `--border-accent`, `--avatar-bg`, `--avatar-text` |
| 171 | `#253746`, `#4b4c43`, `#d7b777` | dark avatar fallback | `--surface-raised`, `--border-accent`, `--accent-text` |
| 182 | `#101d2c`, `#fff`, `#00000006` | primary action fill / border / label / shadow | `--accent`, `--on-accent`, `--shadow-button` |
| 183 | `#273b4e` | primary action hover fill / border / shadow | `--accent-hover` |
| 185 | `#101d2c` | dark primary action label | `--on-accent` |
| 186 | `#e7c98f` | primary action hover fill / border / shadow | `--accent-hover` |
| 215 | `#101d2c`, `#fff` | featured total card fill / boundary / text | `--featured-bg`, `--featured-border`, `--on-dark` |
| 216 | `#c9c4b6` | featured total secondary text | `--featured-muted` |
| 217 | `#c9c4b6` | featured total secondary text | `--featured-muted` |
| 219 | `#c3bdad` | featured total secondary text | `--featured-muted` |
| 220 | `#b4b9b6` | featured total secondary text | `--featured-muted` |
| 221 | `#d7b777`, `#ffffff0a` | featured total action icon / fill | `--accent-text`, `--featured-icon-bg` |
| 222 | `#8fc1b4` | decreased spending indicator on navy total card | `--featured-success` |
| 223 | `#d7b77735` | featured total decorative rings | `--decoration` |
| 224 | `#d7b77735` | featured total decorative rings | `--decoration` |
| 235 | `#00000005` | chart segment selection shadow | `--shadow-control` |
| 295 | `#d7b77722` | empty-state decoration boundary | `--border` |
| 300 | `#e7e7da`, `#f0f1e8` | monthly budget card surface / boundary | `--border`, `--surface-raised` |
| 301 | `#3e4537`, `#2c3328` | monthly budget card surface / boundary | `--border`, `--surface-raised` |
| 303 | `#686f5a` | monthly budget card surface / boundary | `--border` |
| 304 | `#a1aa96` | monthly budget card surface / boundary | `--border` |
| 305 | `#899078`, `#dde0cf`, `#f5f5ed` | monthly budget icon / boundary / fill | `--success`, `--border`, `--success-soft` |
| 306 | `#4a533c`, `#343c2c`, `#b2bf98` | monthly budget icon / boundary / fill | `--success`, `--border`, `--success-soft` |
| 308 | `#c8cdbb`, `#626c51` | monthly budget link boundary / text | `--border`, `--text-secondary` |
| 309 | `#bac5a6` | monthly budget link boundary / text | `--text-secondary` |
| 313 | `#cdd4bb` | monthly budget decorative outline | `--decoration` |
| 316 | `#66714f` | monthly budget decorative outline | `--decoration` |
| 322 | `#dfddca` | monthly budget progress track | `--track` |
| 323 | `#2c4551` | monthly budget progress track | `--track` |
| 324 | `#5a9c9b` | monthly budget progress fill | `--success` |
| 326 | `#786e5d` | monthly budget caption | `--text-muted` |
| 328 | `#e7dcc7`, `#faf3e4` | supporting information surface / boundary | `--border`, `--surface-raised` |
| 329 | `#26323a`, `#3a4548` | supporting information surface / boundary | `--border`, `--surface-raised` |
| 330 | `#a78b52` | supporting information icon / fill | `--text-secondary` |
| 336 | `#e7dcc7`, `#faf4e7` | supporting information surface / boundary | `--border`, `--surface-raised` |
| 337 | `#26323a`, `#3a4548` | supporting information surface / boundary | `--border`, `--surface-raised` |
| 338 | `#a78b52`, `#f1e5cb` | supporting information icon / fill | `--text-secondary`, `--accent-soft` |
| 339 | `#374245` | supporting information icon / fill | `--text-secondary` |
| 349 | `#d7b77725` | form focus boundary / halo | `--focus-ring` |
| 387 | `#d7b77770`, `#f1e5cb`, `#76603e` | avatar fallback border / paper / initials | `--border-accent`, `--avatar-bg`, `--avatar-text` |
| 388 | `#253746`, `#4b4c43`, `#d7b777` | dark avatar fallback | `--surface-raised`, `--border-accent`, `--accent-text` |
| 401 | `#d7b77725` | form focus boundary / halo | `--focus-ring` |
| 416 | `#d7b777bb` | selected theme control boundary | `--border-selected` |
| 419 | `#edf0e6`, `#dce3d3` | local data illustration fill / boundary | `--success-soft`, `--border` |
| 420 | `#1d343c`, `#35505a` | local data illustration fill / boundary | `--success-soft`, `--border` |
| 421 | `#5a9c9b` | local data illustration icon | `--success` |
| 422 | `#c8d9cc` | local data decorative orbits | `--decoration-success` |
| 424 | `#31515a` | local data decorative orbits | `--decoration-success` |
| 452 | `#101d2c85` | shared dialog dim layer | `--overlay` |
| 453 | `#101d2c40` | shared dialog shadow | `--shadow-modal` |
| 466 | `#c35d4c` | chosen expense category boundary | `--border-selected` |
| 486 | `#e7dcc7`, `#f6efdf` | sidebar note surface / boundary | `--border`, `--surface-raised` |
| 487 | `#1c2f3d`, `#324550` | sidebar note surface / boundary | `--border`, `--surface-raised` |
| 488 | `#5a9c9b` | sidebar local-save illustration | `--success` |
| 509 | `#8a6c3e` | load demo link label | `--text-secondary` |
| 514 | `#5a9c9b` | monthly budget progress fill | `--success` |
| 518 | `#ed9989` | increased spending indicator on navy total card | `--featured-danger` |
| 519 | `#ffffff0d` | featured trend pill fill | `--featured-icon-bg` |
| 546 | `#5a9c9b` | tracker note information icon | `--success` |
| 575 | `#e4b4a9` | storage failure panel boundary | `--danger-border` |
| 693 | `#222b2310` | navigation floating shadow | `--shadow-nav` |
| 1260 | `#bca87916` | page-background paper dots only | `--page-texture` |
| 1286 | `#c35d4c12` | active navigation text / count fill | `--accent-text` |
| 1287 | `#d7b77718` | active navigation text / count fill | `--accent-text` |
| 1289 | `#d7b77750`, `#d7b7770a`, `#d7b77708` | sidebar decorative rings | `--decoration`, `--decoration-soft` |
| 1298 | `#d7b77770`, `#76603e` | avatar fallback border / initials | `--border-accent`, `--avatar-text` |
| 1304 | `#101d2c12` | primary action elevation | `--shadow-button` |
| 1305 | `#273b4e`, `#101d2c20` | primary action hover fill / border / shadow | `--accent-hover`, `--shadow-button-hover` |
| 1307 | `#e7c98f` | primary action hover fill / border / shadow | `--accent-hover` |
| 1308 | `#c6ad7d` | secondary action hover boundary | `--control-border-hover` |
| 1309 | `#b99b60`, `#d7b77720` | form focus boundary / halo | `--focus-ring`, `--focus-halo` |
| 1310 | `#101d2c02` | panel warm elevation | `--shadow-panel` |
| 1311 | `#26394a` | featured total card boundary | `--featured-border` |
| 1312 | `#d7b77750`, `#1b2d3d` | dark featured total boundary / surface | `--featured-border`, `--featured-bg` |
| 1313 | `#c5c5bb` | featured total secondary text | `--featured-muted` |
| 1315 | `#d7b77710` | featured total icon fill | `--featured-icon-bg` |
| 1316 | `#bec4c2` | featured total secondary text | `--featured-muted` |
| 1317 | `#94c6bd` | decreased spending indicator on navy total card | `--featured-success` |
| 1318 | `#d7b77728` | featured total decorative rings | `--decoration` |
| 1329 | `#9d7e44` | supporting information icon / fill | `--text-secondary` |
| 1330 | `#d7b77725` | demo information icon fill | `--accent-soft` |
| 1331 | `#d7b77712` | supporting information icon / fill | `--text-secondary` |
| 1332 | `#ecf0e7`, `#dce3d3` | local data illustration fill / boundary | `--success-soft`, `--border` |
| 1334 | `#1b343d`, `#31505b` | local data illustration fill / boundary | `--success-soft`, `--border` |
| 1335 | `#5a9c9b30` | local data decorative orbits | `--decoration-success` |
| 1336 | `#5a9c9b30` | local data decorative orbits | `--decoration-success` |
| 1337 | `#c35d4c70` | selected theme control boundary | `--border-selected` |
| 1338 | `#d7b77790` | selected theme control boundary | `--border-selected` |
| 1351 | `#d7b77735` | welcome marine boundary | `--voyage-border` |
| 1353 | `#101d2c` | welcome marine navy surface | `--brand-navy` |
| 1354 | `#f1e5cb` | welcome marine text on navy | `--on-dark` |
| 1362 | `#d7b77715` | nautical background decoration | `--decoration` |
| 1364 | `#000` | decorative alpha-mask endpoint | `--mask-solid` |
| 1375 | `#d7b77750` | welcome navigational decoration | `--decoration` |
| 1381 | `#d7b777` | welcome marine label / rule | `--accent` |
| 1382 | `#d7b777` | nautical background decoration | `--decoration` |
| 1384 | `#c0c7c7` | welcome secondary text on navy | `--on-dark-muted` |
| 1385 | `#5a9c9b40`, `#9bc7bf`, `#5a9c9b0e` | welcome local badge boundary / text / fill | `--voyage-meta-border`, `--voyage-meta-text`, `--voyage-meta-bg` |
| 1388 | `#d7b77724`, `#d7b77705`, `#d7b77710`, `#d7b77704` | nautical background decoration | `--decoration` |
| 1389 | `#d7b77760` | welcome navigational decoration | `--decoration` |
| 1390 | `#0003` | welcome hat illustration shadow | `--shadow-art` |
| 1395 | `#d7b77790`, `#76603e` | avatar fallback border / initials | `--border-accent`, `--avatar-text` |
| 1401 | `#b99b60` | form focus boundary / halo | `--focus-ring` |
| 1419 | `#101d2c08`, `#1c2d3c` | calendar empty square / cell boundary | `--activity-border-0`, `--activity-0` |
| 1420 | `#203344`, `#101d2c08` | calendar activity level 0 | `--activity-0`, `--activity-border-0` |
| 1421 | `#aacbc2`, `#5a9c9b40` | calendar activity level 1 | `--activity-1`, `--activity-border-1` |
| 1422 | `#5a9c9b`, `#347b7a50` | calendar activity level 2 | `--activity-2`, `--activity-border-2` |
| 1423 | `#b7b77c`, `#af975840` | calendar activity level 3 | `--activity-3`, `--activity-border-3` |
| 1424 | `#d7b777`, `#b99b60` | calendar activity level 4 | `--activity-4`, `--activity-border-4` |
| 1426 | `#d7b777` | calendar hover outline | `--focus-ring` |
| 1427 | `#101d2c`, `#344353` | calendar activity level 0 | `--activity-0`, `--activity-border-0` |
| 1428 | `#315657`, `#477173` | calendar activity level 1 | `--activity-1`, `--activity-border-1` |
| 1429 | `#5a9c9b`, `#79b1a9` | calendar activity level 2 | `--activity-2`, `--activity-border-2` |
| 1430 | `#b3b77c`, `#c4bf8a` | calendar activity level 3 | `--activity-3`, `--activity-border-3` |
| 1431 | `#d7b777`, `#e8ce98` | calendar activity level 4 | `--activity-4`, `--activity-border-4` |
| 1489 | `#d7b77740` | form focus boundary / halo | `--focus-ring` |
| 1537 | `#101d2c1a` | navigation floating shadow | `--shadow-nav` |

## Existing alias migration

| Existing variable | Semantic target |
| --- | --- |
| `--navy` | `--brand-navy` |
| `--gold` | `--accent` |
| `--parchment` | `--brand-parchment` |
| `--coral` | `--brand-coral` |
| `--teal` | `--success` |
| `--canvas` | `--bg` |
| `--surface` | `--surface` |
| `--surface-muted` | `--surface-raised` |
| `--surface-hover` | `--surface-hover` |
| `--ink` | `--text` |
| `--muted` | `--text-muted` |
| `--subtle` | `--text-secondary` |
| `--line` | `--border` |
| `--accent` | `--accent` |
| `--accent-strong` | `--accent-text` |
| `--accent-soft` | `--accent-soft` |
| `--green` | `--success` |
| `--green-soft` | `--success-soft` |
| `--danger` | `--danger` |
| `--danger-soft` | `--danger-soft` |
| `--shadow` | `--shadow-panel` |
| `--track` | `--track` |
| `--chart-empty` | `--chart-empty` |

Aliases can remain temporarily for compatibility across incremental area commits. Their values must reference semantic tokens instead of introducing a second palette. Additional alpha/hover/featured/crop/calendar/poster tokens should stay in the same token block; do not create per-component copies of the palette.

## Verification ledger

Baseline test/build results and screenshot evidence are recorded by the root task after the required Step 0 commands. This read-only audit does not claim those commands passed. After migration, re-run the same search, inspect any remaining art exceptions, and run the full existing suite plus expanded token contrast checks.
