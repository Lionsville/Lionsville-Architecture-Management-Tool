/**
 * A host for the editor, in a test.
 *
 * The editor keeps no copy of the document any more (ADR-0002): it builds a
 * command, sends it to `dispatch`, and draws whatever comes back. So a test
 * that wants to see an edit land needs something on the other end of that call
 * — and the honest something is the real reducer over the real indexed model,
 * not a `vi.fn()`. That is what this is: one model, one undo stack, `apply`.
 *
 * It is deliberately the same shape as `app/useModelSession`, minus everything
 * the session has that a canvas test does not care about (storage, autosave,
 * project refs, toasts). Where the two would disagree the session is right and
 * this is a bug; the shell's own tests are what pin the session.
 */
import { useCallback, useRef, useState } from 'react'
import { renderHook } from '@testing-library/react'
import { apply, fromArrays, toArrays, transaction } from '../../model'
import type { Command, DesignModel, Model } from '../../model'
import type {
  EditorHistory, EditorRequests, SolutionDesignEditorProps,
} from '../props'
import type { EditorPreferences } from '../preferences'
import type { DiagramSettings, ElementId, UploadedLogo } from '../../model/types'
import type { Language } from '../../i18n/strings'
import type { IdPolicy } from '../../model/keys'
import type { WindowChrome } from '../../platform/windowChrome'
import { useEditorState } from '../useEditorState'
import { SolutionDesignEditor } from '../SolutionDesignEditor'

/**
 * What a component test varies, flat.
 *
 * Deliberately NOT `SolutionDesignEditorProps`. The editor's own contract is
 * grouped — a dozen entries, each naming one thing the host owns — and a test
 * that wants a different model should be able to say `{ model }` rather than
 * rebuild the group around it. `hostedProps` below is the one place that maps
 * this onto the real shape, so the grouping is still exercised on every render.
 */
export type HostedEditorProps = {
  model: DesignModel
  activeDiagramId?: string
  readOnly?: boolean
  ids?: IdPolicy
  onActiveDiagramChange?(diagramId: string): void
  onCreateContainerDiagram?(applicationElementId: ElementId): void
  onCreateLayer7Diagram?(): void
  onRenameDiagram?(diagramId: string, name: string): void
  onDuplicateDiagram?(diagramId: string): void
  onDeleteDiagram?(diagramId: string): void
  onDiagramSettingsChange?(diagramId: string, settings: DiagramSettings): void
  focusElement?: EditorRequests['focus']
  documentationRequest?: EditorRequests['documentation']
  onLayoutError?(message: string): void
  onLayoutSettled?(diagramId: string): void
  initialPreferences?: unknown
  onPreferencesChange?(preferences: EditorPreferences): void
  language?: Language
  onLanguageChange?(language: Language): void
  logoLibrary?: UploadedLogo[]
  onRequestLogoUpload?(): void
  onExportImagesMissing?(labels: string[]): void
  renderMarkdown?: SolutionDesignEditorProps['renderMarkdown']
  exportTitleBlock?: SolutionDesignEditorProps['exportTitleBlock']
  windowChrome?: WindowChrome
  onForceSave?(): void
}

export type EditorHostState = {
  /** The document as it now stands. */
  model: DesignModel
  dispatch: SolutionDesignEditorProps['editing']['dispatch']
  history: EditorHistory
  /** Every command the editor sent, in order, newest last. */
  commands: readonly Command[]
  /** The refusals the reducer answered with, for a test that expects one. */
  refused: readonly Command[]
}

/**
 * Hold `document` and let the editor edit it.
 *
 * Handing a different `document` object swaps the document, exactly as the
 * shell's `adopt` does: the model is replaced and the stack forgotten. Handing
 * the same one again changes nothing, so a re-render for any other reason does
 * not throw away what the test has done so far.
 */
export function useEditorHost(document: DesignModel): EditorHostState {
  const [model, setModel] = useState<Model>(() => fromArrays(document))
  const modelRef = useRef(model)
  modelRef.current = model
  const past = useRef<Command[]>([])
  const future = useRef<Command[]>([])
  const commands = useRef<Command[]>([])
  const refused = useRef<Command[]>([])
  const [, setVersion] = useState(0)

  const seen = useRef(document)
  if (seen.current !== document) {
    seen.current = document
    const next = fromArrays(document)
    modelRef.current = next
    past.current = []
    future.current = []
    setModel(next)
  }

  const arraysRef = useRef<{ from: Model; to: DesignModel } | null>(null)
  const asArrays = useCallback((m: Model): DesignModel => {
    if (arraysRef.current?.from !== m) arraysRef.current = { from: m, to: toArrays(m) }
    return arraysRef.current.to
  }, [])

  const dispatch = useCallback<SolutionDesignEditorProps['editing']['dispatch']>((command) => {
    commands.current.push(command)
    const before = modelRef.current
    const result = apply(before, command)
    if (!result.ok) {
      refused.current.push(command)
      return undefined
    }
    if (result.model === before) return asArrays(before)
    modelRef.current = result.model
    setModel(result.model)
    if (command.undoable !== false) {
      const top = past.current[past.current.length - 1]
      // The same coalescing rule the session applies: a step whose key matches
      // the one on top is folded into it rather than pushed after it.
      if (command.coalesce !== undefined && top?.coalesce === command.coalesce) {
        past.current[past.current.length - 1] =
          transaction([result.inverse, top], { coalesce: command.coalesce })
      } else past.current.push(result.inverse)
      future.current = []
    }
    setVersion((v) => v + 1)
    return asArrays(result.model)
  }, [asArrays])

  const step = useCallback((from: 'past' | 'future') => {
    const stack = from === 'past' ? past.current : future.current
    const other = from === 'past' ? future.current : past.current
    const entry = stack.pop()
    if (!entry) return
    const result = apply(modelRef.current, entry)
    if (!result.ok) return
    other.push(result.inverse)
    modelRef.current = result.model
    setModel(result.model)
    setVersion((v) => v + 1)
  }, [])

  return {
    model: asArrays(model),
    dispatch,
    history: {
      undo: () => step('past'),
      redo: () => step('future'),
      canUndo: past.current.length > 0,
      canRedo: future.current.length > 0,
    },
    commands: commands.current,
    refused: refused.current,
  }
}

/** The flat test shape, said the way the editor asks for it. */
export function hostedProps(
  host: EditorHostState,
  o: Partial<HostedEditorProps> = {},
): SolutionDesignEditorProps {
  return {
    document: {
      model: host.model,
      activeDiagramId: o.activeDiagramId ?? 'd1',
      onActiveDiagramChange: o.onActiveDiagramChange ?? (() => {}),
    },
    editing: {
      dispatch: host.dispatch,
      history: host.history,
      ids: o.ids,
      readOnly: o.readOnly,
    },
    diagrams: {
      onCreateContainer: o.onCreateContainerDiagram ?? (() => {}),
      onCreateLayer7: o.onCreateLayer7Diagram ?? (() => {}),
      onRename: o.onRenameDiagram,
      onDuplicate: o.onDuplicateDiagram,
      onDelete: o.onDeleteDiagram,
      onSettingsChange: o.onDiagramSettingsChange,
    },
    requests: { focus: o.focusElement, documentation: o.documentationRequest },
    layout: { onError: o.onLayoutError, onSettled: o.onLayoutSettled },
    preferences: { initial: o.initialPreferences, onChange: o.onPreferencesChange },
    language: { value: o.language, onChange: o.onLanguageChange },
    logos: {
      library: o.logoLibrary,
      onRequestUpload: o.onRequestLogoUpload,
      onExportImagesMissing: o.onExportImagesMissing,
    },
    renderMarkdown: o.renderMarkdown,
    exportTitleBlock: o.exportTitleBlock,
    windowChrome: o.windowChrome,
    onForceSave: o.onForceSave,
  }
}

/**
 * `useEditorState` over a live host — what almost every action test wants.
 *
 * `host.current` is the host as of the last render, so a test can read the
 * model, the commands that were sent, and whether undo is available.
 */
export function renderEditorState(
  document: DesignModel,
  overrides: Partial<HostedEditorProps> = {},
) {
  const host: { current: EditorHostState } = { current: undefined as never }
  const view = renderHook(() => {
    host.current = useEditorHost(document)
    return useEditorState(hostedProps(host.current, overrides))
  })
  return { ...view, host }
}

/**
 * The editor, on a live host — what a component test renders.
 *
 * `model` is the document to start from; handing a different object swaps it.
 * `hostRef`, when given, is filled in on every render, so a test can read the
 * model as it now stands and the commands that got it there.
 */
export function HostedEditor({
  hostRef,
  ...props
}: HostedEditorProps & { hostRef?: { current: EditorHostState } }) {
  const host = useEditorHost(props.model)
  if (hostRef) hostRef.current = host
  return <SolutionDesignEditor {...hostedProps(host, props)} />
}
