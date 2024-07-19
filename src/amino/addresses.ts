import { ripemd160, sha256 } from "../crypto";
import { toBase64 } from "../encoding";
import { Secp256k1Pubkey } from "../proto-signing";

export const pubkeyType = {
    /** @see https://github.com/tendermint/tendermint/blob/v0.33.0/crypto/ed25519/ed25519.go#L22 */
    secp256k1: "tendermint/PubKeySecp256k1" as const,
    /** @see https://github.com/tendermint/tendermint/blob/v0.33.0/crypto/secp256k1/secp256k1.go#L23 */
    ed25519: "tendermint/PubKeyEd25519" as const,
    /** @see https://github.com/tendermint/tendermint/blob/v0.33.0/crypto/sr25519/codec.go#L12 */
    sr25519: "tendermint/PubKeySr25519" as const,
    multisigThreshold: "tendermint/PubKeyMultisigThreshold" as const,
};
  

export function rawSecp256k1PubkeyToRawAddress(pubkeyData: Uint8Array): Uint8Array {
    if (pubkeyData.length !== 33) {
      throw new Error(`Invalid Secp256k1 pubkey length (compressed): ${pubkeyData.length}`);
    }
    return ripemd160(sha256(pubkeyData));
}

export function encodeSecp256k1Pubkey(pubkey: Uint8Array): Secp256k1Pubkey {
    if (pubkey.length !== 33 || (pubkey[0] !== 0x02 && pubkey[0] !== 0x03)) {
      throw new Error("Public key must be compressed secp256k1, i.e. 33 bytes starting with 0x02 or 0x03");
    }
    return {
      type: pubkeyType.secp256k1,
      value: toBase64(pubkey),
    };
}
  