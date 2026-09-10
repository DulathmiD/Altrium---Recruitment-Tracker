// Shared PDFKit building blocks for the Management department reports (Task
// #34/corrections doc). Modeled directly on the header/table/footer drawing
// code already inline in reports.controller.ts's getVacancyReportPdf --
// pulled out here as reusable functions rather than copy-pasted 4 times,
// but deliberately NOT used to refactor that existing function too: it
// already works and is the one PDF export that's been through a real user
// verification pass, so it's left untouched to avoid any risk of a visual
// regression on it while adding these 4 new reports.
// @types/pdfkit declares the `PDFKit` namespace globally -- no import needed
// to reference `PDFKit.PDFDocument` as a type below.

export const PDF_GOLD = "#f5a623";
export const PDF_BLACK = "#000000";
export const PDF_GRAY = "#555555";
export const PDF_LIGHT = "#f2f2f2";
export const PDF_MARGIN = 50;
export const PDF_PAGE_WIDTH = 612;
export const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN * 2;

// Black header band + ALTRIUM wordmark + simplified hexagon mark + a small
// gold badge label identifying which report this is. Returns the y position
// just below the band, where the title block should start.
export function drawReportHeader(doc: PDFKit.PDFDocument, badgeLabel: string): number {
  const HEADER_HEIGHT = 90;
  doc.rect(0, 0, doc.page.width, HEADER_HEIGHT).fill(PDF_BLACK);
  doc.fillColor("#ffffff").fontSize(24).font("Helvetica-Bold").text("ALTRIUM", PDF_MARGIN, 26);
  doc.fillColor(PDF_GOLD).fontSize(10).font("Helvetica-Bold").text(badgeLabel, PDF_MARGIN, 56, { characterSpacing: 1.5 });

  const hexCx = doc.page.width - PDF_MARGIN - 25;
  const hexCy = HEADER_HEIGHT / 2;
  const hexR = 22;
  const hexPoints: [number, number][] = [0, 1, 2, 3, 4, 5].map((i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return [hexCx + hexR * Math.cos(angle), hexCy + hexR * Math.sin(angle)];
  });
  doc.polygon(...hexPoints).fillAndStroke(PDF_BLACK, PDF_GOLD);
  doc.polygon([hexCx - 6, hexCy - 8], [hexCx - 6, hexCy + 8], [hexCx + 9, hexCy]).fill("#ffffff");
  doc.circle(hexCx + hexR * 0.7, hexCy + hexR * 0.55, 4).fill(PDF_GOLD);

  doc.fillColor(PDF_BLACK).font("Helvetica");
  return HEADER_HEIGHT + 25;
}

// Report title + a gray meta line (department, generated date, filter
// summary, etc.) + a gold rule underneath. Returns the next y.
export function drawReportTitleBlock(doc: PDFKit.PDFDocument, title: string, metaLine: string, startY: number): number {
  let y = startY;
  doc.fontSize(17).font("Helvetica-Bold").fillColor(PDF_BLACK).text(title, PDF_MARGIN, y);
  y = doc.y + 4;
  doc.fontSize(10).font("Helvetica").fillColor(PDF_GRAY).text(metaLine, PDF_MARGIN, y);
  y = doc.y + 12;
  doc.moveTo(PDF_MARGIN, y).lineTo(PDF_MARGIN + PDF_CONTENT_WIDTH, y).lineWidth(2).strokeColor(PDF_GOLD).stroke();
  return y + 22;
}

export function drawReportSectionHeading(doc: PDFKit.PDFDocument, title: string, atY: number): number {
  doc.rect(PDF_MARGIN, atY, 4, 14).fill(PDF_GOLD);
  doc.fontSize(12).font("Helvetica-Bold").fillColor(PDF_BLACK).text(title, PDF_MARGIN + 12, atY - 1);
  return doc.y + 8;
}

function drawTableRow(doc: PDFKit.PDFDocument, startX: number, rowY: number, colWidths: number[], row: string[], isHeader: boolean, stripe: boolean): void {
  let rowX = startX;
  const rowHeight = 20;
  row.forEach((cell, colIndex) => {
    const w = colWidths[colIndex] ?? 0;
    const bg = isHeader ? PDF_GOLD : stripe ? PDF_LIGHT : "#ffffff";
    doc.rect(rowX, rowY, w, rowHeight).fillAndStroke(bg, "#dddddd");
    doc
      .fillColor(isHeader ? PDF_BLACK : "#222222")
      .font(isHeader ? "Helvetica-Bold" : "Helvetica")
      .fontSize(9)
      .text(cell, rowX + 8, rowY + 6, { width: w - 16 });
    rowX += w;
  });
}

// Real gap found and fixed while investigating the Export Report bug: this
// never paginated. Every row was drawn at whatever y the running total
// reached, with no check against the page's actual height (A4, ~842pt) --
// a table long enough to run past the bottom of the page didn't error, it
// just kept drawing off-page, so the rows were silently invisible in the
// downloaded PDF rather than flowing onto a second page. Not itself the
// cause of a corrupt/unopenable file (a clipped-but-structurally-valid PDF
// still opens fine), but a real bug in its own right, and one about to
// become reachable now that report data volume is growing -- fixed by
// breaking to a new page (and repeating the header row for readability)
// once a row would cross the same 650pt threshold ensureSpace already uses
// between sections, instead of only ever checking between sections.
export function drawReportTable(doc: PDFKit.PDFDocument, startX: number, startY: number, colWidths: number[], rows: string[][], threshold = 650): number {
  const rowHeight = 20;
  let rowY = startY;
  const header = rows[0] ?? [];
  rows.forEach((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    if (!isHeader && rowY + rowHeight > threshold) {
      doc.addPage();
      rowY = 50;
      drawTableRow(doc, startX, rowY, colWidths, header, true, false);
      rowY += rowHeight;
    }
    drawTableRow(doc, startX, rowY, colWidths, row, isHeader, rowIndex % 2 === 0);
    rowY += rowHeight;
  });
  return rowY;
}

// Breaks to a new page if the content would run past the given threshold --
// same 620-ish guard used inline in getVacancyReportPdf.
export function ensureSpace(doc: PDFKit.PDFDocument, y: number, threshold = 650): number {
  if (y > threshold) {
    doc.addPage();
    return 50;
  }
  return y;
}

export function drawReportFooter(doc: PDFKit.PDFDocument, y: number): void {
  doc.moveTo(PDF_MARGIN, y).lineTo(PDF_MARGIN + PDF_CONTENT_WIDTH, y).lineWidth(1).strokeColor(PDF_GOLD).stroke();
  const footerY = y + 8;
  doc.fontSize(8).fillColor(PDF_GRAY).font("Helvetica").text("Altrium Recruitment & Hiring Tracker", PDF_MARGIN, footerY);
  doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, PDF_MARGIN, footerY, { width: PDF_CONTENT_WIDTH, align: "right" });
}
