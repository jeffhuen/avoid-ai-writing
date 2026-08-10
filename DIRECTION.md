# Fork direction

This fork treats AI-associated writing patterns as editorial evidence, not an
authorship verdict. Its purpose is to help a writer preserve intent, voice,
genre, and project rules while removing habits that make prose generic or
mechanical.

The upstream project remains the technical foundation. This fork keeps an
`upstream` Git remote and will take upstream fixes selectively. It will not
mirror upstream releases automatically.

## Why the fork exists

The upstream catalog is broad and useful, but a universal scan cannot know
which text reaches a reader, which rules belong to a genre, or which habits are
part of an author's voice. A manuscript repository adds more distinctions:
frontmatter is metadata, HTML comments are working notes, quotations retain the
source's language, and narrative craft cannot be reduced to the shortest
possible wording.

This fork therefore adds three layers:

1. Source-aware analysis separates rendered prose from source-only material.
2. Rule provenance records where guidance came from, how it was adapted, and
   why it belongs here.
3. Project profiles carry positive voice and craft rules, file scopes,
   protected material, exact hard rules, and advisory checks.

The third layer lets this skill audit prose produced under narrower voice skills
such as `plain-voice` without pretending to supply that voice. A profile tells
the checker what to preserve. It does not make the checker a first-draft writer.

## Rule admission

A new rule needs all four:

- a named source or a documented local failure;
- a scope statement that distinguishes general prose from platform-specific
  behavior;
- at least one example that must fire and one that must not;
- a reason the rule improves writing or preserves voice.

Wikipedia's AI-cleanup pages are living research sources. They describe
patterns seen on Wikipedia and warn that no single sign proves AI authorship.
Their revisions enter the provenance registry as review prompts. A new page
revision never changes detector behavior by itself.

`blader/humanizer` is a comparative implementation. Its strongest ideas are
source visibility, voice calibration, preservation of information, and the
warning that sterile prose is not a successful rewrite. This fork will adopt
those ideas when they add something the upstream skill does not already cover.
It will not copy rules merely to enlarge the catalog.

## Non-goals

- Claiming that a score identifies who wrote a passage.
- Using the inherited composite score as a publication gate. On the maintained
  corpus, paragraph-level ROC-AUC is 0.502, which does not separate the classes.
- Making every genre sound casual, personal, or irregular.
- Adding first person, biography, vulnerability, or opinion that the writer did
  not supply.
- Copying Wikipedia prose into this MIT repository. Rules are independently
  worded and linked to pinned source revisions.
- Encoding unpublished manuscript passages as public fixtures. Project-specific
  samples stay with the project.

## Maintenance

- `origin` is this fork. `upstream` is Conor Bronsdon's repository.
- `SKILL.md` remains the portable product and source of truth for its plugin
  copies. The Claude and Codex packages bundle the same generated file.
- `provenance/sources.json` records source snapshots and adoption decisions.
- `provenance/rules.json` maps every catalog rule to a source section and records
  selected adaptations from Wikipedia and `blader/humanizer`.
- `detector/audit.js` runs a project profile. Hard project rules can fail a
  check; generic pattern suggestions are unscored and cannot.
- `npm test` validates the detector and the local provenance registry.
- `npm run sources:check:remote` reports when a tracked Wikipedia page has moved
  beyond the reviewed revision. It never updates rules.
- The inherited npm publication workflow is disabled in this fork. Publication
  resumes only after the package has its own name, ownership, and release
  policy.

## Decisions

### 2026-08-09: independent direction

Keep the upstream history and attribution, but maintain this repository for
source-aware, project-aware editorial work. Compatibility is useful. Lockstep
release parity is not.

### 2026-08-09: rendered Markdown is an explicit source mode

Default analysis remains plain text for compatibility. A caller may request
`rendered-markdown`, which masks YAML frontmatter and HTML comments without
moving later character offsets. This fixes false positives caused by
architecture notes and other material a reader never sees.

### 2026-08-09: sources prompt review rather than automatic rule growth

Wikipedia and comparative humanizer projects belong in a visible registry.
Each resulting rule still needs an independent editorial judgment, a stated
scope, and regression coverage.

### 2026-08-09: classification and editorial work are separate products

The inherited classifier remains available for compatibility and research.
Project profiles use editorial purpose, which returns no authorship score or
classification. Generic findings remain suggestions. Only rules named by the
project can fail its check.

### 2026-08-09: protect material the writer does not own

Editorial profiles mask frontmatter, HTML comments, headings, blockquotes,
inline quotations, tables, and code before scanning. The mask preserves source
offsets. A project may narrow the protection when its genre requires it.

### 2026-08-09: one skill, native packages for Claude and Codex

The portable `SKILL.md` remains the product. Native manifests and marketplace
files make the same generated skill installable and updatable in Claude and
Codex. Platform packaging may differ. Editorial behavior may not drift between
the packages.

### 2026-08-09: checking follows drafting

This skill starts from prose. Detect mode flags it; rewrite and edit modes revise
it. None of those modes replaces a project's drafting or authorial-voice skill.
A project profile may encode positive craft so the audit can protect it, but the
writer remains upstream of the checker.
