import { toUtf8 } from "../encoding";
import { StdSignDoc } from "../types";

export function escapeCharacters(input: string): string {
    // When we migrate to target es2021 or above, we can use replaceAll instead of global patterns.
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replaceAll
    const amp = /&/g;
    const lt = /</g;
    const gt = />/g;
    return input.replace(amp, "\\u0026").replace(lt, "\\u003c").replace(gt, "\\u003e");
}

function sortedObject(obj: any): any {
    if (typeof obj !== "object" || obj === null) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(sortedObject);
    }
    const sortedKeys = Object.keys(obj).sort();
    const result: Record<string, any> = {};
    // NOTE: Use forEach instead of reduce for performance with large objects eg Wasm code
    sortedKeys.forEach((key) => {
      result[key] = sortedObject(obj[key]);
    });
    return result;
}
  
export function sortedJsonStringify(obj: any): string {
    return JSON.stringify(sortedObject(obj));
}

export function serializeSignDoc(signDoc: StdSignDoc): Uint8Array {
    const serialized = escapeCharacters(sortedJsonStringify(signDoc));
    return toUtf8(serialized);
  }
  