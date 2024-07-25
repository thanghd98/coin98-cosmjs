import { BinaryReader, BinaryWriter } from "./binary";

export const QuerySmartContractStateRequest = {
    encode(
      message: any,
      writer: BinaryWriter = BinaryWriter.create(),
    ): BinaryWriter {
      if (message.address !== "") {
        writer.uint32(10).string(message.address);
      }
      if (message.queryData.length !== 0) {
        writer.uint32(18).bytes(message.queryData);
      }
      return writer;
    },
}
  
export const QuerySmartContractStateResponse = {
    decode(input: BinaryReader | Uint8Array, length?: number) {
      const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
      let end = length === undefined ? reader.len : reader.pos + length;
      const message = createBaseQuerySmartContractStateResponse();
      while (reader.pos < end) {
        const tag = reader.uint32();
        switch (tag >>> 3) {
          case 1:
            message.data = reader.bytes();
            break;
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    },
}
  
export function createBaseQuerySmartContractStateResponse() {
    return {
      data: new Uint8Array(),
    };
}
  