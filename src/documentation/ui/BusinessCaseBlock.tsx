/**
 * A ```business-case fence, computed (ADR-0009).
 *
 * The table above the line is what the author typed; everything below it is
 * arithmetic, done here rather than in a spreadsheet so that a reader sees the
 * inputs and the answers in one place. `businessCase.ts` beside this holds all
 * of it — this file decides only how the answers look.
 *
 * A block that cannot be read renders as its own source, which is the rule
 * every drawn fence in this app follows: a block that fails must never take its
 * text with it.
 */
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n'
import type { Language, Translate } from '../../i18n'
import { computeBusinessCase, readBusinessCase } from '../businessCase'
import type { BusinessCase, BusinessCaseResult } from '../businessCase'

const CODE_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

/** The locale each language counts in — `1.200,50` against `1,200.50`. */
const LOCALE: Record<Language, string> = { en: 'en-GB', nl: 'nl-NL' }

/**
 * Money, in the block's own currency where it named one this runtime knows.
 *
 * A three-letter code goes to `Intl`, which knows the symbol and where it
 * belongs in each language. Anything else — a symbol, a word, a currency
 * invented for a model — is printed beside the number instead of being
 * refused, because what the author meant is still perfectly clear.
 */
function money(value: number, currency: string | undefined, locale: string): string {
  const rounded = Math.round(value)
  if (currency && /^[A-Za-z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0,
      }).format(rounded)
    } catch {
      // An unknown code: fall through and print it as a word.
    }
  }
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(rounded)
  return currency ? `${currency} ${number}` : number
}

function percent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value)
}

export type BusinessCaseBlockProps = {
  code: string
  /** For a test that wants the parse it is asserting against. */
  read?: (source: string) => BusinessCase
}

export function BusinessCaseBlock({ code, read = readBusinessCase }: BusinessCaseBlockProps) {
  const { t, language } = useStrings()
  const locale = LOCALE[language] ?? 'en-GB'
  const { held, result } = useMemo(() => {
    const parsed = read(code)
    return { held: parsed, result: computeBusinessCase(parsed) }
  }, [code, read])

  // Nothing to compute over: show the source, so a block being typed is still
  // the text its author is typing.
  if (!held.lines.length) {
    return (
      <Box data-testid="business-case" data-state="unreadable" sx={{ my: '0.7em' }}>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
          {t('doc.businessCaseUnreadable')}
        </Typography>
        <Box component="pre" sx={{ m: 0, p: '0.8em', overflowX: 'auto', borderRadius: 1, bgcolor: 'action.hover', fontFamily: CODE_FONT, fontSize: '0.9em' }}>
          <code>{code}</code>
        </Box>
      </Box>
    )
  }

  const figures = summaryFigures(result, held, locale, t)

  return (
    <Box data-testid="business-case" data-state="computed" sx={{ my: '0.7em' }}>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ width: 'auto', minWidth: '60%', '& td, & th': { fontSize: 'inherit', border: 1, borderColor: 'divider', whiteSpace: 'nowrap' } }}>
          <TableHead sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
            <TableRow>
              <TableCell component="th">{t('doc.businessCaseLine')}</TableCell>
              {held.periods.map((period, at) => (
                <TableCell component="th" key={`${period}-${at}`} align="right">{period}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {held.lines.map((line, at) => (
              <TableRow key={`${line.name}-${at}`}>
                <TableCell>{line.name}</TableCell>
                {line.amounts.map((amount, period) => (
                  <TableCell key={period} align="right" sx={{ color: amount < 0 ? 'error.main' : undefined }}>
                    {amount === 0 ? '' : money(amount, held.currency, locale)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {/* Computed, and marked as such: a reader has to be able to tell
                which rows were typed and which were worked out. */}
            <TableRow sx={{ '& td': { fontWeight: 600, borderTop: 2, borderTopColor: 'divider' } }}>
              <TableCell>{t('doc.businessCaseNet')}</TableCell>
              {result.net.map((amount, period) => (
                <TableCell key={period} align="right" sx={{ color: amount < 0 ? 'error.main' : undefined }}>
                  {money(amount, held.currency, locale)}
                </TableCell>
              ))}
            </TableRow>
            <TableRow sx={{ '& td': { color: 'text.secondary' } }}>
              <TableCell>{t('doc.businessCaseCumulative')}</TableCell>
              {result.cumulative.map((amount, period) => (
                <TableCell key={period} align="right" sx={{ color: amount < 0 ? 'error.main' : undefined }}>
                  {money(amount, held.currency, locale)}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, mt: 1.25 }}>
        {figures.map((figure) => (
          <Box key={figure.label} data-testid={`figure-${figure.id}`}>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.2 }}>
              {figure.label}
            </Typography>
            <Typography component="div" sx={{ fontWeight: 600, fontSize: '1.05em' }}>
              {figure.value}
            </Typography>
          </Box>
        ))}
      </Box>

      {result.score && (
        <Box sx={{ mt: 1.25 }}>
          <Typography variant="caption" color="text.secondary" component="div">
            {/* The scale and the maximum are said out loud on purpose: a
                weighted total means nothing without the maximum it is out of,
                and that is exactly what the sheet this replaces got wrong. */}
            {t('doc.businessCaseScore', {
              total: String(result.score.total),
              max: String(result.score.max),
              scale: String(result.score.scale),
            })}
          </Typography>
          <Box component="ul" sx={{ my: 0.5, pl: '1.2em', color: 'text.secondary', fontSize: '0.9em' }}>
            {held.criteria.map((criterion, at) => (
              <Box component="li" key={`${criterion.name}-${at}`}>
                {criterion.name} — {criterion.score} × {criterion.weight}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}

type Figure = { id: string; label: string; value: string }

function summaryFigures(
  result: BusinessCaseResult,
  held: BusinessCase,
  locale: string,
  translate: Translate,
): Figure[] {
  const figures: Figure[] = []
  if (result.npv !== undefined) {
    figures.push({
      id: 'npv',
      label: translate('doc.businessCaseNpv', { rate: percent(held.discountRate ?? 0, locale) }),
      value: money(result.npv, held.currency, locale),
    })
  }
  if (result.irr !== undefined) {
    figures.push({ id: 'irr', label: translate('doc.businessCaseIrr'), value: percent(result.irr, locale) })
  }
  if (result.payback !== undefined) {
    figures.push({
      id: 'payback',
      label: translate('doc.businessCasePayback'),
      value: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(result.payback),
    })
  }
  if (result.roi !== undefined) {
    figures.push({ id: 'roi', label: translate('doc.businessCaseRoi'), value: percent(result.roi, locale) })
  }
  if (result.ratio !== undefined) {
    figures.push({
      id: 'ratio',
      label: translate('doc.businessCaseRatio'),
      value: `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(result.ratio)}×`,
    })
  }
  return figures
}
