# Commercial Content Authoring Workflow

## Inputs

- Current official *Discover Canada* source.
- Official IRCC citizenship-test format requirements.
- Existing internal fact/question inventory.

## Transformation

`official source -> factual claims -> original teaching notes -> original lesson summary -> original questions -> citations -> validation -> editorial approval -> packed runtime bundle`

## Non-goals

Do not build a pipeline that mechanically paraphrases complete source paragraphs and publishes the result without editorial review.

Do not bundle raw guide files for runtime lookup.

Do not use external “current facts” to silently override the selected guide edition.

## Required metadata

Every production lesson should carry its source citation. Every question should carry its source citation and access state. Regional questions should carry the applicable jurisdiction ids.

## Publishing gate

Only content that passes automated validation **and** human editorial approval may be promoted to the release bundle.


## Rewrite and deduplication

The production generator starts from the supplied CitizenshipExam question corpus, removes exact/near duplicates using a 90% similarity gate, then rewrites the retained question stems independently in English and French. Duplicate source records that collapse to one question retain the lesson associations needed for navigation and practice.
