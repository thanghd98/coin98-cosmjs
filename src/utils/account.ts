import get from 'lodash/get'
import { CHAIN_TYPE } from '@wallet/constants'
import { IAccountParams, IAccountResponse } from '../types';

export const getAccount = async ({address, rest, chain}: IAccountParams): Promise<IAccountResponse> => {
    const accountRequest = await fetch(`${rest}/cosmos/auth/v1beta1/accounts/${address}`)

    const { account } = await accountRequest.json()
    if(!account){
        throw new Error(
            `Account '${address}' does not exist on chain. Send some tokens there before.`,
          );
    }

    if(chain === CHAIN_TYPE.injective){
        return {
            sequence: Number(get(account, 'base_account.sequence')),
            account_number: Number(get(account, 'base_account.account_number')),
            pub_key: get(account, 'base_account.pub_key.key')
        }
    }

    return {
        sequence: Number(get(account, 'sequence')),
        account_number: Number(get(account, 'account_number')),
        pub_key: get(account, 'pub_key.key')
    }
}