import { bech32 } from "bech32";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { CosmosChainInfo, ICreateAccountResponse, ISignDirectParams, ISignParams, ITransactionParams, IExecuteTransactiom, ExecuteResult, ExecuteInstruction, IExecuteMultipleTransaction, StdSignDoc, TokenCW20Params } from "./types";
import { ICreateAccountParams } from "./types";
import { mnemonicToSeed } from "bip39"
import { compressPubkey, createSignature, makeKeypair, Sha256, sha256, Slip10, Slip10Curve, stringToPath } from "./crypto";
import { encodeSecp256k1Pubkey, rawSecp256k1PubkeyToRawAddress, serializeSignDoc } from "./amino";
import { SignDoc, TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { BinaryReader, BinaryWriter, getAccount } from "./utils";
import { encode, encodePubkey, makeAuthInfoBytes, makeSignBytes, makeSignDoc } from "./proto-signing";
import { Int53 } from "./math";
import { encodeSecp256k1Signature } from "./crypto/signature";
import { fromBase64, fromUtf8, toAscii, toBase64, toUtf8 } from "./encoding";
import { createDeliverTxResponseErrorMessage, isDeliverTxFailure, parseRawLog } from "./stargate";
import get from "lodash/get";

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

function createBaseQuerySmartContractStateResponse() {
  return {
    data: new Uint8Array(),
  };
}

export class Cosmos{
  chainInfo: CosmosChainInfo

  constructor( chainInfo: CosmosChainInfo ){
    this.chainInfo = chainInfo
  }

  static withChainInfo(chainInfo: CosmosChainInfo){
    return new Cosmos(chainInfo)
  }

  async createAcccount(params: ICreateAccountParams): Promise<ICreateAccountResponse>{
    console.log("🚀 ~ Cosmos ~ createAcccount ~ params:", params)
    const {isPrivateKey, mnemonic, privateKey, path} = params
    let privKey: Buffer

    try {
        if(isPrivateKey){
          privKey = privateKey
        }else{
          const seed = await mnemonicToSeed(mnemonic)
          const { privkey: privateKey } = Slip10.derivePath(Slip10Curve.Secp256k1, seed, stringToPath(`m/44'/${path}'/0'/0/0`));
          privKey = privateKey as Buffer
        }

        const uncompressed =  (await makeKeypair(privKey)).pubkey
    
        const publickey = compressPubkey(uncompressed)

        const words = bech32.toWords(rawSecp256k1PubkeyToRawAddress(publickey))
        const address = bech32.encode( get(this.chainInfo, 'bech32Config.bech32PrefixAccAddr'), words)

        return {
            address,
            privateKey: Buffer.from(privKey).toString('hex'),
            publicKey: Buffer.from(publickey).toString('hex')
        }
    } catch (error) {
      throw new Error('Can not create the account')
    }
  }

  async sendTokens(params: ITransactionParams){
    const { senderAddress, receiptAddress, amount, privateKey, fee, memo } = params
    try {
      const sendMsg = {
          typeUrl: "/cosmos.bank.v1beta1.MsgSend",
          value: {
            fromAddress: senderAddress,
            toAddress: receiptAddress,
            amount: [...amount],
          },
      }
      console.log("🚀 ~ sendMsg:", sendMsg)
  
      return this.signAndBroadcast({senderAddress, privateKey, msgs: [sendMsg], fee, memo })
    } catch (error) {
      console.log("🚀 ~ Cosmos ~ sendTokens ~ error:", error)
    }
  }

  async signAndBroadcast(params: ISignParams){
    const { senderAddress, privateKey, memo, fee, msgs } = params
    const txRaw = await this.sign({privateKey, senderAddress, msgs, fee, memo}) as TxRaw;
    const txBytes = TxRaw.encode(txRaw).finish();

    return this.broadcastTransaction(toBase64(txBytes))
  }

  async sign(params: ISignParams){
    const { senderAddress } = params

    const rest = this.chainInfo.rest
    const { account_number, sequence } = await getAccount({rest, address: senderAddress})

    const  signerData = {
      account_number: account_number,
      sequence: sequence,
      chainId: this.chainInfo.chainId,
    };

    return this.signDirect({...params, signData: signerData})
  }

  async signDirectDapp(privateKey: string, signDoc: SignDoc){
    const signBytes = makeSignBytes(signDoc);

    const uncompressed =  (await makeKeypair(Buffer.from(privateKey, 'hex'))).pubkey
    const publickey = compressPubkey(uncompressed)
  
    const hashedMessage = sha256(signBytes);
    const signature = await createSignature(hashedMessage, Buffer.from(privateKey, 'hex'));
    const signatureBytes = new Uint8Array([...signature.r(32), ...signature.s(32)]);
    const stdSignature = encodeSecp256k1Signature(publickey, signatureBytes);

    return {
      signed: signDoc,
      signature: stdSignature,
    };
  }

  async signDirect(params: ISignDirectParams){
    console.log("🚀 ~ Cosmos ~ signDirect ~ params:", params)
    const { signData, privateKey, msgs, memo, fee } = params
    const { account_number, sequence, chainId } = signData

    const uncompressed =  (await makeKeypair(Buffer.from(privateKey, 'hex'))).pubkey
    console.log("🚀 ~ Cosmos ~ signDirect ~ uncompressed:", uncompressed)
    const publickey = compressPubkey(uncompressed)
    console.log("🚀 ~ Cosmos ~ signDirect ~ publickey:", publickey)
    const pubkey = encodePubkey(encodeSecp256k1Pubkey(publickey));
    console.log("🚀 ~ Cosmos ~ signDirect ~ pubkey:", pubkey)

    const txBodyEncodeObject = {
      typeUrl: "/cosmos.tx.v1beta1.TxBody",
      value: {
        messages: msgs,
        memo: memo,
      },
    };
    console.log("🚀 ~ Cosmos ~ signDirect ~ txBodyEncodeObject:", txBodyEncodeObject)

    const txBodyBytes = encode(txBodyEncodeObject);
    console.log("🚀 ~ Cosmos ~ signDirect ~ txBodyBytes:", txBodyBytes)
    const gasLimit = Int53.fromString(fee.gas).toNumber();
    console.log("🚀 ~ Cosmos ~ signDirect ~ gasLimit:", gasLimit)

    const authInfoBytes = makeAuthInfoBytes(
      [{ pubkey, sequence }],
      fee.amount,
      gasLimit,
      fee.granter,
      fee.payer,
    );
    console.log("🚀 ~ Cosmos ~ signDirect ~ authInfoBytes:", authInfoBytes)

    const signDoc = makeSignDoc(txBodyBytes, authInfoBytes, chainId, account_number);
    console.log("🚀 ~ Cosmos ~ signDirect ~ signDoc:", signDoc)

    const signBytes = makeSignBytes(signDoc);
    console.log("🚀 ~ Cosmos ~ signDirect ~ signBytes:", signBytes)
    const hashedMessage = sha256(signBytes);
    console.log("🚀 ~ Cosmos ~ signDirect ~ hashedMessage:", hashedMessage)
    const signature = await createSignature(hashedMessage, Buffer.from(privateKey, 'hex'));
    console.log("🚀 ~ Cosmos ~ signDirect ~ signature:", signature)
    //@ts-expect-error
    console.log("🚀 ~ Cosmos ~ signDirect ~ signature.data:", signature.data)
    //@ts-expect-error
    console.log("🚀 ~ Cosmos ~ signDirect ~ signature.r(32):", signature.data.r(32))
    //@ts-expect-error
    console.log("🚀 ~ Cosmos ~ signDirect ~ signature.s(32):", signature.data.s(32))
    //@ts-expect-error
    const signatureBytes = new Uint8Array([...signature.data.r(32), ...signature.data.s(32)]);
    console.log("🚀 ~ Cosmos ~ signDirect ~ signatureBytes:", signatureBytes)
    const stdSignature = encodeSecp256k1Signature(publickey, signatureBytes);
    console.log("🚀 ~ Cosmos ~ signDirect ~ stdSignature:", stdSignature)

    const txRaw = TxRaw.fromPartial({
      bodyBytes: signDoc.bodyBytes,
      authInfoBytes: signDoc.authInfoBytes,
      signatures: [fromBase64(stdSignature.signature)],
    });
    console.log("🚀 ~ Cosmos ~ signDirect ~ txRaw:", txRaw)

    return txRaw
  }

  async signAmino(privateKey: string, signDoc: StdSignDoc){
    const uncompressed =  (await makeKeypair(Buffer.from(privateKey, 'hex'))).pubkey
    const publickey = compressPubkey(uncompressed)

    const message = new Sha256(serializeSignDoc(signDoc)).digest();
    const signature = await createSignature(message, Buffer.from(privateKey, 'hex'));
    const signatureBytes = new Uint8Array([...signature.r(32), ...signature.s(32)]);

    return {
      signed: signDoc,
      signature: encodeSecp256k1Signature(publickey, signatureBytes),
    };
  }

  async broadcastTransaction(txBytes: string){
    const broadcastTx = await fetch(`${this.chainInfo.rest}`,{
      method: 'POST',
      body: JSON.stringify({
          "jsonrpc": "2.0",
          "id": new Date().getTime(),
          "method": "broadcast_tx_sync",
          "params": {
             "tx": txBytes
          }
      })
    })

    const { result } = await broadcastTx.json()

    return result?.hash || ''
  }

  async execute (params: IExecuteTransactiom ): Promise<ExecuteResult>{
    const { contractAddress, msg, funds, privateKey, senderAddress, fee, memo } = params
    const instruction: ExecuteInstruction = {
      contractAddress: contractAddress,
      msg: msg,
      funds: funds,
    };
    return this.executeMultiple( {privateKey, senderAddress, instructions: [instruction], fee, memo});
  }

  async executeMultiple ( params: IExecuteMultipleTransaction): Promise<ExecuteResult>{
    const { instructions, senderAddress , privateKey, fee, memo } = params

    const msgs: any[] = instructions.map((i) => ({
      typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
      value: MsgExecuteContract.fromPartial({
        sender: senderAddress,
        contract: i.contractAddress,
        msg: toUtf8(JSON.stringify(i.msg)),
        funds: [...(i.funds || [])],
      }), 
    }));

    const result = await this.signAndBroadcast({privateKey, senderAddress, msgs, fee, memo});

    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxResponseErrorMessage(result));
    }

    return {
      logs: parseRawLog(result.rawLog),
      height: result.height,
      transactionHash: result.transactionHash,
      events: result.events,
      gasWanted: result.gasWanted,
      gasUsed: result.gasUsed,
    };
  }

  async queryContractSmart (params: TokenCW20Params){
    const { address, query} = params

    try {
      const request = { address: address, queryData: toAscii(JSON.stringify(query)) };    
      const  data  = QuerySmartContractStateRequest.encode(request).finish()
      const dataHex = Buffer.from(data).toString('hex')
  
      const fetching = await fetch(this.chainInfo.rpc, {
        method: 'POST',
        body: JSON.stringify({
          "jsonrpc": "2.0",
          "id": new Date().getTime(),
          "method": "abci_query",
          "params": {
              "path": "/cosmwasm.wasm.v1.Query/SmartContractState",
              "data": dataHex,
              "prove": false
          }
        })
      })
  
      const {result} = await fetching.json()

      const value = get(result, 'response.value')
      const valueRaw = fromBase64(value)

      const {data: resultDecode} = QuerySmartContractStateResponse.decode(new BinaryReader(valueRaw))

      let responseText: string;
      try {
        responseText = fromUtf8(resultDecode);
      } catch (error) {
        throw new Error(`Could not UTF-8 decode smart query response from contract: ${error}`);
      }
      try {
        return JSON.parse(responseText);
      } catch (error) {
        throw new Error(`Could not JSON parse smart query response from contract: ${error}`);
      }
      
    } catch (error) {
      console.log("🚀 ~ Cosmos ~ getTokenInfoCw20 ~ error:", error)
      throw new Error('Contract not found')
    }


  }
}

