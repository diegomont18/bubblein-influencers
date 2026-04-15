# Design System Specification: High-End Editorial Dark Mode

## 1. Overview & Creative North Star
**The Creative North Star: "The Digital Intelligence Lab"**

This design system moves away from the generic "SaaS Dashboard" look to create a professional, high-stakes environment for LinkedIn automation. The goal is to make the user feel like they are operating a sophisticated piece of industrial machinery for data. 

We achieve this through **Organic Brutalism**: a combination of deep, monochromatic surfaces, punchy editorial typography, and high-energy accents. We intentionally break the "template" look by using exaggerated typographic scales and asymmetrical layouts where data is grouped into distinct, elevated modules rather than a rigid, flat grid. The focus is on clarity, authority, and high-velocity workflows.

---

## 2. Colors & Surface Philosophy

### Color Palette
- **Core Background**: `#0e0e0e` (Surface/Background)
- **Primary Accent**: `#cc97ff` (Primary) — A vibrant, energetic purple used for critical actions.
- **Secondary Accent**: `#e197fc` (Secondary) — Used for supporting interactive elements and subtle highlights.
- **System Feedback**: Errors are handled with `#ff6e84` (Error), ensuring high visibility against the dark backdrop.

### The "No-Line" Rule
Traditional 1px borders are strictly prohibited for sectioning. We define space through **Tonal Layering**. To separate content, transition the background color between `surface`, `surface-container-low`, and `surface-container-high`. This creates a sophisticated, "etched" look rather than a boxed-in feel.

### Glass & Gradient Implementation
Main CTAs and high-priority cards should utilize subtle gradients (transitioning from `primary` to `primary_container`) to provide visual "soul." For floating elements like dropdowns or overlays, use a **Glassmorphism** effect: 
- **Fill**: `surface_container` at 70% opacity.
- **Effect**: `backdrop-blur: 20px`.
- **Edge**: A "Ghost Border" using `outline_variant` at 15% opacity to catch the light.

---

## 3. Typography
The system uses a dual-typeface strategy to balance character with readability.

- **Display & Headlines (Manrope)**: Used for high-level "editorial" moments. Manrope's geometric yet warm structure conveys modern authority. Use `display-lg` (3.5rem) for main dashboard headers to create a bold, confident entry point.
- **Body & Labels (Inter)**: The workhorse. Inter is used for all data-heavy sections, input fields, and UI labels. Its high x-height ensures maximum legibility in high-density lead lists.

**Hierarchy as Identity:**
Use `headline-sm` (1.5rem) for card titles, but pair it with `label-sm` (0.6875rem) in all-caps with 5% letter spacing for "overlines" (e.g., "CAMPAIGN METRICS"). This contrast between large, bold headers and tiny, wide-spaced labels creates a high-end, premium aesthetic.

---

## 4. Elevation & Depth

### The Layering Principle
Depth is achieved by stacking Material Design surface tiers.
1. **Base Layer**: `surface` (`#0e0e0e`)
2. **Structural Sections**: `surface_container_low` (`#131313`)
3. **Interactive Cards**: `surface_container` (`#1a1919`)
4. **Floating/Active States**: `surface_container_highest` (`#262626`)

### Ambient Shadows
Avoid black drop shadows. When a "floating" effect is required (e.g., a modal or a primary button hover), use an extra-diffused shadow:
- **X/Y**: 0, 12px
- **Blur**: 32px
- **Color**: `on_surface` (White) at **4% opacity**. This mimics natural light reflecting off a dark surface.

---

## 5. Components

### Buttons
- **Primary**: Full fill `primary_container` (`#c284ff`). Text color: `on_primary_container` (`#360061`). Border-radius: `DEFAULT` (0.5rem).
- **Secondary/Ghost**: No background. "Ghost Border" (`outline_variant` at 20%). On hover, fill with `surface_container_highest`.
- **Tertiary**: Text-only using `primary_dim`. Used for low-priority actions like "Cancel."

### Input Fields
Inputs must feel like integrated parts of the UI, not floating boxes. 
- **Container**: `surface_container_high` (`#201f1f`).
- **Border**: None (use the No-Line rule).
- **Active State**: A bottom-only 2px stroke of `primary`.
- **Radius**: `md` (0.75rem).

### Selection Chips
- **Unselected**: `surface_container_highest` with `on_surface_variant` text.
- **Selected**: `secondary_container` (`#6a2785`) with `on_secondary_container` (`#f1bfff`) text.
- **Shape**: `full` (pill-shaped) for a friendly, modern feel.

### Lead Lists & Cards
- **Forbid Dividers**: Use `spacing-md` (1.5rem) and subtle background shifts to separate list items.
- **Interaction**: On hover, a list item should transition from `surface` to `surface_container_low`.

---

## 6. Do's and Don'ts

### Do
- **DO** use generous whitespace. High-end design breathes. If a section feels crowded, increase the padding to `xl` (1.5rem).
- **DO** use `surface_bright` sparingly to highlight "Active" or "Online" status indicators.
- **DO** leverage the `manrope` typeface for numbers and metrics to give them a distinct, custom-built look.

### Don't
- **DON'T** use 100% white (#ffffff) for large bodies of text. Use `on_surface_variant` (`#adaaaa`) to reduce eye strain in the dark theme.
- **DON'T** use sharp 90-degree corners. Everything in this system uses at least `sm` (0.25rem) rounding to soften the "Brutalist" edges.
- **DON'T** use traditional grey shadows. They appear muddy on deep charcoal backgrounds. Always use low-opacity white or tinted shadows.