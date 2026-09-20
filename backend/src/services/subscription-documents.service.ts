import { createRequire } from "node:module";
import PDFDocument from "pdfkit";
import { BILLING_RECIPIENT } from "./billing-details.js";
import {
  getRenewalRequest,
  type RenewalCustomerData,
  type RenewalRequest,
} from "./subscription-renewal.service.js";

const require = createRequire(import.meta.url);
const FONT_REGULAR = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf");
const FONT_BOLD = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf");

interface DocumentMeta {
  contractNumber: string;
  invoiceNumber: string;
  issuedOn: string;
  startsOn: string;
  endsOn: string;
}

export class RenewalDocumentUnavailableError extends Error {
  constructor() {
    super("Документы станут доступны после подтверждения оплаты");
    this.name = "RenewalDocumentUnavailableError";
  }
}

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function documentMeta(request: RenewalRequest): DocumentMeta {
  if (
    request.status !== "paid" ||
    !request.contractNumber ||
    !request.invoiceNumber ||
    !request.issuedOn ||
    !request.startsOn ||
    !request.endsOn
  ) {
    throw new RenewalDocumentUnavailableError();
  }
  return {
    contractNumber: request.contractNumber,
    invoiceNumber: request.invoiceNumber,
    issuedOn: request.issuedOn,
    startsOn: request.startsOn,
    endsOn: request.endsOn,
  };
}

function passportShort(customer: RenewalCustomerData): string {
  return `паспорт: серия ${customer.passportSeries} № ${customer.passportNumber}`;
}

function passportFull(customer: RenewalCustomerData): string {
  return [
    `серия ${customer.passportSeries} № ${customer.passportNumber}`,
    `выдан ${customer.passportIssuedBy} ${formatDate(customer.passportIssuedOn)}`,
    `код подразделения ${customer.divisionCode}`,
    `адрес проживания: ${customer.residentialAddress}`,
    customer.phone ? `телефон: ${customer.phone}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

function createPdf(title: string): {
  doc: PDFKit.PDFDocument;
  result: Promise<Buffer>;
} {
  const doc = new PDFDocument({
    size: "A4",
    margin: 44,
    info: { Title: title, Author: BILLING_RECIPIENT.shortName },
  });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.registerFont("Regular", FONT_REGULAR);
  doc.registerFont("Bold", FONT_BOLD);
  doc.font("Regular").fillColor("#111111");
  return { doc, result };
}

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function paragraph(
  doc: PDFKit.PDFDocument,
  text: string,
  options: PDFKit.Mixins.TextOptions = {},
): void {
  doc
    .font("Regular")
    .fontSize(9.2)
    .fillColor("#111111")
    .text(text, doc.page.margins.left, doc.y, {
      align: "justify",
      lineGap: 2,
      width: contentWidth(doc),
      ...options,
    });
  doc.moveDown(0.55);
}

function heading(doc: PDFKit.PDFDocument, text: string): void {
  doc
    .font("Bold")
    .fontSize(10)
    .text(text, doc.page.margins.left, doc.y, {
      width: contentWidth(doc),
      align: "center",
    });
  doc.moveDown(0.35);
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

function placeAndDate(doc: PDFKit.PDFDocument, issuedOn: string): void {
  const y = doc.y;
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const half = width / 2;
  doc.font("Regular").fontSize(9).fillColor("#111111");
  doc.text("г. Грозный", left, y, { width: half, align: "left" });
  doc.text(formatDate(issuedOn), left + half, y, {
    width: half,
    align: "right",
  });
  doc.x = left;
  doc.y = y + 16;
}

async function buildContract(request: RenewalRequest): Promise<Buffer> {
  const meta = documentMeta(request);
  const customer = request.customer;
  const { doc, result } = createPdf(
    `Договор № ${meta.contractNumber} — ${customer.fullName}`,
  );

  doc.font("Bold").fontSize(13).text(`Договор № ${meta.contractNumber}`, {
    align: "center",
  });
  doc
    .font("Regular")
    .fontSize(10)
    .text("оказания информационно-образовательных услуг", { align: "center" });
  doc.moveDown(0.7);
  placeAndDate(doc, meta.issuedOn);
  doc.moveDown(0.35);

  paragraph(
    doc,
    `${BILLING_RECIPIENT.fullName} (${BILLING_RECIPIENT.shortName}), в соответствии с Лицензией на право ведения образовательной деятельности от 24.02.2021 регистрационный № 3361, серия 20Л02, выданной Министерством образования и науки Чеченской Республики, в лице ректора ${BILLING_RECIPIENT.rector}, действующей на основании Устава, именуемое «Исполнитель», с одной стороны, и физическое лицо ${customer.fullName}, ${passportShort(customer)}, именуемое «Заказчик», при совместном упоминании «Стороны», заключили настоящий Договор о нижеследующем:`,
  );

  heading(doc, "1. Предмет Договора");
  paragraph(
    doc,
    "1.1. Предметом настоящего Договора является оказание информационно-образовательных услуг Заказчику на информационно-образовательной платформе в сети Интернет по адресу: https://tallam.ru/auth. Предоставление услуг предусматривает подключение Заказчика к Интернет-ресурсу Исполнителя. Информационные ресурсы, предоставленные Заказчику, являются собственностью Исполнителя.",
  );
  paragraph(
    doc,
    `1.2. Срок исполнения обязательств: с ${formatDate(meta.startsOn)} по ${formatDate(meta.endsOn)} включительно.`,
  );

  heading(doc, "2. Обязанности сторон");
  paragraph(
    doc,
    "2.1. «Исполнитель» обязуется: своевременно оказать услуги, указанные в разделе о предмете настоящего Договора; предоставить Заказчику индивидуальное системное имя и пароль для доступа к Порталу не позднее 3 (трёх) рабочих дней после подписания Договора; предпринимать необходимые меры для поддержания и улучшения качества оказываемых услуг.",
  );
  paragraph(
    doc,
    "2.2. «Заказчик» обязуется: не передавать третьим лицам системные имена и пароли, используемые для доступа к Порталу; не разглашать и не передавать третьим лицам без согласования с Исполнителем полученную в результате работы с Платформой информацию; передавать в письменном виде замечания или предложения по совершенствованию функционала платформы.",
  );

  heading(doc, "3. Расчёты сторон");
  paragraph(
    doc,
    "3.1. Общая цена Договора составляет 10 000 (десять тысяч) рублей 00 копеек.",
  );
  paragraph(
    doc,
    "3.2. Стоимость включает все издержки и налоговые обязательства Исполнителя.",
  );
  paragraph(
    doc,
    "3.3. Цена Договора является твёрдой и не подлежит изменению в течение срока его действия.",
  );
  paragraph(
    doc,
    "3.4. Оплата производится Заказчиком в форме безналичного расчёта по реквизитам Исполнителя, указанным в настоящем Договоре.",
  );

  heading(doc, "4. Ответственность сторон");
  paragraph(
    doc,
    "4.1. Стороны несут ответственность за выполнение обязательств в соответствии с заключённым Договором.",
  );
  paragraph(
    doc,
    "4.2. Действие Договора может быть приостановлено в случае невыполнения условий одной из Сторон.",
  );

  heading(doc, "5. Срок действия Договора");
  paragraph(
    doc,
    `5.1. Настоящий Договор вступает в силу с момента его подписания Сторонами и действует до ${formatDate(meta.endsOn)}. Каждая Сторона вправе в одностороннем порядке отказаться от исполнения Договора, уведомив другую Сторону не менее чем за один месяц.`,
  );
  paragraph(
    doc,
    "5.2. Расторжение Договора возможно по соглашению Сторон; в этом случае каждая из Сторон обязана уведомить другую Сторону не менее чем за 30 календарных дней.",
  );

  heading(doc, "6. Прочие условия");
  paragraph(
    doc,
    "6.1. Договор составлен на русском языке в двух экземплярах, имеющих одинаковую юридическую силу, по одному для каждой Стороны.",
  );
  paragraph(
    doc,
    "6.2. Ни одна из Сторон не вправе передать полностью или частично свои права и обязанности без предварительного письменного согласия другой Стороны.",
  );
  paragraph(
    doc,
    "6.3. Все изменения и дополнения являются неотъемлемой частью Договора и вступают в силу с момента их подписания Сторонами.",
  );
  paragraph(
    doc,
    "6.4. Все уведомления и сообщения направляются в письменной форме.",
  );
  paragraph(
    doc,
    "6.5. Стороны обязуются незамедлительно уведомлять друг друга об изменении адресов и банковских реквизитов.",
  );

  ensureSpace(doc, 280);
  heading(doc, "7. Юридические адреса и реквизиты сторон");
  const top = doc.y;
  const leftWidth = 245;
  const rightX = 310;
  doc
    .font("Bold")
    .fontSize(9)
    .text("Заказчик", 44, top, { width: leftWidth })
    .text("Исполнитель", rightX, top, { width: 240 });
  doc
    .font("Regular")
    .fontSize(8.5)
    .text(
      `${customer.fullName}\n${passportFull(customer)}\nИНН: ${customer.inn}`,
      44,
      top + 18,
      { width: leftWidth, lineGap: 2 },
    )
    .text(
      `${BILLING_RECIPIENT.shortName}\n${BILLING_RECIPIENT.address}\nИНН ${BILLING_RECIPIENT.inn}, КПП ${BILLING_RECIPIENT.kpp}\nЛ/с ${BILLING_RECIPIENT.personalAccount}\n${BILLING_RECIPIENT.bankName}\nБИК ${BILLING_RECIPIENT.bik}\nР/с ${BILLING_RECIPIENT.account}\nПолучатель: ${BILLING_RECIPIENT.treasury}\nКБК ${BILLING_RECIPIENT.kbk}`,
      rightX,
      top + 18,
      { width: 240, lineGap: 2 },
    );
  doc.y = Math.max(doc.y, top + 185);
  doc
    .font("Regular")
    .fontSize(9)
    .text(`________________ / ${customer.fullName} /`, 44, doc.y, {
      width: leftWidth,
    })
    .text(
      "Ректор ______________ / Г. Б. Эльмурзаева /\nМ.П.",
      rightX,
      doc.y - 11,
      { width: 240 },
    );

  doc.addPage();
  doc.font("Bold").fontSize(14).text("АКТ", { align: "center" });
  doc
    .font("Regular")
    .fontSize(10)
    .text("оказания информационно-образовательных услуг", { align: "center" });
  doc.moveDown(0.8);
  placeAndDate(doc, meta.issuedOn);
  doc.moveDown(0.45);
  paragraph(
    doc,
    `${BILLING_RECIPIENT.fullName} (${BILLING_RECIPIENT.shortName}), в лице ректора ${BILLING_RECIPIENT.rector}, действующей на основании Устава, именуемое «Исполнитель», с одной стороны, и физическое лицо ${customer.fullName}, ${passportShort(customer)}, именуемое «Заказчик», с другой стороны, составили настоящий Акт о нижеследующем:`,
  );
  paragraph(
    doc,
    `Исполнитель оказал Заказчику информационно-образовательную услугу на платформе в сети Интернет https://tallam.ru/auth по договору № ${meta.contractNumber} от ${formatDate(meta.issuedOn)}.`,
  );

  const tableY = doc.y + 5;
  const tableH = 90;
  doc.rect(44, tableY, 507, tableH).stroke("#555555");
  doc.moveTo(78, tableY).lineTo(78, tableY + tableH).stroke();
  doc.moveTo(450, tableY).lineTo(450, tableY + tableH).stroke();
  doc.moveTo(44, tableY + 24).lineTo(551, tableY + 24).stroke();
  doc.moveTo(44, tableY + 66).lineTo(551, tableY + 66).stroke();
  doc.font("Bold").fontSize(8).text("№", 54, tableY + 7, { width: 15 });
  doc.text("Услуга", 90, tableY + 7, { width: 340, align: "center" });
  doc.text("Цена", 465, tableY + 7, { width: 70, align: "center" });
  doc.font("Regular").text("1", 54, tableY + 38, { width: 15 });
  doc.text(
    "Доступ к информационно-образовательной платформе в сети Интернет",
    90,
    tableY + 32,
    { width: 340 },
  );
  doc.text("10 000,00", 465, tableY + 38, { width: 70, align: "center" });
  doc.font("Bold").text("Итого", 90, tableY + 74, {
    width: 340,
    align: "right",
  });
  doc.text("10 000,00", 465, tableY + 74, { width: 70, align: "center" });
  doc.x = doc.page.margins.left;
  doc.y = tableY + tableH + 16;
  paragraph(
    doc,
    "2. Исполнитель оказал услуги своевременно и в полном объёме. Заказчик по объёму и качеству оказанных услуг претензий не имеет.",
  );
  paragraph(
    doc,
    "3. Настоящий Акт составлен в двух экземплярах, имеющих одинаковую юридическую силу, по одному экземпляру для каждой Стороны.",
  );
  paragraph(
    doc,
    "4. Претензий по исполнению Договора Стороны друг к другу не имеют.",
  );
  doc.moveDown(2);
  doc
    .font("Regular")
    .fontSize(9)
    .text(`________________ / ${customer.fullName} /`, 44, doc.y, {
      width: 240,
    })
    .text(
      "Ректор ______________ / Г. Б. Эльмурзаева /\nМ.П.",
      310,
      doc.y - 11,
      { width: 240 },
    );

  doc.end();
  return result;
}

export async function buildRenewalDocument(input: {
  requestId: number;
  schoolId?: number;
}): Promise<{ buffer: Buffer; filename: string } | null> {
  const request = await getRenewalRequest(input.requestId, input.schoolId);
  if (!request) return null;
  return buildRenewalDocumentFromRequest(request);
}

export async function buildRenewalDocumentFromRequest(
  request: RenewalRequest,
): Promise<{ buffer: Buffer; filename: string }> {
  const meta = documentMeta(request);
  return {
    buffer: await buildContract(request),
    filename: `Договор-и-акт-Таллам-${meta.contractNumber}.pdf`,
  };
}

