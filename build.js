const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const PAGES_DIR = path.join(__dirname, 'pages');
const OUTPUT_PDF = path.join(__dirname, 'output', 'wedding-invite-raw.pdf');
const LINK_TARGET_MANIFEST = path.join(__dirname, 'output', 'link-targets.json');
const { LINK_TARGETS } = require('./link-targets');

// Page dimensions: 5.5in x 8.5in (tall invitation format)
const PAGE_WIDTH = 550;
const PAGE_HEIGHT = 850;

async function build() {
  console.log('🎀 Wedding Invite PDF Builder');
  console.log('━'.repeat(40));

  // Ensure output directory exists
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get sorted HTML files
  const htmlFiles = fs.readdirSync(PAGES_DIR)
    .filter(f => f.endsWith('.html'))
    .sort();

  console.log(`📄 Found ${htmlFiles.length} pages to render:`);
  htmlFiles.forEach(f => console.log(`   → ${f}`));

  // Launch Puppeteer
  console.log('\n🚀 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: PAGE_WIDTH, height: PAGE_HEIGHT, deviceScaleFactor: 1.5 });

  // Render each page to PDF pages
  const pdfBuffers = [];
  const renderedTargets = [];

  for (const htmlFile of htmlFiles) {
    const filePath = path.join(PAGES_DIR, htmlFile);
    const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;

    console.log(`\n🎨 Rendering: ${htmlFile}`);
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });

    // Wait a moment for fonts to load
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 500));

    const overflowingText = await page.evaluate(({ pageWidth, pageHeight }) => (
      [...document.querySelectorAll('.text-safe')]
        .map(element => {
          const rect = element.getBoundingClientRect();
          return {
            text: element.textContent.trim().replace(/\s+/g, ' ').slice(0, 48),
            overflows: rect.left < 0 || rect.top < 0 || rect.right > pageWidth || rect.bottom > pageHeight,
          };
        })
        .filter(result => result.overflows)
    ), { pageWidth: PAGE_WIDTH, pageHeight: PAGE_HEIGHT });

    if (overflowingText.length) {
      throw new Error(`Text overflows the invitation canvas in ${htmlFile}: ${overflowingText.map(item => item.text).join('; ')}`);
    }

    const targetsForPage = LINK_TARGETS.filter(target => target.file === htmlFile);
    const measuredTargets = await page.evaluate((targets) => targets.map(({ selector, target }) => {
      const element = document.querySelector(selector);
      if (!element) return { selector, target, error: 'not found' };

      const { x, y, width, height } = element.getBoundingClientRect();
      return { selector, target, x, y, width, height };
    }), targetsForPage);

    for (const target of measuredTargets) {
      const isVisible = target.width > 0 && target.height > 0;
      const isWithinPage = target.x >= 0 && target.y >= 0
        && target.x + target.width <= PAGE_WIDTH && target.y + target.height <= PAGE_HEIGHT;
      if (target.error || !isVisible || !isWithinPage) {
        throw new Error(`Required PDF link target ${target.selector} on ${htmlFile} is missing or clipped.`);
      }
      renderedTargets.push({ pageIndex: pdfBuffers.length, ...target });
    }

    const pdfBuffer = await page.pdf({
      width: `${PAGE_WIDTH}px`,
      height: `${PAGE_HEIGHT}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: false
    });

    pdfBuffers.push(pdfBuffer);
    console.log(`   ✅ Rendered (${Math.round(pdfBuffer.length / 1024)} KB)`);
  }

  await browser.close();
  console.log('\n🌐 Browser closed.');

  // Merge all PDF buffers into one using pdf-lib
  console.log('\n📎 Merging pages into single PDF...');
  const { PDFDocument } = require('pdf-lib');

  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < pdfBuffers.length; i++) {
    const srcDoc = await PDFDocument.load(pdfBuffers[i]);
    const pages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
    pages.forEach(p => mergedPdf.addPage(p));
    console.log(`   + Page ${i + 1} added`);
  }

  const mergedBytes = await mergedPdf.save({ useObjectStreams: true });
  fs.writeFileSync(OUTPUT_PDF, mergedBytes);
  fs.writeFileSync(LINK_TARGET_MANIFEST, JSON.stringify({
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
    targets: renderedTargets,
  }, null, 2));

  console.log(`\n✅ Raw PDF saved: ${OUTPUT_PDF}`);
  console.log(`   Size: ${Math.round(mergedBytes.length / 1024)} KB`);
  console.log(`   Pages: ${pdfBuffers.length}`);
  console.log(`   Link targets: ${renderedTargets.length}`);
  console.log('\n➡️  Run "node process-pdf.js" to add clickable links.');
}

build().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
