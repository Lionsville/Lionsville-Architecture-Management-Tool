/**
 * A business case, as a block inside the document that argues for it
 * (ADR-0009).
 *
 * The case for replacing an application is prose with one table in it, and the
 * table is the part everybody skips to. Today that table lives in a
 * spreadsheet, and the measured cost of that is written into ADR-0009: of the
 * five-sheet workbook this was designed down from, the headline net present
 * value was discounted a period too far and the headline efficiency gain was an
 * operator-precedence bug. Both were invisible, because a reader of a
 * spreadsheet sees numbers and never formulas.
 *
 * So the input is a table a person can read and the output is computed where it
 * is read. What that buys is not accuracy — a spreadsheet is perfectly capable
 * of being right — but *evidence*: the inputs are in the document, the
 * arithmetic is in this file, and this file has tests whose fixtures are that
 * workbook's own cash flows.
 *
 * ## The shape
 *
 * ```
 * currency: EUR
 * discount rate: 10%
 *
 * | Line       | Year 0   | Year 1 | Year 2  |
 * | ---------- | -------- | ------ | ------- |
 * | Investment | -415 000 |        |         |
 * | Savings    |          | 25 000 | 125 000 |
 *
 * | Criterion               | Weight | Score |
 * | ----------------------- | ------ | ----- |
 * | Alignment with strategy | 3      | 4     |
 * ```
 *
 * Keys first, then **the first table is the money and the second is the
 * scorecard** — an order rather than a set of magic column headings, because
 * this app ships in two languages and a format that only worked in one of them
 * would be a format that only worked for half its users. The first column names
 * a line, the rest are periods, a negative number is money out, a positive one
 * is money in, and a blank cell is zero.
 *
 * The keys are English and stay English. The fence's contents are a *format* —
 * a thing written into somebody's file that this must still read in five years
 * — and that puts it in the same place as the agent's tool names: a contract,
 * outside i18n. What is rendered around it is translated; what is typed is not.
 *
 * ## What it deliberately does not do
 *
 * The workbook's other three sheets are twenty-two baseline-versus-improved
 * pairs, each derived to a percentage, each with a score from one to five typed
 * beside it that the percentage does not feed. The derived half and the judged
 * half never meet, which is what happens when judgement is dressed as
 * arithmetic. The scorecard here is the judged half, said plainly: a few
 * criteria, an explicit scale, and a maximum that is derived rather than typed
 * — the workbook's own maximum was computed at five per criterion under a label
 * that said one to ten.
 *
 * Everything else that sheet scored belongs in a decision record, with its
 * drivers and its options and its consequences, which is a thing this tool
 * already has.
 *
 * **Nothing here rewrites the text.** The block is read, never reformatted: it
 * is the author's table, and a tool that tidied it on every save would make
 * every save a diff.
 */

/** The one to five a criterion is scored on. Named, because the reader is told. */
export const SCORE_SCALE = 5

export type CashLine = {
  name: string
  /** One amount per period, zero where the cell was blank. */
  amounts: number[]
}

export type Criterion = {
  name: string
  weight: number
  score: number
}

export type BusinessCase = {
  currency?: string
  /** As a fraction: `10%` and `0.1` both arrive here as 0.1. */
  discountRate?: number
  /** The column headings after the first — whatever the author called them. */
  periods: string[]
  lines: CashLine[]
  criteria: Criterion[]
  /**
   * Keys this does not know, kept rather than dropped.
   *
   * A block written against a later version of this app opens here with its
   * extra keys in hand, which is what stops an older build from quietly
   * discarding them when it re-renders. Nothing reads them yet.
   */
  extra: Record<string, string>
}

export type BusinessCaseResult = {
  /** Per period: everything in, minus everything out. */
  net: number[]
  cumulative: number[]
  totalIn: number
  totalOut: number
  /**
   * Net present value, with period 0 undiscounted.
   *
   * This is the whole of the bug the workbook had. Excel's `NPV` discounts its
   * *first* argument by one period, so `=NPV(rate, investment:last)` — the
   * obvious thing to write — moves every figure a year into the future,
   * including the money that was spent today. Absent when no rate was given.
   */
  npv?: number
  /** The rate at which the net present value is zero. Absent when there is none. */
  irr?: number
  /** In periods, interpolated inside the one it crosses. Absent when it never does. */
  payback?: number
  /** (in − out) / out. Absent when nothing was spent. */
  roi?: number
  /** in / out — the benefit-cost ratio. Absent when nothing was spent. */
  ratio?: number
  score?: { total: number; max: number; scale: number }
}

// --- reading ----------------------------------------------------------------

/**
 * A number as a person writes one: `1 200`, `1.200`, `€ -1,200.50`, `(1200)`.
 *
 * The awkward case is a lone separator — `1.200` is twelve hundred in Dutch and
 * one-point-two in English — and it is settled by counting: a single separator
 * with exactly three digits after it groups thousands, anything else is a
 * decimal point. With both present, the last one is the decimal.
 */
export function readAmount(text: string): number | undefined {
  const trimmed = text.trim()
  if (!trimmed) return 0
  const negative = /^\(.*\)$/.test(trimmed)
  // Currency symbols, letters and spaces of every kind, including the
  // non-breaking ones a spreadsheet pastes in.
  let cleaned = trimmed.replace(/[()]/g, '').replace(/[^\d.,+-]/g, '')
  if (!cleaned || !/\d/.test(cleaned)) return undefined
  const sign = cleaned.startsWith('-') || negative ? -1 : 1
  cleaned = cleaned.replace(/[+-]/g, '')

  const lastDot = cleaned.lastIndexOf('.')
  const lastComma = cleaned.lastIndexOf(',')
  let decimal = -1
  if (lastDot >= 0 && lastComma >= 0) {
    decimal = Math.max(lastDot, lastComma)
  } else if (lastDot >= 0 || lastComma >= 0) {
    const only = Math.max(lastDot, lastComma)
    const after = cleaned.length - only - 1
    const separators = (cleaned.match(/[.,]/g) ?? []).length
    // One separator, three digits after it, and digits before it: thousands.
    if (!(separators > 1 || (after === 3 && only > 0))) decimal = only
  }
  const digits = decimal >= 0
    ? `${cleaned.slice(0, decimal).replace(/[.,]/g, '')}.${cleaned.slice(decimal + 1).replace(/[.,]/g, '')}`
    : cleaned.replace(/[.,]/g, '')
  const value = Number(digits)
  return Number.isFinite(value) ? sign * value : undefined
}

/** A rate as `10%`, `10 %` or `0.1`. */
function readRate(text: string): number | undefined {
  const percent = text.includes('%')
  const value = readAmount(text)
  if (value === undefined) return undefined
  return percent ? value / 100 : value
}

/** The cells of one markdown table row, without the outer pipes. */
function cells(row: string): string[] {
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

/** Whether this row is the `|---|---|` rule under a table's heading. */
function isRule(row: string): boolean {
  return cells(row).every((cell) => /^:?-{1,}:?$/.test(cell))
}

type Table = { header: string[]; rows: string[][] }

/** Every markdown table in the text, in order. */
function tablesIn(lines: string[]): Table[] {
  const tables: Table[] = []
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes('|') || i + 1 >= lines.length || !isRule(lines[i + 1])) continue
    const header = cells(lines[i])
    const rows: string[][] = []
    let at = i + 2
    while (at < lines.length && lines[at].includes('|') && lines[at].trim()) {
      rows.push(cells(lines[at]))
      at += 1
    }
    tables.push({ header, rows })
    i = at - 1
  }
  return tables
}

/**
 * Read a block. Never throws and never refuses: a half-written case still shows
 * the half that reads, because a person editing one is looking at the result
 * while they type.
 */
export function readBusinessCase(source: string): BusinessCase {
  const lines = source.split('\n')
  const extra: Record<string, string> = {}
  let currency: string | undefined
  let discountRate: number | undefined

  for (const line of lines) {
    if (line.includes('|')) break
    const match = /^\s*([A-Za-z][A-Za-z ]*?)\s*:\s*(.*)$/.exec(line)
    if (!match) continue
    const [, rawKey, value] = match
    const key = rawKey.trim().toLowerCase()
    if (key === 'currency') currency = value.trim() || undefined
    else if (key === 'discount rate') discountRate = readRate(value)
    else extra[key] = value.trim()
  }

  const tables = tablesIn(lines)
  const money = tables[0]
  const periods = money ? money.header.slice(1).map((name) => name.trim()) : []
  const lineItems: CashLine[] = (money?.rows ?? [])
    .filter((row) => row.length > 1 && row[0].trim())
    .map((row) => ({
      name: row[0].trim(),
      // Every line is the width of the header, so a short row is trailing zeros
      // rather than a line whose periods mean something different.
      amounts: periods.map((_period, at) => readAmount(row[at + 1] ?? '') ?? 0),
    }))

  const criteria: Criterion[] = (tables[1]?.rows ?? [])
    .filter((row) => row.length >= 3 && row[0].trim())
    .map((row) => ({
      name: row[0].trim(),
      weight: readAmount(row[1]) ?? 0,
      score: readAmount(row[2]) ?? 0,
    }))
    .filter((criterion) => criterion.weight > 0)

  return { currency, discountRate, periods, lines: lineItems, criteria, extra }
}

// --- the arithmetic ---------------------------------------------------------

/** Net present value with period 0 undiscounted. See {@link BusinessCaseResult.npv}. */
export function netPresentValue(net: readonly number[], rate: number): number {
  return net.reduce((sum, amount, period) => sum + amount / (1 + rate) ** period, 0)
}

/**
 * The rate at which the net present value is zero, by bisection.
 *
 * Bisection rather than Newton's method: there is no library here, the range a
 * business case can sensibly live in is small, and bisection cannot run away
 * from a badly behaved series — it either brackets a sign change or reports
 * that there is not one to find.
 */
export function internalRateOfReturn(net: readonly number[]): number | undefined {
  // The precondition, stated rather than discovered: a rate of return is the
  // rate at which money out balances money in, so a series that is all one way
  // — or is empty, which balances at every rate and so at none — has none.
  if (!net.some((amount) => amount > 0) || !net.some((amount) => amount < 0)) return undefined

  let low = -0.9999
  let high = 1000
  let atLow = netPresentValue(net, low)
  const atHigh = netPresentValue(net, high)
  if (!Number.isFinite(atLow) || !Number.isFinite(atHigh)) return undefined
  if (atLow === 0) return low
  if (atHigh === 0) return high
  // Still possible with a series that changes sign more than once: there may be
  // several rates, or none in this range, and reporting nothing is honest.
  if ((atLow > 0) === (atHigh > 0)) return undefined
  for (let step = 0; step < 200; step += 1) {
    const middle = (low + high) / 2
    const value = netPresentValue(net, middle)
    if (value === 0 || high - low < 1e-9) return middle
    if ((value > 0) === (atLow > 0)) { low = middle; atLow = value } else high = middle
  }
  return (low + high) / 2
}

/** Everything the block says, from what it holds. */
export function computeBusinessCase(held: BusinessCase): BusinessCaseResult {
  const width = held.periods.length
  const net = Array.from({ length: width }, (_unused, period) =>
    held.lines.reduce((sum, line) => sum + (line.amounts[period] ?? 0), 0))

  const cumulative: number[] = []
  net.reduce((running, amount) => {
    const total = running + amount
    cumulative.push(total)
    return total
  }, 0)

  let totalIn = 0
  let totalOut = 0
  for (const line of held.lines) {
    for (const amount of line.amounts) {
      if (amount > 0) totalIn += amount
      else totalOut -= amount
    }
  }

  const result: BusinessCaseResult = { net, cumulative, totalIn, totalOut }

  if (held.discountRate !== undefined && width > 0) {
    result.npv = netPresentValue(net, held.discountRate)
  }
  if (width > 0) {
    const irr = internalRateOfReturn(net)
    if (irr !== undefined) result.irr = irr
  }

  // The period the money is back, counted from the start and interpolated
  // inside the period it crosses — the fraction of that period's own flow that
  // was still owed when it began.
  const crossed = cumulative.findIndex((total) => total >= 0)
  if (crossed === 0) result.payback = 0
  else if (crossed > 0) {
    const owed = -cumulative[crossed - 1]
    const flow = net[crossed]
    result.payback = flow > 0 ? crossed - 1 + owed / flow : crossed
  }

  if (totalOut > 0) {
    result.roi = (totalIn - totalOut) / totalOut
    result.ratio = totalIn / totalOut
  }

  if (held.criteria.length) {
    result.score = {
      total: held.criteria.reduce((sum, one) => sum + one.weight * one.score, 0),
      max: held.criteria.reduce((sum, one) => sum + one.weight * SCORE_SCALE, 0),
      scale: SCORE_SCALE,
    }
  }

  return result
}

/**
 * A block to start from, as the fence a document holds it in.
 *
 * English, like the keys and for the same reason: this is the format, and a
 * template that wrote Dutch keys would write a block nothing could read. The
 * years are the periods most cases are argued over, and the two example lines
 * are there to be replaced rather than to be right.
 */
export function businessCaseTemplate(): string {
  return [
    '```business-case',
    'currency: EUR',
    'discount rate: 10%',
    '',
    '| Line       | Year 0 | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 |',
    '| ---------- | ------ | ------ | ------ | ------ | ------ | ------ |',
    '| Investment |        |        |        |        |        |        |',
    '| Benefit    |        |        |        |        |        |        |',
    '',
    '| Criterion | Weight | Score |',
    '| --------- | ------ | ----- |',
    '|           |        |       |',
    '```',
  ].join('\n')
}
