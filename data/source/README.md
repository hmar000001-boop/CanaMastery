# Commercial content source boundary

The production app does not ship the raw study-guide text or third-party lesson corpus.

Content shipped in `src/content/generated/` is an original educational rewrite with citations to the official Government of Canada `Discover Canada` pages. The source URLs are retained as citation metadata; the guide text itself is not bundled.

A future content-authoring workflow should take the current official guide as factual source material, create original summaries/questions, validate them editorially, and then run the packer to produce the obfuscated runtime bundle.

Do not commit raw guide text, copied lesson paragraphs, third-party audio, or unlicensed artwork into this repository.
