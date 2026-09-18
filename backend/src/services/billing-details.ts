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
    return `Оплата за оказание информационно-образовательных услуг по заявке № З-${input.requestId ?? "б/н"}`;
  }
  const contractNumber = input.contractNumber;
  const date = input.issuedOnLabel || "без даты";
  return `Оплата за оказание информационно-образовательных услуг согласно договору № ${contractNumber} от ${date}`;
}

function qrValue(value: string): string {
  return value.replace(/[\r\n|]/g, " ").replace(/\s+/g, " ").trim();
}

function splitFio(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    lastName: parts[0] ?? "",
    firstName: parts[1] ?? "",
    middleName: parts.slice(2).join(" "),
  };
}

export function buildSubscriptionQrPayload(input: {
  purpose: string;
  contractNumber?: string | null;
  payerInn?: string | null;
  payerFullName?: string | null;
}): string {
  const parts = [
    "ST00012",
    `Name=${qrValue(BILLING_RECIPIENT.treasury)}`,
    `PersonalAcc=${BILLING_RECIPIENT.account}`,
    `BankName=${qrValue(BILLING_RECIPIENT.bankName)}`,
    `BIC=${BILLING_RECIPIENT.bik}`,
    `CorrespAcc=${BILLING_RECIPIENT.correspondentAccount}`,
    `PayeeINN=${BILLING_RECIPIENT.inn}`,
    `KPP=${BILLING_RECIPIENT.kpp}`,
    `CBC=${BILLING_RECIPIENT.kbk}`,
    `OKTMO=${BILLING_RECIPIENT.oktmo}`,
    `Sum=${SUBSCRIPTION_PRICE_RUB * 100}`,
    `Purpose=${qrValue(input.purpose)}`,
    "DrawerStatus=13",
    "PaytReason=0",
    "TaxPeriod=0",
    "DocNo=0",
    "DocDate=0",
    "TaxPaytKind=0",
    "UIN=0",
    "UIP=0",
  ];

  const contractNumber = qrValue(String(input.contractNumber ?? ""));
  if (contractNumber) {
    parts.push(`Contract=${contractNumber}`);
  }

  const inn = String(input.payerInn ?? "").replace(/\D/g, "");
  if (inn.length === 10 || inn.length === 12) {
    parts.push(`PayerINN=${inn}`);
  }

  const fio = splitFio(String(input.payerFullName ?? ""));
  if (fio.lastName) parts.push(`LastName=${qrValue(fio.lastName)}`);
  if (fio.firstName) parts.push(`FirstName=${qrValue(fio.firstName)}`);
  if (fio.middleName) parts.push(`MiddleName=${qrValue(fio.middleName)}`);

  return parts.join("|");
}


