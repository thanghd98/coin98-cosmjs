import { ripemd160, sha256 } from "../crypto";

export function rawSecp256k1PubkeyToRawAddress(pubkeyData: Uint8Array): Uint8Array {
    if (pubkeyData.length !== 33) {
      throw new Error(`Invalid Secp256k1 pubkey length (compressed): ${pubkeyData.length}`);
    }
    return ripemd160(sha256(pubkeyData));
}
