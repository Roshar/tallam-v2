export const SUBSCRIPTION_PRICE_RUB = 10_000;

export const BILLING_RECIPIENT = {
  shortName: "ГБУ ДПО «ИРО ЧР»",
  fullName:
    "Государственное бюджетное учреждение дополнительного профессионального образования «Институт развития образования Чеченской Республики»",
  address: "366007, Чеченская Республика, г. Грозный, ул. Лермонтова, 2",
  inn: "2014003615",
  kpp: "201401001",
  account: "03224643960000003200",
  personalAccount: "802У1607000",
  treasury:
    "УФК по Чеченской Республике (ГБУ ДПО «ИРО ЧР», л/с 802У1607000)",
  bankName:
    "ОКЦ № 1 ВВГУ Банка России//УФК по Нижегородской области, г. Нижний Новгород",
  bik: "012202102",
  correspondentAccount: "40102810745370000024",
  kbk: "00000000000000000130",
  oktmo: "96701000",
  rector: "Эльмурзаева Ганга Бекхановна",
  accountant: "Дурдиева Ж. А.",
} as const;

export function renewalPaymentPurpose(input: {
  contractNumber?: string | null;
  issuedOnLabel?: string | null;
  requestId?: number | null;
}): string {
  if (!input.contractNumber) {
    return `Оплата за оказание информационно-образовательных услуг по заявке № З-${input.requestId ?? "—"}`;
  }
  const contractNumber = input.contractNumber;
  const date = input.issuedOnLabel || "без даты";
  return `Оплата за оказание информационно-образовательных услуг согласно договору № ${contractNumber} от ${date}`;
}

