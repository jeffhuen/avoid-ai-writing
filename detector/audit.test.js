const assert = require('node:assert/strict');
const { auditText } = require('./audit.js');

const profile = {
  schemaVersion: 1,
  name: 'Audit fixture',
  analyzer: {
    purpose: 'editorial',
    sourceMode: 'rendered-markdown',
    protected: { blockquotes: 'all', headings: true, inlineQuotes: true, tables: true, code: true },
  },
  hardRules: [
    { id: 'acknowledgment-loop', pattern: '\\bboth objections land\\b', message: 'State the ruling without staged agreement.' },
    { id: 'satisfying-part', pattern: "\\bhere(?: is|[’']s) the satisfying part\\b", message: 'Delete narrated satisfaction.' },
    { id: 'internet-vernacular', pattern: '\\b(?:receipts|rentable)\\b', message: 'Use the concrete noun.' },
    { id: 'em-dash', pattern: '—', message: 'Use project punctuation.' },
  ],
};

const protectedText = [
  '---',
  'title: Both Objections Land',
  '---',
  '<!-- Here is the satisfying part. -->',
  '# This Is What You Voted For',
  '> Both objections land. Here is the satisfying part.',
  'The witness said, "Both objections land, and here is the satisfying part."',
  '| Phrase | Note |',
  '| --- | --- |',
  '| Both objections land | Quoted source |',
  'The editor checked the tape before changing the published account.',
].join('\n');

const protectedResult = auditText(protectedText, profile);
assert.equal(protectedResult.hard.length, 0);
assert.equal(protectedResult.stats.maskedFrontmatter, 1);
assert.equal(protectedResult.stats.maskedHtmlComments, 1);
assert.equal(protectedResult.stats.maskedHeadings, 1);
assert.equal(protectedResult.stats.quotedLines, 1);
assert.equal(protectedResult.stats.maskedInlineQuotes, 1);
assert.equal(protectedResult.stats.maskedTables, 3);

const exposedResult = auditText([
  'Both objections land. Here is the satisfying part.',
  'The notes include receipts and describe the claim as rentable.',
  'The editor used an em dash — despite the project rule.',
].join('\n'), profile);
const hardIds = new Set(exposedResult.hard.map((finding) => finding.rule));
assert.ok(hardIds.has('acknowledgment-loop'));
assert.ok(hardIds.has('satisfying-part'));
assert.ok(hardIds.has('internet-vernacular'));
assert.ok(hardIds.has('em-dash'));
assert.equal(exposedResult.generic.every((finding) => finding.kind === 'generic'), true);

const headingRuleProfile = {
  ...profile,
  hardRules: [{ id: 'heading-punctuation', pattern: '—', message: 'No em dash.', protected: { headings: false } }],
};
const headingResult = auditText('# A Protected Title — With Forbidden Punctuation\n\nThe body remains plain.', headingRuleProfile);
assert.equal(headingResult.hard.length, 1);
assert.equal(headingResult.generic.some((finding) => finding.rule === 'title-case-header'), false);

const noGlobalFlagProfile = {
  ...profile,
  hardRules: [{ id: 'custom-flags', pattern: 'forbidden', flags: 'i', message: 'Remove it.' }],
};
assert.equal(auditText('Forbidden once and forbidden twice.', noGlobalFlagProfile).hard.length, 2);

console.log('Editorial audit fixtures passed.');
