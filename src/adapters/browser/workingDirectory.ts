/**
 * A folder in a browser tab, where the browser has one to give.
 *
 * Chromium's File System Access API can hand a page a real directory handle,
 * and `FileSystemProjectStore` was written against exactly the slice of it that
 * this needs — so the same store, the same format and the same contract suite
 * run in a tab as on the desktop, with the handle coming from a picker instead
 * of from IPC.
 *
 * **Best effort, and the fallback stays honest.** Two things are true here that
 * are not true on the desktop. Not every browser has the API at all (Safari and
 * Firefox do not), and permission to a handle does not reliably survive a
 * restart — a tab that had a folder yesterday usually has to ask again, and
 * asking needs a click. So the rule is: use the remembered folder only when the
 * permission is *already* granted, and otherwise fall back to browser storage
 * without a word. Anything else would be a tab that nags on every boot.
 *
 * The handle itself is kept in IndexedDB because that is the only place it can
 * be: a directory handle is structured-cloneable and not serialisable, so
 * `localStorage` cannot hold one.
 */
import type { DirectoryHandleLike } from '../fileSystem/FileSystemProjectStore'

/** The slice of the File System Access API this file uses, named rather than assumed. */
type PermissionState = 'granted' | 'denied' | 'prompt'
type DirectoryHandle = DirectoryHandleLike & {
  queryPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>
}
type PickerWindow = {
  showDirectoryPicker?(options: { mode: 'readwrite' }): Promise<DirectoryHandle>
  indexedDB?: IDBFactory
}

const DATABASE = 'lvarch.handles'
const STORE = 'handles'
const KEY = 'workingDirectory'

function host(): PickerWindow {
  return window as unknown as PickerWindow
}

/** Can this browser give a page a folder at all? */
export function canChooseDirectory(): boolean {
  return typeof host().showDirectoryPicker === 'function' && Boolean(host().indexedDB)
}

function database(): Promise<IDBDatabase | undefined> {
  const factory = host().indexedDB
  if (!factory) return Promise.resolve(undefined)
  return new Promise((resolve) => {
    const request = factory.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    // A browser that refuses IndexedDB (a private window, a strict policy) has
    // no folder to offer either; browser storage is the answer to both.
    request.onerror = () => resolve(undefined)
  })
}

function transact<T>(
  mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  return database().then((db) => {
    if (!db) return undefined
    return new Promise<T | undefined>((resolve) => {
      try {
        const request = run(db.transaction(STORE, mode).objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(undefined)
      } catch {
        resolve(undefined)
      }
    })
  })
}

/** Ask for a folder. `undefined` when the user cancelled, or cannot be asked. */
export async function chooseDirectory(): Promise<DirectoryHandleLike | undefined> {
  const picker = host().showDirectoryPicker
  if (!picker) return undefined
  let handle: DirectoryHandle
  try {
    handle = await picker.call(window, { mode: 'readwrite' })
  } catch {
    // Cancelling a picker throws. It is not a failure and there is nothing to
    // say about it.
    return undefined
  }
  await transact('readwrite', (store) => store.put(handle, KEY))
  return handle
}

/**
 * The folder this tab worked in last, if it may still use it.
 *
 * Only when the permission is already granted: asking needs a user gesture, and
 * a boot is not one. A tab that has to ask again therefore starts in browser
 * storage and the picker offers the folder button, which is a click the user
 * meant to make.
 */
export async function rememberedDirectory(): Promise<DirectoryHandleLike | undefined> {
  const handle = await transact<DirectoryHandle>('readonly', (store) => store.get(KEY))
  if (!handle) return undefined
  const permission = await handle.queryPermission?.({ mode: 'readwrite' }).catch(() => 'denied')
  return permission === 'granted' ? handle : undefined
}
