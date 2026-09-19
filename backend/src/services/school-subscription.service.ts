import QRCode from "qrcode";
import { query } from "../db/pool.js";
import { getSchoolName } from "./auth.service.js";
import {
  getSchoolAccessState,
  syncSchoolCabinetAccess,
} from "./school-access.service.js";
import {
  BILLING_RECIPIENT,
  SUBSCRIPTION_PRICE_RUB,
  buildSubscriptionQrPayload,
  renewalPaymentPurpose,
} from "./billing-details.js";
import {
  getLatestSchoolRenewal,
  ensureRequestHasDocumentNumbers,
} from "./subscription-renewal.service.js";

export type SchoolSubscriptionPageStatus =
  | "active"
  | "expiring"
  | "expired"
  | "scheduled"
  | "missing";

export interface SchoolBankDetails {
  recipient: string;
  inn: string;
  kpp: string;
  account: string;
  personalAccount: string;
  bankName: string;
  bik: string;
  correspondentAccount: string;
  kbk: string;
  oktmo: string;
  purpose: string;
  contractNumber: string | null;
  directorFullName: string | null;
  amount: number;
  amountLabel: string;
  paymentNotice: string;
}

export interface SchoolSubscriptionOverview {
  schoolId: number;
  schoolName: string;
  status: SchoolSubscriptionPageStatus;
  title: string;
  description: string;
  cabinetLocked: boolean;
  needsPayment: boolean;
  paymentReady: boolean;
  startsOn: string | null;
  endsOn: string | null;
  daysLeft: number | null;
  totalDays: number | null;
  elapsedDays: number | null;
  progressPercent: number | null;
  phone: string | null;
  qrPayload: string | null;
  qrImage: string | null;
  bank: SchoolBankDetails | null;
}

interface PeriodRow {
  id: number;
  startsOn: string;
  endsOn: string;
  phone: string | null;
}

const EXPIRING_DAYS = 30;

function formatDateRu(value: string | null): string {
  if (!value) return "не указана";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function formatMoney(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} ₽`;
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  return Math.round((end - start) / 86_400_000);
}

function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function latestPeriod(schoolId: number): Promise<PeriodRow | null> {
  const rows = await query<PeriodRow[]>(
    `SELECT
       id,
       DATE_FORMAT(starts_on, '%Y-%m-%d') AS startsOn,
       DATE_FORMAT(ends_on, '%Y-%m-%d') AS endsOn,
       contact_phone AS phone
     FROM school_subscriptions
     WHERE school_id = ? AND is_cancelled = 0
     ORDER BY
       CASE WHEN CURDATE() BETWEEN starts_on AND ends_on THEN 0 ELSE 1 END,
       CASE WHEN starts_on > CURDATE() THEN 0 ELSE 1 END,
       starts_on ASC,
       ends_on DESC,
       id DESC
     LIMIT 1`,
    [schoolId],
  );
  return rows[0] ?? null;
}

function pageCopy(
  status: SchoolSubscriptionPageStatus,
  period: PeriodRow | null,
): { title: string; description: string } {
  switch (status) {
    case "expired":
      return {
        title: "Подписка истекла",
        description: period
          ? `Срок доступа закончился ${formatDateRu(period.endsOn)}. Необходимо оплатить продление по QR-коду или реквизитам. Если вы уже оплатили — дождитесь подтверждения со стороны администрации портала, повторно платить не нужно.`
          : "Срок доступа закончился. Необходимо оплатить продление. Если вы уже оплатили — дождитесь подтверждения со стороны администрации портала, повторно платить не нужно.",
      };
    case "expiring":
      return {
        title: "Подписка скоро закончится",
        description: `Текущий срок действует до ${formatDateRu(period?.endsOn ?? null)}. Кабинет пока открыт. Чтобы не потерять доступ, оплатите продление заранее.`,
      };
    case "scheduled":
      return {
        title: "Подписка ещё не началась",
        description: `Доступ откроется ${formatDateRu(period?.startsOn ?? null)}. До этой даты остальные разделы кабинета закрыты.`,
      };
    case "missing":
      return {
        title: "Срок подписки не указан",
        description:
          "Для этой школы пока нет дат подписки. Кабинет доступен. Если нужно оформить или уточнить срок, напишите в поддержку.",
      };
    default:
      return {
        title: "Подписка активна",
        description: `Текущий срок действует с ${formatDateRu(period?.startsOn ?? null)} по ${formatDateRu(period?.endsOn ?? null)}.`,
      };
  }
}

export async function getSchoolSubscriptionOverview(
  schoolId: number,
): Promise<SchoolSubscriptionOverview | null> {
  await syncSchoolCabinetAccess(schoolId);
  const [access, schoolName, period, latestRenewal] = await Promise.all([
    getSchoolAccessState(schoolId),
    getSchoolName(schoolId),
    latestPeriod(schoolId),
    getLatestSchoolRenewal(schoolId),
  ]);

  let renewal = latestRenewal;
  if (
    renewal &&
    (renewal.status === "pending" || renewal.status === "documents_ready") &&
    !renewal.contractNumber
  ) {
    await ensureRequestHasDocumentNumbers(renewal.id);
    renewal = await getLatestSchoolRenewal(schoolId);
  }

  if (!access.hasAccount || !schoolName) {
    return null;
  }

  const today = todayIso();
  let status: SchoolSubscriptionPageStatus = "missing";

  if (access.reason === "expired") {
    status = "expired";
  } else if (access.reason === "scheduled") {
    status = "scheduled";
  } else if (period && period.startsOn <= today && period.endsOn >= today) {
    const daysLeft = daysBetween(today, period.endsOn);
    status = daysLeft <= EXPIRING_DAYS ? "expiring" : "active";
  } else if (!access.hasSubscriptionHistory) {
    status = "missing";
  } else if (period && period.startsOn > today) {
    status = "scheduled";
  } else {
    status = "expired";
  }

  const subscriptionNeedsPayment =
    status === "expired" || status === "expiring";
  const needsPayment =
    subscriptionNeedsPayment && renewal?.status !== "paid";
  const paymentReady =
    needsPayment &&
    Boolean(
      renewal &&
        (renewal.status === "pending" ||
          renewal.status === "documents_ready"),
    );
  const cabinetLocked = status === "expired" || status === "scheduled";
  const { title, description } = pageCopy(status, period);

  let daysLeft: number | null = null;
  let totalDays: number | null = null;
  let elapsedDays: number | null = null;
  let progressPercent: number | null = null;

  if (period) {
    totalDays = daysBetween(period.startsOn, period.endsOn) + 1;
    if (status === "active" || status === "expiring") {
      daysLeft = daysBetween(today, period.endsOn);
      elapsedDays = Math.min(
        totalDays,
        Math.max(1, daysBetween(period.startsOn, today) + 1),
      );
      progressPercent = Math.round((elapsedDays / totalDays) * 100);
    } else if (status === "scheduled") {
      daysLeft = daysBetween(today, period.startsOn);
    }
  }

  const purpose = paymentReady
    ? renewalPaymentPurpose({
        contractNumber: renewal?.contractNumber,
        issuedOnLabel: renewal?.issuedOn
          ? formatDateRu(renewal.issuedOn)
          : null,
        requestId: renewal?.id,
        schoolName,
      })
    : null;
  const qrPayload =
    purpose && renewal ? buildSubscriptionQrPayload({ purpose }) : null;
  const qrImage = qrPayload
    ? await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: "M",
        margin: 4,
        width: 480,
        color: { dark: "#000000", light: "#ffffff" },
      })
    : null;

  return {
    schoolId,
    schoolName,
    status,
    title,
    description,
    cabinetLocked,
    needsPayment,
    paymentReady,
    startsOn: period?.startsOn ?? null,
    endsOn: period?.endsOn ?? null,
    daysLeft,
    totalDays,
    elapsedDays,
    progressPercent,
    phone: period?.phone ?? null,
    qrPayload,
    qrImage,
    bank: paymentReady && purpose
      ? {
          recipient: BILLING_RECIPIENT.treasury,
          inn: BILLING_RECIPIENT.inn,
          kpp: BILLING_RECIPIENT.kpp,
          account: BILLING_RECIPIENT.account,
          personalAccount: BILLING_RECIPIENT.personalAccount,
          bankName: BILLING_RECIPIENT.bankName,
          bik: BILLING_RECIPIENT.bik,
          correspondentAccount: BILLING_RECIPIENT.correspondentAccount,
          kbk: BILLING_RECIPIENT.kbk,
          oktmo: BILLING_RECIPIENT.oktmo,
          purpose,
          contractNumber: renewal?.contractNumber ?? null,
          directorFullName: renewal?.customer.fullName?.trim() || null,
          amount: SUBSCRIPTION_PRICE_RUB,
          amountLabel: formatMoney(SUBSCRIPTION_PRICE_RUB),
          paymentNotice:
            "При оплате обязательно сохраните назначение платежа без изменений.",
        }
      : null,
  };
}
