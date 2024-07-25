//@ts-nocheck
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
import elliptic from "elliptic";
import BN from "bn.js";
import { fromHex } from "../encoding";

const secp256k1 = new elliptic.ec("secp256k1");
const secp256k1N = new BN("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141", "hex");

const derTagInteger = 0x02;

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

export class Secp256k1Signature {
  /**
   * Takes the pair of integers (r, s) as 2x32 byte of binary data.
   *
   * Note: This is the format Cosmos SDK uses natively.
   *
   * @param data a 64 byte value containing integers r and s.
   */
  public static fromFixedLength(data: Uint8Array): Secp256k1Signature {
    if (data.length !== 64) {
      throw new Error(`Got invalid data length: ${data.length}. Expected 2x 32 bytes for the pair (r, s)`);
    }
    return new Secp256k1Signature(
      trimLeadingNullBytes(data.slice(0, 32)),
      trimLeadingNullBytes(data.slice(32, 64)),
    );
  };

  public static fromDer(data: Uint8Array): Secp256k1Signature {
    let pos = 0;

    if (data[pos++] !== 0x30) {
      throw new Error("Prefix 0x30 expected");
    }

    const bodyLength = data[pos++];
    if (data.length - pos !== bodyLength) {
      throw new Error("Data length mismatch detected");
    }

    // r
    const rTag = data[pos++];
    if (rTag !== derTagInteger) {
      throw new Error("INTEGER tag expected");
    }
    const rLength = data[pos++];
    if (rLength >= 0x80) {
      throw new Error("Decoding length values above 127 not supported");
    }
    const rData = data.slice(pos, pos + rLength);
    pos += rLength;

    // s
    const sTag = data[pos++];
    if (sTag !== derTagInteger) {
      throw new Error("INTEGER tag expected");
    }
    const sLength = data[pos++];
    if (sLength >= 0x80) {
      throw new Error("Decoding length values above 127 not supported");
    }
    const sData = data.slice(pos, pos + sLength);
    pos += sLength;

    return new Secp256k1Signature(
      // r/s data can contain leading 0 bytes to express integers being non-negative in DER
      trimLeadingNullBytes(rData),
      trimLeadingNullBytes(sData),
    );
  }

  private readonly data: {
    readonly r: Uint8Array;
    readonly s: Uint8Array;
  };

  public constructor(r: Uint8Array, s: Uint8Array) {
    if (r.length > 32 || r.length === 0 || r[0] === 0x00) {
      throw new Error("Unsigned integer r must be encoded as unpadded big endian.");
    }

    if (s.length > 32 || s.length === 0 || s[0] === 0x00) {
      throw new Error("Unsigned integer s must be encoded as unpadded big endian.");
    }

    this.data = {
      r: r,
      s: s,
    };
  }

  public r(length?: number): Uint8Array {
    if (length === undefined) {
      return this.data.r;
    } else {
      const paddingLength = length - this.data.r.length;
      if (paddingLength < 0) {
        throw new Error("Length too small to hold parameter r");
      }
      const padding = new Uint8Array(paddingLength);
      return new Uint8Array([...padding, ...this.data.r]);
    }
  }

  public s(length?: number): Uint8Array {
    if (length === undefined) {
      return this.data.s;
    } else {
      const paddingLength = length - this.data.s.length;
      if (paddingLength < 0) {
        throw new Error("Length too small to hold parameter s");
      }
      const padding = new Uint8Array(paddingLength);
      return new Uint8Array([...padding, ...this.data.s]);
    }
  }

  public toFixedLength(): Uint8Array {
    return new Uint8Array([...this.r(32), ...this.s(32)]);
  }

  public toDer(): Uint8Array {
    // DER supports negative integers but our data is unsigned. Thus we need to prepend
    // a leading 0 byte when the higest bit is set to differentiate nagative values
    const rEncoded = this.data.r[0] >= 0x80 ? new Uint8Array([0, ...this.data.r]) : this.data.r;
    const sEncoded = this.data.s[0] >= 0x80 ? new Uint8Array([0, ...this.data.s]) : this.data.s;

    const rLength = rEncoded.length;
    const sLength = sEncoded.length;
    const data = new Uint8Array([derTagInteger, rLength, ...rEncoded, derTagInteger, sLength, ...sEncoded]);

    return new Uint8Array([0x30, data.length, ...data]);
  }
}

function trimLeadingNullBytes(inData: Uint8Array): Uint8Array {
  let numberOfLeadingNullBytes = 0;
  for (const byte of inData) {
    if (byte === 0x00) {
      numberOfLeadingNullBytes++;
    } else {
      break;
    }
  }
  return inData.slice(numberOfLeadingNullBytes);
};
/**
 * A Secp256k1Signature plus the recovery parameter
 */
export class ExtendedSecp256k1Signature extends Secp256k1Signature {
  /**
   * Decode extended signature from the simple fixed length encoding
   * described in toFixedLength().
   */
  
  public static fromFixedLength(data: Uint8Array): ExtendedSecp256k1Signature {
    if (data.length !== 65) {
      throw new Error(`Got invalid data length ${data.length}. Expected 32 + 32 + 1`);
    }
    return new ExtendedSecp256k1Signature(
      trimLeadingNullBytes(data.slice(0, 32)),
      trimLeadingNullBytes(data.slice(32, 64)),
      data[64],
    );
  };

  public readonly recovery: number;

  public constructor(r: Uint8Array, s: Uint8Array, recovery: number) {
    super(r, s);

    if (!Number.isInteger(recovery)) {
      throw new Error("The recovery parameter must be an integer.");
    }

    if (recovery < 0 || recovery > 4) {
      throw new Error("The recovery parameter must be one of 0, 1, 2, 3.");
    }

    this.recovery = recovery;
  }

  /**
   * A simple custom encoding that encodes the extended signature as
   * r (32 bytes) | s (32 bytes) | recovery param (1 byte)
   * where | denotes concatenation of bonary data.
   */
  public toFixedLength(): Uint8Array {
    return new Uint8Array([...this.r(32), ...this.s(32), this.recovery]);
  }
}


export const createSignature = async (
  messageHash: Uint8Array,
  privkey: Uint8Array,
): Promise<ExtendedSecp256k1Signature> => {
  if (messageHash.length === 0) {
    throw new Error("Message hash must not be empty");
  }
  if (messageHash.length > 32) {
    throw new Error("Message hash length must not exceed 32 bytes");
  }

  const keypair = secp256k1.keyFromPrivate(privkey);
  // the `canonical` option ensures creation of lowS signature representations
  const { r, s, recoveryParam } = keypair.sign(messageHash, { canonical: true });
  if (typeof recoveryParam !== "number") throw new Error("Recovery param missing");
  return new ExtendedSecp256k1Signature(
    Uint8Array.from(r.toArray()),
    Uint8Array.from(s.toArray()),
    recoveryParam,
  );
}