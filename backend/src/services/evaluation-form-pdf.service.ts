import { createRequire } from "node:module";
import PDFDocument from "pdfkit";
import type { EvaluationDetail } from "./card-view.service.js";
import {
  FULL_FORM,
  METHOD_FORM,
  type EvaluationFormGroup,
} from "../data/evaluation-form.js";

/**
 * Анкета с оценками по критериям отдельным PDF.
 *
 * В письме уже есть итог по разделам и методические рекомендации, но школа
 * часто просит и саму заполненную анкету. Она прикладывается только по
 * галочке: по умолчанию учитель получает короткое письмо.
 */

const require = createRequire(import.meta.url);
const FONT_REGULAR = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf");
const FONT_BOLD = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf");
const COLOR_TEXT = "#1f2a44";
const COLOR_MUTED = "#5c6b7a";

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function writeParagraph(
  doc: PDFKit.PDFDocument,
  text: string,
  options: PDFKit.Mixins.TextOptions = {},
) {
  doc.text(text, doc.page.margins.left, doc.y, {
    width: contentWidth(doc),
    lineGap: 2,
    ...options,
  });
}

function metaLine(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.font("Bold").fontSize(9).fillColor(COLOR_MUTED);
  writeParagraph(doc, label);
  doc.font("Regular").fontSize(10).fillColor(COLOR_TEXT);
  writeParagraph(doc, value || "-");
  doc.moveDown(0.35);
}

export async function buildEvaluationFormPdf(
  detail: EvaluationDetail,
): Promise<Buffer> {
  const groups: EvaluationFormGroup[] =
    detail.cardType === "full" ? FULL_FORM : METHOD_FORM;

  const doc = new PDFDocument({
    size: "A4",
    margin: 48,
    info: {
      Title: "Анкета с оценками по критериям",
      Author: "Tallam",
    },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.registerFont("Regular", FONT_REGULAR);
  doc.registerFont("Bold", FONT_BOLD);

  doc.font("Bold").fontSize(16).fillColor(COLOR_TEXT);
  writeParagraph(doc, "TALLAM", { align: "center" });
  doc.font("Regular").fontSize(12);
  writeParagraph(doc, detail.schoolName, { align: "center" });
  doc.moveDown(0.4);

  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  doc
    .moveTo(left, doc.y)
    .lineTo(left + width, doc.y)
    .lineWidth(1)
    .strokeColor(COLOR_TEXT)
    .stroke();
  doc.moveDown(0.6);

  doc.font("Bold").fontSize(13).fillColor(COLOR_TEXT);
  writeParagraph(doc, "Анкета с оценками по критериям", { align: "center" });
  doc.moveDown(0.2);
  doc.fontSize(11);
  writeParagraph(doc, `ФИО: ${detail.teacher.fullName.toUpperCase()}`, {
    align: "center",
  });
  doc.moveDown(0.5);

  metaLine(doc, "Дата", detail.dateLabel);
  metaLine(doc, "ФИО, должность субъекта оценивания", detail.evaluatorLabel);
  metaLine(doc, "Предмет", detail.disciplineTitle);
  metaLine(doc, "Класс", detail.classLabel);
  metaLine(doc, "Тема", detail.thema);
  metaLine(doc, "Карта", detail.cardTypeLabel);

  for (const group of groups) {
    const block = detail.blocks.find((item) => item.id === group.id);
    doc.font("Bold").fontSize(11).fillColor(COLOR_TEXT);
    writeParagraph(doc, group.title);
    doc.font("Bold").fontSize(8.5).fillColor(COLOR_MUTED);
    writeParagraph(
      doc,
      block
        ? `${group.maxScoreLabel} | итог ${block.percent}% (${block.level})`
        : group.maxScoreLabel,
    );
    doc.moveDown(0.3);

    for (const section of group.subsections) {
      if (section.title) {
        doc.font("Bold").fontSize(9.5).fillColor(COLOR_TEXT);
        writeParagraph(doc, section.title);
        doc.moveDown(0.2);
      }
      for (const item of section.items) {
        doc.font("Regular").fontSize(9.5).fillColor(COLOR_TEXT);
        writeParagraph(doc, `${item.code}. ${item.title}`);
        const score =
          detail.displayedScores[item.key] ?? detail.scores[item.key] ?? "-";
        doc.font("Bold").fontSize(9.5).fillColor(COLOR_TEXT);
        doc.text(`Оценка: ${score}`, left + 12, doc.y, {
          width: width - 12,
          lineGap: 2,
        });
        doc.moveDown(0.25);
      }
      doc.moveDown(0.2);
    }
    doc.moveDown(0.4);
  }

  doc.end();
  return done;
}
