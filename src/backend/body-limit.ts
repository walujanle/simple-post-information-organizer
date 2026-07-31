export function checkContentLength(
  request: Request,
  maxBytes: number,
): { ok: true } | { ok: false; message: string } {
  const lengthHeader = request.headers.get('content-length')
  if (lengthHeader) {
    const length = parseInt(lengthHeader, 10)
    if (!Number.isNaN(length) && length > maxBytes) {
      return {
        ok: false,
        message: `Request body too large (max ${(maxBytes / 1024 / 1024).toFixed(0)}MB).`,
      }
    }
  }
  return { ok: true }
}
