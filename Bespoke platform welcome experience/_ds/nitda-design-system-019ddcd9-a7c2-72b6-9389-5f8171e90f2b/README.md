# NITDA Design System

A design system distilled from the **NITDA Brand Guidelines (2020)** for use in digital interfaces, slides, prototypes, and brand collateral.

> **NITDA** — National Information Technology Development Agency, an agency of the **Federal Ministry of Communications and Digital Economy** of the Federal Republic of Nigeria. Headquartered at No. 28, Port Harcourt Crescent, Off Gimbiya Street, Area 11, Garki, Abuja.

NITDA's mandate is to develop, regulate, and advise on Nigeria's information technology sector — from `.gov.ng` domain registration and IT project clearance to OEM certification, data protection, and SERVICOM compliance.

This system was authored from a single source of truth: the official 2020 brand manual delivered to this project. It is intentionally narrow — NITDA's brand is conservative, governmental, and visually disciplined.

---

## Sources

The following files were provided and used to author this system:

| File | Use |
|---|---|
| `uploads/NITDA Brand Manual - new 4 PRNT mail.pdf` / `.docx` | Primary source: colors, typography, logo rules, applications |
| `uploads/NITDA LOGO WITH NAME AND GREEN BACKGROUND.png` | Horizontal logo, white-out on Deep Green |
| `uploads/NITDA LOGO WHITE BACKGROUND GREEN TEXT.jpeg` | Horizontal logo, full-color on white |
| `uploads/RESIZEDGREEN PNG.png`, `RESIZED2 GREENLOGO ... .png`, `2 GREEN PNG.png` | Stacked/vertical logo, white-out on Deep Green |
| `uploads/NITDA LOGO GLOBE WITH GREEN BACKGROUND.png`, `NITDA ROUND LOGO.png`, `Picture 11 copy 2.jpg` | Complementary "infoweb" symbol (atomic globe) |
| `uploads/NITDA logo 5.jpg` | Stacked logo with serif baseline (legacy variant) |
| `uploads/DOC-20260415-WA0045..jpg` | (Signed page — not a usable design asset) |

A copy of the brand manual lives at `reference/NITDA Brand Manual.pdf`.

---

## Index

```
NITDA Design System/
├─ README.md                  ← you are here
├─ SKILL.md                   ← agent skill manifest (Claude Code compatible)
├─ colors_and_type.css        ← all design tokens (CSS variables) + semantic styles
├─ assets/                    ← logos, marks, photography placeholders
├─ fonts/                     ← (placeholder — drop licensed Alwyn New here)
├─ reference/                 ← original brand manual PDF
├─ preview/                   ← design-system tab cards (HTML)
└─ ui_kits/
   └─ web/                    ← NITDA web property UI kit (index.html + JSX)
```

---

## Content Fundamentals

NITDA writes like a Nigerian federal agency: **formal, third-person, institutional**. Public communications avoid the casual register of consumer tech brands.

**Tone**
- Authoritative, public-service-oriented, neutral
- "The Agency" or "NITDA" — never "we" in formal copy. First-person plural is acceptable in employee-facing materials and short blurbs ("Our Services include...").
- Addresses citizens directly with "you" only in service-oriented contexts (e.g. "If found please return to..." on ID cards).
- No emoji. No jokes. No exclamation points outside of headlines.

**Casing**
- **Title Case** for headings, page titles, navigation, and document titles.
- **Sentence case** acceptable for body content, captions, table cells.
- **ALL CAPS** is reserved for the Federal Ministry credit line ("FEDERAL MINISTRY OF COMMUNICATIONS AND DIGITAL ECONOMY") and for short overline/eyebrow labels. Do not set headlines in all caps.

**Naming conventions**
- Always spell out the agency on first reference: "National Information Technology Development Agency (NITDA)"; "NITDA" thereafter.
- Italicized brackets reserved: `[NITDA]` appears in the brand manual's running header — keep this pattern for governmental documents.
- Phone numbers in the format `+234 ...` with spaces.

**Sample copy from the manual**
- Tag line / baseline: "National Information Technology Development Agency"
- Service line examples (flier copy):
  - ".Gov.Ng Domain Registration"
  - "IT Project Clearance"
  - "Certification & Licensing of OEMs"
  - "Registration of Contractors & Service Providers"
  - "Data Protection"
  - "SERVICOM"
- Address block: "No. 28, Port Harcourt Crescent, Off Gimbiya Street, P.M.B 564, Area 11, Garki, Abuja, Nigeria"

**Vibe**: trustworthy, deliberate, civic. Think "national infrastructure" not "startup". Copy should feel as though it could be delivered by a press secretary.

---

## Visual Foundations

**Palette philosophy.** Two greens carry the brand: a deep, almost-black **Deep Green `#05583B`** (PANTONE 7484C) and a vivid **Smart Green `#17B255`** (PANTONE 354C). Deep Green is the primary surface; Smart Green is reserved for accent moments — the divider line under "NITDA" in the wordmark, hover/active states, success indicators, and small accents. **Tertiary Red and Yellow appear only inside the Coat of Arms** and must never be used in general design. White and brand black (`#373435`) round out the palette. The 80% / 40% tints documented in the manual are approved for charts and graphs — no other color extensions are sanctioned.

**Type.** The brand uses **Alwyn New** (a geometric humanist sans by Mark Simonson Studio) for logo, headings, and applications such as letterheads/business cards/IDs. **Verdana** (system) is the body font for long-form documents — minimum 10pt, with 8.5pt allowed only for footnotes/disclaimers. This system substitutes **Outfit** (Google Fonts) for Alwyn New as a free near-match (geometric, similar proportions, identical weight range) — see "Font substitution" caveat below.

**Backgrounds.** Solid Deep Green is the brand's signature surface — used full-bleed on covers, banners, signage, and email headers. White is the workhorse content surface. The **complementary "infoweb" element** (the atomic-globe symbol) is the only sanctioned background flourish: it can be watermarked at 96% transparency or rendered as a faint motif. **No gradients. No photography overlays. No textures, patterns, or hand-drawn illustrations.** The brand is flat and geometric.

**Imagery.** When photography is used (publications, event materials), it should be warm, candid, and human-centered — Nigerian people in civic, technology, education, and government contexts. The brand manual does not specify a strict treatment, but contrast and clarity are paramount; logos must be placed only on light or uniformly dark areas to maintain legibility.

**Layout.** Logos are always **top-left or bottom-left** (the manual is explicit). Documents follow international paper sizes (A3, A4, A5, DL). Generous whitespace is the rule — minimum exclusion zone around the logo equals the height of "Na" from "National". Page borders on publications are explicitly prohibited.

**Borders, radii, shadows.** Print collateral uses no borders or shadows on the logo (drop shadows on the logo are explicitly forbidden). For digital UI, this system adopts a **conservative radius scale** (4 / 8 / 12 / 16 px) and **soft green-tinted shadows** (`rgba(5, 88, 59, *)`) so elevation reads as part of the brand rather than generic Material drop-shadow.

**Cards.** Cards are white surfaces with a `1px` border in `--border-default` (`#E8E6E7`) and `--shadow-sm`. Optional left-edge accent in Smart Green is allowed for callouts but not as a default card style.

**Animation.** Subtle, governmental — never playful. Use `--ease-standard` (`cubic-bezier(0.2, 0, 0, 1)`) for state transitions at `--dur-base` (200ms). Hover states fade and lighten; press states use `--nitda-deep-green-deep` (slightly darker). No bounces, no spring overshoots in primary UI. The `--ease-emphasis` curve is reserved for marketing/hero motion only.

**Hover & press states**
- Buttons (primary): hover → `--nitda-smart-green`; press → `--nitda-deep-green-deep` + `transform: translateY(1px)`.
- Buttons (secondary/ghost): hover → background `--bg-muted`; press → background `--bg-subtle`.
- Links: hover → switch from Deep Green to Smart Green.
- Icon-only controls: hover → opacity `1` from `0.7`.

**Transparency & blur.** Used sparingly. The complementary infoweb element may sit at 96% transparency as a watermark. Frosted-glass blur is **not** part of the brand — avoid `backdrop-filter`.

**Iconography motif.** The infoweb symbol's lines and dots are the source of the brand's geometric vocabulary — thin strokes, sharp endpoints, atomic node-dots. UI iconography should echo this: outline-style, 1.5–2px stroke, rounded line caps.

---

## Iconography

**The brand provides one mark, not an icon set.** The complementary "infoweb" element — the atomic-globe symbol with orbital lines and dot terminators — is NITDA's only sanctioned graphic mark beyond the logo. It is documented for use on social profile pictures, business-card backs, and as a watermark.

For UI icons (navigation, actions, form states), this system uses **Lucide** via CDN (`https://unpkg.com/lucide@latest/dist/umd/lucide.js`) as a substitute. Lucide was chosen because:
- It is open-source (ISC-licensed) and free for any use.
- Stroke-based outline style matches the geometry of the infoweb mark.
- Default 2px stroke and rounded line caps echo the mark's terminators.

This is a **substitution** — NITDA does not ship an official UI icon set. Mark replacing if/when an official set is provided. **Emoji is not used in NITDA UI.** Unicode dingbats are not used.

**Iconography rules**
- Stroke-style only (Lucide outline). No filled icons in primary UI.
- Color: inherit `currentColor`; on green surfaces, white. On white surfaces, `--nitda-deep-green` for actionable, `--fg-muted` for decorative.
- Size: 16, 20, 24 px (caption / body / title). 44px touch target floor.
- Pair every navigational icon with a text label.

---

## Components & UI Kits

| Surface | Path | Notes |
|---|---|---|
| NITDA web property | `ui_kits/web/index.html` | Home page recreation with header, hero, services grid, news, footer — JSX components for each unit |

The web kit is a **recreation of the brand manual's described web treatment** (the manual specifies logo placement and email/social header dimensions but does not provide complete digital page comps). Treat its content as plausible scaffolding to be replaced by editorial content.

---

## Caveats & substitutions

1. **Alwyn New is substituted with Outfit.** Drop the licensed `AlwynNew-*.woff2` files into `fonts/` and update `colors_and_type.css` to remove the substitution.
2. **Lucide substitutes for an official UI icon set.** NITDA does not ship one.
3. **No web/app design comps were provided** in the brand manual. The web UI kit infers screens from the brand manual's described digital rules + standard government-portal IA. Treat as scaffolding.
4. **The `.zip` and `.tif` listed in the upload manifest were not present in the project filesystem at read time** — we worked from the `.docx` / `.pdf` / `.png` / `.jpg` files that were available.
5. **`DOC-20260415-WA0045..jpg`** appears to be a signed approval page, not a design asset; not included in `assets/`.
