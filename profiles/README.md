# Editorial profiles

A profile makes the project, not the generic catalog, the authority. Pass it to
`detector/audit.js` with `--profile`.

```json
{
  "schemaVersion": 1,
  "name": "House voice",
  "genericPatterns": "advisory",
  "analyzer": {
    "purpose": "editorial",
    "sourceMode": "rendered-markdown",
    "protected": {
      "blockquotes": "all",
      "headings": true,
      "inlineQuotes": true,
      "tables": true,
      "code": true
    },
    "ignoreTypes": ["title-case-header"]
  },
  "hardRules": [
    { "id": "forbidden-mark", "pattern": "—", "message": "Rewrite the junction." }
  ],
  "advisoryRules": [],
  "guidance": {
    "positiveCraft": ["Preserve scene and rhythm."]
  }
}
```

Patterns are JavaScript regular-expression source strings. Flags default to
`gimu`. A rule may set `flags` or override part of the protected-material map.
For example, `"protected": { "headings": false }` lets one hard punctuation
rule inspect headings while generic title-case analysis remains masked.

Hard rules set the exit code under `--check`. Project advisories and generic
findings never do. Guidance is read by the editing agent; the deterministic
runner reports only rules it can verify without inventing judgment.
