import { describe, expect, it, vi } from 'vitest';
import { createFileSharer, type ShareDeps } from '../src/services/shareFile';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Builds typed mocks. Overrides are wrapped in vi.fn here, so every dependency
 * returned is always a mock and `.mock.calls` is available with the right types.
 */
function fakeDeps(overrides: Partial<ShareDeps> = {}) {
  return {
    canShare: vi.fn<ShareDeps['canShare']>(overrides.canShare ?? (() => true)),
    share: vi.fn<ShareDeps['share']>(overrides.share ?? (async () => undefined)),
    download: vi.fn<ShareDeps['download']>(overrides.download ?? (() => undefined)),
  };
}

const blob = new Blob(['data'], { type: XLSX_TYPE });

describe('shareFile', () => {
  it('opens the share sheet with a correctly named and typed file', async () => {
    const deps = fakeDeps();

    const outcome = await createFileSharer(deps)(blob, 'ronda.xlsx');

    expect(outcome).toBe('shared');
    expect(deps.download).not.toHaveBeenCalled();
    const sharedFile = deps.share.mock.calls[0][0];
    expect(sharedFile.name).toBe('ronda.xlsx');
    expect(sharedFile.type).toBe(XLSX_TYPE);
  });

  it('downloads the file when the browser cannot share files', async () => {
    const deps = fakeDeps({ canShare: () => false });

    const outcome = await createFileSharer(deps)(blob, 'ronda.xlsx');

    expect(outcome).toBe('downloaded');
    expect(deps.share).not.toHaveBeenCalled();
    expect(deps.download).toHaveBeenCalledTimes(1);
    expect(deps.download.mock.calls[0][0].name).toBe('ronda.xlsx');
  });

  it('reports "cancelled" and does not download when the user closes the share sheet', async () => {
    const deps = fakeDeps({
      share: async () => {
        throw new DOMException('Share canceled', 'AbortError');
      },
    });

    const outcome = await createFileSharer(deps)(blob, 'ronda.xlsx');

    expect(outcome).toBe('cancelled');
    expect(deps.download).not.toHaveBeenCalled();
  });

  it('falls back to a download when sharing fails for another reason', async () => {
    const deps = fakeDeps({
      share: async () => {
        throw new DOMException('Not allowed', 'NotAllowedError');
      },
    });

    const outcome = await createFileSharer(deps)(blob, 'ronda.xlsx');

    expect(outcome).toBe('downloaded');
        expect(deps.download).toHaveBeenCalledTimes(1);
  });

  it('also falls back when sharing throws something that is not an Error', async () => {
    const deps = fakeDeps({
      share: async () => {
        throw 'boom';
      },
    });

    const outcome = await createFileSharer(deps)(blob, 'ronda.xlsx');

    expect(outcome).toBe('downloaded');
  });
});