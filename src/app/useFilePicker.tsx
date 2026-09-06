/**
 * A hidden file field you can open from elsewhere.
 *
 * The shell has two, with different owners: the document field hangs off the
 * "Open…" button in the toolbar, the mark field off a request coming out of the
 * icon picker inside the package. Both are the same pattern — a field nobody
 * sees, a `click()` from outside, and clearing the field so the same file can be
 * chosen twice.
 *
 * That last part is why this is a hook and not two snippets of JSX: the
 * `value = ''` after a choice was forgotten once, and then a file you had just
 * opened could not be opened again, which reads as "it does nothing".
 */
import { useCallback, useRef } from 'react'

export type FilePicker = {
  /** Open the dialog. */
  open: () => void
  /** To place anywhere in the tree; it is invisible. */
  input: React.ReactElement
}

export function useFilePicker(options: {
  accept: string
  onPick: (file: File) => void
  testId?: string
}): FilePicker {
  const { accept, onPick, testId } = options
  const ref = useRef<HTMLInputElement>(null)

  const open = useCallback(() => ref.current?.click(), [])

  const input = (
    <input
      ref={ref}
      type="file"
      accept={accept}
      hidden
      data-testid={testId}
      onChange={(ev) => {
        const file = ev.target.files?.[0]
        if (file) onPick(file)
        ev.target.value = ''
      }}
    />
  )

  return { open, input }
}
