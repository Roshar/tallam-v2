export const SUBSCRIPTION_PRICE_RUB = 10_000;

export const BILLING_RECIPIENT = {
  shortName: 'ГБУ ДПО "ИРО ЧР"',
  qrName: 'ГБУ ДПО "ИРО ЧР"',
  fullName:
    "Государственное бюджетное учреждение дополнительного профессионального образования «Институт развития образования Чеченской Республики»",
  address: "366007, Чеченская Республика, г. Грозный, ул. Лермонтова, 2",
  inn: "2014003615",
  kpp: "201401001",
  account: "03224643960000003200",
  personalAccount: "802У1607000",
  treasury:
    'УФК по Чеченской Республике (ГБУ ДПО "ИНСТИТУТ РАЗВИТИЯ ОБРАЗОВАНИЯ ЧЕЧЕНСКОЙ РЕСПУБЛИКИ", л/с 802У1607000)',
  bankName:
    "ОКЦ № 1 ВВГУ Банка России//УФК по Нижегородской области, г Нижний Новгород",
  bik: "012202102",
  correspondentAccount: "40102810745370000024",
  kbk: "00000000000000000130",
  oktmo: "96701000",
  rector: "Эльмурзаева Ганга Бекхановна",
  accountant: "Дурдиева Ж. А.",
} as const;

function qrValue(value: string): string {
  return value.replace(/[\r\n|]/g, " ").replace(/\s+/g, " ").trim();
}

export function renewalPaymentPurpose(input: {
  contractNumber?: string | null;
  issuedOnLabel?: string | null;
  requestId?: number | null;
  schoolName?: string | null;
}): string {
  const school = qrValue(String(input.schoolName ?? ""));
  const schoolSuffix = school ? `, ${school}` : "";
  if (!input.contractNumber) {
    return `Оплата за образовательные услуги согласно договору${schoolSuffix}`;
  }
  const date = input.issuedOnLabel || "без даты";
  return `Оплата за образовательные услуги согласно договору № ${input.contractNumber} от ${date}${schoolSuffix}`;
}

export function buildSubscriptionQrPayload(input: { purpose: string }): string {
  return [
    "ST00012",
    `Name=${qrValue(BILLING_RECIPIENT.qrName)}`,
    `PersonalAcc=${BILLING_RECIPIENT.account}`,
    `BankName=${qrValue(BILLING_RECIPIENT.bankName)}`,
    `BIC=${BILLING_RECIPIENT.bik}`,
    `CorrespAcc=${BILLING_RECIPIENT.correspondentAccount}`,
    `PayeeINN=${BILLING_RECIPIENT.inn}`,
    `KPP=${BILLING_RECIPIENT.kpp}`,
    `PersonalAccount=${BILLING_RECIPIENT.personalAccount}`,
    `Purpose=${qrValue(input.purpose)}`,
    `Sum=${SUBSCRIPTION_PRICE_RUB * 100}`,
  ].join("|");
}


