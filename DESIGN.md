---
name: The Challenge
description: A habit challenge for two, in calm frosted glass.
colors:
  page-mist: '#f6f8fb'
  glow-periwinkle: '#e2e8f8'
  glow-lilac: '#ebe6fa'
  glow-blush: '#f7e9f1'
  ink: '#161a29'
  ink-slate: '#58647d'
  line: '#e1e5ee'
  line-strong: '#ccd3e0'
  field-line: '#7d869b'
  surface: '#ffffff'
  sunken: '#e9ecf3'
  slate-button: '#2e3543'
  slate-button-light: '#49515e'
  violet: '#5b47a8'
  violet-strong: '#4a3794'
  violet-soft: '#ece8f8'
  violet-line: '#cbc1ee'
  done-green: '#1f7a4b'
  done-soft: '#dcf5e6'
  missed-red: '#b23b3b'
  missed-soft: '#fde3e3'
  wait-amber: '#855404'
  wait-soft: '#fff0d4'
  forgiven-green: '#2f6b52'
  forgiven-soft: '#e2f3ea'
  day-done: '#86c79c'
  day-forgiven: '#b4d7e3'
  day-missed: '#cc718a'
  day-waiting: '#e2bd71'
  day-open: '#8d9ad0'
  day-mark: '#23203a'
  look-seventy-five: '#7c3a8f'
  look-sleep: '#3d55b0'
  look-dry: '#13777a'
  look-fitness: '#a4470f'
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: 'clamp(28px, 1.6vw + 22px, 36px)'
    fontWeight: 400
    lineHeight: 1.1
  headline:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: '24px'
    fontWeight: 400
    lineHeight: 1.2
  sheet-title:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: '26px'
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: '-0.015em'
  section-title:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: '22px'
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: '-0.015em'
  title:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: '20px'
    fontWeight: 400
    lineHeight: 1.25
  number:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: '30px'
    fontWeight: 400
    lineHeight: 1
  number-large:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: '40px'
    fontWeight: 400
    lineHeight: 1
  number-verdict:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: 'clamp(48px, 5vw + 30px, 72px)'
    fontWeight: 400
    lineHeight: 1
  number-countdown:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: '64px'
    fontWeight: 400
    lineHeight: 1
    letterSpacing: '-0.03em'
  number-countdown-wide:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: '88px'
    fontWeight: 400
    lineHeight: 1
    letterSpacing: '-0.03em'
  signature:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: '32px'
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: '0.01em'
  lead:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: '19px'
    lineHeight: 1.45
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: '17px'
    fontWeight: 400
    lineHeight: 1.5
  secondary:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: '15px'
    lineHeight: 1.45
  button:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: '16px'
    fontWeight: 500
    lineHeight: 1.2
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: '14px'
    fontWeight: 600
    lineHeight: 1.2
rounded:
  mark-xs: '2px'
  mark-sm: '6px'
  mark: '8px'
  button: '11px'
  sm: '12px'
  md: '14px'
  control: '16px'
  lg: '18px'
  bar: '22px'
  sheet: '28px'
  full: '999px'
spacing:
  gap-xs: '8px'
  gap-sm: '12px'
  card-pad-sm: '14px 16px'
  card-pad: '18px'
  gutter: '20px'
  card-pad-lg: '26px'
  page-max: '720px'
components:
  button-primary:
    backgroundColor: '{colors.slate-button}'
    textColor: '{colors.surface}'
    typography: '{typography.button}'
    rounded: '{rounded.button}'
    padding: '0 18px'
    height: '44px'
  button-primary-large:
    backgroundColor: '{colors.slate-button}'
    textColor: '{colors.surface}'
    rounded: '{rounded.button}'
    padding: '0 22px'
    height: '48px'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    typography: '{typography.button}'
    rounded: '{rounded.button}'
    padding: '0 18px'
    height: '44px'
  button-quiet:
    textColor: '{colors.violet}'
    typography: '{typography.button}'
    rounded: '{rounded.button}'
    padding: '0 12px'
    height: '44px'
  button-quiet-hover:
    backgroundColor: '{colors.violet-soft}'
  button-danger:
    backgroundColor: '{colors.missed-red}'
    textColor: '{colors.surface}'
    rounded: '{rounded.button}'
    height: '44px'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.button}'
    padding: '10px 14px'
    height: '48px'
  card:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.md}'
    padding: '{spacing.card-pad}'
  row:
    rounded: '{rounded.lg}'
    padding: '14px 16px 14px 18px'
    height: '60px'
  chip:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.full}'
    padding: '3px 14px 3px 3px'
    height: '44px'
  pill-done:
    backgroundColor: '{colors.done-soft}'
    textColor: '{colors.done-green}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: '3px 12px'
    height: '28px'
  pill-missed:
    backgroundColor: '{colors.missed-soft}'
    textColor: '{colors.missed-red}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: '3px 12px'
    height: '28px'
  pill-waiting:
    backgroundColor: '{colors.wait-soft}'
    textColor: '{colors.wait-amber}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: '3px 12px'
    height: '28px'
  day-square-done:
    backgroundColor: '{colors.day-done}'
    textColor: '{colors.day-mark}'
    rounded: '{rounded.sm}'
    size: '44px'
  day-square-missed:
    backgroundColor: '{colors.day-missed}'
    textColor: '{colors.day-mark}'
    rounded: '{rounded.sm}'
    size: '44px'
  sheet:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sheet}'
    padding: '16px 24px 24px'
  action-bar:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.bar}'
    padding: '12px'
---

# Design System: The Challenge

## Overview

**Creative North Star: "Calm"**

This is the style Erin picked from three tried across every page. The other two were Warm (paper and cocoa, with solid cards) and Bold (flat and high-contrast, with the accent as the main button).

Pages sit on a pale page with soft, fixed glows of colour at its corners. Content sits on frosted glass cards. Titles and big numbers are set in Georgia, and everything else in the phone's own system font. Colour is kept for meaning: a day's status, and the small marks of the challenge's look. The main button is a quiet dark slate.

It is an everyday tool used on a phone in passing, so it is sparse. Each page is one 720px column with one obvious main action. A page or sheet either fits the screen or is a long list. Motion is short, eased and never in the way.

Erin has turned down two directions. Purple main buttons were "too aggressive", so the main button became slate. Vivid status colours were "way too vibrant", so they were softened.

**Key Characteristics:**

- Frosted glass cards on a pale page with soft glows.
- Georgia for titles and numbers; the system font for everything else.
- A slate main button. The look's colour appears only in small marks.
- Status is always shown by both a colour and an icon or word.
- One 720px column on every page. Nothing scrolls a little.

## Colors

The page is a cool, near-white mist, and one muted accent per look. Status colours are clear but soft, and the same in every look.

### Primary

- **Slate Button** (slate-button, with slate-button-light at the start of its gradient): the main filled button on every page, in every look. In dark mode it becomes a pale grey button with dark text.
- **Calm Violet** (violet): the classic look's accent. Used for quiet buttons, chevrons, links, today's ring and selected chips. Its soft and line variants tint selected and hovered things.

### Secondary

- **The looks**: each theme brings its own accent and page glow, set with `data-look` on any element:
  - **75-Day Challenge**: Plum (look-seventy-five). It was berry until November 2026, which sat too close to missed red.
  - **Sleep & Screens Reset**: Night Blue (look-sleep).
  - **Dry Month**: Teal (look-dry).
  - **Fitness & Food**: Clay (look-fitness).

  Each look's gradient fill (`--nx-fill`) is used only on small things: theme swatches, badges, today's marker and progress dots. Each look also has its own light and dark page, glows and accent tints, all in `styles/next.css`; only the main accent is listed here.

### Tertiary: status

- **Done Green / Missed Red / Waiting Amber / Forgiven Green** (each with a soft background): status pills, bars and status text.
- **Day square colours** (day-done, day-missed, day-waiting, day-forgiven, day-open, with day-mark for the icon): Erin's palette from October 21, with a dark icon on every square. They look the same in light and dark: in dark the gradient ends on the colour itself rather than fading, so every mark keeps 4.5:1.

### Neutral

- **Page Mist** (page-mist), with the three glows (periwinkle, lilac, blush): the page background, fixed while the page scrolls.
- **Ink** (ink): all text. **Slate Ink** (ink-slate): secondary text and hints.
- **Line / Line Strong**: card borders, dividers and the borders of secondary buttons.
- **Field Line** (field-line): the edge of anything you type in or switch (inputs, number boxes, the switch when off, the selected segment), at 3:1 against the surface.
- **Surface / Sunken**: sheets, inputs, the action bar; sunken wells and empty squares. In dark, surfaces are the look's own page lifted a little, so sheets and bars match the look.

### Named Rules

**The Slate Button Rule.** The one main action on a screen is the slate button, never the look's colour. A coloured main button was tried and turned down.

**The Small Marks Rule.** A look's colour appears in quiet buttons, chevrons, swatches, badges, today's ring and progress dots, never as a large filled area.

**The Clear of Missed Rule.** A look's accent never sits near missed red in hue, so good news never reads as a miss.

**The Never Colour Alone Rule.** A status always has its icon (day squares) or its word (pills) as well as its colour.

## Typography

**Display Font:** Georgia (with Times New Roman, serif)
**Body Font:** the system UI font (-apple-system, Segoe UI, Roboto, Helvetica Neue, Arial)

**Character:** a classic book serif for titles and numbers, set at regular weight, over the phone's own sans for everything you read and tap. It reads as calm and personal rather than techy.

### Hierarchy

- **Display** (Georgia 400, 28–36px fluid, 1.1): page titles and the end-of-day heading.
- **Sheet title** (Georgia 400, 26px, 1.2, -0.015em): the title of every sheet.
- **Headline** (Georgia 400, 24px, 1.2): headings inside a page, like the end of a day's "All logged" on phones.
- **Section title** (Georgia 400, 22px, 1.2, -0.015em): the kit's section titles (`.nx-section-title`).
- **Title** (Georgia 400, 20px, 1.25): card titles.
- **Numbers** (Georgia 400, 30px and 40px): points, amounts and counts. Every number is a button.
- **Big numbers** (Georgia 400): the verdict's gifts at 48–72px fluid, and the pact's countdown to Day 1 at 64px (88px from 640px, -0.03em, in the accent). These are the only two. A signed name on the pact is the one italic, at 32px.
- **Lead** (sans, 19px, 1.45): an occasional opening line.
- **Body** (sans 400, 17px, 1.5): everything you read, and inputs.
- **Secondary** (sans, 15px, 1.45): hints, sub-lines and field labels (600).
- **Button** (sans 500, 16px; 17px on large buttons).
- **Label** (sans 600, 14px): status pills and count badges. This is the floor.

### Named Rules

**The 14px Floor Rule.** Body text is 17px and secondary text 15px. Nothing is under 14px, and inputs are at least 16px (they are 17px).

**The Serif Is for Names and Numbers Rule.** Georgia is used for titles and big numbers only. It is never used for body text, buttons or labels.

## Layout

- **One column:** every page is a single column at most 720px wide, with 20px side margins, on phones and laptops alike. No page is wider than another.
- **Phones:** a tab bar sits at the bottom. Each page's main action sits in a sticky action bar above the tab bar.
- **Laptops (1024px and up):** the tabs move into the top bar, and the page keeps its 720px column.
- **Sheets:** a bottom sheet on phones, at most the screen's height minus 24px. From 640px a centred dialog, at most 760px tall.
- **Spacing:** cards use 14–26px of padding (larger from 640px), and gaps step through 8, 12, 16, 20 and 24px.
- **Fitting:** a page or sheet either fits the screen or is a long list. When a page fits, the frame drops its bottom padding (`data-fits`) so it doesn't scroll for nothing.
- **Width:** a sheet's sections sit side by side from 640px, rather than stacking into a scroll.

### Named Rules

**The Nothing Scrolls a Little Rule.** If a screen scrolls by less than a screenful, rearrange it so it fits: side by side, shorter wording, fewer lines. Only a long list scrolls.

**The Same Width Rule.** Every page uses the same 720px column and margins.

## Elevation & Depth

Depth comes from glass cards rather than heavy shadows. Cards are translucent white gradients over the page's soft glow, with a bright hairline border and a soft, wide, cool shadow. They don't blur what's behind them (only the glow is), so scrolling stays smooth on older phones; the tab bar and the laptop header blur, since content scrolls under them. Something tappable lifts a little on hover. Sheets and the action bar are opaque surfaces with a lift shadow, so text scrolling underneath never shows through. Dark mode keeps the structure, swaps the shadows for deeper black ones, and adds a faint inner top highlight.

### Shadow Vocabulary

- **Glass** (`box-shadow: 0 1px 2px #1e2a5a0a, 0 12px 36px -10px #2a3a6b24`): cards at rest.
- **Lift** (`box-shadow: 0 2px 4px #1e2a5a0f, 0 18px 44px -12px #2a3a6b33`): a tappable card on hover, and the action bar.
- **Sheet** (`box-shadow: 0 -12px 48px -12px #0000004d`): the bottom sheet over its blurred scrim.

### Named Rules

**The Opaque Bar Rule.** The action bar, sheets and tab bar never let page text show through their buttons.

## Shapes

Shapes are soft but not bubbly:

- **Corners:** buttons and inputs 11px, day squares 12px, cards 14px, the segmented control and Check in's day chip 16px, glass cards and rows 18px, the action bar 22px, and a sheet's top corners 28px. Small marks take 2px (rails, confetti), 6px (legend squares, text highlights) or 8px (bar segments, a number's tap area).
- **Pills:** chips, pills and count badges are full pills.
- **Round:** icon buttons are 44px circles.
- **Day squares:** square, frosted and gradient-lit, with a dark icon in each.
- **Borders:** 1px hairlines throughout.

## Components

### Buttons

- **Shape:** gently rounded (11px). 44px tall, or 48px for `size="lg"`, with 16px medium labels.
- **Primary:** the slate gradient with white text, in every look; in dark mode, a pale grey gradient with dark text. Use it once per screen.
- **Secondary:** light glass with a thin grey border and ink text. On hover it becomes solid white.
- **Quiet:** text in the look's accent, with a soft accent wash on hover.
- **Danger:** solid red, for ending or deleting.
- **States:**
  - **Pressed:** scales to 0.97.
  - **Disabled:** uses `aria-disabled` at 45% opacity. It stays focusable, so pressing it can say why.
  - **Loading:** shows a spinner and dims the label.

### Chips

- **Style:** a full pill in light glass with a hairline border and 15px semibold text, 44px tall when tappable. It often holds a person's avatar or a mini day square.
- **State:** a selected chip takes the accent's soft fill and border.

### Status pills

- **Style:** a 28px full pill with a 14px semibold label, a soft status background and status-coloured text. Words only, no icon.

### Cards / Containers

- **Glass card:** 18px corners, translucent white gradient, glass shadow, no blur.
- **Plain card:** 14px corners, hairline border, faint surface.
- **Row:** a whole glass card is one button, at least 60px tall, ending in an accent chevron that nudges right on hover.

### Inputs / Fields

- **Style:** 48px tall, 11px corners, a field-line border (3:1), white surface, 17px text.
- **Field:** a 15px semibold label, the input, then a 15px hint in slate ink.
- **Focus:** the border turns to the accent, with a 4px soft accent ring.
- **Error:** the border turns missed red, and the hint says what's wrong.

### Navigation

- **Phones:** a fixed bottom tab bar, frosted at 86% surface with a 24px blur, respecting the safe area.
- **From 1024px:** the same tabs sit in the top bar as a row.
- **Badges:** a count badge (slate pill, 14px bold, tabular numbers) marks what is waiting.

### Day square (signature)

The one way a day is drawn everywhere: Overview's week, the Progress calendar, each habit's calendar and the end of a day on Check in.

- **Style:** a frosted, gradient-lit square in Erin's day colours, with a dark icon:
  - check: done
  - X: missed
  - clock: waiting
  - heart: forgiven
  - dashed circle: open
  - dash: no visit
- **Other states:** an outline for a weekly day with no visit, plain glass for days ahead, faded for days a habit doesn't ask for, and an accent ring for today.
- **Size:** at least 44px wide when tappable.

### Sheet

A bottom sheet with a grabber on phones, and a centred dialog from 640px. It has a serif title, an optional Back arrow before the title for a sheet opened from another, a scrolling body, and a footer of buttons separated by a hairline.

### Action bar

An opaque, rounded (22px) bar that sticks above the tab bar and holds the page's main action. From 640px its buttons sit in a row, with the main one on the right.

## Do's and Don'ts

### Do:

- **Do** give each screen one slate main button. Secondary actions are glass or quiet buttons.
- **Do** draw every day with the day square: its colour and its icon.
- **Do** keep text at 17px body and 15px secondary, never under 14px, and inputs at 16px or more.
- **Do** make every tap target at least 44px.
- **Do** animate in 150–300 ms with `cubic-bezier(0.22, 1, 0.36, 1)`, and drop all motion under `prefers-reduced-motion`.
- **Do** keep pages to the 720px column, and fit a near-fit screen instead of letting it scroll a little.
- **Do** check light and dark, and at least one other look, for every change.

### Don't:

- **Don't** use the look's colour for the main button or any large filled area.
- **Don't** use vivid, saturated status colours; Erin found them "way too vibrant and aggressive".
- **Don't** put icons inside status pills (no ✓ or ✗); pills are words and colour.
- **Don't** show a toast or pop-up to confirm an action. The page shows what changed, and only a failed write shows a message.
- **Don't** set body text, buttons or labels in Georgia.
- **Don't** add a legend, label or line that repeats what a square, title or button already says.
