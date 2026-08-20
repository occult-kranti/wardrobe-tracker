/**
 * THE ONE JOURNEY OUT — the relay call, over a fake fetch.
 *
 * What is pinned here is the request the phone actually makes and the way it
 * answers when the relay cannot help:
 *
 *  - THE SHAPE IS THE PROVIDER'S OWN. An Anthropic Messages body with the
 *    image block first and the text block second, `model` claude-fable-5 and
 *    `max_tokens` 16000 — the numbers src/lib/anthropic.ts states and the
 *    reasons it gives (Fable always thinks, and its thinking spends the same
 *    budget as the answer).
 *  - NO KEY LEAVES THIS PHONE, because there is none to leave. The request
 *    carries no x-api-key, no authorization, and no bearer of any kind.
 *    scripts/check-native-storage.mjs polices the storage half of that rule;
 *    this is the wire half.
 *  - THE PARSER IS THE SHARED ONE. The fixture answer below is fed through
 *    @almari/shared/intake's readIntake, never a local reader, so a
 *    photograph read on the phone meets exactly the strictness a handoff file
 *    pasted into the browser meets — including the guarantee that a row
 *    describing a BODY is struck on the way in.
 *  - A 503 IS CALM. "The relay has no key yet" is the house's own failure,
 *    said as the house's own failure, with the offer that everything else
 *    still works.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
  AI_DISCLOSURE,
  explainRelay,
  MAX_TOKENS,
  MODEL_LABEL,
  readPhotograph,
  readPieceFromPhoto,
  RELAY_ENDPOINT,
  RELAY_MODEL,
  SEND_QUALITY,
} from '../src/lib/intakeClient';

type FetchArgs = [string, { method: string; headers: Record<string, string>; body: string }];

let calls: FetchArgs[] = [];

/** One canned relay answer, in the Anthropic Messages response shape. */
function answering(text: string, status = 200, raw?: string) {
  return jest.fn(async (...args: unknown[]) => {
    calls.push(args as FetchArgs);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({
        content: [
          { type: 'thinking', thinking: 'this part is left on the floor' },
          { type: 'text', text },
        ],
      }),
      text: async () => raw ?? text,
    };
  });
}

/** A handoff file exactly as docs/23 specifies one, for one photographed piece. */
const ONE_PIECE = JSON.stringify({
  toileIntake: 1,
  pieces: [
    {
      ref: 'p1',
      name: 'Blue oxford shirt',
      category: 'tops',
      color: '#2E4A6B',
      colorName: 'navy',
      description: 'A navy cotton oxford with a button-down collar.',
      season: ['spring', 'fall'],
      occasion: ['work'],
      brand: 'Ordinary Co',
      material: 'cotton',
      confidence: 0.9,
      uncertain: [],
      box: [0.1, 0.1, 0.8, 0.8],
      background: 'plain',
    },
  ],
});

const IMAGE = { base64: 'QUJDRA==', mediaType: 'image/jpeg' };

beforeEach(() => {
  calls = [];
});

describe('the request the phone actually makes', () => {
  test('one POST to the relay, in the Anthropic Messages shape', async () => {
    global.fetch = answering('hello') as unknown as typeof fetch;

    const { text, model } = await readPhotograph(IMAGE, 'READ THIS');

    expect(text).toBe('hello');
    expect(model).toBe('claude-fable-5');
    expect(calls).toHaveLength(1);

    const [url, init] = calls[0];
    expect(url).toBe(RELAY_ENDPOINT);
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body) as {
      model: string;
      max_tokens: number;
      messages: Array<{ role: string; content: Array<Record<string, unknown>> }>;
    };
    expect(body.model).toBe(RELAY_MODEL);
    expect(body.max_tokens).toBe(MAX_TOKENS);
    expect(body.max_tokens).toBe(16000);

    // Image first, prompt second — the order the web sends and the order a
    // vision model reads best.
    const content = body.messages[0].content;
    expect(body.messages[0].role).toBe('user');
    expect(content[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJDRA==' },
    });
    expect(content[1]).toEqual({ type: 'text', text: 'READ THIS' });
  });

  test('NOTHING resembling a key is sent — the app does not have one', async () => {
    global.fetch = answering('hello') as unknown as typeof fetch;
    await readPhotograph(IMAGE, 'READ THIS');

    const [, init] = calls[0];
    const names = Object.keys(init.headers).map(h => h.toLowerCase());
    expect(names).not.toContain('x-api-key');
    expect(names).not.toContain('authorization');
    expect(init.body).not.toMatch(/sk-ant-/);
    // and no forbidden parameters: Fable answers 400 to every one of these.
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.thinking).toBeUndefined();
    expect(body.temperature).toBeUndefined();
    expect(body.top_p).toBeUndefined();
    expect(body.top_k).toBeUndefined();
  });

  test('the reasoning block is left on the floor; only text is the answer', async () => {
    global.fetch = answering('the answer') as unknown as typeof fetch;
    const { text } = await readPhotograph(IMAGE, 'p');
    expect(text).toBe('the answer');
    expect(text).not.toContain('left on the floor');
  });

  test('a photograph too large to send is refused here, not by a 400 nobody can read', async () => {
    const called = jest.fn();
    global.fetch = called as unknown as typeof fetch;
    // 5MB of bytes is about 6.7M base64 characters.
    const huge = { base64: 'A'.repeat(7_000_000), mediaType: 'image/jpeg' };
    await expect(readPhotograph(huge, 'p')).rejects.toThrow(/too large to send/);
    expect(called).not.toHaveBeenCalled();
  });

  test('an empty photograph never reaches the wire', async () => {
    const called = jest.fn();
    global.fetch = called as unknown as typeof fetch;
    await expect(readPhotograph({ base64: '', mediaType: 'image/jpeg' }, 'p')).rejects.toThrow(
      'There was no photograph to read.',
    );
    expect(called).not.toHaveBeenCalled();
  });
});

describe('what goes wrong, said the way a person can act on', () => {
  test('a 503 with no key is the HOUSE’s failure, and says everything else still works', () => {
    const said = explainRelay(503, '{"error":"not configured"}');
    expect(said).toContain('whoever runs this house has not set one');
    expect(said).toContain('works without it');
    expect(said).not.toContain('!');
  });

  test('a refused relay key is not blamed on the person holding the phone', () => {
    expect(explainRelay(401, '')).toContain('that is the house’s to fix, not yours');
    expect(explainRelay(403, '')).toContain('not yours');
  });

  test('every other status names the model and says nothing was catalogued', () => {
    expect(explainRelay(429, '')).toContain(MODEL_LABEL);
    expect(explainRelay(500, '')).toContain('Nothing was catalogued');
    expect(explainRelay(400, 'billing: no credit')).toContain('no credit left');
    expect(explainRelay(418, '')).toContain('(418)');
  });

  test('a 503 travels all the way out of readPhotograph as that sentence', async () => {
    global.fetch = answering('', 503, 'not configured') as unknown as typeof fetch;
    await expect(readPhotograph(IMAGE, 'p')).rejects.toThrow(/has no key yet/);
  });

  test('no network is a sentence about the network, and says the rest works offline', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(readPhotograph(IMAGE, 'p')).rejects.toThrow(/works offline/);
  });

  test('an answer with no text in it is not silently treated as an empty wardrobe', async () => {
    global.fetch = answering('') as unknown as typeof fetch;
    await expect(readPhotograph(IMAGE, 'p')).rejects.toThrow(/nothing readable/);
  });
});

describe('the parser is the shared one, not a copy', () => {
  test('a fixture answer becomes a draft with every field the form needs', async () => {
    global.fetch = answering(ONE_PIECE) as unknown as typeof fetch;

    const { draft, found, model } = await readPieceFromPhoto(IMAGE);

    expect(found).toBe(1);
    expect(model).toBe(RELAY_MODEL);
    expect(draft.name).toBe('Blue oxford shirt');
    expect(draft.category).toBe('tops');
    expect(draft.color).toBe('#2E4A6B');
    expect(draft.brand).toBe('Ordinary Co');
    expect(draft.season).toEqual(['spring', 'fall']);
    expect(draft.occasion).toEqual(['work']);
    expect(draft.description).toBe('A navy cotton oxford with a button-down collar.');
  });

  test('a model that wrapped its JSON in a fence is still read — readIntake strips it', async () => {
    global.fetch = answering('```json\n' + ONE_PIECE + '\n```') as unknown as typeof fetch;
    const { draft } = await readPieceFromPhoto(IMAGE);
    expect(draft.name).toBe('Blue oxford shirt');
  });

  test('a row that described a BODY is struck by the shared reader, and says it was', async () => {
    global.fetch = answering(
      JSON.stringify({
        toileIntake: 1,
        pieces: [
          {
            ref: 'p1',
            name: 'Slimming black dress',
            category: 'dresses',
            color: '#101010',
            description: 'A flattering black dress that hides the waist.',
            season: [],
            occasion: [],
            confidence: 0.8,
            uncertain: [],
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const { draft } = await readPieceFromPhoto(IMAGE);
    // The GUARANTEE, not the request: the shared reader's own struck-word list
    // (intake.ts ABOUT_A_BODY) is applied to whatever the model sent, and the
    // strike is recorded in `repairs` where the review surface can show it.
    // The prompt is the first line of defence for anything the list has not
    // met yet; this is the second, and it is the one that cannot be talked out
    // of doing its job.
    const said = `${draft.name} ${draft.description}`.toLowerCase();
    expect(said).not.toMatch(/slimming|flattering/);
    expect(draft.name).toBe('black dress');
    expect(draft.repairs.join(' ')).toMatch(/struck out; this record is about clothes/);
  });

  test('several pieces in one photograph: the clearest is taken and the count is told', async () => {
    global.fetch = answering(
      JSON.stringify({
        toileIntake: 1,
        pieces: [
          { ref: 'a', name: 'A blurred thing', category: 'tops', color: '#111111', description: 'x', season: [], occasion: [], confidence: 0.2, uncertain: [] },
          { ref: 'b', name: 'Black ankle boots', category: 'shoes', color: '#151515', description: 'y', season: [], occasion: [], confidence: 0.95, uncertain: [] },
        ],
      }),
    ) as unknown as typeof fetch;

    const { draft, found } = await readPieceFromPhoto(IMAGE);
    expect(found).toBe(2);
    expect(draft.name).toBe('Black ankle boots');
  });

  test('a photograph with nothing wearable in it says so rather than inventing a piece', async () => {
    global.fetch = answering(JSON.stringify({ toileIntake: 1, pieces: [] })) as unknown as typeof fetch;
    await expect(readPieceFromPhoto(IMAGE)).rejects.toThrow(/Nothing wearable/);
  });

  test('a broken file is the parser’s own error, handed on unchanged', async () => {
    global.fetch = answering('not json at all') as unknown as typeof fetch;
    await expect(readPieceFromPhoto(IMAGE)).rejects.toThrow(/valid JSON/);
  });
});

describe('the disclosure (docs/35 — name the model wherever a photograph is read)', () => {
  test('it names Claude Fable by Anthropic, and where the key is', () => {
    expect(AI_DISCLOSURE).toContain(MODEL_LABEL);
    expect(MODEL_LABEL).toBe('Claude Fable by Anthropic');
    expect(AI_DISCLOSURE).toContain('never on this device');
  });

  test('it promises the thing the code actually does: nothing saved until you add', () => {
    expect(AI_DISCLOSURE).toContain('Nothing is saved until you press add');
  });

  test('it obeys the copy law — no exclamation point', () => {
    expect(AI_DISCLOSURE).not.toContain('!');
  });
});

describe('the shrink discipline, kept where it can be kept', () => {
  test('read-bound picks ask for a re-encode rather than the raw camera file', () => {
    expect(SEND_QUALITY).toBeGreaterThan(0);
    expect(SEND_QUALITY).toBeLessThan(1);
  });
});
