/**
 * What a new plan's body starts as (ADR-0009, ADR-0010).
 *
 * Headings for the things a plan has to say — goal, scope, approach, risks,
 * rollback — and, under the business case, the fence the document computes.
 * The headings are words and come from the string table; the fence is a
 * format and comes from the module that reads it.
 */
import { businessCaseTemplate } from '../documentation'
import type { Translate } from '../i18n'

export function planBodyTemplate(t: Translate): string {
  return t('plan.template', { businessCase: businessCaseTemplate() })
}
