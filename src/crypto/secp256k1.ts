import elliptic from "elliptic";
import BN from "bn.js";
import { fromHex } from "../encoding";
const secp256k1 = new elliptic.ec("secp256k1");
const secp256k1N = new BN("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141", "hex");

export interface Secp256k1Keypair {
    /** A 32 byte private key */
    readonly pubkey: Uint8Array;
    /**
     * A raw secp256k1 public key.
     *
     * The type itself does not give you any guarantee if this is
     * compressed or uncompressed. If you are unsure where the data
     * is coming from, use `Secp256k1.compressPubkey` or
     * `Secp256k1.uncompressPubkey` (both idempotent) before processing it.
     */
    readonly privkey: Uint8Array;
}

export const makeKeypair = async (privkey: Uint8Array): Promise<Secp256k1Keypair>  =>{
    if (privkey.length !== 32) {
        // is this check missing in secp256k1.validatePrivateKey?
        // https://github.com/bitjson/bitcoin-ts/issues/4
        throw new Error("input data is not a valid secp256k1 private key");
    }

    const keypair = secp256k1.keyFromPrivate(privkey);
    if (keypair.validate().result !== true) {
      throw new Error("input data is not a valid secp256k1 private key");
    }

    // range test that is not part of the elliptic implementation
    const privkeyAsBigInteger = new BN(privkey);
    if (privkeyAsBigInteger.gte(secp256k1N)) {
      // not strictly smaller than N
      throw new Error("input data is not a valid secp256k1 private key");
    }

    const out: Secp256k1Keypair = {
        privkey: fromHex(keypair.getPrivate("hex")),
        // encodes uncompressed as
        // - 1-byte prefix "04"
        // - 32-byte x coordinate
        // - 32-byte y coordinate
        pubkey: Uint8Array.from(keypair.getPublic("array")),
    };

    return out;
}

export const compressPubkey = (pubkey: Uint8Array): Uint8Array => {
    switch (pubkey.length) {
      case 33:
        return pubkey;
      case 65:
        return Uint8Array.from(secp256k1.keyFromPublic(pubkey).getPublic(true, "array"));
      default:
        throw new Error("Invalid pubkey length");
    }
}