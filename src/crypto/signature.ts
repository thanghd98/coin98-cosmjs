import { encodeSecp256k1Pubkey } from "../amino";
import { toBase64 } from "../encoding";
import { Pubkey } from "../proto-signing";


export interface StdSignature {
    readonly pub_key: Pubkey;
    readonly signature: string;
  }

export function encodeSecp256k1Signature(pubkey: Uint8Array, signature: Uint8Array): StdSignature {
    if (signature.length !== 64) {
      throw new Error(
        "Signature must be 64 bytes long. Cosmos SDK uses a 2x32 byte fixed length encoding for the secp256k1 signature integers r and s.",
      );
    }
  
    return {
      pub_key: encodeSecp256k1Pubkey(pubkey),
      signature: toBase64(signature),
    };
}