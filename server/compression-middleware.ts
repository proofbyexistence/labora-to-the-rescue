/**
 * Streaming Brotli and Gzip HTTP response compression middleware for text and JSON assets.
 */
import type { NextFunction, Request, Response } from 'express';
import zlib from 'node:zlib';

const COMPRESSIBLE_CONTENT_TYPE =
  /^(text\/|application\/(javascript|json|xml|xhtml\+xml)|image\/svg\+xml)/i;
const MIN_COMPRESSIBLE_BYTES = 1024;

type CompressionEncoding = 'br' | 'gzip';
type CompressorStream = zlib.BrotliCompress | zlib.Gzip;

function resolveEncoding(req: Request): CompressionEncoding | null {
  const acceptEncoding = String(req.headers['accept-encoding'] ?? '');
  if (/\bbr\b/i.test(acceptEncoding)) return 'br';
  if (/\bgzip\b/i.test(acceptEncoding)) return 'gzip';
  return null;
}

function toBuffer(chunk: unknown, encodingOrCb: unknown): Buffer {
  if (typeof chunk === 'string') {
    const enc = typeof encodingOrCb === 'string' ? (encodingOrCb as BufferEncoding) : 'utf8';
    return Buffer.from(chunk, enc);
  }
  return Buffer.isBuffer(chunk) ? chunk : Buffer.alloc(0);
}

function isEligibleForCompression(res: Response, byteHint: number): boolean {
  const status = res.statusCode;
  const existingEnc = res.getHeader('Content-Encoding');
  const contentType = String(res.getHeader('Content-Type') ?? '');
  const rawLen = res.getHeader('Content-Length');
  const knownLen = typeof rawLen === 'number' ? rawLen : Number(rawLen);
  if (status === 204 || status === 304 || existingEnc) return false;
  if (!COMPRESSIBLE_CONTENT_TYPE.test(contentType)) return false;
  if (Number.isFinite(knownLen) && knownLen > 0 && knownLen < MIN_COMPRESSIBLE_BYTES) return false;
  return !(!Number.isFinite(knownLen) && byteHint > 0 && byteHint < MIN_COMPRESSIBLE_BYTES && res.writableEnded);
}

function createCompressorStream(
  res: Response,
  encoding: CompressionEncoding,
  origWrite: typeof res.write,
  origEnd: typeof res.end
): CompressorStream {
  res.removeHeader('Content-Length');
  res.setHeader('Content-Encoding', encoding);
  const stream =
    encoding === 'br'
      ? zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } })
      : zlib.createGzip({ level: 6 });
  stream.on('data', (chunk: Buffer) => origWrite(chunk));
  stream.on('end', () => origEnd());
  stream.on('error', () => res.destroy());
  return stream;
}

function attachCompressedWriters(res: Response, encoding: CompressionEncoding): void {
  const origWrite = res.write.bind(res);
  const origEnd = res.end.bind(res);
  let decided = false;
  let compressor: CompressorStream | null = null;

  const ensureCompressor = (byteHint: number) => {
    if (decided) return;
    decided = true;
    if (isEligibleForCompression(res, byteHint)) {
      compressor = createCompressorStream(res, encoding, origWrite, origEnd);
    }
  };

  res.write = ((chunk: unknown, encOrCb?: BufferEncoding | ((e?: Error | null) => void), cb?: (e?: Error | null) => void): boolean => {
    const buf = toBuffer(chunk, encOrCb);
    ensureCompressor(buf.length);
    return compressor ? compressor.write(buf) : origWrite(chunk as never, encOrCb as never, cb as never);
  }) as typeof res.write;

  res.end = ((chunk?: unknown, encOrCb?: BufferEncoding | (() => void), cb?: () => void): Response => {
    const hasChunk = chunk !== undefined && chunk !== null && typeof chunk !== 'function';
    const buf = hasChunk ? toBuffer(chunk, encOrCb) : Buffer.alloc(0);
    if (!decided) {
      const rawLen = res.getHeader('Content-Length');
      const knownLen = typeof rawLen === 'number' ? rawLen : Number(rawLen);
      const effectiveLen = Number.isFinite(knownLen) && knownLen > 0 ? knownLen : buf.length;
      if (effectiveLen >= MIN_COMPRESSIBLE_BYTES) ensureCompressor(effectiveLen);
      else decided = true;
    }
    if (compressor) {
      if (hasChunk && buf.length > 0) compressor.end(buf);
      else compressor.end();
      return res;
    }
    return origEnd(chunk as never, encOrCb as never, cb as never);
  }) as typeof res.end;
}

/**
 * Compresses eligible HTTP responses using Brotli (`br`) or Gzip when supported by the client.
 *
 * @param req - Incoming Express request.
 * @param res - Outgoing Express response.
 * @param next - Next middleware callback.
 */
export function compressionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.method === 'HEAD') {
    next();
    return;
  }
  const encoding = resolveEncoding(req);
  res.vary('Accept-Encoding');
  if (encoding) {
    attachCompressedWriters(res, encoding);
  }
  next();
}
