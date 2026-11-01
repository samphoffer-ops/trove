# Trove Design Spec (v1.0)

Save this file as `docs/design-spec.md`, and add one line to CLAUDE.md: "All UI work follows docs/design-spec.md." It is the source of truth for how Trove looks and behaves. `src/theme/index.ts` is the source of truth for token values; if this spec and the theme file disagree on a value, the theme file wins.

---

## How Claude Code should use this spec

1. Read this whole file before any UI task.
2. Plan before building: list components, files touched, new dependencies, and data writes, then wait for approval.
3. Do not invent layout details this spec doesn't cover. If something is unspecified, ask.
4. Never add a feature from the "Not in 1.0" list. Log it as a GitHub issue labeled `v1.1` instead.
5. After building a screen, list how it differs from this spec, if at all.

---

## 1. Principles

- **Serious enough to buy, playful enough to enjoy.** The register sits between Ssense (too cold) and Depop (too chaotic).
- **Restraint is the look.** One primary action per screen. No likes, follower counts, badges, or notification counts anywhere in 1.0.
- **The image does the work.** Product imagery carries the feed. Text on cards is minimal.
- **The playful notes come from coral and the oversized italic type.** Not from decoration, gradients, or extra color.
- **No generic layouts.** Uniform type hierarchy and symmetric layouts are what make the app look generic. Every screen needs clear scale contrast and at least one asymmetric or editorial moment.

---

## 2. Visual system

### Color (from the theme file)

| Token | Value | Use |
| --- | --- | --- |
| Coral | `#FF4A1C` | Brand moments only: onboarding reveal, editorial headers, empty states, logo dot |
| Warm white | `#FFF8F0` | Surfaces, including the feed background |
| Near-black | from theme | Text and brand moments |
| Chartreuse | `#E8F353` | The single primary action. Max one per screen. |
| Blue | `#5C85FF` | Utility only: links, secondary system affordances |

**Rule:** don't place product photography directly on full-bleed coral. Coral full-bleed is for moments with no product imagery (the onboarding reveal, empty states). Product grids sit on warm white.

### Typography

- **Typeface:** Mulish throughout.
- **Contrast comes from scale, not extra fonts.** Editorial headers are roughly 4× body size, set in Mulish italic at regular or medium weight with slightly tight letter-spacing (about -1% to -2.5%) and line-height near 1.0.
- **Body:** 15–16pt, line-height about 1.4–1.5.
- **Small labels** (brand, price on cards): small, medium weight, quiet color. Keep them visually subordinate to the image.
- **Bold is not the main hierarchy tool.** Size and placement come first.
- Respect Dynamic Type where it doesn't break the editorial headers. Body text must scale.

### Spacing and shape

- Use the spacing and radius tokens in the theme file. If a needed value is missing, propose it and ask before adding it.
- Generous outer margins; tight, consistent gutters in the masonry grid.

### Appearance

- **Lock 1.0 to light appearance.** Set `"userInterfaceStyle": "light"` in app config. A dark palette is a 1.1 project, built with at least four surface levels, not an inversion.

---

## 3. Platform: iOS 27 and Liquid Glass

- **Tab bar:** use Expo Router native tabs (`expo-router/unstable-native-tabs`) so the system renders the real Liquid Glass tab bar. Don't hand-build a glass tab bar. The API is marked unstable, so check the docs for the project's current Expo SDK before writing it.
- **Glass is only for controls floating over content:** the tab bar, header buttons, and bottom sheets. Never use it as a decorative surface or a card background.
- **Legibility:** iOS 27 gives users a system-wide glass opacity slider. Test the tab bar and header controls at minimum and maximum opacity, over warm white and over product photos.
- **Builds:** native glass and native tabs need a development build (EAS), not Expo Go.
- **Tabs in 1.0:** Feed and Boards. Profile and settings are reached from the header. Search arrives in a later release.

---

## 4. Interaction

### Haptics (expo-haptics)

| Action | Haptic |
| --- | --- |
| Onboarding selection (brand, style, image yes/no) | `selectionAsync()` |
| Save to Board | `impactAsync(Light)` |
| "Not for me" | `impactAsync(Soft)` if available, else Light |
| Board created, onboarding complete | `notificationAsync(Success)` |

Every gesture gets a haptic. No haptics on scroll.

### Gestures

- **Long-press a feed card** opens quick actions: Save, Not for me.
- **Every gesture needs a visible fallback:** a small save icon on cards, plus "Not for me" in the long-press menu. A gesture is never the only path.

### Thumb zone

- Primary actions live in the bottom third of the screen.
- On product detail, "Shop at [Brand]" is a bottom-anchored chartreuse button.
- Secondary flows open as bottom sheets: Save to Board, filters later, share options.

---

## 5. Motion

- **Feed card to product detail:** a shared-element transition with Reanimated. The image grows from its card position into the detail hero. This is the most important motion in the app.
- **Parallax:** subtle, only on the product detail hero image and editorial bento blocks. The feed grid stays flat and fast.
- **No entrance animations on feed cards** beyond the image placeholder resolving.
- Respect Reduce Motion: fall back to a crossfade.

---

## 6. Imagery

- Use `expo-image` with blurhash placeholders. Never show empty gray boxes.
- **Consistent framing:** masonry heights can vary, but crop each image to a small set of fixed aspect ratios (for example 4:5 and 3:4). Center the product consistently.
- **Normalize at ingest:** in the catalog pipeline, store the chosen aspect ratio and a blurhash per image. Flag images with busy or off-brand backgrounds for review instead of showing them.
- Mixed product photography is the biggest risk to perceived quality. Treat it as a design problem, not a data problem.

---

## 7. Screens

### Onboarding

**Job:** build a usable taste profile in under 90 seconds.

1. **Brand picks:** a grid of yes-list brand wordmarks. Select at least five. The continue button stays disabled until then.
2. **Never-show:** a grid of styles or categories to exclude. These are stored as negative signals.
3. **Image picks:** 8–12 product images, each answered yes or no, with a haptic on each choice.
4. **Reveal:** full-bleed coral with an oversized italic Mulish header ("Your edit is ready"), a success haptic, then a transition into the feed.

Sign in with Apple comes before or after these steps, never in the middle. The reveal is the app's main brand moment, so give it the most polish.

**Done when:** a new user reaches a personalized feed in under 90 seconds, and every selection is written to the taste profile in Supabase.

### Feed

**Job:** show products worth saving, fast.

- Two-column masonry on warm white.
- Cards show only the image, brand, and price.
- A small save icon on each card; long-press for Save or Not for me.
- An editorial bento block every 8–12 cards: an asymmetric layout with an oversized italic header naming a mini-edit (for example "Quiet linen" or "New from [Brand]"). The block breaks the grid on purpose and is Trove's signature move.
- Pagination with a quiet loading state; a designed empty state on coral.

**Done when:** the feed scrolls without dropped frames on a real device, the bento blocks appear at the right interval, and save and not-for-me events are logged.

### Product detail

**Job:** make the case for one product, then get out of the way.

- A full-width image carousel, entered with the shared-element transition.
- Brand, product name, and price.
- One line on why it's in your edit, drawn from the taste profile or the brand brief.
- A bottom-anchored chartreuse "Shop at [Brand]" button that opens the outbound link through the single redirect endpoint.
- Save to Board in the header; it opens a bottom sheet.

**Done when:** the transition is smooth in both directions, the outbound link goes through the redirect endpoint, and saving works from the sheet.

### Boards

**Job:** let people express taste and come back to it.

- A Boards index where each cover is built automatically from the first four saves, in a bento layout.
- Board detail is a tight grid of saved products.
- Create, rename, delete, and reorder boards.
- Share a Board through the native share sheet as a generated image card.

**Done when:** all board actions persist, and the shared image card renders correctly in Messages and Instagram Stories.

### Header and navigation

- Logo wordmark on the left, profile and settings on the right, all as glass controls.
- No DMs button in 1.0.

---

## 8. Not in 1.0 (do not build)

- "More like this" (needs image embeddings)
- Price-drop alerts and push notifications
- Collage view for Boards
- Search and natural-language search
- DMs, following, social feeds
- Dark mode
- Chat or assistant interfaces of any kind
- Deals, coupons, or discount badges

---

## 9. Never

- More than one chartreuse element on a screen
- Visible social metrics: likes, followers, counts
- Product photos on full-bleed coral
- Glass as a decorative surface
- Custom-built tab bars
- Gradients, drop-shadow-heavy cards, or decorative illustration
- Centered, symmetric layouts throughout a whole screen with no editorial moment
- Layout details that aren't in this spec without asking first
