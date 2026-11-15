import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { query } from "../db/pool.js";
import {
  encryptCustomer,
  ensureRequestHasDocumentNumbers,
  ensureSubscriptionRenewalSchema,
  getRenewalRequest,
  validateRenewalCustomerData,
  type RenewalCustomerData,
  type RenewalStatus,
} from "./subscription-renewal.service.js";

export class ContractDataError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ContractDataError";
    this.status = status;
  }
}

export interface SchoolContractData {
  required: boolean;
  requestId: number | null;
  status: RenewalStatus | null;
  customer: RenewalCustomerData;
  submitted: boolean;
  documentAvailable: boolean;
  contractNumber: string | null;
  issuedOn: string | null;
  startsOn: string | null;
  endsOn: string | null;
  amount: number | null;
  paidOn: string | null;
}

const EMPTY_CUSTOMER: RenewalCustomerData = {
  fullName: "",
  phone: "",
  passportSeries: "",
  passportNumber: "",
  passportIssuedBy: "",
  passportIssuedOn: "",
  divisionCode: "",
  residentialAddress: "",
  inn: "",
};

interface ManualRow extends RowDataPacket {
  requestId: number | null;
  amount: string | number | null;
  paidOn: string | null;
}

async function findAfterIncidentActivation(
  schoolId: number,
): Promise<ManualRow | null> {
  const rows = await query<ManualRow[]>(
    `SELECT sma.renewal_request_id AS requestId,
            sma.amount,
            DATE_FORMAT(sma.paid_on, '%Y-%m-%d') AS paidOn
     FROM subscription_manual_activations sma
     WHERE sma.school_id = ? AND sma.is_after_incident = 1
     ORDER BY sma.id DESC
     LIMIT 1`,
    [schoolId],
  );
  return rows[0] ?? null;
}

function isCustomerFilled(customer: RenewalCustomerData): boolean {
  return Boolean(
    customer.fullName &&
      customer.passportSeries &&
      customer.passportNumber &&
      customer.inn,
  );
}

function notRequired(): SchoolContractData {
  return {
    required: false,
    requestId: null,
    status: null,
    customer: EMPTY_CUSTOMER,
    submitted: false,
    documentAvailable: false,
    contractNumber: null,
    issuedOn: null,
    startsOn: null,
    endsOn: null,
    amount: null,
    paidOn: null,
  };
}

export async function getSchoolContractData(
  schoolId: number,
): Promise<SchoolContractData> {
  await ensureSubscriptionRenewalSchema();
  const manual = await findAfterIncidentActivation(schoolId);
  if (!manual?.requestId) return notRequired();

  const request = await getRenewalRequest(Number(manual.requestId), schoolId);
  if (!request) return notRequired();

  const submitted = isCustomerFilled(request.customer);
  return {
    required: true,
    requestId: request.id,
    status: request.status,
    customer: request.customer,
    submitted,
    documentAvailable: Boolean(
      submitted &&
        request.contractNumber &&
        request.invoiceNumber &&
        request.issuedOn &&
        request.startsOn &&
        request.endsOn,
    ),
    contractNumber: request.contractNumber,
    issuedOn: request.issuedOn,
    startsOn: request.startsOn,
    endsOn: request.endsOn,
    amount: manual.amount === null ? null : Number(manual.amount),
    paidOn: manual.paidOn,
  };
}

export async function saveSchoolContractData(
  schoolId: number,
  input: Partial<RenewalCustomerData> & { consent?: unknown },
): Promise<SchoolContractData> {
  await ensureSubscriptionRenewalSchema();
  if (input.consent !== true) {
    throw new ContractDataError(
      "Подтвердите согласие на обработку персональных данных",
    );
  }
  const manual = await findAfterIncidentActivation(schoolId);
  if (!manual?.requestId) {
    throw new ContractDataError(
      "Для этой школы нет запроса на данные для договора",
      404,
    );
  }

  let customer: RenewalCustomerData;
  try {
    customer = validateRenewalCustomerData(input);
  } catch (error) {
    throw new ContractDataError(
      error instanceof Error ? error.message : "Проверьте данные для договора",
    );
  }
  const encrypted = encryptCustomer(customer);
  const result = await query<ResultSetHeader>(
    `UPDATE subscription_renewal_requests
     SET customer_ciphertext = ?,
         customer_iv = ?,
         customer_auth_tag = ?,
         consent_at = NOW()
     WHERE id = ? AND school_id = ?`,
    [
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.authTag,
      Number(manual.requestId),
      schoolId,
    ],
  );
  if (!result.affectedRows) {
    throw new ContractDataError("Не удалось сохранить данные для договора", 404);
  }

  await ensureRequestHasDocumentNumbers(Number(manual.requestId));
  return getSchoolContractData(schoolId);
}
