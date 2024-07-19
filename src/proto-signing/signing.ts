import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';
import { AuthInfo, SignDoc, SignerInfo } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { Any } from 'cosmjs-types/google/protobuf/any';

export function makeAuthInfoBytes(
    signers: ReadonlyArray<{ readonly pubkey: Any; readonly sequence: bigint | number }>,
    feeAmount: readonly Coin[],
    gasLimit: number,
    feeGranter: string | undefined,
    feePayer: string | undefined,
    signMode = SignMode.SIGN_MODE_DIRECT,
): Uint8Array {
    const authInfo = AuthInfo.fromPartial({
      signerInfos: makeSignerInfos(signers, signMode),
      fee: {
        amount: [...feeAmount],
        gasLimit: BigInt(gasLimit),
        granter: feeGranter,
        payer: feePayer,
      },
    });
    return AuthInfo.encode(authInfo).finish();
}


function makeSignerInfos(
    signers: ReadonlyArray<{ readonly pubkey: Any; readonly sequence: number | bigint }>,
    signMode: SignMode,
  ): SignerInfo[] {
    return signers.map(
      ({ pubkey, sequence }): SignerInfo => ({
        publicKey: pubkey,
        modeInfo: {
          single: { mode: signMode },
        },
        sequence: BigInt(sequence),
      }),
    );
}

export function makeSignDoc(
    bodyBytes: Uint8Array,
    authInfoBytes: Uint8Array,
    chainId: string,
    accountNumber: number,
  ): SignDoc {
    return {
      bodyBytes: bodyBytes,
      authInfoBytes: authInfoBytes,
      chainId: chainId,
      accountNumber: BigInt(accountNumber),
    };
}
  
export function makeSignBytes({ accountNumber, authInfoBytes, bodyBytes, chainId }: SignDoc): Uint8Array {
    const signDoc = SignDoc.fromPartial({
      accountNumber: accountNumber,
      authInfoBytes: authInfoBytes,
      bodyBytes: bodyBytes,
      chainId: chainId,
    });
    return SignDoc.encode(signDoc).finish();
}
  
  