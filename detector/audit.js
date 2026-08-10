#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const AIDetector = require('./patterns.js');

const PROSE_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.rst', '.adoc']);

function ruleRegex(rule) {
  const flags = rule.flags || 'imu';
  return new RegExp(rule.pattern, flags.includes('g') ? flags : `${flags}g`);
}

function loadProfile(profilePath) {
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  if (profile.schemaVersion !== 1) throw new Error('profile schemaVersion must be 1');
  if (!profile.name) throw new Error('profile requires a name');
  for (const group of ['hardRules', 'advisoryRules']) {
    if (profile[group] !== undefined && !Array.isArray(profile[group])) throw new Error(`${group} must be an array`);
    const ids = new Set();
    for (const rule of profile[group] || []) {
      if (!rule.id || !rule.pattern || !rule.message) throw new Error(`${group} entries require id, pattern, and message`);
      if (ids.has(rule.id)) throw new Error(`duplicate ${group} id: ${rule.id}`);
      ids.add(rule.id);
      ruleRegex(rule);
    }
  }
  return profile;
}

function collectFiles(inputs) {
  const files = [];
  const visit = (target) => {
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(target).sort()) visit(path.join(target, name));
    } else if (PROSE_EXTENSIONS.has(path.extname(target).toLowerCase())) {
      files.push(target);
    }
  };
  for (const input of inputs) visit(path.resolve(input));
  return files;
}

function location(text, index) {
  const before = text.slice(0, Math.max(0, index));
  const lines = before.split(/\r?\n/);
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

function matchRules(originalText, preparedText, rules, kind, analyzer) {
  const findings = [];
  for (const rule of rules || []) {
    const text = rule.protected
      ? AIDetector.prepareText(originalText, { ...analyzer, protected: { ...(analyzer.protected || {}), ...rule.protected } }).text
      : preparedText;
    const regex = ruleRegex(rule);
    let match;
    while ((match = regex.exec(text)) !== null) {
      findings.push({ kind, rule: rule.id, text: match[0], message: rule.message, index: match.index, ...location(text, match.index) });
      if (!match[0]) regex.lastIndex += 1;
    }
  }
  return findings;
}

function auditText(text, profile) {
  const analyzer = {
    purpose: 'editorial',
    sourceMode: 'rendered-markdown',
    protected: { blockquotes: 'all', headings: true, inlineQuotes: true, tables: true, code: true },
    ...(profile.analyzer || {}),
  };
  const prepared = AIDetector.prepareText(text, analyzer);
  const hard = matchRules(text, prepared.text, profile.hardRules, 'hard', analyzer);
  const advisory = matchRules(text, prepared.text, profile.advisoryRules, 'advisory', analyzer);
  const generic = profile.genericPatterns === 'off' ? [] : AIDetector.analyzeText(text, analyzer).issues.map((issue) => {
    const index = typeof issue.index === 'number' ? issue.index : prepared.text.toLowerCase().indexOf((issue.text || '').toLowerCase());
    return { kind: 'generic', rule: issue.type, text: issue.text, message: issue.suggestion, index, ...location(text, index) };
  });
  return { hard, advisory, generic, stats: prepared.stats };
}

function auditFile(file, profile) {
  return { file, ...auditText(fs.readFileSync(file, 'utf8'), profile) };
}

function parseArgs(argv) {
  let profilePath;
  let json = false;
  let check = false;
  let hardOnly = false;
  const inputs = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--profile') profilePath = argv[++i];
    else if (arg === '--json') json = true;
    else if (arg === '--check') check = true;
    else if (arg === '--hard-only') hardOnly = true;
    else if (arg.startsWith('--')) throw new Error(`unknown option: ${arg}`);
    else inputs.push(arg);
  }
  if (!profilePath || inputs.length === 0) throw new Error('usage: audit.js --profile <profile.json> [--check] [--hard-only] [--json] <file-or-directory>...');
  return { profilePath: path.resolve(profilePath), inputs, json, check, hardOnly };
}

function printResults(results, profile) {
  console.log(`Editorial profile: ${profile.name}`);
  for (const result of results) {
    for (const finding of [...result.hard, ...result.advisory, ...result.generic]) {
      const detail = finding.text ? `: ${JSON.stringify(finding.text)}` : '';
      console.log(`${result.file}:${finding.line}:${finding.column} [${finding.kind}/${finding.rule}] ${finding.message || ''}${detail}`.trim());
    }
  }
  const counts = results.reduce((sum, result) => ({
    hard: sum.hard + result.hard.length,
    advisory: sum.advisory + result.advisory.length,
    generic: sum.generic + result.generic.length,
  }), { hard: 0, advisory: 0, generic: 0 });
  console.log(`Summary: ${counts.hard} hard, ${counts.advisory} project advisory, ${counts.generic} generic suggestions across ${results.length} files.`);
  console.log('Generic suggestions are unscored and never fail the check.');
  return counts;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const loadedProfile = loadProfile(args.profilePath);
  const profile = args.hardOnly ? { ...loadedProfile, genericPatterns: 'off', advisoryRules: [] } : loadedProfile;
  const results = collectFiles(args.inputs).map((file) => auditFile(file, profile));
  const hardCount = results.reduce((sum, result) => sum + result.hard.length, 0);
  if (args.json) console.log(JSON.stringify({ profile: profile.name, results }, null, 2));
  else printResults(results, profile);
  if (args.check && hardCount) process.exitCode = 1;
  return { profile, results, hardCount };
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}

module.exports = { auditText, auditFile, collectFiles, loadProfile, main };
