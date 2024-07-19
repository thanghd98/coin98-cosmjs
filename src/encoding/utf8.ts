export function toUtf8(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}
  