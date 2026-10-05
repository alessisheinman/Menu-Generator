export type Tag = 'GF' | 'Vegan' | 'Vegetarian';
export const TAGS: Tag[] = ['Vegan', 'Vegetarian', 'GF'];

export type Category =
  | 'Breakfast' | 'Soup' | 'Salad' | 'Sandwich' | 'Pasta' | 'Rice/Grains'
  | 'Chicken' | 'Beef/Pork' | 'Fish' | 'Vegetarian Main' | 'Vegetable'
  | 'Spread/Bread' | 'Dessert' | 'Beverage/Service';

export const CATEGORIES: Category[] = [
  'Breakfast', 'Soup', 'Salad', 'Sandwich', 'Pasta', 'Rice/Grains',
  'Chicken', 'Beef/Pork', 'Fish', 'Vegetarian Main', 'Vegetable',
  'Spread/Bread', 'Dessert', 'Beverage/Service',
];

/** Dinner slot → catalog categories offered in that slot's picker. */
export type Slot = 'Starch' | 'Protein' | 'Vegetable' | 'Dessert';
export const SLOTS: Slot[] = ['Starch', 'Protein', 'Vegetable', 'Dessert'];
export const SLOT_CATEGORIES: Record<Slot, Category[]> = {
  Starch: ['Pasta', 'Rice/Grains'],
  Protein: ['Chicken', 'Beef/Pork', 'Fish', 'Vegetarian Main'],
  Vegetable: ['Vegetable'],
  Dessert: ['Dessert'],
};

export interface Dish { id: string; name: string; category: Category; tags: Tag[]; }
export interface Venue { id: string; name: string; printLabel: string; }

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Custom';
export const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Custom'];

export interface TemplateLine {
  /** null = an empty dinner slot to be filled in. */
  dishId: string | null;
  slot?: Slot;
  unit?: string;
  /** Dish IDs offered as one-click swaps (e.g. Sausage Patties ↔ Links). */
  alternatives?: string[];
  /** false = offered as a quick-add suggestion instead of added up front. */
  enabled?: boolean;
}

export interface MealTemplate {
  id: string;
  name: string;
  mealType: MealType;
  includesSaladBar: boolean;
  /** Salad bar items for this template; defaults to the catalog's standard list. */
  saladItems?: string[];
  lines: TemplateLine[];
}

export interface SaladBarConfig { standard: string[]; addOns: string[]; }

export interface Catalog {
  dishes: Dish[];
  templates: MealTemplate[];
  venues: Venue[];
  saladBar: SaladBarConfig;
}

export type SaladSize = '' | 'Small' | 'Medium' | 'Large';

/** Dish lines snapshot name + tags so later catalog edits never change a saved menu. */
export interface DishLine {
  kind: 'dish';
  id: string;
  qty: string;
  unit: string;
  dishName: string;
  tags: Tag[];
  note: string;
  sourceDishId?: string;
  slot?: Slot;
  alternatives?: string[];
}
export interface TextLine { kind: 'text'; id: string; text: string; }
export interface SaladLine { kind: 'salad'; id: string; size: SaladSize; items: string[]; }
export type Line = DishLine | TextLine | SaladLine;

export interface Meal {
  id: string;
  type: MealType;
  time: string;
  headcount: number | null;
  /** Printed after the headcount on the red header line, e.g. "CHINA". */
  headerNote: string;
  templateId?: string;
  lines: Line[];
}
export interface Day { id: string; label: string; meals: Meal[]; }
export interface MenuEvent {
  id: string;
  name: string;
  venueLabel: string;
  fileName: string;
  days: Day[];
  updatedAt: string;
}

export interface CatalogOverrides {
  dishes: { upserted: Dish[]; deletedIds: string[] };
  templates?: MealTemplate[];
  venues?: Venue[];
  saladBar?: SaladBarConfig;
}

export interface ExportFile {
  schemaVersion: number;
  events: MenuEvent[];
  catalogOverrides?: CatalogOverrides;
}
