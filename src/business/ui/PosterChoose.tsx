// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two things Design asks for in words: which icon a step or a stakeholder
 * carries, and which picture goes on the poster and what it shows. A picture is an
 * image of this scope's by its content address, or one added to it here, and a text
 * for a screen reader is required of it.
 */
import { useContext, useRef, useState } from 'react'
import { PicturesContext, PictureThumbnail } from '../../documentation/ui/Pictures'
import { useStrings } from '../../i18n'
import type { ImageEntry } from '../../model/imageName'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { TextField, TextInput } from '../../widgets/kit/Field'
import { LineIcon, POSTER_ICONS } from './posterIcons'

/** Under this a logo goes soft on paper, and the person is told. */
const LOGO_ENOUGH_PX = 200

export function useScopeImages(): readonly ImageEntry[] {
  return [...useContext(PicturesContext).entries.values()]
}

/** The images of the scope, each a press. */
function ImagePick({ onPick, chosen, addImage }: { onPick(entry: ImageEntry): void; chosen: string | undefined; addImage?: ((file: File) => Promise<string | undefined>) | undefined }) {
  const { t } = useStrings()
  const images = useScopeImages()
  const file = useRef<HTMLInputElement>(null)
  return (
    <>
      <div className="poster-icons">
        {images.map((entry) => (
          <button key={entry.name} type="button" title={entry.name} aria-label={entry.name} aria-pressed={entry.contentAddress === chosen} onClick={() => onPick(entry)}>
            <PictureThumbnail entry={entry} />
          </button>
        ))}
      </div>
      {addImage && (
        <>
          <input
            ref={file} type="file" accept="image/*" hidden aria-label={t('sheet.poster.addImage')}
            onChange={(event) => {
              const picked = event.target.files?.[0]
              if (picked) void addImage(picked)
              event.target.value = ''
            }}
          />
          <Button variant="quiet" size="small" onClick={() => file.current?.click()}>{t('sheet.poster.addImage')}</Button>
        </>
      )}
    </>
  )
}

export function PosterIconDialog({ name, icon, onChoose, onClose, addImage }: {
  name: string
  icon: string | undefined
  onChoose(icon: string | undefined): void
  onClose(): void
  addImage?: ((file: File) => Promise<string | undefined>) | undefined
}) {
  const { t } = useStrings()
  const [find, setFind] = useState('')
  const [images, setImages] = useState(false)
  const shown = POSTER_ICONS.filter((one) => one.includes(find.trim().toLocaleLowerCase()))
  const scope = useScopeImages()
  const small = scope.find((entry) => entry.contentAddress === icon && entry.width < LOGO_ENOUGH_PX)
  return (
    <Dialog
      open size="s" title={t('sheet.poster.iconFor', { name })} onClose={onClose}
      actions={{
        aside: [{ onClick: () => { onChoose(undefined); onClose() }, label: t('sheet.poster.noIcon') }, { onClick: () => setImages((was) => !was), label: t('sheet.poster.fromImages') }],
        cancel: { onClick: onClose, label: t('common.close') },
      }}
    >
      {images
        ? <ImagePick chosen={icon} addImage={addImage} onPick={(entry) => { onChoose(entry.contentAddress); onClose() }} />
        : (
          <>
            <TextInput value={find} placeholder={t('sheet.poster.findIcon')} aria-label={t('sheet.poster.findIcon')} onChange={(event) => setFind(event.target.value)} autoFocus />
            <div className="poster-icons" style={{ marginBlockStart: 8 }}>
              {shown.map((one) => (
                <button key={one} type="button" title={one} aria-label={one} aria-pressed={one === icon} onClick={() => { onChoose(one); onClose() }}><LineIcon name={one} size={20} /></button>
              ))}
            </div>
          </>
        )}
      {small && <p>{t('sheet.poster.logoSmall')}</p>}
    </Dialog>
  )
}

export function PosterPictureDialog({ onAdd, onClose, addImage }: {
  onAdd(image: string, alt: string): void
  onClose(): void
  addImage?: ((file: File) => Promise<string | undefined>) | undefined
}) {
  const { t } = useStrings()
  const [image, setImage] = useState<string | undefined>(undefined)
  const [alt, setAlt] = useState('')
  const ready = image !== undefined && alt.trim() !== ''
  return (
    <Dialog
      open size="s" title={t('sheet.poster.pictureTitle')} onClose={onClose}
      actions={{
        cancel: { onClick: onClose, label: t('common.cancel') },
        outcome: { disabled: !ready, onClick: () => { if (image !== undefined) onAdd(image, alt.trim()); onClose() }, label: t('sheet.poster.addPicture') },
      }}
    >
      <ImagePick chosen={image} addImage={addImage} onPick={(entry) => setImage(entry.contentAddress)} />
      <TextField label={t('sheet.poster.pictureAlt')} value={alt} onChange={setAlt} />
    </Dialog>
  )
}
