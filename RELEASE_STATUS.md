# CanaMastery release status

This archive is a release-candidate source tree for manual upload to the CanaMastery GitHub repository.

## Content
- 1,332 source question records processed from the supplied CitizenshipExam corpus.
- 696 unique rewritten runtime questions after 636 duplicate removals.
- English and French question stems are rewritten independently.
- Rewrite audit: maximum EN similarity 85.71%; maximum FR similarity 87.18%; zero questions at or above 90%.
- 85 lessons, 14 chapters, 45 exams.
- 148 free questions, 548 premium questions.
- 52 regional questions across all 13 provinces/territories.
- No raw source question text is included in the runtime bundle.

## App scope
- Offline-first.
- No account, backend, advertising, or analytics.
- Android first; iOS bundle configuration retained.
- English and French only.
- One-time premium unlock through platform billing.
- Province/territory selection personalizes regional questions; it is not presented as a separate official exam mode.

## Important release gates still requiring external validation
- Human editorial/legal approval of all final questions and assets.
- Real Google Play Billing purchase/restore test.
- Signed Android production AAB/Play Console release configuration.
- Final privacy-policy URL, store metadata, screenshots, and regulatory declarations.
- CI run must pass dependency install, content validation, i18n validation, typecheck, lint, tests, and Android APK/AAB build after the manual GitHub upload.
