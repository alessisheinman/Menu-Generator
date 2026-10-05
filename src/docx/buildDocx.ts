import { Document, Packer, Paragraph, TextRun } from 'docx';
import { formatHeader, printableLines } from '../model/format';
import type { MenuEvent } from '../model/types';

/** Formatting measured from the existing kitchen menus (see spec §2). */
export const DOCX_FORMAT = {
  font: 'Calibri',
  halfPoints: 40, // 20pt
  headerColor: 'C00000',
  bodyColor: '000000',
  pageTwips: { width: 12240, height: 15840 }, // US Letter
  marginTwips: { top: 1440, bottom: 1440, left: 720, right: 720 },
} as const;

const STYLE_ID = 'NoSpacing';

function para(text: string, color: string, pageBreakBefore = false): Paragraph {
  return new Paragraph({
    style: STYLE_ID,
    pageBreakBefore,
    children: text ? [new TextRun({ text, color, size: DOCX_FORMAT.halfPoints, font: DOCX_FORMAT.font })] : [],
  });
}

export function buildDocument(event: MenuEvent): Document {
  const children: Paragraph[] = [];
  let first = true;
  for (const day of event.days) {
    for (const meal of day.meals) {
      const header = formatHeader(day.label, event.venueLabel, meal).filter(Boolean);
      header.forEach((line, i) => children.push(para(line, DOCX_FORMAT.headerColor, !first && i === 0)));
      if (header.length === 0) children.push(para('', DOCX_FORMAT.headerColor, !first));
      children.push(para('', DOCX_FORMAT.bodyColor));
      for (const line of printableLines(meal)) children.push(para(line, DOCX_FORMAT.bodyColor));
      first = false;
    }
  }
  if (children.length === 0) children.push(para('', DOCX_FORMAT.bodyColor));

  return new Document({
    creator: 'Menu Generator',
    title: event.name,
    styles: {
      default: { document: { run: { font: DOCX_FORMAT.font, size: DOCX_FORMAT.halfPoints } } },
      paragraphStyles: [{
        id: STYLE_ID, name: 'No Spacing', basedOn: 'Normal', quickFormat: true,
        paragraph: { spacing: { before: 0, after: 0, line: 240 } },
      }],
    },
    sections: [{
      properties: { page: { size: DOCX_FORMAT.pageTwips, margin: DOCX_FORMAT.marginTwips } },
      children,
    }],
  });
}

export function buildDocxBlob(event: MenuEvent): Promise<Blob> {
  return Packer.toBlob(buildDocument(event));
}

export function buildDocxBuffer(event: MenuEvent): Promise<Buffer> {
  return Packer.toBuffer(buildDocument(event));
}
