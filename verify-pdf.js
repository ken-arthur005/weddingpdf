const fs = require('fs');
const path = require('path');
const { PDFDocument, PDFName } = require('pdf-lib');
const { LINK_TARGETS } = require('./link-targets');

const PDF_PATH = path.join(__dirname, 'output', 'wedding-invite.pdf');

function getAnnotations(pdfDoc, page) {
  const annotations = page.node.get(PDFName.of('Annots'));
  if (!annotations) return [];
  return Array.from({ length: annotations.size() }, (_, index) => pdfDoc.context.lookup(annotations.get(index)));
}

async function verifyPdf() {
  if (!fs.existsSync(PDF_PATH)) {
    throw new Error('Final PDF not found. Run "npm run build" first.');
  }

  const pdfDoc = await PDFDocument.load(fs.readFileSync(PDF_PATH));
  const pages = pdfDoc.getPages();
  if (pages.length !== 3) {
    throw new Error(`Expected 3 PDF pages, found ${pages.length}.`);
  }

  for (const expected of LINK_TARGETS) {
    const pageIndex = ['01-cover.html', '02-invitation.html', '03-route.html']
      .indexOf(expected.file);
    const annotations = getAnnotations(pdfDoc, pages[pageIndex]);
    const matchingAction = annotations.some(annotation => {
      if (expected.target.type === 'internal') {
        return Boolean(annotation.get(PDFName.of('Dest')));
      }
      const action = annotation.get(PDFName.of('A'));
      return action && action.toString().includes(expected.target.url);
    });
    if (!matchingAction) {
      throw new Error(`Missing ${expected.target.type} annotation for ${expected.selector} on ${expected.file}.`);
    }
  }

  console.log(`Verified ${LINK_TARGETS.length} interactive targets across ${pages.length} PDF pages.`);
}

verifyPdf().catch(error => {
  console.error(`PDF verification failed: ${error.message}`);
  process.exit(1);
});
