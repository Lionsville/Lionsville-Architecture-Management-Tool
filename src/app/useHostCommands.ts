/**
 * One stream of commands, whoever sent them.
 *
 * The desktop's menu bar sends `HostCommand`s over IPC; the web's overflow
 * sends the same ones from a button in the toolbar (ADR-0005). They go through
 * one bus so that nothing is reachable from one and not the other, and so the
 * shell and the workspace each subscribe once and take the commands they own
 * — the way they already did when the only sender was the host.
 *
 * Listeners are kept in a ref, not in state: subscribing must not render, and
 * a command sent during a render must reach whoever is listening now.
 */
import { useEffect, useMemo, useRef } from 'react'
import type { HostCommand } from '../platform/hostCommands'

export type CommandStream = (listener: (command: HostCommand) => void) => () => void

export type CommandBus = {
  /** Every command, until the returned function is called. */
  on: CommandStream
  /** Say one, as if the host had. */
  send: (command: HostCommand) => void
}

export function useHostCommands(host?: CommandStream): CommandBus {
  const listeners = useRef(new Set<(command: HostCommand) => void>())

  const bus = useMemo<CommandBus>(() => ({
    on: (listener) => {
      listeners.current.add(listener)
      return () => { listeners.current.delete(listener) }
    },
    send: (command) => {
      // A copy: a listener may unsubscribe while being called.
      for (const listener of [...listeners.current]) listener(command)
    },
  }), [])

  useEffect(() => host?.((command) => bus.send(command)), [host, bus])

  return bus
}
