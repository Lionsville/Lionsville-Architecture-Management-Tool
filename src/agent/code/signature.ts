// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A method's signature, written from the schema its tool is checked against
 * (ADR-0051): what a script may pass, as TypeScript, because that is the
 * notation a model reads an API in and a fifth of the characters the same
 * schema costs as JSON.
 *
 * Written from the argument schema and from nothing else, so a signature
 * cannot say what the check would refuse. An enum is a union of literals,
 * an integer and a number are `number`, a row is an inline object, a map a
 * `Record`, and what is required loses its `?`. The shapes many tools share
 * are said once by name ({@link SHARED_SHAPES}). Two arguments every tool
 * has are left out of every signature and said once in the rules instead:
 * `scope`, which `lv.in(path)` sets, and `ifRevision`, which a script has no
 * use for — `run` holds each scope to the revision it was tried at.
 *
 * Every method answers `Promise<unknown>`: the tool table says what goes in
 * and not what comes out, and a signature does not make it up.
 */
import { PRINCIPLES_CITED, PRINCIPLE_REF, REVISION_GUARD, SCOPE_ARGUMENT, personArgument } from '../tools'
import type { ArgumentSchema, InputSchema, RowSchema } from '../tools'

/**
 * The arguments a signature leaves out, said once for every method: the
 * scope and the guard the tool table adds to every tool. A `scope` a tool
 * spells for itself — a filter over the tree, a destination — is its own
 * argument and stays.
 */
const SAID_ONCE: readonly ArgumentSchema[] = [SCOPE_ARGUMENT, REVISION_GUARD]

const saidOnce = (schema: InputSchema | RowSchema): string[] =>
  Object.entries(schema.properties).filter(([, spec]) => SAID_ONCE.includes(spec)).map(([name]) => name)

/** The three arguments of a page, which every list read takes: one name in a signature. */
const PAGE_ARGUMENTS: readonly string[] = ['cursor', 'fields', 'limit']

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

/** A property name as TypeScript writes it. */
function key(name: string): string {
  return IDENTIFIER.test(name) ? name : JSON.stringify(name)
}

function union(values: readonly string[]): string {
  return values.map((value) => JSON.stringify(value)).join(' | ')
}

/** A row's fields, as an inline object type. */
function objectType(schema: InputSchema | RowSchema, omit: readonly string[] = []): string {
  const required = schema.required ?? []
  const fields = Object.entries(schema.properties)
    .filter(([name]) => !omit.includes(name))
    .map(([name, spec]) => `${key(name)}${required.includes(name) ? '' : '?'}: ${typeOf(spec)}`)
  return fields.length === 0 ? '{}' : `{ ${fields.join('; ')} }`
}

/** An argument's type, written out in full. */
function written(spec: ArgumentSchema): string {
  if ('anyOf' in spec) return 'string | { person: string }'
  switch (spec.type) {
    case 'string': return spec.enum ? union(spec.enum) : 'string'
    case 'integer':
    case 'number': return 'number'
    case 'boolean': return 'boolean'
    case 'array': {
      const item = spec.items.type === 'string' ? (spec.items.enum ? union(spec.items.enum) : 'string') : typeOf(spec.items)
      return /[ |]/.test(item) && !item.startsWith('{') ? `(${item})[]` : `${item}[]`
    }
    case 'object': {
      if ('properties' in spec) return objectType(spec)
      if (spec.additionalProperties === true) return 'Record<string, unknown>'
      return `Record<string, ${spec.additionalProperties.enum ? union(spec.additionalProperties.enum) : 'string'}>`
    }
    default: {
      const unexpected: never = spec
      return unexpected
    }
  }
}

/** A shared shape's name, by what it is written out as: filled as each is declared, so a later one may name an earlier. */
const NAME_OF = new Map<string, string>()

function shared(name: string, type: string): string {
  NAME_OF.set(type, name)
  return type
}

/**
 * The shapes said once by name, each with what it is written out as. A
 * person-naming argument, a principle somewhere in the tree, the principles
 * a record cites as it is written, and a list read's page.
 */
export const SHARED_SHAPES: Readonly<Record<string, string>> = {
  PersonRef: shared('PersonRef', written(personArgument(''))),
  PrincipleRef: shared('PrincipleRef', written(PRINCIPLE_REF)),
  PrinciplesCited: shared('PrinciplesCited', written(PRINCIPLES_CITED)),
  ListArgs: '{ cursor?: string; fields?: string[]; limit?: number }',
}

/** An argument's type: a shared shape by its name, anything else written out. */
function typeOf(spec: ArgumentSchema): string {
  const type = written(spec)
  return NAME_OF.get(type) ?? type
}

/** The declarations of the shared shapes, one a line, as a description of the API carries them. */
export function sharedDeclarations(): readonly string[] {
  return Object.entries(SHARED_SHAPES).map(([name, type]) => `type ${name} = ${type}`)
}

/**
 * One method's signature: `list(args?: { kind?: "application" | … } & ListArgs): Promise<unknown>`.
 * A method that takes nothing takes no argument, and one with nothing
 * required may be called with none.
 */
export function signatureOf(method: string, schema: InputSchema): string {
  const paged = PAGE_ARGUMENTS.every((name) => name in schema.properties)
  const own = objectType(schema, [...saidOnce(schema), ...(paged ? PAGE_ARGUMENTS : [])])
  const required = (schema.required ?? []).length > 0
  const args = own === '{}' ? (paged ? 'ListArgs' : undefined) : (paged ? `${own} & ListArgs` : own)
  return args === undefined ? `${method}(): Promise<unknown>` : `${method}(args${required ? '' : '?'}: ${args}): Promise<unknown>`
}

/** Every argument of a tool with what the tool table says of it, nested ones by path: what `detail: 'full'` adds. */
export function argumentDocs(schema: InputSchema): Readonly<Record<string, string>> {
  const said: Record<string, string> = {}
  const walk = (properties: Readonly<Record<string, ArgumentSchema>>, prefix: string) => {
    for (const [name, spec] of Object.entries(properties)) {
      if (SAID_ONCE.includes(spec)) continue
      const path = `${prefix}${name}`
      if (spec.description) said[path] = spec.description
      if ('anyOf' in spec) continue
      if (spec.type === 'object' && 'properties' in spec) walk(spec.properties, `${path}.`)
      if (spec.type === 'array' && spec.items.type === 'object') walk(spec.items.properties, `${path}[].`)
    }
  }
  walk(schema.properties, '')
  return said
}
