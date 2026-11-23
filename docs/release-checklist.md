# Commercial Release Checklist

## Product

- [ ] App name is final and trademark/domain/app-store search is complete.
- [ ] Legal entity, support email, privacy contact, and refund policy are final.
- [ ] Google Play is the first public store target; iOS remains build-ready.

## Content

- [ ] Current *Discover Canada* edition and official URLs have been rechecked.
- [ ] Every production lesson has an official citation.
- [ ] Every production question has an official citation and an editorially reviewed explanation.
- [ ] No raw guide paragraph/excerpt is present in runtime content.
- [ ] No unlicensed third-party audio or artwork is bundled.
- [ ] Every inherited question has a clear provenance and commercial-use decision.
- [ ] All 13 province/territory filters have been tested.
- [ ] English/French parity issues are resolved.
- [ ] Editorial team has completed the human gate for the full question bank.

## Free/premium

- [ ] Free chapters/questions are accessible without purchase.
- [ ] Locked content cannot be opened through normal navigation.
- [ ] Premium unlock opens all intended lessons, questions, review queues, and exams.
- [ ] Purchase is one-time/non-consumable.
- [ ] Restore purchase works.
- [ ] Reinstall + restore has been tested.
- [ ] Offline use after entitlement has been tested.
- [ ] Premium cache behavior is acceptable for the no-backend product.

## Exam behavior

- [ ] Mock exam uses 20 questions.
- [ ] Timer uses 45 minutes.
- [ ] Passing mark is 15/20.
- [ ] True/false questions render correctly.
- [ ] Results, review, and progress work after interruption/reopen.
- [ ] Selected province/territory filters regional questions.
- [ ] No UI claims that IRCC runs a separate provincial/territorial exam.

## Privacy / permissions

- [ ] No account creation.
- [ ] No analytics SDK.
- [ ] No advertising SDK.
- [ ] No remote content service.
- [ ] Notifications are optional and local.
- [ ] Android permission set is minimal.
- [ ] Privacy policy is hosted at a public HTTPS URL.
- [ ] Google Play Data Safety form matches the final implementation.

## Google Play

- [ ] Create one-time in-app product: `com.canamastery.premium_lifetime`.
- [ ] Product price/country availability configured.
- [ ] Internal/closed testing completed.
- [ ] Signed Android App Bundle or required release artifact is configured.
- [ ] Target API requirement is satisfied by the chosen Expo/Android toolchain.
- [ ] Store listing, screenshots, icon, privacy URL, and support details are complete.
- [ ] Content rating questionnaire is complete.
- [ ] Data Safety questionnaire is complete.
- [ ] Purchase and restore tested with a test account.

## Apple later

- [ ] Use the same entitlement semantics as a non-consumable one-time purchase.
- [ ] Configure matching StoreKit product id.
- [ ] Complete App Store privacy details.
- [ ] Publish privacy policy and support URLs.
- [ ] Test restore purchase on a clean iOS install.

## Technical release gates

```bash
npm run validate:content
npm run typecheck
npm run lint
npm test
```

Then build and install a release artifact on a physical device and run the manual regression suite.
