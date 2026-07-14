---
name: KatolikGo Divine Elegance
colors:
  surface: '#121411'
  surface-dim: '#121411'
  surface-bright: '#383a36'
  surface-container-lowest: '#0d0f0c'
  surface-container-low: '#1a1c19'
  surface-container: '#1e201d'
  surface-container-high: '#292a27'
  surface-container-highest: '#333532'
  on-surface: '#e3e3de'
  on-surface-variant: '#c3c6cf'
  inverse-surface: '#e3e3de'
  inverse-on-surface: '#2f312e'
  outline: '#8d9199'
  outline-variant: '#43474e'
  surface-tint: '#abc9f2'
  primary: '#abc9f2'
  on-primary: '#103253'
  primary-container: '#1a3a5c'
  on-primary-container: '#87a4cc'
  inverse-primary: '#436084'
  secondary: '#ecc246'
  on-secondary: '#3d2e00'
  secondary-container: '#b18c09'
  on-secondary-container: '#352800'
  tertiary: '#ffb3b2'
  on-tertiary: '#670315'
  tertiary-container: '#730e1c'
  on-tertiary-container: '#ff787c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d2e4ff'
  primary-fixed-dim: '#abc9f2'
  on-primary-fixed: '#001c37'
  on-primary-fixed-variant: '#2a486b'
  secondary-fixed: '#ffe08e'
  secondary-fixed-dim: '#ecc246'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#584400'
  tertiary-fixed: '#ffdad9'
  tertiary-fixed-dim: '#ffb3b2'
  on-tertiary-fixed: '#410008'
  on-tertiary-fixed-variant: '#871e28'
  background: '#121411'
  on-background: '#e3e3de'
  surface-variant: '#333532'
  navy-dark: '#0e2a4d'
  cream-soft: '#fdfaf0'
  status-error: '#c62828'
  halo-glow: rgba(201, 162, 39, 0.3)
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  version-text:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 40px
---

## Brand & Style

The brand personality is **Devotional, Premium, and Encouraging**. It seeks to create a digital space that feels like a sacred sanctuary—distinguished and traditional, yet engaging through modern gamification. The target audience is the Malaysian Catholic community, requiring a UI that feels both culturally resonant and technologically sophisticated.

The design style is a blend of **Modern Corporate and Glassmorphism**, enriched with **Theological Symbolism**. 
- **Modern Corporate:** Provides the underlying structure of reliability and clarity, essential for educational and religious content.
- **Glassmorphism:** Applied to quiz cards and overlays to create a sense of ethereal lightness, mimicking stained glass or divine light.
- **Theological Accents:** Subtle halo glows, Latin cross motifs, and hex-clipped containers reinforce the Catholic identity without cluttering the interface.

## Colors

The palette is rooted in deep liturgical tones. The primary **Navy (#1a3a5c)** represents depth and stability, while the **Gold accent (#c9a227)** signifies divinity and achievement. 

- **Primary & Secondary:** Use Navy for backgrounds and primary containers. Use Gold exclusively for highlights, active states, and decorative "halo" motifs.
- **Neutral:** A "Soft Cream" is utilized for text on dark backgrounds to reduce eye strain compared to pure white, maintaining a "parchment" feel.
- **Interaction:** The **Maroon (#b9444a)** is reserved for high-priority Call-to-Action buttons (e.g., "Mula Kuis"), separating "doing" from "navigating."
- **Gradients:** Use a linear gradient from `navy-dark` to `primary` for main screen backgrounds to provide a sense of vertical depth.

## Typography

The system uses **Plus Jakarta Sans** for headlines to provide a welcoming, contemporary feel, and **Inter** for body text to ensure maximum legibility during long reading sessions or quiz taking.

- **Headlines:** Use a bold weight and slightly tighter letter spacing. Headlines should always appear in `cream-soft` or `gold` for hierarchy.
- **Body:** `Inter` provides a neutral, utilitarian foundation for Bahasa Melayu strings, handling descenders and diacritics with clarity.
- **Labels:** Use uppercase for the `label-md` role when used in navigation or small headers to create a "formal" secondary hierarchy.
- **Accessibility:** All user-facing strings must be in Bahasa Melayu. Technical versioning at the bottom of the profile uses `version-text`.

## Layout & Spacing

The design system utilizes a **Fluid Grid** system based on an 8px spacing power-scale. 

- **Layout Model:** A standard 12-column grid is used for desktop, reflowing to a single-column layout for mobile with **20px side margins**.
- **Quiz Level Path:** The level picker (as seen in the reference) uses a non-linear, serpentine path. Nodes are spaced `xl` (32px) apart vertically to allow for easy thumb interaction.
- **Guttering:** Content cards within the Home and Leaderboard screens use a `16px` gutter to maintain a clean, breathable professional appearance.
- **Safe Areas:** Ensure a `32px` bottom padding on mobile to accommodate system gesture bars and the floating gold navigation dock.

## Elevation & Depth

Visual hierarchy is established through **Tonal Layering and Tinted Glows** rather than generic grey shadows.

- **Surfaces:** Level 0 is the Navy gradient background. Level 1 (Cards/Lists) uses a slightly lighter Navy or a semi-transparent Gold glass effect (`backrop-filter: blur(10px)`).
- **Interactive Depth:** Active quiz nodes or CTA buttons feature a `halo-glow`—a soft, diffused gold outer glow that suggests illumination rather than a physical drop shadow.
- **Gradients:** Use subtle top-to-bottom gradients on buttons and navigation bars to simulate a convex, tactile surface.

## Shapes

The shape language is **Structured but Organic**, balancing hard geometric religious motifs with soft-touch UI elements.

- **Corner Radius:** Standard components (Buttons, Cards) use a **0.5rem (8px)** radius to feel modern and accessible.
- **Religious Motifs:** Use **Hex-clipped** containers for profile avatars or special achievement badges to evoke a sense of architectural stained glass.
- **The Halo:** Circular elements (like the Quiz Level nodes) are perfectly round (`rounded-full`) to represent the halo and the eternal nature of the faith.

## Components

- **Buttons:** Primary CTAs use the `maroon` color with `cream-soft` text. Secondary buttons use a `gold` outline (ghost style).
- **Quiz Nodes:** Circular nodes with a 2px `gold` border. Completed nodes are solid `gold` with a `navy` cross icon; locked nodes are `grey-scale` with a padlock icon.
- **Navigation Dock:** A floating bar with `rounded-xl` corners. The active state is indicated by a `navy` capsule behind the icon and a small gold dot indicator.
- **Cards:** Used in Leaderboards and the Home feed. Use a dark navy background with a 1px `gold` border at 20% opacity.
- **Input Fields:** Soft cream background with navy text. Focus state triggers a 2px `gold` border and a subtle `halo-glow`.
- **Chips:** Used for quiz categories. Small, pill-shaped with `navy-dark` background and `gold` text.