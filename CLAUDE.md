# Trove

Trove is an iOS app for discovering clothing from independent brands. New users pick
what they like during onboarding, which builds a taste profile. The feed then shows a
masonry grid of products ranked against that profile. Users save products to boards
and tap out to the brand's own site through a single redirect endpoint. Trove earns
affiliate revenue on those click-outs. The app is Expo/React Native in `mobile/`, the
backend is Supabase in `supabase/`, and the catalog is built by intake and refresh jobs.

## v1.0 scope
**In scope:** Sign in with Apple · onboarding taste capture · feed (masonry, Layer 1
ranking, pagination, empty/loading states) · product detail with redirect click-out ·
boards (create, save, rename, delete, reorder) · DMs/inbox (with report, block and
content filtering) · public profiles · following · social feed · push notifications
(DMs, new followers, price-drop alerts) · settings with in-app account deletion · event
logging · crash reporting · curated catalog with scheduled refresh and dead-link checks.

**Deferred (v1.1+):** board sharing and collaborators · brand-facing pages (for-brands,
brand review, inquiries) · search.
<!-- Draft until "Freeze v1.0 scope" (#8) closes. -->

## Design system (locked)
All UI work follows docs/design-spec.md.
Tokens live in `mobile/src/lib/theme.ts`. Use them; never hard-code values.
- Colors: bg `#FFF8F0`, text/ink `#0D1035`. Coral `accent` is for primary actions only,
  chartreuse `accentLime` for active/selected states, sky `accentBlue` for informational elements.
- Type: Mulish only, using the named `Typography` styles (displayXl, display, headline,
  cardTitle, body, caption, subhead, label, price).
- `Radius`, `Spacing` (4/6/8/12/18/28), `Shadows` (card, elevated), and `Animation`
  (140/240/360 ms, plus the spring).

## Quality bar
The app should feel like a serious, native iOS app. Follow Apple's platform conventions
for navigation, gestures, sheets, haptics and safe areas. No generic layouts or
template-looking screens: every screen should feel editorial and deliberate, with
imagery leading. If a screen doesn't meet this bar, it isn't done.

## Working rules
- Work on one issue per session.
- Read the issue with `gh issue view <N>` before starting.
- Name the branch `<N>-<slug>`, for example `24-sign-in-with-apple`.
- Every PR description includes `Closes #N`.
- Anything out of scope becomes a new issue labeled `v1.1`. Never code it.
