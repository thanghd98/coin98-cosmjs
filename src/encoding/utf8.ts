export function toUtf8(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}
  
export function fromUtf8(data: Uint8Array, lossy = false): string {
    const fatal = !lossy;
    return new TextDecoder("utf-8", { fatal }).decode(data);
}
  