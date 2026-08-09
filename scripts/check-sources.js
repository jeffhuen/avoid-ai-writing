#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const registryPath = path.join(__dirname, '..', 'provenance', 'sources.json');
const allowedStatuses = new Set(['adopted', 'adapted', 'covered', 'deferred', 'rejected', 'watch']);

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
  console.log(`provenance registry valid: ${registry.sources.length} sources, ${registry.decisions.length} decisions`);
  if (process.argv.includes('--remote')) await checkRemote(registry);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { validateRegistry };
