/**
 * Request Context — Enterprise Observability
 * ดึง X-Request-ID จาก request (middleware ส่งต่อ)
 */
export const REQUEST_ID_HEADER = "x-request-id";

export function getRequestId(request: Request): string | null {
  return request.headers.get(REQUEST_ID_HEADER);
}
