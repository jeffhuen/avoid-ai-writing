#!/usr/bin/env bash
# Regenerate the plugin's bundled skill from the canonical root SKILL.md.
# Root SKILL.md is the single source of truth; the plugin copy is generated.
# Run this after editing SKILL.md. CI fails if the copy is out of sync.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$repo_root/SKILL.md"
dest="$repo_root/plugins/avoid-ai-writing/skills/avoid-ai-writing/SKILL.md"
openai_src="$repo_root/agents/openai.yaml"
openai_dest="$repo_root/plugins/avoid-ai-writing/skills/avoid-ai-writing/agents/openai.yaml"

cp "$src" "$dest"
mkdir -p "$(dirname "$openai_dest")"
cp "$openai_src" "$openai_dest"

# Keep plugin.json's version in lockstep with the SKILL.md frontmatter version.
# Read the version only from the first YAML frontmatter block, and strip any CR
# so a CRLF checkout can't forge a mismatch on visually-identical strings.
skill_version="$(sed -n '/^---[[:space:]]*$/,/^---[[:space:]]*$/ s/^[[:space:]]*version:[[:space:]]*//p' "$src" | head -n1 | tr -d '\r\"')"
if [ -z "$skill_version" ]; then
  echo "could not parse 'version:' from SKILL.md frontmatter" >&2
  exit 1
fi
manifest_version() {
  python3 - "$1" <<'PY'
import json
import sys

path = sys.argv[1]
try:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
except FileNotFoundError:
    print(f"Missing plugin manifest: {path}", file=sys.stderr)
    sys.exit(1)
except json.JSONDecodeError as e:
    print(f"Invalid JSON in plugin manifest: {path}: {e}", file=sys.stderr)
    sys.exit(1)

version = data.get("version")
if not isinstance(version, str) or not version:
    print(f'Invalid or missing "version" in plugin manifest: {path}', file=sys.stderr)
    sys.exit(1)

print(version)
PY
}

claude_version="$(manifest_version "$repo_root/plugins/avoid-ai-writing/.claude-plugin/plugin.json")"
codex_version="$(manifest_version "$repo_root/plugins/avoid-ai-writing/.codex-plugin/plugin.json")"
codex_base="${codex_version%%+*}"

if [ "$skill_version" != "$claude_version" ] || [ "$skill_version" != "$codex_base" ]; then
  echo "version mismatch: SKILL.md=$skill_version Claude=$claude_version Codex=$codex_version" >&2
  echo "Update both plugin manifest versions to match SKILL.md frontmatter." >&2
  exit 1
fi

echo "synced: plugin skill metadata + versions ($skill_version)"
