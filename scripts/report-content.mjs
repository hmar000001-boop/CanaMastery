#!/usr/bin/env node
import fs from 'node:fs';
const m = JSON.parse(fs.readFileSync('src/content/generated/manifest.json', 'utf8'));
const msg = `Production content: ${m.chapters} chapters, ${m.lessons} lessons, ${m.questions} questions (${m.freeQuestions} free / ${m.premiumQuestions} premium), ${m.exams} exams, ${m.regionalQuestions} regional questions across 13 jurisdictions. Raw guide text and third-party audio are not bundled.`;
console.log(msg);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `summary=${msg}\n`);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${msg}\n`);
