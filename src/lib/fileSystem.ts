import { Bookmark, BookmarkFile } from '../types';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

declare global {
  interface Window {
    showOpenFilePicker(options?: any): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker(options?: any): Promise<FileSystemFileHandle>;
  }
}

export const isFileSystemApiSupported = () => {
  return ('showOpenFilePicker' in window && 'showSaveFilePicker' in window) || Capacitor.isNativePlatform();
};

export async function getFileHandle() {
  if (Capacitor.isNativePlatform()) {
    // On native, we return a "virtual" handle which is just the known filename
    // Actually, we'll use a string 'native-config' to identify it
    return 'native-bookmarks' as any;
  }
  if (!isFileSystemApiSupported()) {
    return null;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'JSON Files',
          accept: {
            'application/json': ['.json'],
          },
        },
      ],
      multiple: false,
    });
    return handle;
  } catch (err) {
    console.error('User cancelled or error picking file', err);
    return null;
  }
}

export async function createNewFile() {
  if (!isFileSystemApiSupported()) {
    return null;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'bookmarks.json',
      types: [
        {
          description: 'JSON Files',
          accept: {
            'application/json': ['.json'],
          },
        },
      ],
    });
    return handle;
  } catch (err) {
    console.error('Error creating file', err);
    return null;
  }
}

export async function readFile(handle: FileSystemFileHandle): Promise<BookmarkFile | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Filesystem.readFile({
        path: 'bookmarks.json',
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      return JSON.parse(result.data as string);
    } catch (err) {
      console.error('Error reading native file, might not exist yet', err);
      return null;
    }
  }
  try {
    const file = await handle.getFile();
    const content = await file.text();
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading file', err);
    return null;
  }
}

export async function writeFile(handle: FileSystemFileHandle, data: BookmarkFile) {
  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.writeFile({
        path: 'bookmarks.json',
        data: JSON.stringify(data, null, 2),
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      return true;
    } catch (err) {
      console.error('Error writing native file', err);
      return false;
    }
  }
  try {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    return true;
  } catch (err) {
    console.error('Error writing file', err);
    return false;
  }
}

// Fallback methods for non-supported browsers
export function downloadFileFallback(data: BookmarkFile, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function uploadFileFallback(): Promise<BookmarkFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    // Use both extension and MIME type for widest compatibility
    input.accept = '.json,application/json';
    input.style.display = 'none';
    
    // Some browsers (like Safari on iOS in standalone mode) 
    // require the element to be in the DOM to trigger a click
    document.body.appendChild(input);

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        try {
          resolve(JSON.parse(text));
        } catch (err) {
          console.error('Invalid JSON', err);
          resolve(null);
        }
      } else {
        resolve(null);
      }
      // Cleanup
      document.body.removeChild(input);
    };

    // Trigger click
    input.click();

    // Handle case where user cancels the picker (safari doesn't always trigger onchange)
    window.addEventListener('focus', () => {
      setTimeout(() => {
        if (!input.files?.length) {
          // If no file was selected after returning focus, we can't be sure 
          // because onchange might still fire, but it's a safe bet after a delay
          // This is tricky in JS, but for now we'll just let it be.
        }
      }, 500);
    }, { once: true });
  });
}
