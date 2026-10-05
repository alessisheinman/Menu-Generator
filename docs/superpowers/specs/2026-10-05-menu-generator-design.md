# Menu Generator — Design Spec

**Date:** 2026-10-05
**Status:** Draft for review

## 1. Problem and goal

Kitchen menus for each catered event (touring-artist catering at venues such as Radio City, Barclays Center, PruCenter, Pier 17, Hulu Theater) are currently typed by hand in Word. The dishes rarely change — only the selection and quantities do — so the manual work is repetitive and error-prone (inconsistent names and dietary tags).

**Goal:** a website where a user sets up an event, builds each meal by selecting from saved dishes and templates, types quantities, and downloads a `.docx` that matches the format of the existing menus in `Finished Menus/`.

**Success criteria**
- Building a typical 3-meal day takes a few minutes, mostly typing quantities.
- The downloaded `.docx` is visually indistinguishable in format from the existing menus.
- Dish names and dietary tags are consistent across all menus.

## 2. What the existing menus look like (reference format)

Derived from the 9 files in `Finished Menus/`.

- One meal per page.
- Header: three red lines — `DAY` / `VENUE` / `TIME + HEADCOUNT` (e.g. `TUESDAY` / `RCMH` / `5AM 70 ppl`) — then one blank line.
- Body: one item per line, black: `{quantity} {unit} {dish name} {tags}`, e.g. `80 Chicken Kabob GF`, `5 dz Pastries`, `1 Small Hummus, Tahini, Yogurt Dill`, `½ Moroccan Lentil Soup (Vegan, GF)`.
- Lines may carry kitchen notes (`OVALADO`, `CHINA`) and meals may include free-text lines (`JUICER`, `ESPRESSO`, `11 sandwiches para to-go`, `VERY NICE DINNER PLEASE`).

**Word formatting (measured from the source files):** Calibri (theme minor font), 20pt (`sz=40`) for all text, "No Spacing" paragraph style, header color `#C00000`, body color black, US Letter, margins 1" top/bottom and 0.5" left/right, page break between meals.

## 3. Meal structure

- **Breakfast:** a fixed default list; quantities change, items occasionally swap (sausage links ↔ patties, pancakes ↔ French toast, turkey sausage). Common extras: Espresso, Juicer, Fresh Fruits, Hard Boiled Eggs.
- **Lunch:** consistent by cuisine (Mediterranean kabob, Italian parm, Mexican taco, etc.), always with the standard salad bar. The salad bar's ingredient list is identical every time except for a size (Small/Medium/Large) and occasional add-ons (Tuna, Chicken Salad, Egg Salad).
- **Dinner:** 2 starches (rice/pasta), 2 proteins, 2 vegetables, plus desserts.
- **Custom:** any meal not fitting the above.

Quantities are always entered manually. The app does no quantity math.

## 4. User workflow

### 4.1 Event setup
- Event name (e.g. "Artist Name – Radio City"), venue (pick from saved list or type new; the printed venue label is stored per venue, e.g. "Radio City" → `RCMH`).
- Add days (day-of-week label, e.g. TUESDAY).
- Add meals to each day: time (free text, e.g. `5AM`), headcount (number), type (Breakfast / Lunch / Dinner / Custom).

### 4.2 Meal editor
- **Breakfast** — prefilled from the breakfast template. Each line can be toggled off, swapped for an alternative, or given a quantity/unit. Extras added from a quick-add list.
- **Lunch** — choose a cuisine template; this loads the cuisine's dishes plus the salad bar line. Salad bar has a Small/Medium/Large selector and add-on checkboxes. Dishes can be added/removed freely.
- **Dinner** — slots: Starch ×2, Protein ×2, Vegetable ×2, Dessert (variable count). Each slot is a searchable dropdown filtered to the relevant catalog categories. Extra slots can be added.
- **All meals:**
  - Add any catalog dish, a one-off typed dish, or a free-text note line.
  - Per-line fields: quantity (free text — accepts `½`, `1/2`, `2-3`, blank), unit (free text with suggestions: `dz`, `pcs`, `Small`, `Medium`, `Large`), optional note (e.g. `OVALADO`).
  - Drag to reorder lines.
  - Duplicate a meal; duplicate a whole day.

### 4.3 Preview and download
- Live on-screen preview styled like the Word output.
- Non-blocking warning when a meal is missing a time or headcount.
- **Download .docx** for the whole event. Filename: `{Event name} Kitchen Menu {year}.docx` (editable before download).

### 4.4 Catalog editor
- Add, rename, recategorize, retag, or delete dishes.
- Edit the breakfast template, salad bar template, lunch cuisine templates, and venue list.

## 5. Architecture

**Stack:** Vite + React + TypeScript, static build, deployed to GitHub Pages via a GitHub Actions workflow on push to `main`. No backend, no auth. `.docx` generation uses the `docx` npm library in the browser.

### 5.1 Units

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `src/catalog/` | Seed data as JSON: `dishes.json`, `templates.json`, `venues.json` | — |
| `src/model/` | Types and pure functions: apply template, duplicate meal/day, format line text, validate event | catalog types |
| `src/storage/` | localStorage persistence (events + catalog overrides), JSON export/import with schema version and migration | model |
| `src/docx/` | Build a `.docx` Blob from an Event using the formatting in §2 | model |
| `src/ui/` | Screens: event list, event builder, meal editor, catalog editor, preview | model, storage, docx |

### 5.2 Data model

```ts
type Tag = 'GF' | 'Vegan' | 'Vegetarian';
type Category =
  | 'Breakfast' | 'Soup' | 'Salad' | 'Sandwich' | 'Pasta' | 'Rice/Grains'
  | 'Chicken' | 'Beef/Pork' | 'Fish' | 'Vegetarian Main' | 'Vegetable'
  | 'Spread/Bread' | 'Dessert' | 'Beverage/Service';

interface Dish { id: string; name: string; category: Category; tags: Tag[]; }

interface Venue { id: string; name: string; printLabel: string; }

type Line =
  | { kind: 'dish'; id: string; qty: string; unit: string; dishName: string; tags: Tag[]; note: string; sourceDishId?: string }
  | { kind: 'text'; id: string; text: string };

interface Meal { id: string; type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Custom'; time: string; headcount: number | null; lines: Line[]; }
interface Day { id: string; label: string; meals: Meal[]; }
interface MenuEvent { id: string; name: string; venueLabel: string; days: Day[]; updatedAt: string; }

// Template line: a default dish plus optional swap alternatives (e.g. Sausage Patties ↔ Links)
interface TemplateLine { dishId: string; alternatives: string[]; defaultUnit: string; enabledByDefault: boolean; }
interface MealTemplate { id: string; name: string; mealType: Meal['type']; lines: TemplateLine[]; includesSaladBar: boolean; }

interface CatalogOverrides {
  dishes: { upserted: Dish[]; deletedIds: string[] };
  templates?: MealTemplate[];   // full replacement when present
  venues?: Venue[];             // full replacement when present
}

interface ExportFile { schemaVersion: number; events: MenuEvent[]; catalogOverrides?: CatalogOverrides; }
```

**Snapshot rule:** a dish line copies `dishName` and `tags` at the time it is added. Later catalog edits/deletions do not alter existing events, so a past event always reproduces the same document.

**Catalog overrides:** user edits are stored as overrides layered over the bundled seed (added, modified, and deleted dish IDs; replaced templates/venues). Shipping an updated seed does not erase user edits.

### 5.3 Line formatting

`formatLine(line)` → `[qty, unit, dishName, formatTags(tags), note].filter(nonEmpty).join(' ')`.

`formatTags`: `[]` → `''`; `['GF']` → `GF`; multiple → `(Vegan, GF)` (fixed order: Vegan, Vegetarian, GF). This normalizes the inconsistent tag styles in the source files.

### 5.4 Data flow

UI edits → model functions return a new Event → storage autosaves to localStorage on every change → preview renders from the same Event → `docx/` builds the file from the same Event on download.

## 6. Catalog seeding

1. Import every dish from https://www.jackmonkeycatering.com/jackmonkeycatering-2 (~270 items, 13 sections) with its section mapped to a `Category`.
2. Add every dish appearing in the 9 finished menus that is not on the website (e.g. Chicken Kabob, Kofta Kabob, Falafel, Chicken Paillard, Eggplant Parm, Fried Eggplants, Hummus/Tahini spreads, Baklava, Flan, Tres Leches, Belgian Chocolate Cake, Limoncello Cake, "Just" Eggs Scrambled, Vegetable Jambalaya, Black Bean Meatballs).
3. Where the menus and website name the same dish differently, use the menu's name (it is what the kitchen reads).
4. Apply dietary tags from the menus; website `(V)` maps to `Vegan` for review.
5. Templates derived from the menus: Breakfast default; Salad Bar; lunch cuisines Mediterranean, Italian, Mexican, Comfort.
6. Venues from the menus: Radio City → `RCMH`, Barclays Center, PruCenter/Prudential, Pier 17, Hulu Theater/InfoSys Theatre.
7. User reviews the seeded catalog once before first real use.

## 7. Error handling and edge cases

- **Autosave** on every change; no explicit save.
- **Data loss risk:** localStorage is per-browser and can be cleared. The app shows an export reminder when data hasn't been exported for 14 days; export is one click.
- **Import conflicts:** if an imported event's ID already exists, ask: replace or keep both.
- **Schema versioning:** exports carry `schemaVersion`; storage migrates older versions on load. Unparseable imports show an error and change nothing.
- **Long meals** flow to a second page; each meal still starts on a new page.
- **Missing time/headcount** prints whatever is present; warns in preview, never blocks download.
- **localStorage unavailable** (private mode): app works for the session and shows a banner that nothing will be saved; export still works.
- **Target browser:** Chrome. Others should work but are not tested.

## 8. Testing

- **Unit (Vitest), `model/`:** template application, duplicate meal/day (new IDs, deep copy), `formatLine`/`formatTags`, validation warnings.
- **Unit, `storage/`:** round-trip export/import, migration from an older schema version, override layering over seed, import conflict handling.
- **Docx check:** generate a sample event reconstructing one existing menu (e.g. a Radio City menu), unzip the output, and assert font size 20pt, header color `C00000`, "No Spacing" style, page size/margins, one page break between meals, and line text matching the source.
- **Manual:** open the generated file in Word and compare side by side with the source.

## 9. Privacy and repo

GitHub Pages on a free account requires a public repo. `Finished Menus/` (artist names, real event details) is **excluded via `.gitignore`** and never committed. The seed catalog contains only dish names (already public on the website), templates, and venue names. The docx test fixture uses a reconstructed event with a placeholder event name.

## 10. Out of scope

Logins, multi-device sync, quantity calculation, costing, PDF export, browser printing, editing existing `.docx` files.
