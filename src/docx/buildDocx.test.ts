import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { blankDishLine, textLine } from '../model/event';
import type { DishLine, Meal, MenuEvent, Tag } from '../model/types';
import { buildDocxBuffer } from './buildDocx';

const line = (qty: string, unit: string, dishName: string, tags: Tag[] = [], note = ''): DishLine =>
  ({ ...blankDishLine(), qty, unit, dishName, tags, note });

const meal = (time: string, headcount: number, lines: Meal['lines']): Meal =>
  ({ id: time, type: 'Custom', time, headcount, headerNote: '', lines });

// Reconstruction of the first two pages of an existing menu, with a placeholder event name.
const event: MenuEvent = {
  id: 'e', name: 'Sample Artist', venueLabel: 'RCMH', fileName: 'x.docx', updatedAt: '',
  days: [{
    id: 'd1', label: 'Tuesday',
    meals: [
      meal('5AM', 70, [
        line('5', 'dz', 'pastries'),
        line('3', '', 'Scrambled Organic Eggs', ['GF']),
        line('1', '', '“Just” Eggs Scrambled', ['Vegan', 'GF'], 'ovalado'),
      ]),
      meal('9AM', 35, [
        { kind: 'salad', id: 's', size: 'Small', items: ['Cherry Tomatoes', 'Corn'] },
        line('½', '', 'Moroccan Lentil Soup', ['Vegan', 'GF']),
        line('80', '', 'Chicken Kabob', ['GF']),
        { ...blankDishLine(), slot: 'Dessert' }, // empty slot: must not print
        textLine('JUICER'),
      ]),
    ],
  }],
};

async function documentXml(ev: MenuEvent) {
  const zip = await JSZip.loadAsync(await buildDocxBuffer(ev));
  return { doc: await zip.file('word/document.xml')!.async('string'), styles: await zip.file('word/styles.xml')!.async('string') };
}

const paragraphTexts = (xml: string) =>
  [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => [...m[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((t) => t[1]).join(''));

describe('buildDocx', () => {
  it('writes the same lines as the source menu, one meal per page', async () => {
    const { doc } = await documentXml(event);
    expect(paragraphTexts(doc)).toEqual([
      'TUESDAY', 'RCMH', '5AM 70 PPL', '',
      '5 dz pastries', '3 Scrambled Organic Eggs GF', '1 “Just” Eggs Scrambled (Vegan, GF) ovalado',
      'TUESDAY', 'RCMH', '9AM 35 PPL', '',
      'Salad with Small: Cherry Tomatoes, Corn', '½ Moroccan Lentil Soup (Vegan, GF)', '80 Chicken Kabob GF', 'JUICER',
    ]);
    expect(doc.match(/<w:pageBreakBefore\/>/g)).toHaveLength(1);
  });

  it('uses Calibri 20pt, red headers, No Spacing, US Letter and the source margins', async () => {
    const { doc, styles } = await documentXml(event);
    expect(doc).toMatch(/<w:color w:val="C00000"\/>/);
    expect(doc).toMatch(/<w:sz w:val="40"\/>/);
    expect(doc).toMatch(/w:ascii="Calibri"/);
    expect(doc).toMatch(/<w:pStyle w:val="NoSpacing"\/>/);
    expect(doc).toMatch(/<w:pgSz w:w="12240" w:h="15840"/);
    expect(doc).toMatch(/<w:pgMar w:top="1440" w:right="720" w:bottom="1440" w:left="720"/);
    const noSpacing = styles.match(/<w:style [^>]*w:styleId="NoSpacing"[\s\S]*?<\/w:style>/)?.[0] ?? '';
    expect(noSpacing).toContain('<w:name w:val="No Spacing"/>');
    expect(noSpacing).toMatch(/<w:spacing (?=[^>]*w:after="0")(?=[^>]*w:before="0")(?=[^>]*w:line="240")[^>]*\/>/);
  });

  it('still produces a valid file for an empty event', async () => {
    const { doc } = await documentXml({ ...event, days: [] });
    expect(doc).toContain('<w:body>');
  });
});
