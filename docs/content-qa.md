# Content QA and Editorial Gate

## Source policy

The factual source for citizenship-test preparation is the currently published Government of Canada *Discover Canada* material used by IRCC. The app may retain source information even when the real world has changed, because the product follows the selected guide edition rather than silently replacing facts with web information.

The official test-format page is used for format rules such as 20 questions, 45 minutes, and 15/20 to pass.

## Production snapshot

Generated on 2026-11-23:

- 11 chapters
- 95 lessons
- 1,151 questions
- 46 exams
- 67 English glossary terms
- 66 French glossary terms
- 223 free questions
- 928 premium questions
- 150 regional questions
- 13 province/territory filters

## Regional policy

Canada has 10 provinces and 3 territories. The guide refers to the candidate's province or territory, including knowledge such as the capital of the province or territory.

CanaMastery therefore asks the learner to select one of 13 jurisdictions and uses that choice to filter regional questions. The product must never describe this as a separate official provincial/territorial exam mode.

## Question policy

Questions must be original educational formulations. They must not reproduce a guide paragraph or present copied guide prose as a question stem or answer explanation.

For each question we require:

1. a factual claim that can be traced to the source;
2. an original question formulation;
3. a clear correct answer;
4. plausible distractors when multiple-choice;
5. an explanation written in original wording;
6. a precise official citation;
7. an editorial review decision.

Questions sourced from the supplied legacy repositories require provenance review before commercial publication. Repository ownership or a local open-source license does not automatically clear third-party material embedded in that repository.

## Current content status

The current bundle is a migration/rebuild candidate. Automated transformations and structural checks have been performed, but this is **not equivalent to a human editorial review of all 1,151 questions**.

Before store publication, the editorial gate must inspect every question, especially:

- ambiguous or outdated facts;
- questions whose answer depends on wording from the guide;
- questions that may accidentally reveal copied source prose;
- true/false questions that were migrated from a source tag rather than semantically reviewed;
- regional tags;
- English/French parity;
- modern terminology for the Sovereign and institutions;
- duplicate or near-duplicate questions.

## Outdated guide information

The guide can contain older wording or historical references. The app should follow the guide for study facts unless the selected source edition itself is updated. Do not silently “correct” a guide fact using a newer news page.

Where a source page provides an explicit current update to a portion of the study material, the editorial decision and citation should be recorded rather than silently replacing the guide.

## No raw source excerpts

Production runtime content must not contain a `source.excerpt` field or equivalent copied paragraph from the guide. Source citations point to the official page instead.
