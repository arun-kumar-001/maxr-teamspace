# MAXR Teamspace Design

**Status:** adopted by the Technical Lead. **Colours and fonts:** MaxR Flow (the company's product). **Layout, shape and component style:** the dashboard references the TL chose: Ondra (`demo.codeandchill.store/ondra`), Petalo (`/petalo`) and Selvar (`/selvar`), with their neutrals tinted toward the MaxR Flow teal. All values were measured from screenshots (the sites themselves are blocked from the build environment). Values live in `apps/web/src/styles/tokens.css`; rules in `AGENTS.md` §8. Live examples: component gallery (`/components` in the dev server), tab **Dashboard Patterns**.

## 1. Character
Calm, spacious, data-first. A dark teal sidebar floats on a light, slightly teal-grey page; near-white cards with very round corners hold the content; one teal accent marks what is active; colour beyond teal appears only as data (deltas, pipelines, charts) or as soft pastel "attention" tiles. Big friendly greeting, numbers set large.

## 2. Colour roles

| Token | Value | Use |
|---|---|---|
| `primary` | `#46C7B8` | Active indicator, live dots, bars, progress, logo tile. **Never text, never white on it** |
| `primary-strong` | `#0D9488` | Icons, focus ring |
| `primary-deep` / `-deeper` | `#0F766E` / `#115E59` | Solid primary buttons (white text) with `shadow-primary` |
| `primary-ink` / `primary-soft` | `#0F766E` / `#E9F8F6` | Teal text and links / soft teal fills, icon squares |
| `bg` | `#EEF2F1` | Page |
| `surface` / `surface-raised` / `surface-muted` | `#FBFCFC` / `#FFFFFF` / `#F2F5F4` | Cards / selected tile, active segment, inputs, white buttons / metric strip, inner tiles |
| `track` | `#E8EEEC` | Segmented control track |
| `border` / `border-strong` | `#E3E9E7` / `#D3DCD9` | Card outlines / inputs, outlined buttons, pills |
| `text` / `text-muted` / `text-subtle` | `#13201E` / `#4F5C5A` / `#5F6C6A` | Everything / secondary / captions and "vs" values |
| `sidebar` (bg, raised, border) | `#0E2826`, `#1B3532`, `#26413E` | Floating sidebar, its active item and inner cards |
| `sidebar-text` / `-strong` / `-muted` | `#D5E2DF` / `#F2F7F6` / `#8AA29D` | Items / active item and product name / group labels |
| `positive-soft` + `positive-ink` | `#DCF2EA` + `#047857` | Good change chip |
| `negative-soft` + `negative-ink` | `#F9E3E1` + `#B42318` | Bad change chip |
| `tile-peach` `tile-yellow` `tile-blue` `tile-green` | `#FFE0D4` `#FBECC6` `#DCEBFA` `#D8F1E3` | Attention tiles (dark text) |
| `chart-1…7` / `chart-ink-1…7` | blue, teal, pink, purple, amber, green, red (MaxR Flow) | Data fills / numbers next to them |
| `success` `warning` `danger` `info` | unchanged | Status meaning (`StatusPill`, `Badge`) |

Two teals on purpose: the MaxR Flow teal is too light for text (2.07:1), so shapes use it and text/buttons use the deep teal. `contrast.test.ts` checks every text pairing listed here.

## 3. Typography
- **Outfit** for the greeting, page and card titles and every big number (`font-display`); **Inter** for UI text. Outfit is the visual match to MaxR Flow and the references; confirm with the MaxR Flow designer.
- Greeting `text-greeting` (32–48px, medium, tight tracking). Card title 18px semibold. Body 14–16px. Captions 12px `text-subtle`. Numbers 28px semibold `tabular-nums`. Sidebar group labels 11–12px uppercase, tracking 0.08em.

## 4. Shape, depth, spacing
- Radius: buttons, inputs, nav items, icon buttons **12px** (`rounded-input`); segments 10px inside a 14px track; tiles **16px** (`rounded-tile`); metric strip 20px; cards, sidebar, modals **24px** (`rounded-card`). Chips and badges fully round.
- Depth: cards `border-border shadow-card` (almost flat); selected tile / active segment `shadow-raised`; primary button `shadow-primary` (teal glow).
- Spacing on the 8px scale: card padding 20–24px; gaps 16px; sections 32px; page padding 24–32px.

## 5. App shell (issue #12)

| Part | Spec |
|---|---|
| Sidebar, desktop ≥1024px | **Use `Sidebar` from `components/ui`** (do not build another). Floating panel `bg-sidebar rounded-card`, `w-sidebar` (296px), placed `shell` (16px) from the top, left and bottom window edges, full height; the nav scrolls inside. Top: logo tile (48px, `bg-primary`, dark icon, soft glow), product name + subtitle, collapse button. Groups with sentence-case labels (`sidebar-muted`) and a divider between groups. Items 44px: outline icon + label, count badge (`attention` = amber, `neutral` = raised), chevron for sub-pages. **Active page (Petalo style): solid teal pill** `bg-primary text-sidebar font-semibold shadow-sidebar-active`; an open group is `bg-sidebar-raised` with its sub-pages indented on a guide line. Optional summary card above the user card (avatar, name, role, "⋮" menu). |
| Collapsed / tablet 640–1023px | `Sidebar collapsed` (88px rail): logo tile, expand button, icons only; active page is a solid teal square; counts become dots (amber or teal) but stay in the accessible name ("Leave, 8 new"); labels appear as tooltips on hover **and keyboard focus**; a parent with sub-pages opens the full sidebar. |
| Phone <640px | `SidebarDrawer`: the expanded sidebar slides in as a modal drawer (focus trapped, Escape and backdrop close it, focus returns to the menu button, closes after navigating), plus an optional bottom navigation bar for the 4–5 main items. |
| Top bar | No background (sits on `bg`). Left: breadcrumb with a small icon (`text-muted` › `text`). Right: search pill (`surface-raised`, `rounded-card`, ⌘K hint), date-time pill with a live `primary` dot, `IconButton`s for theme and notifications (count badge), primary **New** button. On phone: search becomes an icon button; date pill hidden. |
| Page header | Date line with a calendar icon, greeting headline, one narrative sentence with bold figures and an underlined `primary-ink` link; actions on the right (secondary "Export" + primary action), stacked below on phone. |
| Content | Max width 1536px for dashboards; 12-column feel: main card ~2/3 + side card ~1/3 on large screens; more columns on ≥1920px, never stretched text. |

## 6. Components and patterns
- `Button`: primary (deep teal, glow), secondary (white with outline, "Export"), outline, ghost, danger; 44–48px tall, 12px radius.
- `SegmentedControl`: grey track, raised white selected segment ("7 days / 30 days / 90 days").
- `MetricStrip`: selectable KPI tiles that drive a chart; selected tile raised white. `StatCard`: stand-alone KPI card. Both use icon square + label, big number, `DeltaChip` + "vs …" comparison or a caption.
- `DeltaChip`: arrow + sign + value, green or red; `isGood={false}` when a rise is bad (late check-ins, leave days, costs).
- `Sidebar` / `SidebarDrawer`: the navigation panel described in §5; router-agnostic (`onNavigate(id, event)`, call `event.preventDefault()` when a client router handles the link).
- `IconButton`: 44px square-rounded white button with optional count badge or dot; always has `aria-label`.
- **Attention tiles:** pastel `tile-*` card, white icon square, title, arrow, big number at the bottom, one-line caption; the whole tile is a link.
- **Pipeline tiles (MaxR Flow):** stage label, `chart-ink` number, 4px `chart` bar.
- **Charts:** current period as a filled teal area/line, previous period dashed `text-subtle`; event markers as small rings on the x-axis; grid lines `border`. Pick a chart library via ADR before the first real chart.
- `StatusPill`, `Badge`, `DataTable`, `Modal`, `Toast`, state cards: unchanged behaviour, new shape and colours.

## 7. Not decided yet
- **Dark theme:** the references have a theme toggle, but no dark design was supplied. The toggle can be shown once a dark palette is designed; until then leave it out of the shell.
- **Icon library:** references use thin outline icons (Lucide style); choose via ADR (for example `lucide-react`). Inline SVGs until then.
- **Logo files and font confirmation** from MaxR Flow.
