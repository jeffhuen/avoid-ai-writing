#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const registryPath = path.join(__dirname, '..', 'provenance', 'sources.json');
const rulesPath = path.join(__dirname, '..', 'provenance', 'rules.json');
const skillPath = path.join(__dirname, '..', 'SKILL.md');
const allowedStatuses = new Set(['adopted', 'adapted', 'covered', 'deferred', 'rejected', 'watch']);
const allowedRelationships = new Set(['inherited', 'adapted', 'scoped', 'rejected']);

function loadRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function validateRegistry(registry) {
  if (registry.schemaVersion !== 1) throw new Error('unsupported provenance schemaVersion');
  if (!Array.isArray(registry.sources) || registry.sources.length === 0) throw new Error('sources must be a non-empty array');
  if (!Array.isArray(registry.decisions)) throw new Error('decisions must be an array');

  const ids = new Set();
  for (const source of registry.sources) {
    for (const key of ['id', 'kind', 'title', 'url', 'revision', 'license', 'use']) {
      if (source[key] === undefined || source[key] === '') throw new Error(`source is missing ${key}: ${source.id || '<unknown>'}`);
    }
    if (ids.has(source.id)) throw new Error(`duplicate source id: ${source.id}`);
    ids.add(source.id);
  }

  const decisionIds = new Set();
  for (const decision of registry.decisions) {
    if (!decision.id || decisionIds.has(decision.id)) throw new Error(`invalid or duplicate decision id: ${decision.id || '<missing>'}`);
    if (!allowedStatuses.has(decision.status)) throw new Error(`invalid status for ${decision.id}: ${decision.status}`);
    if (!decision.reason) throw new Error(`decision is missing reason: ${decision.id}`);
    for (const sourceId of decision.sources || []) {
      if (!ids.has(sourceId)) throw new Error(`unknown source ${sourceId} in decision ${decision.id}`);
    }
    decisionIds.add(decision.id);
  }
}

function catalogHeadings(skill) {
  const start = skill.indexOf('## What to remove or fix');
  const end = skill.indexOf('\n## Severity tiers', start);
  if (start < 0 || end < 0) throw new Error('could not locate the SKILL.md rule catalog');
  return [...skill.slice(start, end).matchAll(/^### (.+)$/gm)]
    .map((match) => match[1])
    .filter((heading) => !heading.includes('(structure test)') && !heading.includes('(content test)') && heading !== 'When to rewrite from scratch vs. patch');
}

function validateRuleMap(ruleMap, registry, skill) {
  if (ruleMap.schemaVersion !== 1 || !Array.isArray(ruleMap.rules)) throw new Error('invalid provenance/rules.json schema');
  const sourceIds = new Set(registry.sources.map((source) => source.id));
  const expected = catalogHeadings(skill);
  const actual = ruleMap.rules.map((rule) => rule.heading);
  if (new Set(actual).size !== actual.length) throw new Error('duplicate rule heading in provenance/rules.json');
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`rule provenance drift: SKILL.md has ${expected.length} ordered categories, map has ${actual.length}`);

  const ruleIds = new Set();
  for (const rule of ruleMap.rules) {
    if (!rule.id || ruleIds.has(rule.id)) throw new Error(`invalid or duplicate rule id: ${rule.id || '<missing>'}`);
    if (!Array.isArray(rule.sources) || rule.sources.length === 0) throw new Error(`rule has no sources: ${rule.id}`);
    for (const source of rule.sources) {
      if (!sourceIds.has(source.sourceId)) throw new Error(`unknown source ${source.sourceId} in rule ${rule.id}`);
      if (!source.sourceSection) throw new Error(`missing sourceSection in rule ${rule.id}`);
      if (!allowedRelationships.has(source.relationship)) throw new Error(`invalid relationship in rule ${rule.id}: ${source.relationship}`);
    }
    ruleIds.add(rule.id);
  }

  for (const adaptation of ruleMap.adaptations || []) {
    if (!ruleIds.has(adaptation.ruleId)) throw new Error(`unknown adapted rule: ${adaptation.ruleId}`);
    if (!sourceIds.has(adaptation.sourceId)) throw new Error(`unknown source ${adaptation.sourceId} in adaptation ${adaptation.ruleId}`);
    if (!adaptation.sourceSection || !adaptation.rationale) throw new Error(`incomplete adaptation: ${adaptation.ruleId}`);
    if (!allowedRelationships.has(adaptation.relationship)) throw new Error(`invalid adaptation relationship: ${adaptation.relationship}`);
  }
}

async function checkRemote(registry) {
  let stale = 0;
  for (const source of registry.sources.filter((item) => item.remoteCheck?.type === 'mediawiki')) {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'revisions',
      rvprop: 'ids|timestamp',
      format: 'json',
      titles: source.remoteCheck.title,
    });
    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
    if (!response.ok) throw new Error(`remote check failed for ${source.id}: HTTP ${response.status}`);
    const body = await response.json();
    const page = Object.values(body.query?.pages || {})[0];
    const latest = page?.revisions?.[0]?.revid;
    if (!latest) throw new Error(`remote check returned no revision for ${source.id}`);
    if (latest !== source.revision) {
      stale += 1;
      console.error(`${source.id}: reviewed ${source.revision}, latest ${latest}`);
    } else {
      console.log(`${source.id}: current at ${latest}`);
    }
  }
  if (stale) throw new Error(`${stale} tracked source${stale === 1 ? '' : 's'} changed; review before updating the pinned revision`);
}

async function main() {
  const registry = loadRegistry();
  validateRegistry(registry);
  const ruleMap = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  validateRuleMap(ruleMap, registry, fs.readFileSync(skillPath, 'utf8'));
  console.log(`provenance registry valid: ${registry.sources.length} sources, ${registry.decisions.length} decisions, ${ruleMap.rules.length} catalog rules`);
  if (process.argv.includes('--remote')) await checkRemote(registry);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { catalogHeadings, validateRegistry, validateRuleMap };
