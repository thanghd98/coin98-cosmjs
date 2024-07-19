
interface Integer {
    readonly toNumber: () => number;
    readonly toBigInt: () => bigint;
    readonly toString: () => string;
  }
  
  interface WithByteConverters {
    readonly toBytesBigEndian: () => Uint8Array;
    readonly toBytesLittleEndian: () => Uint8Array;
  }
  
export class Uint32 implements Integer, WithByteConverters {
    /** @deprecated use Uint32.fromBytes */
    public static fromBigEndianBytes(bytes: ArrayLike<number>): Uint32 {
      return Uint32.fromBytes(bytes);
    }
  
    /**
     * Creates a Uint32 from a fixed length byte array.
     *
     * @param bytes a list of exactly 4 bytes
     * @param endianess defaults to big endian
     */
    public static fromBytes(bytes: ArrayLike<number>, endianess: "be" | "le" = "be"): Uint32 {
      if (bytes.length !== 4) {
        throw new Error("Invalid input length. Expected 4 bytes.");
      }
  
      for (let i = 0; i < bytes.length; ++i) {
        if (!Number.isInteger(bytes[i]) || bytes[i] > 255 || bytes[i] < 0) {
          throw new Error("Invalid value in byte. Found: " + bytes[i]);
        }
      }
  
      const beBytes = endianess === "be" ? bytes : Array.from(bytes).reverse();
  
      // Use mulitiplication instead of shifting since bitwise operators are defined
      // on SIGNED int32 in JavaScript and we don't want to risk surprises
      return new Uint32(beBytes[0] * 2 ** 24 + beBytes[1] * 2 ** 16 + beBytes[2] * 2 ** 8 + beBytes[3]);
    }
  
    public static fromString(str: string): Uint32 {
      if (!str.match(/^[0-9]+$/)) {
        throw new Error("Invalid string format");
      }
      return new Uint32(Number.parseInt(str, 10));
    }
  
    protected readonly data: number;
  
    public constructor(input: number) {
      if (Number.isNaN(input)) {
        throw new Error("Input is not a number");
      }
  
      if (!Number.isInteger(input)) {
        throw new Error("Input is not an integer");
      }
  
      if (input < 0 || input > 4294967295) {
        throw new Error("Input not in uint32 range: " + input.toString());
      }
  
      this.data = input;
    }
  
    public toBytesBigEndian(): Uint8Array {
      // Use division instead of shifting since bitwise operators are defined
      // on SIGNED int32 in JavaScript and we don't want to risk surprises
      return new Uint8Array([
        Math.floor(this.data / 2 ** 24) & 0xff,
        Math.floor(this.data / 2 ** 16) & 0xff,
        Math.floor(this.data / 2 ** 8) & 0xff,
        Math.floor(this.data / 2 ** 0) & 0xff,
      ]);
    }
  
    public toBytesLittleEndian(): Uint8Array {
      // Use division instead of shifting since bitwise operators are defined
      // on SIGNED int32 in JavaScript and we don't want to risk surprises
      return new Uint8Array([
        Math.floor(this.data / 2 ** 0) & 0xff,
        Math.floor(this.data / 2 ** 8) & 0xff,
        Math.floor(this.data / 2 ** 16) & 0xff,
        Math.floor(this.data / 2 ** 24) & 0xff,
      ]);
    }
  
    public toNumber(): number {
      return this.data;
    }
  
    public toBigInt(): bigint {
      return BigInt(this.toNumber());
    }
  
    public toString(): string {
      return this.data.toString();
    }
  }


export class Int53 implements Integer {
    public static fromString(str: string): Int53 {
      if (!str.match(/^-?[0-9]+$/)) {
        throw new Error("Invalid string format");
      }
  
      return new Int53(Number.parseInt(str, 10));
    }
  
    protected readonly data: number;
  
    public constructor(input: number) {
      if (Number.isNaN(input)) {
        throw new Error("Input is not a number");
      }
  
      if (!Number.isInteger(input)) {
        throw new Error("Input is not an integer");
      }
  
      if (input < Number.MIN_SAFE_INTEGER || input > Number.MAX_SAFE_INTEGER) {
        throw new Error("Input not in int53 range: " + input.toString());
      }
  
      this.data = input;
    }
  
    public toNumber(): number {
      return this.data;
    }
  
    public toBigInt(): bigint {
      return BigInt(this.toNumber());
    }
  
    public toString(): string {
      return this.data.toString();
    }
  }
  

  export class Uint53 implements Integer {
    public static fromString(str: string): Uint53 {
      const signed = Int53.fromString(str);
      return new Uint53(signed.toNumber());
    }
  
    protected readonly data: Int53;
  
    public constructor(input: number) {
      const signed = new Int53(input);
      if (signed.toNumber() < 0) {
        throw new Error("Input is negative");
      }
      this.data = signed;
    }
  
    public toNumber(): number {
      return this.data.toNumber();
    }
  
    public toBigInt(): bigint {
      return BigInt(this.toNumber());
    }
  
    public toString(): string {
      return this.data.toString();
    }
  }
  