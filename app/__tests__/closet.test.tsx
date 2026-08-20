/**
 * The closet screen — tiles, the detail sheet, the add sheet.
 *
 * Mirrors the maths contracts the node suites hold: every figure on a tile
 * comes from @almari/shared/cost via shared/similarity's wearContext, so
 * the expected strings here are the same INR strings scripts/test-dates.mjs
 * pins for the formatters (₹, en-IN grouping, two decimals per wear) and
 * the CPW precedence scripts/test-migrate.mjs's corpus exercises (a
 * recorded 0 is 'free', never a per-wear figure; no wears is its own
 * answer). Rendered through the real router tree — provider, storage,
 * migrate-on-read included.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { ACCOUNTS_KEY, SESSION_KEY, storage, wardrobeKey } from '../src/lib/storage';

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: async () => undefined,
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: async () => true,
  hideAsync: async () => undefined,
}));

/* ---------- the phone's photograph machinery, stood in for ----------

   Both doubles are `mock`-prefixed so jest's hoist allows the factories to
   reach them. Neither is a stub of the app's own code: expo-image-picker and
   expo-file-system are the DEVICE, and the shapes here are the ones the SDK 57
   docs state — a PermissionResponse with `granted`, an ImagePickerResult with
   `{ canceled, assets }`, and the object filesystem API's File / Directory /
   Paths. Everything above them is the shipped code. */

const mockPicker = {
  camera: { granted: true, canAskAgain: true, status: 'granted' } as Record<string, unknown>,
  library: { granted: true, canAskAgain: true, status: 'granted' } as Record<string, unknown>,
  result: { canceled: true, assets: null } as { canceled: boolean; assets: Array<{ uri: string }> | null },
  /** What the app asked the phone for, in order — this is the permission law. */
  calls: [] as string[],
};

jest.mock('expo-image-picker', () => ({
  async requestCameraPermissionsAsync() {
    mockPicker.calls.push('request-camera');
    return mockPicker.camera;
  },
  async requestMediaLibraryPermissionsAsync() {
    mockPicker.calls.push('request-library');
    return mockPicker.library;
  },
  async launchCameraAsync() {
    mockPicker.calls.push('launch-camera');
    return mockPicker.result;
  },
  async launchImageLibraryAsync() {
    mockPicker.calls.push('launch-library');
    return mockPicker.result;
  },
}));

const mockDisk = { files: new Map<string, string>(), dirs: new Set<string>() };

jest.mock('expo-file-system', () => {
  const DOCUMENT = 'file:///documents/';
  const resolve = (args: unknown[]): string => {
    const [first, ...rest] = args;
    const base = typeof first === 'string' ? first : String((first as { uri: string }).uri);
    if (rest.length === 0) return base;
    const head = base.endsWith('/') ? base : `${base}/`;
    return head + rest.map(String).join('/');
  };
  class Directory {
    uri: string;
    constructor(...args: unknown[]) {
      const uri = resolve(args);
      this.uri = uri.endsWith('/') ? uri : `${uri}/`;
    }
    get exists() {
      return mockDisk.dirs.has(this.uri);
    }
    create() {
      mockDisk.dirs.add(this.uri);
    }
  }
  class File {
    uri: string;
    constructor(...args: unknown[]) {
      this.uri = resolve(args);
    }
    get exists() {
      return mockDisk.files.has(this.uri);
    }
    create() {
      if (!mockDisk.files.has(this.uri)) mockDisk.files.set(this.uri, '');
    }
    write(content: string) {
      mockDisk.files.set(this.uri, content);
    }
    async base64() {
      const v = mockDisk.files.get(this.uri);
      if (v === undefined) throw new Error('no such file');
      return v;
    }
    delete() {
      mockDisk.files.delete(this.uri);
    }
    async copy(destination: File) {
      const v = mockDisk.files.get(this.uri);
      if (v === undefined) throw new Error('no such file');
      mockDisk.files.set(destination.uri, v);
    }
  }
  return {
    Directory,
    File,
    Paths: { document: new Directory(DOCUMENT), cache: new Directory('file:///cache/') },
  };
});

/** Every request the app made to the relay, so the wire can be inspected. */
const mockRelayCalls: Array<[string, { headers: Record<string, string>; body: string }]> = [];

/** One canned relay answer, in the Anthropic Messages response shape. */
function mockRelay(text: string, status = 200) {
  return jest.fn(async (...args: unknown[]) => {
    mockRelayCalls.push(args as [string, { headers: Record<string, string>; body: string }]);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({ content: [{ type: 'text', text }] }),
      text: async () => text,
    };
  });
}

const DOC = JSON.stringify({
  schemaVersion: 8,
  items: [
    {
      id: 'i-oxford', name: 'The white oxford', category: 'tops', color: '#F4EFE2',
      season: [], occasion: ['work'], imageUrl: '', dateAdded: '2026-01-01',
      wearCount: 100, cost: 350, favorite: false, laundryStatus: 'clean',
    },
    {
      id: 'i-ring', name: 'The gifted ring', category: 'accessories', color: '#C9A227',
      season: [], occasion: [], imageUrl: '', dateAdded: '2026-01-25',
      wearCount: 9, cost: 0, favorite: false, laundryStatus: 'clean',
    },
    {
      id: 'i-linen', name: 'The good linen shirt', category: 'tops', color: '#D9C4A3',
      season: [], occasion: [], imageUrl: '', dateAdded: '2026-06-01',
      wearCount: 0, cost: 2600, favorite: false, laundryStatus: 'clean',
    },
  ],
  outfits: [], wearLogs: [], wishlist: [],
  circle: { profiles: [], groups: [], messages: [], loans: [] },
  events: [], furniture: [], photoEncoding: 'inline',
});

async function seed(doc: string | null) {
  await AsyncStorage.clear();
  mockRelayCalls.length = 0;
  if (doc === null) return;
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'acct-1' }));
  await storage.setItem(
    ACCOUNTS_KEY,
    JSON.stringify([
      { id: 'acct-1', name: 'Test wardrobe', handle: '@test', monogram: 'T', color: '#105F7D', createdAt: '2026-08-01' },
    ]),
  );
  await storage.setItem(wardrobeKey('acct-1'), doc);
}

describe('the closet tiles state their ledger honestly', () => {
  beforeEach(async () => {
    await seed(DOC);
  });

  test('cost-per-wear renders in rupees via the shared formatter', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    // 350 over 100 wears — the en-IN two-decimal string, from shared/cost.
    expect(await shell.findByText('Tops · worn 100× · ₹3.50/wear')).toBeTruthy();
  });

  test('a recorded zero is free, not a per-wear figure; no wears is its own answer', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    // reason 'free': wears stated plainly, never ₹0.00/wear.
    expect(await shell.findByText('Accessories · 9 wears')).toBeTruthy();
    // reason 'no-wears': the caption says so instead of dividing by zero.
    expect(await shell.findByText('Tops · never worn yet')).toBeTruthy();
  });

  test('the detail sheet shows the facts and "Worn today" logs with the seal copy', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    fireEvent.press(await shell.findByText('The white oxford'));

    expect(await shell.findByText('₹350')).toBeTruthy();
    expect(shell.getByText('₹3.50/wear')).toBeTruthy();
    expect(shell.getByText('100')).toBeTruthy();

    fireEvent.press(shell.getByText('Worn today'));
    expect(await shell.findByText('Logged. Worn 101 times.')).toBeTruthy();
    // The count moved on the tile too.
    expect(await shell.findByText('Tops · worn 101× · ₹3.47/wear')).toBeTruthy();
  });

  test('the add sheet takes the minimal fields and the piece persists', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    fireEvent.press(await shell.findByText('Add a piece'));

    fireEvent.changeText(await shell.findByLabelText('Name'), 'The market tote');
    fireEvent.press(shell.getByText('Add it'));

    expect(await shell.findByText('Added. It starts at 0 wears.')).toBeTruthy();
    expect(await shell.findByText('The market tote')).toBeTruthy();

    // Through the debounce and onto the shelf — waitFor advances the settle
    // window (the RN preset's timers are fake; waitFor is what drives them).
    await waitFor(async () => {
      const raw = await storage.getItem(wardrobeKey('acct-1'));
      expect(raw).toContain('The market tote');
    });
  });

  test('a nameless piece is refused with a sentence, not a disabled door', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    fireEvent.press(await shell.findByText('Add a piece'));
    fireEvent.press(await shell.findByText('Add it'));
    expect(await shell.findByText('A name is all it needs to start.')).toBeTruthy();
  });
});

describe('the empty closet keeps the house line', () => {
  test('an empty wardrobe shows the empty state, not a zero-row grid', async () => {
    await seed(JSON.stringify({ items: [] }));
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    expect(await shell.findByText('Nothing hangs here yet.')).toBeTruthy();
    expect(
      shell.getByText(
        'One piece is enough to start: a name, and a photo if you have one. The ledger counts from its first wear.',
      ),
    ).toBeTruthy();
  });
});

/* ============================================================================
   THE PHOTOGRAPH, AND THE ONE JOURNEY OUT.

   Three laws are pinned here, in the order a person meets them:

    1. PERMISSION IS ASKED AT THE MOMENT OF USE. Nothing is requested while
       the closet is merely open; the request happens on the press of the
       button that needs it, and a refusal is answered with a sentence and
       the other route rather than a dead end.
    2. THE FILE IS WRITTEN BEFORE THE RECORD, and a photograph attached to a
       piece that is then abandoned comes off the disk again.
    3. THE AI READS, IT NEVER WRITES. Reading fills the form; the closet does
       not change until "Add it" is pressed. This is the web's own law
       (AddItemModal) and the one the whole feature stands or falls on.
   ============================================================================ */

describe('the photograph', () => {
  beforeEach(async () => {
    mockDisk.files.clear();
    mockDisk.dirs.clear();
    mockPicker.camera = { granted: true, canAskAgain: true, status: 'granted' };
    mockPicker.library = { granted: true, canAskAgain: true, status: 'granted' };
    mockPicker.result = { canceled: true, assets: null };
    mockPicker.calls = [];
    await seed(DOC);
  });

  test('a piece with no photograph draws its flat, and asks for one as a choice', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    fireEvent.press(await shell.findByText('The white oxford'));

    // No broken frame, no gap labelled as a gap — two plain offers.
    expect(await shell.findByLabelText('Photograph it')).toBeTruthy();
    expect(shell.getByLabelText('Choose a photograph')).toBeTruthy();
    expect(shell.queryByLabelText('Photograph of The white oxford')).toBeNull();
    // Nothing to remove when there is nothing there.
    expect(shell.queryByLabelText('Remove the photograph')).toBeNull();
  });

  test('a stored photograph is drawn on the tile and in the sheet', async () => {
    mockDisk.files.set('file:///documents/photos/p-oxford.jpg', 'JPEGBYTES');
    await seed(
      JSON.stringify({
        ...JSON.parse(DOC),
        photoEncoding: 'file',
        items: JSON.parse(DOC).items.map((i: { id: string }) =>
          i.id === 'i-oxford' ? { ...i, imageUrl: 'photos/p-oxford.jpg' } : i,
        ),
      }),
    );

    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    const tile = await shell.findAllByLabelText('Photograph of The white oxford');
    expect(tile.length).toBeGreaterThan(0);
    // The relative path is resolved against the document directory, never
    // stored absolute — an iOS container uuid change must not blank the tile.
    expect((tile[0].props as { source: { uri: string } }).source.uri).toBe(
      'file:///documents/photos/p-oxford.jpg',
    );
  });

  test('a photograph that came down from the web as a data URI draws the same way', async () => {
    const inline = 'data:image/jpeg;base64,QUJDRA==';
    await seed(
      JSON.stringify({
        ...JSON.parse(DOC),
        items: JSON.parse(DOC).items.map((i: { id: string }) =>
          i.id === 'i-oxford' ? { ...i, imageUrl: inline } : i,
        ),
      }),
    );
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    const tile = await shell.findAllByLabelText('Photograph of The white oxford');
    expect((tile[0].props as { source: { uri: string } }).source.uri).toBe(inline);
  });

  test('PERMISSION IS ASKED AT THE MOMENT OF USE, and not one moment earlier', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    fireEvent.press(await shell.findByText('The white oxford'));
    await shell.findByLabelText('Photograph it');

    // The closet has been opened, a piece opened, the button rendered — and
    // nothing has been asked of the phone yet.
    expect(mockPicker.calls).toEqual([]);

    mockPicker.result = { canceled: false, assets: [{ uri: 'file:///cache/shot.jpg' }] };
    mockDisk.files.set('file:///cache/shot.jpg', 'SHOT');
    await act(async () => {
      fireEvent.press(shell.getByLabelText('Photograph it'));
    });

    expect(mockPicker.calls).toEqual(['request-camera', 'launch-camera']);
  });

  test('the library route asks for the library, never the camera', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    fireEvent.press(await shell.findByText('The white oxford'));
    await shell.findByLabelText('Choose a photograph');

    mockPicker.result = { canceled: false, assets: [{ uri: 'file:///cache/lib.jpg' }] };
    mockDisk.files.set('file:///cache/lib.jpg', 'LIB');
    await act(async () => {
      fireEvent.press(shell.getByLabelText('Choose a photograph'));
    });

    expect(mockPicker.calls).toEqual(['request-library', 'launch-library']);
  });

  test('a refusal is a sentence and the other route, never a dead end or a scold', async () => {
    mockPicker.camera = { granted: false, canAskAgain: false, status: 'denied' };
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    fireEvent.press(await shell.findByText('The white oxford'));

    await act(async () => {
      fireEvent.press(await shell.findByLabelText('Photograph it'));
    });

    const said = await shell.findByText(/The camera is not open to Almari/);
    expect(said).toBeTruthy();
    // It points at the phone's settings and at the other door.
    expect(said.props.children).toContain('choose a photograph from the library instead');
    // The camera was never launched after the refusal.
    expect(mockPicker.calls).toEqual(['request-camera']);
  });

  test('a photographed piece keeps the file, and the document says photoEncoding file', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    fireEvent.press(await shell.findByText('The white oxford'));

    mockPicker.result = { canceled: false, assets: [{ uri: 'file:///cache/shot.jpg' }] };
    mockDisk.files.set('file:///cache/shot.jpg', 'SHOT');
    await act(async () => {
      fireEvent.press(await shell.findByLabelText('Photograph it'));
    });

    // findAll, not find: the house toast keeps its queue in module state and a
    // toast raised by an earlier case in this file has no real clock to expire
    // it. What this test is actually about is the two lines below.
    expect((await shell.findAllByText('Photographed.')).length).toBeGreaterThan(0);
    await waitFor(async () => {
      const doc = JSON.parse((await storage.getItem(wardrobeKey('acct-1'))) as string);
      const oxford = doc.items.find((i: { id: string }) => i.id === 'i-oxford');
      expect(oxford.imageUrl).toMatch(/^photos\//);
      expect(doc.photoEncoding).toBe('file');
      expect(mockDisk.files.get(`file:///documents/${oxford.imageUrl}`)).toBe('SHOT');
    });
  });

  test('cancelling the picker changes nothing at all', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    fireEvent.press(await shell.findByText('The white oxford'));

    mockPicker.result = { canceled: true, assets: null };
    await act(async () => {
      fireEvent.press(await shell.findByLabelText('Photograph it'));
    });

    expect(shell.queryByText('Photographed.')).toBeNull();
    expect(mockDisk.files.size).toBe(0);
  });

  test('removing a photograph stands behind the house confirm, and says what stays', async () => {
    mockDisk.files.set('file:///documents/photos/p-oxford.jpg', 'JPEGBYTES');
    await seed(
      JSON.stringify({
        ...JSON.parse(DOC),
        photoEncoding: 'file',
        items: JSON.parse(DOC).items.map((i: { id: string }) =>
          i.id === 'i-oxford' ? { ...i, imageUrl: 'photos/p-oxford.jpg' } : i,
        ),
      }),
    );
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    fireEvent.press(await shell.findByText('The white oxford'));

    fireEvent.press(await shell.findByLabelText('Remove the photograph'));

    // The gate names what happens to the piece, not just to the picture.
    expect(
      await shell.findByText(
        /The photograph of The white oxford comes off this device\. The piece keeps its name, its wears and everything else — only the picture goes\./,
      ),
    ).toBeTruthy();

    await act(async () => {
      fireEvent.press(shell.getByLabelText('Remove it'));
    });

    expect(await shell.findByText('Removed. The piece keeps everything else.')).toBeTruthy();
    await waitFor(() => {
      expect(mockDisk.files.has('file:///documents/photos/p-oxford.jpg')).toBe(false);
    });
    // The ledger is untouched.
    expect(await shell.findByText('Tops · worn 100× · ₹3.50/wear')).toBeTruthy();
  });

  test('a photograph attached in the add sheet and then abandoned comes off the disk', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    fireEvent.press(await shell.findByText('Add a piece'));

    mockPicker.result = { canceled: false, assets: [{ uri: 'file:///cache/orphan.jpg' }] };
    mockDisk.files.set('file:///cache/orphan.jpg', 'ORPHAN');
    await act(async () => {
      fireEvent.press(await shell.findByLabelText('Choose a photograph'));
    });

    const written = [...mockDisk.files.keys()].filter(k => k.startsWith('file:///documents/'));
    expect(written).toHaveLength(1);

    await act(async () => {
      fireEvent.press(shell.getByLabelText('Not now'));
    });

    // Nobody owns that file now, and an invisible file is how a phone fills up.
    await waitFor(() => {
      expect(mockDisk.files.has(written[0])).toBe(false);
    });
  });
});

describe('reading a piece from a photograph — the AI reads, it never writes', () => {
  beforeEach(async () => {
    mockDisk.files.clear();
    mockDisk.dirs.clear();
    mockPicker.camera = { granted: true, canAskAgain: true, status: 'granted' };
    mockPicker.library = { granted: true, canAskAgain: true, status: 'granted' };
    mockPicker.result = { canceled: false, assets: [{ uri: 'file:///cache/shot.jpg' }] };
    mockPicker.calls = [];
    mockDisk.files.set('file:///cache/shot.jpg', 'U0hPVA==');
    await seed(DOC);
  });

  /** Attach a photograph in the add sheet and hand back the shell. */
  async function openAddSheetWithPhoto() {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    fireEvent.press(await shell.findByText('Add a piece'));
    await act(async () => {
      fireEvent.press(await shell.findByLabelText('Choose a photograph'));
    });
    return shell;
  }

  test('the offer appears only once there is a photograph, and names the model', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    fireEvent.press(await shell.findByText('Add a piece'));

    // Nothing to read yet, so nothing offered and nothing disclosed.
    expect(shell.queryByLabelText('Read it from a photograph')).toBeNull();
    expect(shell.queryByText(/Claude Fable by Anthropic/)).toBeNull();

    await act(async () => {
      fireEvent.press(await shell.findByLabelText('Choose a photograph'));
    });

    expect(await shell.findByLabelText('Read it from a photograph')).toBeTruthy();
    // docs/35: name the model wherever a photograph is read.
    expect(shell.getByText(/Claude Fable by Anthropic/)).toBeTruthy();
    expect(shell.getByText(/never on this device/)).toBeTruthy();
    expect(shell.getByText(/Nothing is saved until you press add/)).toBeTruthy();
  });

  test('the reading fills the form and WRITES NOTHING until "Add it" is pressed', async () => {
    global.fetch = mockRelay(
      JSON.stringify({
        toileIntake: 1,
        pieces: [
          {
            ref: 'p1',
            name: 'Blue oxford shirt',
            category: 'bottoms',
            color: '#2E4A6B',
            description: 'A navy cotton oxford with a button-down collar.',
            season: [],
            occasion: [],
            confidence: 0.9,
            uncertain: [],
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const shell = await openAddSheetWithPhoto();
    const before = JSON.parse((await storage.getItem(wardrobeKey('acct-1'))) as string).items.length;

    await act(async () => {
      fireEvent.press(shell.getByLabelText('Read it from a photograph'));
    });

    // The words landed in the INPUTS, where they can still be changed.
    expect((shell.getByLabelText('Name').props as { value: string }).value).toBe(
      'Blue oxford shirt',
    );
    expect((shell.getByLabelText('Notes').props as { value: string }).value).toContain(
      'A navy cotton oxford',
    );
    expect(shell.getByText(/Change anything that is wrong before you add it/)).toBeTruthy();

    // NOTHING has been written. This is the whole law of the feature.
    const stillThere = JSON.parse((await storage.getItem(wardrobeKey('acct-1'))) as string);
    expect(stillThere.items).toHaveLength(before);
    expect(JSON.stringify(stillThere)).not.toContain('Blue oxford shirt');

    // Only now, and only because a person pressed it.
    fireEvent.press(shell.getByLabelText('Add it'));
    await waitFor(async () => {
      const doc = JSON.parse((await storage.getItem(wardrobeKey('acct-1'))) as string);
      expect(doc.items).toHaveLength(before + 1);
      const added = doc.items[doc.items.length - 1];
      expect(added.name).toBe('Blue oxford shirt');
      expect(added.category).toBe('bottoms');
      expect(added.imageUrl).toMatch(/^photos\//);
    });
  });

  test('the person’s own edit beats the reading — what is on screen is what is written', async () => {
    global.fetch = mockRelay(
      JSON.stringify({
        toileIntake: 1,
        pieces: [
          {
            ref: 'p1',
            name: 'Blue oxford shirt',
            category: 'tops',
            color: '#2E4A6B',
            description: 'A navy cotton oxford.',
            season: [],
            occasion: [],
            confidence: 0.9,
            uncertain: [],
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const shell = await openAddSheetWithPhoto();
    await act(async () => {
      fireEvent.press(shell.getByLabelText('Read it from a photograph'));
    });

    fireEvent.changeText(shell.getByLabelText('Name'), 'The shirt I actually call it');
    fireEvent.press(shell.getByLabelText('Add it'));

    await waitFor(async () => {
      const doc = JSON.parse((await storage.getItem(wardrobeKey('acct-1'))) as string);
      const added = doc.items[doc.items.length - 1];
      expect(added.name).toBe('The shirt I actually call it');
    });
  });

  test('several pieces in one photograph: the clearest is filled in and the count is told', async () => {
    global.fetch = mockRelay(
      JSON.stringify({
        toileIntake: 1,
        pieces: [
          { ref: 'a', name: 'A blurred thing', category: 'tops', color: '#111111', description: 'x', season: [], occasion: [], confidence: 0.2, uncertain: [] },
          { ref: 'b', name: 'Black ankle boots', category: 'shoes', color: '#151515', description: 'y', season: [], occasion: [], confidence: 0.95, uncertain: [] },
        ],
      }),
    ) as unknown as typeof fetch;

    const shell = await openAddSheetWithPhoto();
    await act(async () => {
      fireEvent.press(shell.getByLabelText('Read it from a photograph'));
    });

    expect((shell.getByLabelText('Name').props as { value: string }).value).toBe(
      'Black ankle boots',
    );
    expect(shell.getByText(/Found 2 pieces in that photograph/)).toBeTruthy();
  });

  test('a relay with no key says so calmly, and the form still works', async () => {
    global.fetch = mockRelay('not configured', 503) as unknown as typeof fetch;

    const shell = await openAddSheetWithPhoto();
    await act(async () => {
      fireEvent.press(shell.getByLabelText('Read it from a photograph'));
    });

    expect(await shell.findByText(/The relay has no key yet/)).toBeTruthy();
    expect(shell.getByText(/type the piece in and it is recorded just the same/)).toBeTruthy();

    // And it is: the door is not closed by the relay being shut.
    fireEvent.changeText(shell.getByLabelText('Name'), 'Typed in by hand');
    fireEvent.press(shell.getByLabelText('Add it'));
    expect((await shell.findAllByText('Added. It starts at 0 wears.')).length).toBeGreaterThan(0);
    await waitFor(async () => {
      const doc = JSON.parse((await storage.getItem(wardrobeKey('acct-1'))) as string);
      expect(doc.items.some((i: { name: string }) => i.name === 'Typed in by hand')).toBe(true);
    });
  });

  test('no network says the network, and says the rest of Almari works offline', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    const shell = await openAddSheetWithPhoto();
    await act(async () => {
      fireEvent.press(shell.getByLabelText('Read it from a photograph'));
    });

    expect(await shell.findByText(/works offline/)).toBeTruthy();
  });

  test('the photograph really is what is sent — the stored file, as base64, with no key', async () => {
    const relay = mockRelay(
      JSON.stringify({
        toileIntake: 1,
        pieces: [{ ref: 'p1', name: 'A shirt', category: 'tops', color: '#111111', description: 'x', season: [], occasion: [], confidence: 0.9, uncertain: [] }],
      }),
    );
    global.fetch = relay as unknown as typeof fetch;

    const shell = await openAddSheetWithPhoto();
    await act(async () => {
      fireEvent.press(shell.getByLabelText('Read it from a photograph'));
    });

    expect(mockRelayCalls).toHaveLength(1);
    const [url, init] = mockRelayCalls[0];
    expect(url).toContain('/functions/v1/ai-proxy');
    const body = JSON.parse(init.body) as {
      messages: Array<{ content: Array<{ type: string; source?: { data: string } }> }>;
    };
    // The bytes the closet stored, not a second copy of the original.
    expect(body.messages[0].content[0].source?.data).toBe('U0hPVA==');
    const headers = Object.keys(init.headers).map(h => h.toLowerCase());
    expect(headers).not.toContain('x-api-key');
    expect(headers).not.toContain('authorization');
  });
});

describe('the looks rail — a hook into the room, linked by address only', () => {
  test('an empty wardrobe still offers the way in', async () => {
    await seed(JSON.stringify({ items: [] }));
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    // R2 (2026-08-20): the room adopted the web's own word — Outfits.
    expect(await shell.findByLabelText('Build an outfit')).toBeTruthy();
  });

  test('the looks this wardrobe holds are named on the rail, and all of them lead one place', async () => {
    await seed(
      JSON.stringify({
        ...JSON.parse(DOC),
        outfits: [
          { id: 'o-1', name: 'Monday', itemIds: ['i-oxford'], favorite: false, dateCreated: '2026-06-01T00:00:00.000Z', wearCount: 0 },
          { id: 'o-2', name: 'The wedding', itemIds: ['i-ring'], favorite: false, dateCreated: '2026-06-02T00:00:00.000Z', wearCount: 0 },
        ],
      }),
    );
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    expect(await shell.findByLabelText('Monday')).toBeTruthy();
    expect(shell.getByLabelText('The wedding')).toBeTruthy();
    // R2 (2026-08-20): the room adopted the web's own word — Outfits.
    expect(shell.getByLabelText('All outfits')).toBeTruthy();
  });
});
