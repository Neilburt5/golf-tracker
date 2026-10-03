/** What happened to the file. The UI can show a message for each. */
export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/** Browser capabilities, injected so the decision logic can be tested without a browser. */
export interface ShareDeps {
  canShare: (file: File) => boolean;
  share: (file: File) => Promise<void>;
  download: (file: File) => void;
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

export function createFileSharer(deps: ShareDeps) {
  /**
   * Offers the file through the system share sheet, falling back to a download.
   * Call it straight from a tap handler: iOS only allows the share sheet while
   * the tap is still "fresh", so do not await anything before calling it.
   */
  return async function shareFile(blob: Blob, filename: string): Promise<ShareOutcome> {
    const file = new File([blob], filename, { type: blob.type });

    if (deps.canShare(file)) {
      try {
        await deps.share(file);
        return 'shared';
      } catch (error) {
        // Closing the share sheet is a choice, not a failure.
        if (isAbortError(error)) return 'cancelled';
        // Any other failure: fall through to the download so the data is not lost.
      }
    }

    deps.download(file);
    return 'downloaded';
  };
}

/** Triggers a normal browser download of the file. */
function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before releasing the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const browserDeps: ShareDeps = {
  canShare: (file) =>
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] }),
  share: (file) => navigator.share({ files: [file] }),
  download: downloadFile,
};

export const shareFile = createFileSharer(browserDeps);