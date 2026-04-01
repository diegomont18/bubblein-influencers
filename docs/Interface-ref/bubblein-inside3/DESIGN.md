# Design System Document: High-Energy Creator Editorial

## 1. Overview & Creative North Star: "The Neon Pulse"
The Creative North Star for this design system is **"The Neon Pulse."** We are moving away from the static, rigid structures of traditional SaaS and into an editorial, high-motion experience that mirrors the energy of the creator economy. 

This system rejects the "template" look. It favors intentional asymmetry, bold typographic scales, and depth achieved through light and transparency rather than lines. We don't just "display" content; we "stage" it. By using deep charcoal as our canvas and electric purple as our heartbeat, we create a high-contrast environment that feels both premium and tech-forward.

## 2. Colors: The Electric Palette
Our palette is designed to vibrate against a dark, sophisticated background. 

### Core Palette
*   **Surface (Deep Charcoal):** `#0e0e0e`. This is our foundation. It provides the "void" that allows our vibrant accents to pop.
*   **Primary (Electric Purple):** `#ca98ff` (and its variants). This is the energy source. Use `primary_dim` (`#9c42f4`) for high-motion areas.
*   **Secondary (Neon Green):** `#a2f31f`. Use sparingly for "Success" states or high-priority CTA accents to signify growth and action.
*   **Tertiary (Coral):** `#ff946e`. Our "human" touchpoint. Use for creator-centric highlights or secondary actions.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to section content. Boundaries must be defined solely through background color shifts. 
*   Place a `surface_container_low` (`#131313`) section directly against the `surface` (`#0e0e0e`) background. 
*   The transition is the border. This creates a seamless, "infinite" feel that mimics high-end editorial magazines.

### The "Glass & Gradient" Rule
To elevate beyond flat UI, use `surface_variant` at 40% opacity with a `backdrop-blur` of 20px for floating navigation or cards. 
*   **Signature Textures:** Apply a linear gradient from `primary` to `primary_dim` on hero buttons to provide a "liquid" feel.

---

## 3. Typography: Bold & Assertive
We use **Lexend** for all structural and high-impact messaging to ensure a tech-forward, geometric feel. **Be Vietnam Pro** provides a sophisticated, legible contrast for long-form content.

*   **Display Large (Lexend, 3.5rem):** Reserved for hero headlines. Use tight letter-spacing (-0.02em) to create a "block" of text that feels like a graphic element.
*   **Headline Medium (Lexend, 1.75rem):** Use for section headers. Always pair with generous top-padding to let the typography breathe.
*   **Body Large (Be Vietnam Pro, 1rem):** Our standard for readability. Maintain a line-height of 1.6 to ensure the dark background doesn't "choke" the white text.
*   **Label Small (Lexend, 0.6875rem):** All-caps for metadata or categories. Use a 0.05em letter-spacing to maintain "premium" vibe.

---

## 4. Elevation & Depth: Tonal Layering
In this design system, depth is a physical property of light, not a shadow effect.

*   **The Layering Principle:** Stack surfaces from darkest (bottom) to lightest (top). 
    *   *Base:* `surface` (`#0e0e0e`)
    *   *Section:* `surface_container_low` (`#131313`)
    *   *Card:* `surface_container_high` (`#20201f`)
*   **Ambient Shadows:** If a card must float (e.g., a modal), use a shadow color tinted with `#8A2BE2` at 6% opacity with a 40px blur. It should look like the purple light is "bleeding" from underneath.
*   **The "Ghost Border" Fallback:** If accessibility requires a border, use `outline_variant` at 15% opacity. Never use 100% opaque lines.
*   **Soft Roundness:** Apply `ROUND_TWELVE` (1rem) as the standard. For large hero imagery, scale up to `lg` (2rem) to create an inviting, organic feel.

---

## 5. Components: Fluid & High-Energy

### Buttons
*   **Primary:** Gradient of `primary` to `primary_dim`. Text is `on_primary` (Deep Purple). Shape: `full` (pill-shaped) for a modern influencer feel.
*   **Secondary:** Ghost style. Transparent background with a `secondary` (`#a2f31f`) Ghost Border (20% opacity). Text is `secondary`.
*   **Interaction:** On hover, scale buttons to 1.05 and increase the glow (shadow) intensity.

### Cards & Lists
*   **The Divider Forbiddance:** Never use lines between list items. Use a 1.5rem (Spacing 6) gap or a subtle shift to `surface_container_highest` on hover.
*   **Creator Cards:** Use `surface_container` with a `backdrop-blur`. Imagery should have a `md` (1.5rem) corner radius nested inside the card's `DEFAULT` (1rem) padding.

### Input Fields
*   **Styling:** Fill with `surface_container_lowest`. No border. On focus, animate a 2px `primary` bottom-border that grows from the center. 
*   **Error State:** Use `error_dim` (`#d73357`) for text; do not turn the entire box red—keep it sophisticated.

### Signature Component: The "Creator Pulse" Chip
*   A selection chip using `surface_bright` with a 2px neon green dot (`secondary`) to indicate "Live" or "Active" status. This injects high-energy motion into static data.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** overlap elements. Let a creator's headshot break the "boundary" of a container to create 3D depth.
*   **Do** use the `secondary_fixed` (Neon Green) for micro-interactions like toggles or progress bars.
*   **Do** use high-quality, high-shutter-speed photography of creators in motion (dancing, filming, laughing).

### Don’t:
*   **Don’t** use "Bank Blue" or any muted, corporate greys.
*   **Don’t** use 1px dividers. If you feel you need one, increase the white space instead.
*   **Don’t** use square corners. This system is about fluidity and energy; keep everything "Soft Round."
*   **Don’t** over-saturate. With a black background and neon colors, use white space (the "0" in our charcoal) to prevent visual fatigue.