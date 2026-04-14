import {
  QUICK_START_ITEMS_FROM_TAXONOMY,
  QUICK_START_SECTIONS_FROM_TAXONOMY,
  type QuickStartSection,
} from "../lib/recipeTaxonomy";

export type { QuickStartSection };

export const QUICK_START_SECTIONS: QuickStartSection[] = QUICK_START_SECTIONS_FROM_TAXONOMY;

export const QUICK_START_ITEMS = QUICK_START_ITEMS_FROM_TAXONOMY;
