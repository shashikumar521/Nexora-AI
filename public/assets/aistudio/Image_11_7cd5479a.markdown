---
name: Syntropic Lumina
colors:
  surface: '#f9f9ff'
  surface-dim: '#d1daf4'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8ff'
  surface-container-highest: '#d9e2fc'
  on-surface: '#121b2e'
  on-surface-variant: '#464554'
  inverse-surface: '#273044'
  inverse-on-surface: '#edf0ff'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#494bd6'
  primary: '#4648d4'
  on-primary: '#ffffff'
  primary-container: '#6063ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#c0c1ff'
  secondary: '#6b38d4'
  on-secondary: '#ffffff'
  secondary-container: '#8455ef'
  on-secondary-container: '#fffbff'
  tertiary: '#006387'
  on-tertiary: '#ffffff'
  tertiary-container: '#007da9'
  on-tertiary-container: '#fcfcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#c4e7ff'
  tertiary-fixed-dim: '#7bd0ff'
  on-tertiary-fixed: '#001e2c'
  on-tertiary-fixed-variant: '#004c69'
  background: '#f9f9ff'
  on-background: '#121b2e'
  surface-variant: '#d9e2fc'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: -0.011em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: -0.006em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.005em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system expresses a forward-leaning, high-precision artificial intelligence interface. It bridges the frictionless conversational clarity of state-of-the-art computational tools with an ethereal, luminous aesthetic. 

The visual style blends **Modern Cleanliness** with **Subtle Glassmorphism** and dynamic chromatic energy:
- **Atmosphere:** Deeply computational yet organic, tranquil, luminous, and focused.
- **Visual Identity:** Translucent micro-surfaces, gentle internal borders, luminous indigo-violet energy gradients, and crystal-clear contrast.
- **Tone:** Authoritative, responsive, hyper-intelligent, and effortless. Interfaces avoid gratuitous neon glow, applying vibrant accentuation purely as a beacon for real-time generative states, conversational hierarchy, and system feedback.

## Colors

The palette establishes an intellectual, luminous baseline that flexes seamlessly between an airy, clean light workspace and a deep-space navy/charcoal computational dark canvas.

### Palette Architecture
- **Primary (`#6366F1`):** Electric Indigo. Drives primary actions, system status indications, and active conversational states.
- **Secondary (`#8B5CF6`):** Deep Violet. Works in tandem with Indigo for smooth gradient vectors, generative thought badges, and model distinction.
- **Tertiary / Accent (`#38BDF8`):** Radiant Sky. Pinpoints dynamic prompts, code block highlights, streaming cursors, and citation links.
- **Neutral Core (`#172033`):** High-density Ink. Used for razor-sharp typography in light mode.

### Light Surface Roles
- **Background (`#F8FAFF`):** Cool-tinted luminous white providing soft ambient contrast without eye fatigue.
- **Card / Surface (`#FFFFFF`):** Pure white with translucent fallbacks (`rgba(255, 255, 255, 0.85)`).
- **Subtle Border (`#E8EAF3`):** Hairline structure with a 1px crisp presence.
- **Muted Text (`#64748B`):** Secondary meta-labels, timestamps, and input placeholders.

### Dark Mode Semantic Tokens
- **Root Background:** `#0B0F19` (Obsidian Navy).
- **Surface Elevation 1 (Sidebar / Input Trays):** `#111827` (Charcoal Void).
- **Surface Elevation 2 (Chat Bubbles / Modals):** `#1F2937` with subtle linear borders (`rgba(255, 255, 255, 0.08)`).
- **Dark Text:** `#F8FAFC` (Primary Text), `#94A3B8` (Secondary Text).

## Typography

The typographic hierarchy couples geometric clarity with systematic readability:
- **Headlines & Display:** Set in **Plus Jakarta Sans**. Its sculpted modern letterforms and tight geometric apertures bring confidence and freshness to greeting hero lines, modal titles, and section dividers.
- **Continuous Reading & Body:** Governed by **Inter**. Optimized for long-form generative answers, nuanced step-by-step reasoning, and effortless legibility across display densities.
- **Code & Metadata:** Rendered in **JetBrains Mono**. Dedicated to technical artifacts, API structures, tokens, mathematical expressions, and inline telemetry.

## Layout & Spacing

The layout model is divided into a responsive two-pane architecture: a collapsible sidebar utility region and an optimized, centered fluid conversational stream.

### Structural Grid & Rails
- **Collapsible Sidebar:** Fixed at 280px on desktop; slides off-canvas as a modal drawer below 1024px.
- **Conversation Stage:** Fluid column capped at a maximum width of 48rem (768px) to maintain optimal reading line lengths (60–75 characters per line).
- **Margins & Gutters:** Desktop outer margin spans `2rem` (32px), shifting smoothly to `1rem` (16px) on mobile viewports under 640px.

### Responsive Breakpoints
- **Mobile (< 640px):** Single-column stacked stack. Input prompt docks flush to the bottom safe area with ambient background blur. Sidebar lives behind a slide-over gesture.
- **Tablet (640px – 1023px):** Compact navigation rail (icon-only mode: 64px width). Conversational canvas stretches with dynamic side gutters.
- **Desktop (≥ 1024px):** Fully expanded persistent layout with parallel secondary inspect panels (code view, artifacts, parameter sliders) scaling from a 12-column grid.

## Elevation & Depth

Visual hierarchy rejects heavy, dirty drop-shadows in favor of ethereal chromatic diffusion and layered glassmorphism.

### Depth Archetypes
- **Base Canvas:** Deepest layer, matte finish with subtle radial gradients of Indigo (`rgba(99, 102, 241, 0.04)`) bleeding softly from the upper right viewport.
- **Tonal Glass (Floating Panels & Header):** `backdrop-filter: blur(16px); background: rgba(255, 255, 255, 0.75)` in light mode; `rgba(17, 24, 39, 0.75)` in dark mode. Paired with a 1px boundary line (`rgba(232, 234, 243, 0.8)` or `rgba(255, 255, 255, 0.08)`).
- **Interactive Elevations (Prompt Box, Dropdowns, Flyouts):** Soft atmospheric shadows:
  - *Light Mode:* `0 10px 30px -5px rgba(99, 102, 241, 0.08), 0 4px 12px -2px rgba(23, 32, 51, 0.04)`
  - *Dark Mode:* `0 12px 36px -6px rgba(0, 0, 0, 0.45), 0 0 1px 1px rgba(255, 255, 255, 0.08)`
- **Luminous Active States:** Focused elements evoke an indigo photon aura using an inset or outer double ring: `0 0 0 2px #FFFFFF, 0 0 0 4px #6366F1`.

## Shapes

The interface adopts a curved, humanized contour profile (Level 2: Rounded base, scaling to ultra-curved containers):
- **Base UI Elements:** Inputs, buttons, and chips use `0.75rem` (12px) to `1rem` (16px) for an approachable, sleek finish.
- **Cards & Prompts (`rounded-2xl`):** Primary chat bubbles, modal bodies, and the floating execution input bar leverage a generous `1rem` to `1.25rem` radius, eliminating abrasive sharp corners.
- **Badges & Switches:** Full circular pills (`rounded-full` / 9999px) preserving tactile, floating semantics.

## Components

### 1. Interactive Chat Bubbles
- **User Message:** Right-aligned, minimal, rounded-2xl with the lower-right corner slightly tapered. Flat solid fill (`#172033` in light mode, `#1F2937` in dark mode) with crisp white text.
- **Assistant Message:** Left-aligned, transparent backing or subtle card styling (`#FFFFFF` in light mode with `#E8EAF3` border; `#111827` in dark mode). Displays streaming response typography with inline visual cues.
- **Thinking / Generative State:** Encased in a subtle violet-to-indigo animated shimmer outline accompanied by an ambient pulsing badge.

### 2. Buttons
- **Primary:** Linear gradient (`135deg, #6366F1 0%, #8B5CF6 100%`) with crisp white label. Hover state features an inner top highlight reflection and subtle elevation translation (`translate-y(-0.5px)`).
- **Ghost / Neutral:** Transparent background, text `#64748B`, transitioning to `#172033` with an ultra-light tint background (`rgba(99, 102, 241, 0.06)`) on hover.
- **Icon Actions (Copy, Regenerate, Thumbs):** Micro-buttons (`w-8 h-8`) with soft border and low-opacity foreground icons that transition to `#6366F1` on hover.

### 3. Conversational Floating Input Bar
- Floating anchor bar spanning the base of the viewport.
- Multi-line autosizing textarea, surrounded by an absolute glass container (`rounded-2xl`, backdrop blur 20px).
- Bottom toolbar within the prompt houses attachment chips, model picker dropdown, web search toggles, and an arrow submit button that glows with Primary Indigo when text is valid.

### 4. Glowing Gradient Badges & Chips
- Model indicators (e.g., "Nexora Pro 4.5", "Web Browsing", "Reasoning"): Pill-shaped (`rounded-full`), padded `py-1 px-3`, featuring a multi-stop border gradient (`#6366F1` to `#38BDF8`) over a semi-transparent base (`rgba(99, 102, 241, 0.08)`).
- Text rendered with sharp high-contrast typography in `JetBrains Mono` or `Inter Medium`.

### 5. Refined Code Blocks
- Dual-tier block design:
  - **Header Bar:** `#0B0F19` dark rail across both color modes, containing the language slug, token counter, and an instantaneous clipboard copy button with checkmark micro-interaction.
  - **Code Surface:** Deep slate/black matte fill (`#0B0F19`), syntax highlighting styled via sky (`#38BDF8`), violet (`#8B5CF6`), and amber keys. Inset horizontal scrollbar styled to 4px thickness.

### 6. Inputs, Checkboxes & Switches
- **Form Controls:** Text fields sit on `#FFFFFF` with `#E8EAF3` borders, shifting to an active `#6366F1` hairline ring on focus.
- **Toggles:** Smooth pill track shifting from `#E8EAF3` to the indigo gradient, holding a floating white circular thumb with drop shadow.