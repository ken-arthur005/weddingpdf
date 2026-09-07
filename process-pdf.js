const { PDFDocument, PDFName, PDFString } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const INPUT_PDF = path.join(__dirname, 'output', 'wedding-invite-raw.pdf');
const OUTPUT_PDF = path.join(__dirname, 'output', 'wedding-invite.pdf');
const LINK_TARGET_MANIFEST = path.join(__dirname, 'output', 'link-targets.json');

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
function htmlToPdf(htmlX, htmlY, htmlW, htmlH, pdfPageW, pdfPageH, htmlWidth, htmlHeight) {
  const scaleX = pdfPageW / htmlWidth;
  const scaleY = pdfPageH / htmlHeight;

  const x1 = htmlX * scaleX;
  const x2 = (htmlX + htmlW) * scaleX;
  // Flip Y: PDF bottom = HTML top inverted
  const y2 = pdfPageH - (htmlY * scaleY);           // top in PDF coords
  const y1 = pdfPageH - ((htmlY + htmlH) * scaleY); // bottom in PDF coords

  return [x1, y1, x2, y2];
}

function addLink(pages, pdfDoc, pageIndex, htmlX, htmlY, htmlW, htmlH, url, htmlWidth, htmlHeight) {
  const page = pages[pageIndex];
  const { width: pw, height: ph } = page.getSize();
  const rect = htmlToPdf(htmlX, htmlY, htmlW, htmlH, pw, ph, htmlWidth, htmlHeight);

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

function addInternalLink(pages, pdfDoc, pageIndex, htmlX, htmlY, htmlW, htmlH, targetPageIndex, htmlWidth, htmlHeight) {
  const page = pages[pageIndex];
  const targetPage = pages[targetPageIndex];
  const { width: pw, height: ph } = page.getSize();
  const rect = htmlToPdf(htmlX, htmlY, htmlW, htmlH, pw, ph, htmlWidth, htmlHeight);

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
  if (!fs.existsSync(LINK_TARGET_MANIFEST)) {
    throw new Error('Link target manifest not found. Run "node build.js" first.');
  }

  const pdfBytes = fs.readFileSync(INPUT_PDF);
  const linkManifest = JSON.parse(fs.readFileSync(LINK_TARGET_MANIFEST, 'utf8'));
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  console.log(`📄 Loaded ${pages.length} pages`);

  // Print actual page dimensions
  pages.forEach((p, i) => {
    const { width, height } = p.getSize();
    console.log(`   Page ${i + 1}: ${width.toFixed(1)} × ${height.toFixed(1)} pt`);
  });

  for (const target of linkManifest.targets) {
    if (!pages[target.pageIndex]) {
      throw new Error(`Link target ${target.selector} refers to a missing PDF page.`);
    }
    const { x, y, width, height, pageIndex, selector } = target;
    if (target.target.type === 'external') {
      addLink(pages, pdfDoc, pageIndex, x, y, width, height, target.target.url,
        linkManifest.pageWidth, linkManifest.pageHeight);
      console.log(`   ✅ ${selector} → ${target.target.url}`);
    } else if (target.target.type === 'internal') {
      addInternalLink(pages, pdfDoc, pageIndex, x, y, width, height, target.target.pageIndex,
        linkManifest.pageWidth, linkManifest.pageHeight);
      console.log(`   ✅ ${selector} → Page ${target.target.pageIndex + 1}`);
    } else {
      throw new Error(`Link target ${selector} has an unsupported target type.`);
    }
  }

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
