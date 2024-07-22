export interface IBinaryWriter {
    len: number;
    head: IOp;
    tail: IOp;
    uint32(value: number): IBinaryWriter;
}

interface IOp {
    len: number;
    next?: IOp;
    proceed(buf: Uint8Array | number[], pos: number): void;
}

class Op<T> implements IOp {
    fn?: ((val: T, buf: Uint8Array | number[], pos: number) => void) | null;
    len: number;
    val: T;
    next?: IOp;
  
    constructor(
      fn: ((val: T, buf: Uint8Array | number[], pos: number) => void | undefined | null) | null,
      len: number,
      val: T,
    ) {
      this.fn = fn;
      this.len = len;
      this.val = val;
    }
  
    proceed(buf: Uint8Array | number[], pos: number) {
      if (this.fn) {
        this.fn(this.val, buf, pos);
      }
    }
}


export class BinaryWriter implements IBinaryWriter {
    len = 0;
    head: IOp;
    tail: IOp;
  
    constructor() {
      this.head = new Op(null, 0, 0);
      this.tail = this.head;
    }
  
    static create() {
      return new BinaryWriter();
    }

    uint32(value: number): BinaryWriter {
        this.len += (this.tail = this.tail.next =
          new Op(
            writeVarint32,
            (value = value >>> 0) < 128 ? 1 : value < 16384 ? 2 : value < 2097152 ? 3 : value < 268435456 ? 4 : 5,
            value,
          )).len;
        return this;
    }

    private _push<T>(fn: (val: T, buf: Uint8Array | number[], pos: number) => void, len: number, val: T) {
        this.tail = this.tail.next = new Op(fn, len, val);
        this.len += len;
        return this;
    }
    

    string(value: string): BinaryWriter {
        const len = utf8Length(value);
        return len ? this.uint32(len)._push(utf8Write, len, value) : this._push(writeByte, 1, 0);
    }

    bytes(value: Uint8Array): BinaryWriter {
        const len = value.length >>> 0;
        if (!len) return this._push(writeByte, 1, 0);
        return this.uint32(len)._push(writeBytes, len, value);
    }

    static alloc(size: number): Uint8Array | number[] {
        if (typeof Uint8Array !== "undefined") {
          return pool((size) => new Uint8Array(size), Uint8Array.prototype.subarray)(size);
        } else {
          return new Array(size);
        }
    }

    finish(): Uint8Array {
        let head = this.head.next,
          pos = 0;
        const buf = BinaryWriter.alloc(this.len);
        while (head) {
          head.proceed(buf, pos);
          pos += head.len;
          head = head.next;
        }
        return buf as Uint8Array;
      }
    
}

export function writeVarint32(val: number, buf: Uint8Array | number[], pos: number) {
    while (val > 127) {
      buf[pos++] = (val & 127) | 128;
      val >>>= 7;
    }
    buf[pos] = val;
}

export function utf8Length(str: string) {
    let len = 0,
      c = 0;
    for (let i = 0; i < str.length; ++i) {
      c = str.charCodeAt(i);
      if (c < 128) len += 1;
      else if (c < 2048) len += 2;
      else if ((c & 0xfc00) === 0xd800 && (str.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
        ++i;
        len += 4;
      } else len += 3;
    }
    return len;
}

export function utf8Write(str: string, buffer: Uint8Array | Array<number>, offset: number) {
    const start = offset;
    let c1, // character 1
      c2; // character 2
    for (let i = 0; i < str.length; ++i) {
      c1 = str.charCodeAt(i);
      if (c1 < 128) {
        buffer[offset++] = c1;
      } else if (c1 < 2048) {
        buffer[offset++] = (c1 >> 6) | 192;
        buffer[offset++] = (c1 & 63) | 128;
      } else if ((c1 & 0xfc00) === 0xd800 && ((c2 = str.charCodeAt(i + 1)) & 0xfc00) === 0xdc00) {
        c1 = 0x10000 + ((c1 & 0x03ff) << 10) + (c2 & 0x03ff);
        ++i;
        buffer[offset++] = (c1 >> 18) | 240;
        buffer[offset++] = ((c1 >> 12) & 63) | 128;
        buffer[offset++] = ((c1 >> 6) & 63) | 128;
        buffer[offset++] = (c1 & 63) | 128;
      } else {
        buffer[offset++] = (c1 >> 12) | 224;
        buffer[offset++] = ((c1 >> 6) & 63) | 128;
        buffer[offset++] = (c1 & 63) | 128;
      }
    }
    return offset - start;
}

export function writeByte(val: number, buf: Uint8Array | number[], pos: number) {
    buf[pos] = val & 255;
}
  

function writeBytes(val: Uint8Array | number[], buf: Uint8Array | number[], pos: number) {
    if (typeof Uint8Array !== "undefined") {
      (buf as Uint8Array).set(val, pos);
    } else {
      for (let i = 0; i < val.length; ++i) buf[pos + i] = val[i];
    }
}
  
function pool(
    alloc: (size: number) => Uint8Array,
    slice: (begin?: number, end?: number) => Uint8Array,
    size?: number,
  ): (size: number) => Uint8Array {
    const SIZE = size || 8192;
    const MAX = SIZE >>> 1;
    let slab: Uint8Array | null = null;
    let offset = SIZE;
    return function pool_alloc(size): Uint8Array {
      if (size < 1 || size > MAX) return alloc(size);
      if (offset + size > SIZE) {
        slab = alloc(SIZE);
        offset = 0;
      }
      const buf: Uint8Array = slice.call(slab, offset, (offset += size));
      if (offset & 7)
        // align to 32 bit
        offset = (offset | 7) + 1;
      return buf;
    };
}

export enum WireType {
    Varint = 0,
  
    Fixed64 = 1,
  
    Bytes = 2,
  
    Fixed32 = 5,
  }
  
  // Reader
  export interface IBinaryReader {
    buf: Uint8Array;
    pos: number;
    type: number;
    len: number;
    skip(length?: number): this;
    skipType(wireType: number): this;
    uint32(): number;
    bytes(): Uint8Array;
}
  

export class BinaryReader implements IBinaryReader {
    pos: number;
    buf: Uint8Array;
    type: number;
    len: number;

    assertBounds(): void {
        if (this.pos > this.len) throw new RangeError("premature EOF");
    }
  
    constructor(buf?: ArrayLike<number>) {
        this.buf = buf ? new Uint8Array(buf) : new Uint8Array(0);
        this.pos = 0;
        this.type = 0;
        this.len = this.buf.length;
      }
    

    skip(length?: number) {
        if (typeof length === "number") {
          if (this.pos + length > this.len) throw indexOutOfRange(this, length);
          this.pos += length;
        } else {
          do {
            if (this.pos >= this.len) throw indexOutOfRange(this);
          } while (this.buf[this.pos++] & 128);
        }
        return this;
      }
    
      skipType(wireType: number) {
        switch (wireType) {
          case WireType.Varint:
            this.skip();
            break;
          case WireType.Fixed64:
            this.skip(8);
            break;
          case WireType.Bytes:
            this.skip(this.uint32());
            break;
          case 3:
            while ((wireType = this.uint32() & 7) !== 4) {
              this.skipType(wireType);
            }
            break;
          case WireType.Fixed32:
            this.skip(4);
            break;
    
          /* istanbul ignore next */
          default:
            throw Error("invalid wire type " + wireType + " at offset " + this.pos);
        }
        return this;
      }

      uint32(): number {
        return varint32read.bind(this)();
      }
      
      bytes(): Uint8Array {
        const len = this.uint32(),
          start = this.pos;
        this.pos += len;
        this.assertBounds();
        return this.buf.subarray(start, start + len);
      }
    
}

type ReaderLike = {
    buf: Uint8Array;
    pos: number;
    len: number;
    assertBounds(): void;
};

export function varint32read(this: ReaderLike): number {
    let b = this.buf[this.pos++];
    let result = b & 0x7f;
    if ((b & 0x80) == 0) {
      this.assertBounds();
      return result;
    }
  
    b = this.buf[this.pos++];
    result |= (b & 0x7f) << 7;
    if ((b & 0x80) == 0) {
      this.assertBounds();
      return result;
    }
  
    b = this.buf[this.pos++];
    result |= (b & 0x7f) << 14;
    if ((b & 0x80) == 0) {
      this.assertBounds();
      return result;
    }
  
    b = this.buf[this.pos++];
    result |= (b & 0x7f) << 21;
    if ((b & 0x80) == 0) {
      this.assertBounds();
      return result;
    }
  
    // Extract only last 4 bits
    b = this.buf[this.pos++];
    result |= (b & 0x0f) << 28;
  
    for (let readBytes = 5; (b & 0x80) !== 0 && readBytes < 10; readBytes++) b = this.buf[this.pos++];
  
    if ((b & 0x80) != 0) throw new Error("invalid varint");
  
    this.assertBounds();
  
    // Result can have 32 bits, convert it to unsigned
    return result >>> 0;
}
  
function indexOutOfRange(reader: BinaryReader, writeLength?: number) {
    return RangeError("index out of range: " + reader.pos + " + " + (writeLength || 1) + " > " + reader.len);
}