// Portable overlay links: the PUBLIC config (no owner id, no secrets) is
// encoded into the URL fragment, so OBS on any computer that can reach this
// app renders the right effect without shared storage.
//
// Trade-off: the link carries its own copy of the settings. It cannot be
// revoked remotely and does not pick up later edits — copy a new link after
// saving. A hosted repository removes both limits (see ../BACKEND.md).

import { sanitizePublic } from '../validate';
import type { PublicOverlayConfig } from '../types';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Generic portable encoding (base64url JSON) shared by every overlay type. */
export function encodeJson(value: unknown): string {
  return toBase64Url(JSON.stringify(value));
}

/** Decodes and validates; returns null for oversized, malformed or invalid data. */
export function decodeJson<T>(data: string, sanitize: (raw: unknown) => T | null): T | null {
  if (data.length > 8000) return null;
  try {
    return sanitize(JSON.parse(fromBase64Url(data)));
  } catch {
    return null;
  }
}

export function encodePortable(config: PublicOverlayConfig): string {
  return encodeJson(config);
}

export function decodePortable(data: string): PublicOverlayConfig | null {
  return decodeJson(data, sanitizePublic);
}
