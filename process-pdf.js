const { PDFDocument, PDFName, PDFString } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const INPUT_PDF = path.join(__dirname, 'output', 'wedding-invite-raw.pdf');
const OUTPUT_PDF = path.join(__dirname, 'output', 'wedding-invite.pdf');

const RSVP_URL = 'https://forms.gle/tnZxmdZ5R93eFUj19';
const MAPS_URL = 'https://maps.app.goo.gl/fb5JWYKorDAH574f7';

// HTML canvas dimensions (the CSS pixel dimensions used in HTML)
const HTML_W = 550;
const HTML_H = 850;

/**
 * Convert HTML pixel coordinates to PDF point coordinates.
 *
 * Puppeteer converts px→inches at 96dpi, then inches→points at 72dpi,
 * so the scale factor is 72/96 = 0.75.
 *
 * PDF origin: bottom-left.  HTML origin: top-left.
 *
 * @returns [x1, y1, x2, y2] in PDF points (bottom-left origin)
 */
function htmlToPdf(htmlX, htmlY, htmlW, htmlH, pdfPageW, pdfPageH) {
  const scaleX = pdfPageW / HTML_W;
  const scaleY = pdfPageH / HTML_H;

  const x1 = htmlX * scaleX;
  const x2 = (htmlX + htmlW) * scaleX;
  // Flip Y: PDF bottom = HTML top inverted
  const y2 = pdfPageH - (htmlY * scaleY);           // top in PDF coords
  const y1 = pdfPageH - ((htmlY + htmlH) * scaleY); // bottom in PDF coords

  return [x1, y1, x2, y2];
}

function addLink(pages, pdfDoc, pageIndex, htmlX, htmlY, htmlW, htmlH, url) {
  const page = pages[pageIndex];
  const { width: pw, height: ph } = page.getSize();
  const rect = htmlToPdf(htmlX, htmlY, htmlW, htmlH, pw, ph);

  const linkDict = pdfDoc.context.obj({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Link'),
    Rect: rect,
    Border: pdfDoc.context.obj([0, 0, 0]),
    A: pdfDoc.context.obj({
      S: PDFName.of('URI'),
      URI: PDFString.of(url),
    }),
  });

  const ref = pdfDoc.context.register(linkDict);
  let annots = page.node.get(PDFName.of('Annots'));
  if (!annots) {
    annots = pdfDoc.context.obj([]);
    page.node.set(PDFName.of('Annots'), annots);
  }
  annots.push(ref);
}

function addInternalLink(pages, pdfDoc, pageIndex, htmlX, htmlY, htmlW, htmlH, targetPageIndex) {
  const page = pages[pageIndex];
  const targetPage = pages[targetPageIndex];
  const { width: pw, height: ph } = page.getSize();
  const rect = htmlToPdf(htmlX, htmlY, htmlW, htmlH, pw, ph);

  const dest = pdfDoc.context.obj([
    targetPage.ref,
    PDFName.of('Fit'),
  ]);

  const linkDict = pdfDoc.context.obj({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Link'),
    Rect: rect,
    Border: pdfDoc.context.obj([0, 0, 0]),
    Dest: dest,
  });

  const ref = pdfDoc.context.register(linkDict);
  let annots = page.node.get(PDFName.of('Annots'));
  if (!annots) {
    annots = pdfDoc.context.obj([]);
    page.node.set(PDFName.of('Annots'), annots);
  }
  annots.push(ref);
}

async function processPdf() {
  console.log('🔗 Wedding Invite — Link Processor');
  console.log('━'.repeat(40));

  if (!fs.existsSync(INPUT_PDF)) {
    console.error('❌ Raw PDF not found. Run "node build.js" first.');
    process.exit(1);
  }

  const pdfBytes = fs.readFileSync(INPUT_PDF);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  console.log(`📄 Loaded ${pages.length} pages`);

  // Print actual page dimensions
  pages.forEach((p, i) => {
    const { width, height } = p.getSize();
    console.log(`   Page ${i + 1}: ${width.toFixed(1)} × ${height.toFixed(1)} pt`);
  });

  // ═══════════════════════════════════════════════
  // PAGE 1 (idx 0): COVER — Envelope → Page 3
  // ═══════════════════════════════════════════════
  console.log('\n📌 Page 1 — Cover');
  addInternalLink(pages, pdfDoc, 0, 135, 330, 280, 190, 2);
  console.log('   ✅ Envelope → Page 3');

  // ═══════════════════════════════════════════════
  // PAGE 2 (idx 1): SAVE THE DATE — Badge → Page 3
  // ═══════════════════════════════════════════════
  console.log('\n📌 Page 2 — Save the Date');
  addInternalLink(pages, pdfDoc, 1, 230, 600, 90, 70, 2);
  console.log('   ✅ E-Invitation badge → Page 3');

  // ═══════════════════════════════════════════════
  // PAGE 3 (idx 2): MONOGRAM — no links
  // ═══════════════════════════════════════════════
  console.log('\n📌 Page 3 — Monogram (no links)');

  // ═══════════════════════════════════════════════
  // PAGE 4 (idx 3): INVITATION — RSVP
  // ═══════════════════════════════════════════════
  console.log('\n📌 Page 4 — Invitation');
  addLink(pages, pdfDoc, 3, 150, 600, 250, 50, RSVP_URL);
  console.log('   ✅ RSVP → Google Form');

  // ═══════════════════════════════════════════════
  // PAGE 5 (idx 4): DETAILS — RSVP button
  // ═══════════════════════════════════════════════
  console.log('\n📌 Page 5 — Details');
  addLink(pages, pdfDoc, 4, 225, 755, 100, 50, RSVP_URL);
  console.log('   ✅ RSVP button → Google Form');

  // ═══════════════════════════════════════════════
  // PAGE 6 (idx 5): ROUTE — Map card + buttons
  // ═══════════════════════════════════════════════
  console.log('\n📌 Page 6 — Route');
  addLink(pages, pdfDoc, 5, 30, 140, 490, 300, MAPS_URL);
  console.log('   ✅ Map card → Google Maps');
  addLink(pages, pdfDoc, 5, 165, 720, 80, 50, MAPS_URL);
  console.log('   ✅ Location button → Google Maps');
  addLink(pages, pdfDoc, 5, 285, 720, 80, 50, RSVP_URL);
  console.log('   ✅ RSVP button → Google Form');

  // ═══════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════
  const modifiedBytes = await pdfDoc.save({ useObjectStreams: true });

  // Write to temp file first, then rename (avoids EBUSY if original is open)
  const tmpPath = OUTPUT_PDF + '.tmp';
  fs.writeFileSync(tmpPath, modifiedBytes);
  try {
    fs.renameSync(tmpPath, OUTPUT_PDF);
  } catch {
    // If rename fails (file locked), write directly
    fs.writeFileSync(OUTPUT_PDF, modifiedBytes);
  }

  console.log('\n' + '━'.repeat(40));
  console.log(`✅ Final PDF: ${OUTPUT_PDF}`);
  console.log(`   Size: ${Math.round(modifiedBytes.length / 1024)} KB`);
  console.log(`   Pages: ${pages.length}`);
  console.log('\n🎉 Done!');
}

processPdf().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
