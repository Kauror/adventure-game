import { et } from './et';

/**
 * Minimal typed translation lookup.
 *
 * Deliberately not a framework: the point at this stage is to establish the
 * convention that player-visible text is *data referenced by a key*, not an
 * arbitrary string embedded in a component. A real i18n library can replace
 * this later without touching call sites, because `t()` is the only entry point.
 */

export const AUTHORING_LOCALE = 'et' as const;

export type TranslationKey = keyof typeof et;

const catalogue: Readonly<Record<TranslationKey, string>> = et;

export function t(key: TranslationKey): string {
  return catalogue[key];
}

/**
 * Lookup for keys that come from *content* rather than from source code, where
 * the compiler cannot prove the key exists (a region's `nameKey`, for example).
 *
 * A missing key renders as the key itself rather than throwing or showing an
 * empty box: a visible `region.foo.name` on screen is an obvious bug report,
 * whereas silence is not. The CI content validator will eventually catch these
 * before they ship (PLAN §20).
 */
export function tContent(key: string): string {
  return Object.hasOwn(catalogue, key) ? catalogue[key as TranslationKey] : key;
}

/** Every key in the catalogue. Used by tests to assert completeness. */
export function translationKeys(): TranslationKey[] {
  return Object.keys(catalogue) as TranslationKey[];
}
