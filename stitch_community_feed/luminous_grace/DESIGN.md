---
name: Luminous Grace
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#42474e'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#73777f'
  outline-variant: '#c3c6cf'
  surface-tint: '#3b608b'
  primary: '#234a74'
  on-primary: '#ffffff'
  primary-container: '#3d628d'
  on-primary-container: '#c5ddff'
  inverse-primary: '#a5c9fa'
  secondary: '#705d00'
  on-secondary: '#ffffff'
  secondary-container: '#ffde60'
  on-secondary-container: '#756100'
  tertiary: '#4a483c'
  on-tertiary: '#ffffff'
  tertiary-container: '#636052'
  on-tertiary-container: '#dfdbca'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d2e4ff'
  primary-fixed-dim: '#a5c9fa'
  on-primary-fixed: '#001c37'
  on-primary-fixed-variant: '#214872'
  secondary-fixed: '#ffe173'
  secondary-fixed-dim: '#e4c44a'
  on-secondary-fixed: '#221b00'
  on-secondary-fixed-variant: '#554500'
  tertiary-fixed: '#e7e3d1'
  tertiary-fixed-dim: '#cbc7b6'
  on-tertiary-fixed: '#1d1c11'
  on-tertiary-fixed-variant: '#49473a'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Quicksand
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
  body-md:
    fontFamily: Quicksand
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  label-md:
    fontFamily: Quicksand
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 8px
  container-padding-mobile: 20px
  container-padding-desktop: 40px
  stack-gap-sm: 12px
  stack-gap-md: 24px
  stack-gap-lg: 48px
---

## Brand & Style

The design system is centered on a "Cute and Minimal" aesthetic, blending the spiritual serenity of its predecessor with a modern, approachable, and playful friendliness. It targets a community seeking connection and guidance in a space that feels safe, warm, and joyful.

The style leverages **Soft Minimalism** with a touch of **Neomorphism-lite**. It prioritizes high-clarity layouts, expansive whitespace, and a "squishy" tactile feel. The emotional response should be one of "gentle delight"—where every interaction feels soft to the touch and visually calming.

## Colors

The palette evolves from traditional religious tones into a modern, vibrant spectrum. 

- **Primary (Soft Navy):** A desaturated, calming blue that provides professional grounding without the harshness of deep navy.
- **Secondary (Pop Gold):** A saturated, sunny yellow used for high-impact actions and celebratory accents.
- **Tertiary (Cream):** A warm off-white used for background surfaces to reduce eye strain and enhance the "cute" warmth.
- **Gradients:** Use subtle linear gradients for primary buttons (e.g., Soft Navy to a slightly lighter blue) to add depth.

## Typography

This design system utilizes a pairing of **Plus Jakarta Sans** for structure and **Quicksand** for personality. 

The typography is intentionally spaced with generous line heights to maintain the minimal, airy feel. Headlines use a heavier weight to provide clear hierarchy against the softer body text. Avoid all-caps except for very small labels to maintain an approachable, non-aggressive tone.

## Layout & Spacing

The layout philosophy is **Fluid-Adaptive**, relying on dynamic padding rather than rigid grids to ensure the UI feels organic and unconstrained. 

- **Whitespace:** Increase standard margins by 1.5x compared to traditional SaaS layouts to emphasize the minimal aesthetic.
- **Mobile:** Single column flow with 20px side gutters.
- **Desktop:** Centered max-width containers (1200px) with generous 48px-64px vertical section spacing. 
- **Rhythm:** All spacing must be multiples of 8px to maintain visual harmony.

## Elevation & Depth

Depth is communicated through **Soft Shadows** and **Tonal Layering**. 

- **Shadows:** Use large blur radii (20px-40px) with very low opacity (5-8%) tinted with the Primary Soft Navy. This creates a "floating" effect rather than a "heavy" one.
- **Surfaces:** Use a Tertiary (Cream) background with white cards to create subtle, low-contrast separation.
- **Interactive Depth:** On hover, buttons should appear to "lift" slightly (shadow expands), and on click, they should "sink" (shadow shrinks or disappears), mimicking physical tactile feedback.

## Shapes

The shape language is extremely rounded to evoke comfort and safety.

- **Buttons & Pills:** Must always use `rounded-full` (pill-shaped).
- **Cards & Containers:** Use `rounded-xl` (1.5rem / 24px) or larger. 
- **Icons:** Use icons with rounded terminals and a thick 2px-3px stroke weight. Avoid sharp corners in any custom illustrations or iconography.

## Components

- **Buttons:** Primary buttons use the "Pop Gold" with a subtle top-down gradient. Text is bold and centered. Size should be slightly taller than standard (min-height 48px) to feel "chunky."
- **Cards:** Large corner radii, white background, and a very soft navy-tinted shadow. Padding inside cards should be at least 24px.
- **Inputs:** Soft gray borders (1px) that turn into a thick 2px Soft Navy border on focus. Backgrounds should be slightly off-white to feel less "stark."
- **Chips/Tags:** Always pill-shaped. Use pastel versions of the primary/secondary colors for background fills.
- **Lists:** High vertical spacing between list items. Use chunky, circular icons or avatars as leading elements.
- **Progress Bars:** Thick, rounded tracks with the "Pop Gold" as the fill color to make progress feel rewarding.