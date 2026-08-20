/**
 * THE DRIFT GUARD on the mirrored prompt.
 *
 * src/lib/intakePrompt.ts is the source of truth for what a vision model is
 * asked; app/src/lib/intakeClient.ts holds a verbatim mirror, because the app
 * never imports a web file (docs/34 §2.8 — only packages/shared crosses).
 * A mirror without a guard is a fork with a polite comment on it, and this is
 * the guard: the web file is read off the disk and compared character for
 * character.
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS. The prompt is not prose — it is the
 * WRITTEN FORM OF THE CONTRACT that @almari/shared/intake's readIntake
 * enforces: the category ids, the "one JSON object" rule, the version number,
 * the ban on describing a person. Reword the web's copy and leave this one
 * alone and the two apps quietly ask for two different files while both claim
 * to speak intake version 1.
 *
 * Line endings are normalised because this repo is checked out on Windows and
 * git's autocrlf decides that, not the author. Nothing else is normalised: a
 * changed word, a changed id, a moved line all fail.
 *
 * Reading a web FILE from a test is not the app importing web code — nothing
 * here ships in the bundle. It is the audit that makes the mirroring legal.
 */
import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

import { INTAKE_PROMPT } from '../src/lib/intakeClient';

const WEB_PROMPT_FILE = join(__dirname, '..', '..', 'src', 'lib', 'intakePrompt.ts');

/** The template literal's contents, exactly as the web file declares them. */
function webPrompt(): string {
  const source = readFileSync(WEB_PROMPT_FILE, 'utf8');
  const match = source.match(/export const INTAKE_PROMPT = `([\s\S]*?)`;/);
  if (!match) {
    throw new Error(
      `No INTAKE_PROMPT template literal in ${WEB_PROMPT_FILE}. If the web moved it, this ` +
        'mirror has to move with it — that is what this guard is for.',
    );
  }
  return match[1];
}

const lf = (text: string) => text.replace(/\r\n/g, '\n');

describe('the mirrored prompt has not drifted from the web’s', () => {
  test('character for character, line endings aside', () => {
    expect(lf(INTAKE_PROMPT)).toBe(lf(webPrompt()));
  });

  test('the guard is looking at a real prompt, not an empty match', () => {
    // A guard that would pass against an empty string is not a guard.
    expect(INTAKE_PROMPT.length).toBeGreaterThan(4000);
    expect(lf(webPrompt()).length).toBe(lf(INTAKE_PROMPT).length);
  });
});

describe('the parts of the prompt the parser depends on are present', () => {
  test('it asks for one JSON object and no prose around it', () => {
    expect(INTAKE_PROMPT).toContain('Return ONLY a JSON object');
    expect(INTAKE_PROMPT).toContain('no markdown');
  });

  test('it names exactly the category ids @almari/shared/types declares', () => {
    for (const id of [
      'tops',
      'bottoms',
      'dresses',
      'layers',
      'outerwear',
      'shoes',
      'jewellery',
      'accessories',
    ]) {
      expect(INTAKE_PROMPT).toContain(id);
    }
  });

  test('it forbids describing a person, and forbids gendered wording', () => {
    expect(INTAKE_PROMPT).toContain('do not describe');
    expect(INTAKE_PROMPT).toMatch(/no gendered wording/i);
  });

  test('it obeys the house copy law itself — no exclamation point in the ask', () => {
    expect(INTAKE_PROMPT).not.toContain('!');
  });
});
