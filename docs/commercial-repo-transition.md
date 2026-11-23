# Commercial Repository Transition

The commercial branch was prepared from the supplied `CitizenshipExam` repository.

## Critical history warning

Removing raw guide text, audio, or other files from the current working tree does **not** remove those bytes from existing Git commits. A public commercial repository should therefore not simply be created by pushing this branch onto the old repository if the old history contains material that should not be redistributed.

## Recommended publication path

1. Finish the editorial/legal review of all content and third-party assets.
2. Create a new private commercial repository for CanaMastery.
3. Copy the cleaned working tree into that repository without importing the old Git history.
4. Make the first commit contain only the clean commercial tree.
5. Add branch protections and CI.
6. Keep the legacy repository private or unchanged as a development/reference repository.
7. Run a repository-wide secret scan and a search for raw guide/audio/assets before publishing anything publicly.

## Why this matters

A clean first commit gives a much simpler assurance boundary than trying to prove that every historic commit is safe. If the old repository must be retained publicly, consult legal counsel before deciding which history can remain visible.
