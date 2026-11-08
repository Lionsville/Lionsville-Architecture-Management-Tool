// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Adding where the person is looking: one field that searches what exists and names
 * what is new, at the point asked for. Enter adds, Tab changes what a new one would be.
 * A logo, a colour and a shape are the inspector's, after it has a name.
 *
 * What exists comes first and in the same list, so reusing is no further away than
 * making a duplicate. With a line in hand, what is chosen arrives connected to it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStrings } from '../i18n/LanguageContext';
import { inSentence } from '../i18n/languages';
import { allowedKindsOn } from '../model/kindChange';
import type { DesignDiagram, ElementId, Layer7Zone, Point } from '../model/types';
import { PickerAt, type PickerOption } from '../widgets/kit/Picker';
import { newDomainGroup } from './canvas/domainGroupPlacement';
import { PALETTE_SECTIONS, paletteLabel, type PaletteKey } from './canvas/paletteItems';
import type { EditorParts } from './editorParts';
import './addPicker.css';

export type AddRequest = {
  /** Where the field opens, in window pixels. */
  screen: Point;
  /** What a new one would be, at first. */
  kind?: PaletteKey;
  /** Where it lands on the board. Absent: where its kind goes. */
  at?: { position: Point; zone?: Layer7Zone; group?: string };
  /** The line in hand comes from here. */
  connectFrom?: ElementId;
};

export function useAddRequests() {
  const [request, setRequest] = useState<AddRequest | undefined>(undefined);
  const close = useCallback(() => setRequest(undefined), []);
  return { request, ask: setRequest, close };
}
export type AddRequests = ReturnType<typeof useAddRequests>;

/** What may be added to this view, in the palette's order. */
export function addableKinds(diagram: DesignDiagram): PaletteKey[] {
  const allowed = new Set<PaletteKey>(allowedKindsOn(diagram));
  if (diagram.kind === 'layer7') allowed.add('domainGroup');
  return PALETTE_SECTIONS.flatMap((section) => section.keys).filter((key) => allowed.has(key));
}

export function AddPicker({ parts, diagram }: { parts: EditorParts; diagram: DesignDiagram }) {
  const { t, language } = useStrings();
  const { adding, state, props } = parts;
  const { request } = adding;
  const kinds = useMemo(() => addableKinds(diagram), [diagram]);
  const [chosen, setChosen] = useState<PaletteKey | undefined>(undefined);
  const kind: PaletteKey = chosen ?? request?.kind ?? kinds[0] ?? 'application';
  useEffect(() => setChosen(undefined), [request]);

  // Something brought in lands in a step of the host's, so its line waits for it.
  const pendingLine = useRef<{ from: ElementId; to: ElementId } | undefined>(undefined);
  useEffect(() => {
    const line = pendingLine.current;
    if (!line || !diagram.members.some((member) => member.id === line.to)) return;
    pendingLine.current = undefined;
    state.actions.connect(line.from, line.to);
  }, [diagram.members, state.actions]);

  const existing = useMemo<PickerOption[]>(() => {
    if (!request) return [];
    const rows = props.ownership?.existingRows?.() ?? [];
    // What exists of the kind asked for comes first, under its own heading, so the
    // list never offers a platform first while the chip says Application.
    const same = rows.filter((row) => row.kind === kind)
    const others = rows.filter((row) => row.kind !== kind)
    const option = (group: string) => (row: (typeof rows)[number]): PickerOption => ({ id: row.id, label: row.name, group, ...(row.detail ? { detail: row.detail } : {}) });
    return [...same.map(option(t('add.existingSame'))), ...others.map(option(t('add.existingOther')))];
  }, [request, props.ownership, kind, t]);

  if (!request) return null;
  const name = paletteLabel(kind, t);
  const stepKind = (back: boolean) => {
    const here = kinds.indexOf(kind);
    setChosen(kinds[(here + (back ? kinds.length - 1 : 1)) % kinds.length]);
  };
  const create = (typed: string) => {
    if (kind === 'domainGroup') {
      const { group, box } = newDomainGroup({
        diagram, translate: t, name: typed, ...(request.at ? { center: request.at.position } : {}),
      });
      state.actions.addDomainGroup(group, box);
      return;
    }
    state.actions.addElement({
      kind, name: typed,
      ...(request.at ?? {}),
      ...(request.connectFrom ? { connectFrom: request.connectFrom } : {}),
    });
  };
  const pick = (option: PickerOption) => {
    if (request.connectFrom) pendingLine.current = { from: request.connectFrom, to: option.id };
    props.ownership?.onPickExisting?.(option.id, request.at ? { ...request.at } : undefined);
  };
  return (
    <PickerAt
      open
      at={request.screen}
      onClose={adding.close}
      label={t('add.label')}
      placeholder={t('add.placeholder')}
      options={existing}
      onPick={pick}
      onCreate={create}
      createLabel={(typed) => t('add.new', { kind: inSentence(name, language), name: typed })}
      onTab={stepKind}
      foot={(
        <>
          <span className="lv-add__kinds" role="radiogroup" aria-label={t('add.kind')}>
            <span>{t('add.kind')}</span>
            {kinds.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={key === kind}
                className="lv-add__kind"
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setChosen(key)}
              >
                {paletteLabel(key, t)}
              </button>
            ))}
          </span>
          <span className="lv-add__how">{t('add.how')}</span>
        </>
      )}
    />
  );
}
