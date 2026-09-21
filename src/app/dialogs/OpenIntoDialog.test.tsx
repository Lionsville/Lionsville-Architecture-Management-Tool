// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../../i18n'
import { renderShell } from '../testing/renderShell'
import { OpenIntoDialog } from './OpenIntoDialog'

afterEach(() => cleanup())

const s = translator('en')

describe('OpenIntoDialog', () => {
  it('names the file, warns what replacing writes over, and offers both ways', () => {
    const onHere = vi.fn()
    const onFolder = vi.fn()
    renderShell(<OpenIntoDialog
      open file="theirs.lvarch" here="Nederlandse Spoorwegen" canChooseFolder
      onCancel={() => {}} onHere={onHere} onFolder={onFolder} s={s}
    />)
    expect(screen.getByText('Where should “theirs.lvarch” go?')).toBeDefined()
    expect(screen.getByText(/writes over “Nederlandse Spoorwegen” and every scope filed under it/)).toBeDefined()
    fireEvent.click(screen.getByTestId('open-into-folder'))
    expect(onFolder).toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('open-into-here'))
    expect(onHere).toHaveBeenCalled()
  })

  it('offers only "here" where no folder can be chosen, and still warns', () => {
    renderShell(<OpenIntoDialog
      open file="x.lvarch" here="Acme" canChooseFolder={false}
      onCancel={() => {}} onHere={() => {}} onFolder={() => {}} s={s}
    />)
    expect(screen.queryByTestId('open-into-folder')).toBeNull()
    expect(screen.getByText(/writes over “Acme”/)).toBeDefined()
  })
})
