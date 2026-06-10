import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

/**
 * Renders a generated proposal (Markdown subset: ##/### headings, tables,
 * lists, bold) into a DOCX buffer (spec 1.4 step 5). Rendering happens on
 * demand at download time; the canonical body lives in proposal_versions.
 */
export async function markdownToDocx(title: string, md: string): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: title, bold: true })],
    }),
  ];

  const lines = md.split(/\r?\n/);
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const rows = tableRows.filter((cells) => !cells.every((c) => /^[-:\s]*$/.test(c)));
    if (rows.length > 0) {
      const colCount = Math.max(...rows.map((r) => r.length));
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: rows.map(
            (cells, rowIdx) =>
              new TableRow({
                children: Array.from({ length: colCount }, (_, i) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: cells[i] ?? "", bold: rowIdx === 0 }),
                        ],
                      }),
                    ],
                  }),
                ),
              }),
          ),
        }),
      );
    }
    tableRows = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\|.*\|$/.test(line.trim())) {
      tableRows.push(
        line
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.replace(/\*\*/g, "").trim()),
      );
      continue;
    }
    flushTable();

    if (line.startsWith("### ")) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(line.slice(4))] }),
      );
    } else if (line.startsWith("## ")) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(line.slice(3))] }),
      );
    } else if (line.startsWith("# ")) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(line.slice(2))] }),
      );
    } else if (/^\s*[-*]\s+/.test(line)) {
      children.push(
        new Paragraph({ bullet: { level: 0 }, children: inlineRuns(line.replace(/^\s*[-*]\s+/, "")) }),
      );
    } else if (/^\s*\d+\.\s+/.test(line)) {
      children.push(
        new Paragraph({ bullet: { level: 0 }, children: inlineRuns(line.replace(/^\s*\d+\.\s+/, "")) }),
      );
    } else if (line.trim().length > 0) {
      children.push(new Paragraph({ children: inlineRuns(line) }));
    } else {
      children.push(new Paragraph({}));
    }
  }
  flushTable();

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
    },
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}

function inlineRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    } else if (part.length > 0) {
      runs.push(new TextRun({ text: part }));
    }
  }
  return runs;
}
