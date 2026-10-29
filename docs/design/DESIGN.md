# MAXR Teamspace Design: the MaxR Flow look

**Status:** adopted by the Technical Lead. **Source:** a screenshot of the MaxR Flow dashboard (the company's existing product) supplied by the Technical Lead; colours were read from its pixels, not estimated. This file is the visual spec; `AGENTS.md` §8 holds the rules and `apps/web/src/styles/tokens.css` holds the values. Live examples: the component gallery (`/components` in the dev server), tab **Dashboard Patterns**.

## 1. Character
Light, airy and calm. White surfaces on a very light cool grey page, one fresh teal as the only brand colour, soft mint fills for "active" and "selected", rounded cards with almost invisible borders and shadows, bold geometric headings and large numbers. Colour beyond teal appears only as data (pipelines, charts, statuses).

## 2. Colour roles

| Token | Value | Use | Never |
|---|---|---|---|
| `primary` | `#46C7B8` | Fills, progress bars, hero border, dots, chart series | Text of any size, white text on it (2.07:1) |
| `primary-strong` | `#0D9488` | Icons, focus ring | Small text (3.74:1) |
| `primary-deep` / `-deeper` | `#0F766E` / `#115E59` | Solid primary buttons and the selected segment (white text) | |
| `primary-ink` | `#0F766E` | Teal text: active nav, links, soft pills | |
| `primary-soft` / `-soft-border` | `#E9F8F6` / `#CCEFEB` | Active nav background, icon chips, soft pills | |
| `bg` | `#F8FAFC` | Page background | |
| `surface` / `surface-muted` | `#FFFFFF` / `#FAFBFD` | Cards, sidebar, header / tiles inside cards, row hover | |
| `border` / `border-strong` | `#EEF0F4` / `#E2E8F0` | Card and divider lines / header line, inputs, outlined buttons | |
| `text` / `text-muted` / `text-subtle` | `#1A2332` / `#475569` / `#64748B` | Headings and numbers / labels and body / captions and breadcrumbs | |
| `hero-from` → `hero-to`, `hero-border` | `#FFFFFF` → `#E3F4F4`, `#62D1C5` | Welcome panel gradient and outline | |
| `chart-1…7` (fill) | blue `#3B82F6`, teal `#46C7B8`, pink `#EC4899`, purple `#8B5CF6`, amber `#F59E0B`, green `#10B981`, red `#EF4444` | Bars, chart series, pipeline underlines, in this order | Text |
| `chart-ink-1…7` | darker shades of the same hues | Numbers next to those bars (large bold text, 3:1+) | |
| `success` `warning` `danger` `info` | unchanged | Status meaning; text uses the soft pill styles in `StatusPill`/`Badge` | |
| `brand-red` | `#E5322D` | The "R" in the logo only (approximate, verify from the logo file) | UI meaning |

**Accessibility rule (why there are two teals):** the MaxR Flow teal is light. Text and white-on-teal fail WCAG AA with it, so the brand teal is used for shapes and a deeper teal for anything that must be read. `contrast.test.ts` checks every text pairing the components use.

## 3. Typography
- **Outfit** (Google Fonts, 500–700) for page titles, section titles and big numbers (`font-display`); **Inter** for everything else. Outfit is a visual match to the reference, not a confirmed brand font: confirm with the MaxR Flow designer.
- Scale: page title 28–32px bold; section title 22–24px bold; card title 18px semibold; label 14px semibold `text-muted`; body 14–16px; caption 12px `text-subtle`; KPI number 28–30px bold, `tabular-nums`.
- Uppercase section labels in the sidebar ("NAVIGATION"): 11–12px, letter-spacing 0.08em, `text-subtle`.

## 4. Shape, depth and spacing
- Radius: inputs 10px (`rounded-input`), cards and tiles 16px (`rounded-card`), hero panel 20px (`rounded-panel`), buttons, segmented controls and pills fully round (`rounded-full`).
- Cards: `bg-surface border border-border shadow-card`. Raised floating buttons (white pills): `shadow-raised`.
- Spacing on the 8px scale: card padding 20–24px, gap between cards 16px, between sections 32px.

## 5. App shell (applies to issue #12)
| Part | Spec |
|---|---|
| Sidebar (desktop ≥1024px) | White `surface`, right border `border`, ~280px wide. Logo block at top (mark + "MAXR Teamspace" + small uppercase subtitle). "NAVIGATION" label with a collapse button. Items: outline icon + label, 44px tall, `rounded-input`; **active** = `bg-primary-soft text-primary-ink` + chevron; hover = `bg-surface-muted`. |
| Tablet (640–1023px) | Same sidebar collapsed to an icon rail (tooltips, active item in `primary-soft`). |
| Phone (<640px) | Drawer from the left with the same items, plus a bottom navigation bar for the 4–5 main items. |
| Header | White, bottom border `border-strong`, ~80px on desktop. Left: breadcrumb (`text-subtle` › `text`). Right: round outlined icon buttons (notifications with a teal `primary` dot) and an account pill (avatar, name, role, chevron). Sticky. |
| Page | `bg` background, content padding 24–32px, max width 1536px for dashboards (more columns on large monitors, never stretched text). |

## 6. Patterns (see the gallery)
- **Welcome panel:** `rounded-panel border-hero-border` with the hero gradient; outlined soft pill on top, `font-display` title, `text-muted` subtitle; actions on the right (segmented control, secondary pill button), stacked under the text on phone.
- **KPI cards:** `StatCard`: label + icon chip, big number, caption. Grid: 1–2 columns on phone, 3 on laptop, 6 on wide screens.
- **Pipeline / stage tiles:** tile `surface-muted rounded-card`, centred stage label, number in `chart-ink-n`, 4px bar in `chart-n` at the bottom. Leave statuses use: Applied blue, Pending amber, Approved green, Rejected red, Cancelled purple.
- **Segmented control:** `SegmentedControl` (radio group, keyboard arrows), selected segment `primary-deep`.
- **Soft pill:** `Badge variant="primary"` ("Total 57 requests").
- **Status:** `StatusPill` as before (always icon/dot plus label, never colour alone).

## 7. Not decided yet
- **Dark theme:** the reference is light only, so there is no dark palette for now (`AGENTS.md` §8 previously asked for both). Add one only when requested.
- **Icon library:** the reference uses thin outline icons (Lucide style). Choosing one (for example `lucide-react`) needs an ADR; until then use inline SVGs.
- **Logo:** use the official MAXR / MaxR Flow logo files when supplied; do not redraw it.
