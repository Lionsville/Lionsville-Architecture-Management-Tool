import type { ElementId } from './types';

const TEMP_PREFIX = 'tmp-';

let fallbackCounter = 0;

/**
 * Create a client-side id for a new element/connection. The host's save
 * round-trip returns a tempId → real-id map; until the host feeds the mapped
 * model back through the `model` prop, batches keep referring to the temp id.
 */
export function createTempId(): ElementId {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `${TEMP_PREFIX}${cryptoApi.randomUUID()}`;
  }
  fallbackCounter += 1;
  return `${TEMP_PREFIX}${Date.now().toString(36)}-${fallbackCounter}`;
}

/** True for ids minted by createTempId (i.e. not yet persisted). */
export function isTempId(id: string): boolean {
  return id.startsWith(TEMP_PREFIX);
}

/**
 * How the app asks for a new id. A function and not a counter, because who
 * hands out ids is the composition's business: a test wants them predictable
 * and the app wants them unique.
 */
export type MakeId = (prefix: string) => string
