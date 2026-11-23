import { glossaryLanguage, GLOSSARY_LANGUAGES, translateGlossaryTerm } from './glossaryLanguages';

describe('glossary languages', () => {
  it('supports English and French only', () => {
    expect(GLOSSARY_LANGUAGES).toEqual(['fr', 'en']);
    expect(glossaryLanguage('fr')).toBe('fr');
    expect(glossaryLanguage('en')).toBe('en');
    expect(glossaryLanguage('ar')).toBe('en');
  });

  it('falls back to the source term when a translation is unavailable', () => {
    const source = { id: 1, term: 'Term', definition: 'Definition' };
    const fr = { id: 1, term: 'Terme', definition: 'Définition' };
    expect(translateGlossaryTerm(source, 'fr', { fr })).toMatchObject({ term: 'Terme', definition: 'Définition', rtl: false, missing: false });
    expect(translateGlossaryTerm(source, 'en', {}).missing).toBe(true);
  });
});
