/**
 * PHOTOGRAPHS ON DISK — the file layer, over a fake filesystem.
 *
 * The fake is a Map, not a stub: `File` and `Directory` really create, write,
 * read back, copy and delete, so a round trip here is a genuine round trip
 * through lib/photos.ts's own logic. What it replaces is the device, not the
 * behaviour — the shapes are the ones the SDK 57 docs state for the default
 * object API (`new File(dir, name)`, `create({ intermediates, overwrite })`,
 * `write(content, { encoding: 'base64' })`, `await base64()`, `delete()`,
 * `await copy(dest)`, `exists`, `uri`, `Paths.document`).
 *
 * The laws pinned here:
 *  - a picked file is COPIED into the document directory, because the picker
 *    writes into the cache and the OS empties the cache;
 *  - the path stored is RELATIVE, so an iOS container UUID change cannot
 *    blank every photograph in the wardrobe at once;
 *  - the export inliner answers a data URI, and answers '' rather than
 *    throwing when a file has gone — one swept file must not take a whole
 *    backup down with it;
 *  - `..` never resolves, so the export path can never be turned into a way
 *    to read the app sandbox out of the phone;
 *  - a disk that refuses is SAID OUT LOUD, in the house's own sentence.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

/** The disk, such as it is. `mock`-prefixed so jest's hoist allows the reference. */
const mockDisk = {
  files: new Map<string, string>(),
  dirs: new Set<string>(),
  failWrites: false,
  failCopy: false,
};

jest.mock('expo-file-system', () => {
  const DOCUMENT = 'file:///documents/';

  const joinUri = (base: string, parts: string[]): string => {
    const head = base.endsWith('/') ? base : `${base}/`;
    return head + parts.filter(p => p.length > 0).join('/');
  };

  const resolve = (args: unknown[]): string => {
    const [first, ...rest] = args;
    const base = typeof first === 'string' ? first : String((first as { uri: string }).uri);
    return rest.length > 0 ? joinUri(base, rest.map(String)) : base;
  };

  class Directory {
    uri: string;
    constructor(...args: unknown[]) {
      const uri = resolve(args);
      this.uri = uri.endsWith('/') ? uri : `${uri}/`;
    }
    get exists(): boolean {
      return mockDisk.dirs.has(this.uri);
    }
    create(): void {
      if (mockDisk.failWrites) throw new Error('no space left on device');
      mockDisk.dirs.add(this.uri);
    }
  }

  class File {
    uri: string;
    constructor(...args: unknown[]) {
      this.uri = resolve(args);
    }
    get exists(): boolean {
      return mockDisk.files.has(this.uri);
    }
    create(): void {
      if (mockDisk.failWrites) throw new Error('no space left on device');
      if (!mockDisk.files.has(this.uri)) mockDisk.files.set(this.uri, '');
    }
    write(content: string): void {
      if (mockDisk.failWrites) throw new Error('no space left on device');
      mockDisk.files.set(this.uri, content);
    }
    async base64(): Promise<string> {
      const value = mockDisk.files.get(this.uri);
      if (value === undefined) throw new Error('no such file');
      return value;
    }
    delete(): void {
      mockDisk.files.delete(this.uri);
    }
    async copy(destination: File): Promise<void> {
      if (mockDisk.failCopy) throw new Error('no space left on device');
      const value = mockDisk.files.get(this.uri);
      if (value === undefined) throw new Error('no such file');
      mockDisk.files.set(destination.uri, value);
    }
  }

  return { Directory, File, Paths: { document: new Directory(DOCUMENT), cache: new Directory('file:///cache/') } };
});

import {
  isInlinePhoto,
  mimeFor,
  PhotoError,
  photoUri,
  PHOTO_DIR,
  readPhotoAsDataUrl,
  removePhoto,
  savePhoto,
  STORAGE_REFUSED,
  storedPath,
} from '../src/lib/photos';

const DOCUMENT = 'file:///documents/';

/** A photograph sitting in the picker's cache, waiting to be copied in. */
function seedPicked(uri: string, bytes: string) {
  mockDisk.files.set(uri, bytes);
}

beforeEach(() => {
  mockDisk.files.clear();
  mockDisk.dirs.clear();
  mockDisk.failWrites = false;
  mockDisk.failCopy = false;
});

describe('a picked photograph becomes a file this wardrobe owns', () => {
  test('the picker uri is copied in, and the stored path is relative', async () => {
    seedPicked('file:///cache/ImagePicker/abc.jpg', 'JPEGBYTES');

    const path = await savePhoto('file:///cache/ImagePicker/abc.jpg');

    // Relative, under photos/, and never the absolute container path — an
    // iOS reinstall reissues that uuid and would blank every tile at once.
    expect(path.startsWith(`${PHOTO_DIR}/`)).toBe(true);
    expect(path).not.toContain(DOCUMENT);
    expect(path.endsWith('.jpg')).toBe(true);

    // The bytes really moved: the cache copy could be swept tomorrow.
    expect(mockDisk.files.get(`${DOCUMENT}${path}`)).toBe('JPEGBYTES');
    expect(mockDisk.files.has('file:///cache/ImagePicker/abc.jpg')).toBe(true);
  });

  test('the photos folder is made before anything is written into it', async () => {
    seedPicked('file:///cache/x.jpg', 'BYTES');
    await savePhoto('file:///cache/x.jpg');
    expect(mockDisk.dirs.has(`${DOCUMENT}${PHOTO_DIR}/`)).toBe(true);
  });

  test('two photographs never collide', async () => {
    seedPicked('file:///cache/a.jpg', 'A');
    seedPicked('file:///cache/b.jpg', 'B');
    const first = await savePhoto('file:///cache/a.jpg');
    const second = await savePhoto('file:///cache/b.jpg');
    expect(first).not.toBe(second);
    expect(mockDisk.files.get(`${DOCUMENT}${first}`)).toBe('A');
    expect(mockDisk.files.get(`${DOCUMENT}${second}`)).toBe('B');
  });

  test('a query string on the picker uri does not become part of the filename', async () => {
    seedPicked('file:///cache/IMG_0001.HEIC?width=100', 'HEICBYTES');
    const path = await savePhoto('file:///cache/IMG_0001.HEIC?width=100');
    expect(path.endsWith('.heic')).toBe(true);
    expect(path).not.toContain('?');
  });

  test('a data URI is written out as a file of its own kind', async () => {
    const path = await savePhoto('data:image/png;base64,UE5HQllURVM=');
    expect(path.endsWith('.png')).toBe(true);
    expect(mockDisk.files.get(`${DOCUMENT}${path}`)).toBe('UE5HQllURVM=');
  });

  test('a data URI that is not base64 is refused rather than half-written', async () => {
    await expect(savePhoto('data:image/svg+xml,<svg/>')).rejects.toBeInstanceOf(PhotoError);
    expect(mockDisk.files.size).toBe(0);
  });

  test('nothing at all is refused, and says so', async () => {
    await expect(savePhoto('   ')).rejects.toThrow('There was no photograph to save.');
  });
});

describe('a disk that refuses is said out loud (docs/34 §2.4 law 2)', () => {
  test('a refused write answers the house sentence, not a stack trace', async () => {
    mockDisk.failWrites = true;
    await expect(savePhoto('data:image/jpeg;base64,QUJD')).rejects.toThrow(STORAGE_REFUSED);
  });

  test('a refused copy answers the same sentence', async () => {
    seedPicked('file:///cache/a.jpg', 'A');
    mockDisk.failCopy = true;
    await expect(savePhoto('file:///cache/a.jpg')).rejects.toThrow(STORAGE_REFUSED);
  });

  test('the sentence names the remedy and carries no exclamation (copy law)', () => {
    expect(STORAGE_REFUSED).toContain('Export a backup from Settings');
    expect(STORAGE_REFUSED).not.toContain('!');
  });
});

describe('inlining for export — a backup opens on any device', () => {
  test('a stored photograph comes back as a data URI with its own media type', async () => {
    seedPicked('file:///cache/a.png', 'UE5H');
    const path = await savePhoto('file:///cache/a.png');
    await expect(readPhotoAsDataUrl(path)).resolves.toBe('data:image/png;base64,UE5H');
  });

  test('a jpeg path reports image/jpeg, not the extension it was written with', async () => {
    seedPicked('file:///cache/a.jpeg', 'SlBH');
    const path = await savePhoto('file:///cache/a.jpeg');
    await expect(readPhotoAsDataUrl(path)).resolves.toBe('data:image/jpeg;base64,SlBH');
    expect(mimeFor('photos/p-1.heic')).toBe('image/heic');
    expect(mimeFor('photos/p-1.unknown')).toBe('image/jpeg');
  });

  test('a document that came down from the web is already inline and passes through', async () => {
    const inline = 'data:image/jpeg;base64,QUJDRA==';
    expect(isInlinePhoto(inline)).toBe(true);
    await expect(readPhotoAsDataUrl(inline)).resolves.toBe(inline);
  });

  test('a photograph that is gone answers empty rather than taking the backup down', async () => {
    seedPicked('file:///cache/a.jpg', 'A');
    const path = await savePhoto('file:///cache/a.jpg');
    mockDisk.files.delete(`${DOCUMENT}${path}`);
    await expect(readPhotoAsDataUrl(path)).resolves.toBe('');
  });

  test('a piece with no photograph answers empty', async () => {
    await expect(readPhotoAsDataUrl('')).resolves.toBe('');
  });
});

describe('an export can never be turned into a way to read the sandbox', () => {
  test('.. does not resolve, spelled with either slash', () => {
    expect(storedPath('../../secrets.json')).toBeNull();
    expect(storedPath('photos/../../secrets.json')).toBeNull();
    expect(storedPath('photos\\..\\..\\secrets.json')).toBeNull();
    expect(storedPath('./photos/a.jpg')).toBeNull();
  });

  test('a traversal path reads as nothing and removes nothing', async () => {
    mockDisk.files.set('file:///secrets.json', 'THE KEYS');
    await expect(readPhotoAsDataUrl('../../secrets.json')).resolves.toBe('');
    await removePhoto('../../secrets.json');
    expect(mockDisk.files.get('file:///secrets.json')).toBe('THE KEYS');
  });

  test('a file:// path outside our own document directory is not ours', () => {
    expect(storedPath('file:///somewhere/else/a.jpg')).toBeNull();
    expect(storedPath('https://example.com/a.jpg')).toBeNull();
    expect(storedPath('content://media/1')).toBeNull();
  });

  test('an absolute path that IS under our document directory is normalised back', () => {
    expect(storedPath(`${DOCUMENT}photos/p-1.jpg`)).toBe('photos/p-1.jpg');
  });
});

describe('rendering a photograph', () => {
  test('a stored path resolves to an absolute uri an Image can open', async () => {
    seedPicked('file:///cache/a.jpg', 'A');
    const path = await savePhoto('file:///cache/a.jpg');
    expect(photoUri(path)).toBe(`${DOCUMENT}${path}`);
  });

  test('a data URI is handed back untouched, so one call site draws either kind', () => {
    const inline = 'data:image/jpeg;base64,QQ==';
    expect(photoUri(inline)).toBe(inline);
  });

  test('nothing to draw answers null, and the caller draws the flat', () => {
    expect(photoUri('')).toBeNull();
    expect(photoUri('../../secrets')).toBeNull();
  });
});

describe('removing a photograph', () => {
  test('the file really goes', async () => {
    seedPicked('file:///cache/a.jpg', 'A');
    const path = await savePhoto('file:///cache/a.jpg');
    expect(mockDisk.files.has(`${DOCUMENT}${path}`)).toBe(true);

    await removePhoto(path);
    expect(mockDisk.files.has(`${DOCUMENT}${path}`)).toBe(false);
  });

  test('removing twice is not an error — three paths can reach the same file', async () => {
    seedPicked('file:///cache/a.jpg', 'A');
    const path = await savePhoto('file:///cache/a.jpg');
    await removePhoto(path);
    await expect(removePhoto(path)).resolves.toBeUndefined();
  });

  test('a data URI has no file behind it and is a no-op', async () => {
    mockDisk.files.set(`${DOCUMENT}photos/keep.jpg`, 'KEEP');
    await removePhoto('data:image/jpeg;base64,QQ==');
    expect(mockDisk.files.get(`${DOCUMENT}photos/keep.jpg`)).toBe('KEEP');
  });
});
