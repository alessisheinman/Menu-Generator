import { emptySlotLine, saladLine, textLine } from '../model/event';
import { defaultFileName } from '../model/format';
import { newId } from '../model/ids';
import { MEAL_TYPES, SLOTS, TAGS, type Catalog, type DishLine, type Line, type Meal, type MealType, type MenuEvent, type Slot, type Tag } from '../model/types';

/**
 * Import an approved client proposal (from the Proposed Menu Generator site) as a kitchen menu.
 * Descriptions are dropped and quantities left blank; days, meals, dishes and dietary tags carry over.
 *
 * Both sites are served from alessisheinman.github.io, so the kitchen site can read the proposals
 * saved in the same browser directly. A proposal backup file (.json) works too.
 */
export const PROPOSAL_STORAGE_KEY = 'proposed-menu-generator:v1';

/** The proposal fields the kitchen menu uses (kept loose: this data comes from the other site). */
export interface ProposalDishLine { kind: 'dish'; dishName?: string; tags?: unknown[]; slot?: string; alternatives?: unknown[]; sourceDishId?: string }
export interface ProposalTextLine { kind: 'text'; text?: string }
export interface ProposalMeal { type?: string; title?: string; templateId?: string; lines?: (ProposalDishLine | ProposalTextLine)[] }
/** `date` (YYYY-MM-DD) is set when the day was picked on the proposal calendar; older proposals only have a typed `dateLabel`. */
export interface ProposalDay { date?: string; dateLabel?: string; meals?: ProposalMeal[] }
export interface Proposal { id: string; name: string; venue?: string; days: ProposalDay[]; updatedAt?: string }

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
/** Proposals carry a color palette and per-day date lines; kitchen events don't — that tells the two apart. */
const looksLikeProposal = (x: unknown): x is Proposal =>
  isObj(x) && typeof x.id === 'string' && typeof x.name === 'string' && Array.isArray(x.days) && isObj(x.palette);

export type ParsedProposals = { ok: true; proposals: Proposal[] } | { ok: false; error: string };

/** Read proposals from a proposal backup file or from the proposal site's saved browser data. */
export function parseProposals(text: string | null): ParsedProposals {
  if (!text) return { ok: true, proposals: [] };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'That file is not valid JSON.' }; }
  if (!isObj(raw) || !Array.isArray(raw.events)) return { ok: false, error: "That doesn't look like a proposal file." };
  const proposals = raw.events.filter(looksLikeProposal);
  if (raw.events.length > 0 && proposals.length === 0) {
    return { ok: false, error: 'That looks like a kitchen menu backup, not a proposal — use Import… for those.' };
  }
  return { ok: true, proposals };
}

/** Proposals saved in this browser by the Proposed Menu Generator (empty if none or unreadable). */
export function readBrowserProposals(storage: Pick<Storage, 'getItem'> | null): Proposal[] {
  try {
    const res = parseProposals(storage?.getItem(PROPOSAL_STORAGE_KEY) ?? null);
    return res.ok ? res.proposals : [];
  } catch {
    return [];
  }
}

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

/**
 * The kitchen day label, weekday first with the date after it: "WEDNESDAY 10/14".
 * Uses the proposal's calendar date when there is one, otherwise reads a typed line like
 * "Tuesday, November 10"; anything unrecognised is kept as typed, uppercased.
 */
export function kitchenDayLabel(dateLabel: string, date?: string): string {
  const iso = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  if (iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]} ${m}/${d}`;
  }
  const t = dateLabel.trim().toUpperCase();
  const weekday = WEEKDAYS.find((d) => t.startsWith(d) || new RegExp(`^${d.slice(0, 3)}\\b`).test(t));
  if (!weekday) return t;
  const md = t.match(/\b([A-Z]{3,9})\.?\s+(\d{1,2})\b/g)
    ?.map((s) => s.match(/([A-Z]+)\.?\s+(\d+)/)!)
    .find((x) => MONTHS.some((mo) => mo.startsWith(x[1]))); // "NOV" or "NOVEMBER", not "TUESDAY"
  if (!md) return weekday;
  const month = MONTHS.findIndex((mo) => mo.startsWith(md[1])) + 1;
  return `${weekday} ${month}/${Number(md[2])}`;
}

const STANDARD_TITLES: Record<MealType, string> = { Breakfast: 'BREAKFAST', Lunch: 'LUNCH', Dinner: 'DINNER', Custom: 'MENU' };
/** Proposal salad lines ("Salad World", "Fresh Salad Bar Medley"…) become the kitchen salad bar line. */
const SALAD_BAR = /^(salad world|fresh salad bar medley|salad medley|salad bar)\b/i;

export function proposalToKitchen(p: Proposal, catalog: Catalog, year = new Date().getFullYear()): MenuEvent {
  const byId = new Map(catalog.dishes.map((d) => [d.id, d]));
  const byName = new Map(catalog.dishes.map((d) => [d.name.toLowerCase(), d]));
  const templateIds = new Set(catalog.templates.map((t) => t.id));
  const venueText = (p.venue ?? '').trim();
  const venue = catalog.venues.find((v) => [v.name, v.printLabel].some((n) => n.toLowerCase() === venueText.toLowerCase()));

  const toLines = (lines: ProposalMeal['lines'] = []): Line[] => {
    const out: Line[] = [];
    let hasSalad = false;
    for (const l of lines) {
      if (!isObj(l)) continue;
      if (l.kind === 'text') {
        const text = String(l.text ?? '').trim();
        if (text) out.push(textLine(text));
        continue;
      }
      if (l.kind !== 'dish') continue;
      const name = String(l.dishName ?? '').trim();
      const slot = SLOTS.includes(l.slot as Slot) ? (l.slot as Slot) : undefined;
      if (!name) {
        if (slot) out.push(emptySlotLine(slot));
        continue;
      }
      if (SALAD_BAR.test(name)) {
        if (!hasSalad) out.push(saladLine(catalog.saladBar.standard));
        hasSalad = true;
        continue;
      }
      const match = (l.sourceDishId && byId.get(l.sourceDishId)) || byName.get(name.toLowerCase());
      const line: DishLine = {
        kind: 'dish', id: newId(), qty: '', unit: '', note: '',
        dishName: name,
        tags: (Array.isArray(l.tags) ? l.tags : []).filter((t): t is Tag => TAGS.includes(t as Tag)),
        sourceDishId: match?.id,
        slot,
        alternatives: (Array.isArray(l.alternatives) ? l.alternatives : []).filter((id): id is string => typeof id === 'string' && byId.has(id)),
      };
      if (!line.alternatives?.length) delete line.alternatives;
      out.push(line);
    }
    return out;
  };

  return {
    id: newId(),
    name: p.name,
    venueLabel: venue ? venue.printLabel : venueText,
    fileName: defaultFileName(p.name, year),
    updatedAt: new Date().toISOString(),
    days: p.days.map((d) => ({
      id: newId(),
      label: kitchenDayLabel(String(d.dateLabel ?? ''), typeof d.date === 'string' ? d.date : undefined),
      meals: (d.meals ?? []).filter((m): m is ProposalMeal => isObj(m)).map((m): Meal => {
        const type: MealType = MEAL_TYPES.includes(m.type as MealType) ? (m.type as MealType) : 'Custom';
        const title = String(m.title ?? '').trim().toUpperCase();
        return {
          id: newId(),
          type,
          time: '',
          headcount: null,
          // A non-standard page heading (e.g. OVERNIGHT MEAL) goes on the red header line.
          headerNote: title && title !== STANDARD_TITLES[type] ? title : '',
          templateId: m.templateId && templateIds.has(m.templateId) ? m.templateId : undefined,
          lines: toLines(m.lines),
        };
      }),
    })),
  };
}
