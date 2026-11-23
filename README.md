# CanaMastery

**Canadian Citizenship Test Prep** — an offline-first educational app for preparing for the Canadian citizenship test.

CanaMastery is built from the existing `CitizenshipExam` Expo/React Native project, but the commercial branch is intentionally separated from the old public product identity and from raw source materials.

## Product direction

- English and French from the first commercial release.
- One-time premium unlock; no subscription.
- A small free learning area with its related questions.
- Premium unlock adds the remaining learning content, practice and mock exams.
- Official-exam-style mock test: 20 questions, 45 minutes, 15/20 to pass.
- User selects one of Canada's 10 provinces or 3 territories during onboarding.
- Regional questions are automatically filtered to the selected jurisdiction. This is a personalization feature, **not** a claim that IRCC administers a separate provincial/territorial exam.
- A dedicated **Your province or territory** learning section provides the regional content without introducing a separate “province mode”.
- No account, backend, advertising, analytics, or remote content service.
- Progress, settings, review data, and premium state are stored locally.
- Android is the first store target; the architecture and iOS bundle identifier are kept ready for Apple distribution.

## Content policy

The app uses the currently published Government of Canada *Discover Canada* material as the factual study source. The app does **not** ship raw guide paragraphs or guide excerpts.

Production content is authored as original explanations/questions and linked to the official source using citation metadata. A citation can identify the official title, chapter/section, URL, and content verification date.

The current release candidate includes content migrated from the supplied repositories. This does **not** constitute a legal clearance of every inherited question or asset. Before public commercial release, the editorial/legal review must confirm that every shipped question, illustration, icon, and other third-party asset has a usable license or is original to CanaMastery.

The guide can contain information that is no longer current in the real world. For test-preparation content, the guide edition is treated as the source of truth unless the guide itself is updated.

## Current content snapshot

Generated production bundle (2026-11-23):

- 11 chapters
- 95 lessons
- 1,151 questions
- 46 exams (1 free sample + premium exams)
- 67 English glossary terms
- 13 selectable jurisdictions (10 provinces + 3 territories)
- 150 regional questions tagged to jurisdictions
- 3 free chapters
- 223 free questions / 928 premium questions

The French glossary currently contains 66 terms; content parity must be reviewed during final editorial QA.

## Content protection

The runtime content is not stored as a plain JSON dataset. The build pipeline packs the prepared content into generated TypeScript payloads using a rotating XOR transform and base64 encoding.

This is **obfuscation**, not DRM. An offline application must eventually make its content available to the device, so no purely local mechanism can make extraction impossible. The objective is to prevent casual dataset extraction and raise the cost of automated scraping/reverse engineering.

Raw guide/source JSON and copied study-guide text must remain outside the public repository. The packer accepts a private prepared content directory through `CONTENT_JSON_DIR` and only the packed runtime output is committed.

## Purchase model

Google Play / Apple product id:

`com.canamastery.premium_lifetime`

The app uses a non-consumable/lifetime-style one-time entitlement. There is no custom backend receipt-verification service in this version. Store purchase state is restored through the native store and cached locally with SecureStore. This choice must be re-evaluated if fraud resistance or cross-device entitlement syncing becomes a priority.

## Development

```bash
npm install
npm run validate:content
npm run typecheck
npm run lint
npm test
npx expo start
```

The CI workflow also builds a standalone Android release APK after tests pass.

## Building the content bundle

A private prepared content directory is required:

```bash
CONTENT_JSON_DIR=/path/to/private-content npm run build:content
```

The directory must contain:

- `content.en.json`
- `content.fr.json`

The JSON must already contain original educational wording, citations, access flags, and regional jurisdiction tags. The public repository must never be used as the source of raw guide text.

## Google Play release notes

Google Play publication requires the normal store compliance work in addition to code quality, including a public privacy policy URL, completed Data Safety declarations, signed release artifacts, product configuration for the premium entitlement, and testing of purchase/restore flows.

See:

- `docs/release-checklist.md`
- `docs/store-listing.md`
- `docs/privacy-policy.md`
- `docs/terms.md`
- `docs/content-qa.md`
- `docs/commercial-repo-transition.md`

## Important repository-history warning

This branch was created from an existing project whose history may contain raw guide text, audio, or other third-party material. **Deleting files from the working tree does not erase them from Git history.** Before making a commercial repository public, create a clean commercial repository/history or rewrite the history and verify that no prohibited source material remains in reachable commits.

## Official source

CanaMastery is not affiliated with, endorsed by, or sponsored by the Government of Canada or IRCC.
