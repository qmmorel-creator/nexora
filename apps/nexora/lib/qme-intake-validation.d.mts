export const QME_PROJECT_ID: string;
export const QME_TASK_TYPE_ID: string;
export const QME_STATUS_ID: string;
export const QME_SOURCE: string;

export function requiredText(value: unknown, field: string, max: number): string;
export function optionalText(value: unknown, field: string, max: number): string;
export function normalizeOrganization(value: unknown, max?: number): string;
export function validateEmail(value: unknown, max?: number): string;
export function validateRequestId(value: unknown): string;
export function validateSourceUrl(value: unknown, expectedOrigin: string, max?: number): string;
export function escapeMarkdown(value: unknown): string;
export function buildTitle(organization: string): string;
export function buildDescription(input: {
  name: string;
  email: string;
  organization: string;
  need: string;
  message: string;
  receivedAtParis: string;
  requestId: string;
  sourceUrl: string;
}): string;
export function buildProspectChecklist(idFactory?: () => string): Array<{
  id: string;
  text: string;
  done: boolean;
  end: null;
  statusId: null;
  assignee: string;
}>;
export function computeSignature(secret: string, timestamp: string, rawBody: string): string;
export function verifySignature(secret: string, timestamp: string, rawBody: string, providedSignature: unknown): boolean;
export function isTimestampFresh(timestampSeconds: unknown, nowSeconds?: number, maxAgeSeconds?: number, maxSkewSeconds?: number): boolean;
export function signatureFingerprint(signature: string): string;
export function ipFingerprint(ip: string): string;
