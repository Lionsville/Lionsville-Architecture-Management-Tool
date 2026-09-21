/**
 * What a build composed from this one may ask of the desktop side.
 *
 * The registry pattern `logoRegistry.ts` established, applied to the main
 * process: a hook is registered at composition, main runs the registered ones
 * where it registers its own channels, and this build registers none. So the
 * list below is empty in this tree and the loop over it is the whole of the
 * seam — which is the point. Everything main already does stays main's; what a
 * hook gets is the two things a source of work kept somewhere else cannot
 * arrange for itself from the renderer.
 *
 * **Somewhere to answer the renderer.** A renderer cannot reach an OS or a
 * network on its own (ADR-0007 says why, and the CSP and the sandbox are what
 * enforce it), so anything that has to happen outside the page happens behind
 * an IPC channel. `ChannelHost` is as much of Electron's `ipcMain` as that
 * takes and not one method more — a hook registers what it answers and cannot
 * reach the window, the menu or the file channel through it.
 *
 * **Somewhere to keep a small secret.** `userData`, mode 0600, the way the
 * agent's token is kept (ADR-0007): out of the working folder, which belongs
 * to whoever else opens it, and out of the log, which a person is invited to
 * hand over. A secret is a short string a person would otherwise have to type
 * again every morning; the store makes no promise beyond the file's own mode,
 * and this record says so rather than letting a reader assume a keychain.
 *
 * Both are declared here, beside the other facts two processes share, because
 * `platform` is the one module main and the renderer both read. Nothing here
 * is Electron: `ChannelHost` is a shape Electron's `ipcMain` happens to
 * satisfy, and the filling of `SecretStore` is `electron/main`'s.
 */

/**
 * What every channel a hook registers is named with: `hook:<hook>:<what>`.
 *
 * The page cannot reach an IPC channel on its own — a sandboxed renderer with
 * no `ipcRenderer` is the whole of ADR-0007's reasoning — so it reaches a
 * hook's through one door in the preload, and that door opens for this prefix
 * and nothing else. It is therefore the one check in this app that is NOT a
 * check the caller can skip: main cannot tell who called, and the page has no
 * second way to ask. A hook that names its channels anything else has a main
 * side nothing can call.
 */
export const HOOK_CHANNEL_PREFIX = 'hook:'

/** Is this a channel a hook may have registered, and the page may therefore call? */
export function isHookChannel(channel: unknown): channel is string {
  return typeof channel === 'string' && channel.startsWith(HOOK_CHANNEL_PREFIX)
}

/**
 * Call a hook's main side from the page: the channel it registered, whatever
 * arguments it takes, and whatever it answers.
 *
 * `unknown` at both ends on purpose. What crosses here is a hook's own
 * business, and this tree neither knows nor checks the shape of it — which is
 * also why the payload is checked again in main, exactly as the file channel's
 * is.
 */
export type HookInvoke = (channel: string, ...args: unknown[]) => Promise<unknown>

/**
 * As much of `ipcMain` as a hook may have: answer a call from the renderer,
 * and take the answer back.
 *
 * `handle` and nothing else of the listening half, because a hook that can `on`
 * a channel can also listen to one it did not register. The event and the
 * arguments are `unknown`: a payload from the renderer is a shape until it has
 * been checked, which is the rule every channel in this app already keeps.
 *
 * The channel is named `hook:<hook>:<what>` ({@link HOOK_CHANNEL_PREFIX}), or
 * the page has no way to call it.
 */
export type ChannelHost = {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void
  removeHandler(channel: string): void
}

/**
 * A few small secrets, by name.
 *
 * Deliberately three verbs and no list: a caller that can enumerate what is
 * kept is a caller that can read a secret it did not write, and nothing needs
 * to. A name it has never been given reads as `undefined`, the way every
 * settings file in this app reads a missing value as the safe answer; a write
 * or a removal that fails is an error, because a secret silently not kept is
 * worse than one that is reported.
 */
export type SecretStore = {
  read(name: string): Promise<string | undefined>
  write(name: string, value: string): Promise<void>
  remove(name: string): Promise<void>
}

/** What the desktop side hands a hook, and the whole of what it hands it. */
export type DesktopSide = {
  readonly channels: ChannelHost
  readonly secrets: SecretStore
}

/**
 * One hook. `id` is what the log names and what makes registering the same one
 * twice a no-op, so a test may register per case.
 */
export type DesktopHook = {
  readonly id: string
  /** Called once, before the first window, with the desktop side. */
  registerChannels(desktop: DesktopSide): void
}

const HOOKS: DesktopHook[] = []

/**
 * Add a hook. Call it at composition, before `app.whenReady` has run — a hook
 * registered after main has made its pass is a channel the first request of
 * the session would be answered "no such channel" on, which is the same
 * reasoning that puts `registerFileChannel` before the window.
 *
 * A hook already registered under this `id` is ignored rather than added
 * twice.
 */
export function registerDesktopHook(hook: DesktopHook): void {
  if (HOOKS.some((held) => held.id === hook.id)) return
  HOOKS.push(hook)
}

/** The hooks this build has, in the order they were registered. */
export function desktopHooks(): readonly DesktopHook[] {
  return HOOKS
}
