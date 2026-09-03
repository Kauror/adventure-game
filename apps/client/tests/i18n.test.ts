import { describe, expect, it } from 'vitest';

import { et } from '../src/i18n/et';
import { AUTHORING_LOCALE, t, tContent, translationKeys } from '../src/i18n';

describe('i18n', () => {
  it('uses Estonian as the canonical authoring locale', () => {
    expect(AUTHORING_LOCALE).toBe('et');
  });

  it('resolves a key to its Estonian string', () => {
    expect(t('app.title')).toBe('Seiklusmäng');
  });

  it('has a non-empty string for every key', () => {
    const keys = translationKeys();
    expect(keys.length).toBeGreaterThan(0);

    for (const key of keys) {
      const value = t(key);
      expect(typeof value).toBe('string');
      expect(value.trim()).not.toBe('');
    }
  });

  it('round-trips Estonian characters without mangling (UTF-8 probe)', () => {
    // If the toolchain ever mis-handles encoding, this is the first thing to break.
    expect(t('dev.charsetProbe')).toBe('õ ä ö ü Õ Ä Ö Ü');
    expect(t('orientation.rotateToLandscape')).toContain('öö');
    // `õ` is checked on a key that still has one: the orientation notice was
    // cut to two words after the playtest, since the diagram above it does the
    // explaining and most of the players cannot read.
    expect(t('debug.dodge')).toContain('õ');
  });

  it('has the orientation notice the portrait screen needs', () => {
    // Two words, exactly. The rotate diagram carries the meaning.
    expect(t('orientation.rotateToLandscape')).toBe('Pööra seadet');
  });

  it('exposes exactly the catalogue keys', () => {
    expect(translationKeys().sort()).toEqual(Object.keys(et).sort());
  });

  describe('tContent (keys that come from content, not source)', () => {
    it('resolves a known key', () => {
      expect(tContent('region.testArena.name')).toBe('Prooviareen');
    });

    it('falls back to the key itself so a missing translation is visible', () => {
      expect(tContent('region.missing.name')).toBe('region.missing.name');
    });

    it('does not resolve inherited Object properties', () => {
      expect(tContent('toString')).toBe('toString');
      expect(tContent('constructor')).toBe('constructor');
    });
  });
});
