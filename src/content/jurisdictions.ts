import type { JurisdictionId } from '../types';

export interface Jurisdiction {
  id: JurisdictionId;
  nameEn: string;
  nameFr: string;
  kind: 'province' | 'territory';
  capitalEn: string;
  capitalFr: string;
}

export const JURISDICTIONS: Jurisdiction[] = [
  { id: 'AB', nameEn: 'Alberta', nameFr: 'Alberta', kind: 'province', capitalEn: 'Edmonton', capitalFr: 'Edmonton' },
  { id: 'BC', nameEn: 'British Columbia', nameFr: 'Colombie-Britannique', kind: 'province', capitalEn: 'Victoria', capitalFr: 'Victoria' },
  { id: 'MB', nameEn: 'Manitoba', nameFr: 'Manitoba', kind: 'province', capitalEn: 'Winnipeg', capitalFr: 'Winnipeg' },
  { id: 'NB', nameEn: 'New Brunswick', nameFr: 'Nouveau-Brunswick', kind: 'province', capitalEn: 'Fredericton', capitalFr: 'Fredericton' },
  { id: 'NL', nameEn: 'Newfoundland and Labrador', nameFr: 'Terre-Neuve-et-Labrador', kind: 'province', capitalEn: "St. John's", capitalFr: 'Saint-Jean de Terre-Neuve' },
  { id: 'NS', nameEn: 'Nova Scotia', nameFr: 'Nouvelle-Écosse', kind: 'province', capitalEn: 'Halifax', capitalFr: 'Halifax' },
  { id: 'NT', nameEn: 'Northwest Territories', nameFr: 'Territoires du Nord-Ouest', kind: 'territory', capitalEn: 'Yellowknife', capitalFr: 'Yellowknife' },
  { id: 'NU', nameEn: 'Nunavut', nameFr: 'Nunavut', kind: 'territory', capitalEn: 'Iqaluit', capitalFr: 'Iqaluit' },
  { id: 'ON', nameEn: 'Ontario', nameFr: 'Ontario', kind: 'province', capitalEn: 'Toronto', capitalFr: 'Toronto' },
  { id: 'PE', nameEn: 'Prince Edward Island', nameFr: "Île-du-Prince-Édouard", kind: 'province', capitalEn: 'Charlottetown', capitalFr: 'Charlottetown' },
  { id: 'QC', nameEn: 'Quebec', nameFr: 'Québec', kind: 'province', capitalEn: 'Quebec City', capitalFr: 'Québec' },
  { id: 'SK', nameEn: 'Saskatchewan', nameFr: 'Saskatchewan', kind: 'province', capitalEn: 'Regina', capitalFr: 'Regina' },
  { id: 'YT', nameEn: 'Yukon', nameFr: 'Yukon', kind: 'territory', capitalEn: 'Whitehorse', capitalFr: 'Whitehorse' },
];

export function jurisdictionById(id: JurisdictionId): Jurisdiction {
  return JURISDICTIONS.find((j) => j.id === id) ?? JURISDICTIONS[9];
}
