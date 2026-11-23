'use strict';

/**
 * Renders a report table to PDF with pdfmake. Plain CommonJS on purpose: it runs inside a
 * worker thread (so layout work never blocks the API event loop) and is loaded by file path,
 * which a TypeScript file could not be in tests. `allowJs` in tsconfig copies it to dist.
 *
 * Input is data only (title, columns, rows). No user-supplied document structure, HTML or
 * image ever reaches pdfmake, and URL and file access are denied except the bundled fonts.
 */
const path = require('node:path');
const { isMainThread, parentPort, workerData } = require('node:worker_threads');
const pdfmake = require('pdfmake');

const MAX_CELL_CHARS = 2000;
// Tamil block plus zero-width joiners, which Tamil text uses inside words.
const TAMIL_CHAR = /[஀-௿‌‍]/;

const fontFile = (pkg, file) =>
  path.join(path.dirname(require.resolve(`${pkg}/package.json`)), 'files', file);

const FONTS = {
  Inter: {
    normal: fontFile('@fontsource/inter', 'inter-latin-400-normal.woff'),
    bold: fontFile('@fontsource/inter', 'inter-latin-700-normal.woff'),
  },
  Tamil: {
    normal: fontFile('@fontsource/noto-sans-tamil', 'noto-sans-tamil-tamil-400-normal.woff'),
    bold: fontFile('@fontsource/noto-sans-tamil', 'noto-sans-tamil-tamil-700-normal.woff'),
  },
};

const ALLOWED_FILES = new Set(
  Object.values(FONTS).flatMap((family) => Object.values(family).map((file) => path.resolve(file))),
);

let configured = false;
function configure() {
  if (configured) {
    return;
  }
  pdfmake.setFonts(FONTS);
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((file) => ALLOWED_FILES.has(path.resolve(file)));
  configured = true;
}

function asText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const text = value instanceof Date ? value.toISOString() : String(value);
  return text.length > MAX_CELL_CHARS ? `${text.slice(0, MAX_CELL_CHARS)}...` : text;
}

/** Splits text into runs so Tamil letters use the Tamil font and everything else Inter. */
function runs(text, bold) {
  const out = [];
  for (const char of text) {
    const font = TAMIL_CHAR.test(char) ? 'Tamil' : 'Inter';
    const last = out[out.length - 1];
    if (last && last.font === font) {
      last.text += char;
    } else {
      out.push({ text: char, font, bold });
    }
  }
  return out.length > 0 ? out : [{ text: '', font: 'Inter', bold }];
}

const cell = (value, bold) => ({ text: runs(asText(value), bold) });

async function renderPdf({ title, subtitle, columns, rows }) {
  configure();
  const header = columns.map((column) => ({
    ...cell(column.label, true),
    fillColor: '#EEF2F1',
  }));
  const body = [
    header,
    ...rows.map((row) => columns.map((column) => cell(row[column.key], false))),
  ];

  const definition = {
    pageSize: 'A4',
    pageOrientation: columns.length > 5 ? 'landscape' : 'portrait',
    pageMargins: [30, 50, 30, 40],
    defaultStyle: { font: 'Inter', fontSize: 9 },
    info: { title: asText(title), creator: 'MAXR Teamspace' },
    header: {
      margin: [30, 18, 30, 0],
      columns: [
        { text: runs(asText(title), true), fontSize: 12 },
        { text: runs(asText(subtitle), false), alignment: 'right', color: '#4F5C5A' },
      ],
    },
    footer: (page, pages) => ({
      text: `Page ${page} of ${pages}`,
      alignment: 'right',
      margin: [0, 10, 30, 0],
      color: '#4F5C5A',
    }),
    content: [
      {
        table: {
          headerRows: 1,
          widths: columns.map(() => '*'),
          body,
        },
        layout: 'lightHorizontalLines',
      },
    ],
  };

  const buffer = await pdfmake.createPdf(definition).getBuffer();
  return new Uint8Array(buffer);
}

if (!isMainThread && parentPort) {
  renderPdf(workerData)
    .then((pdf) => parentPort.postMessage({ ok: true, pdf }, [pdf.buffer]))
    .catch((error) =>
      parentPort.postMessage({ ok: false, message: String(error && error.message) }),
    );
}

module.exports = { configure, renderPdf };
