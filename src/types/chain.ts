interface Currency {
    coinDenom: string
    coinMinimalDenom: string
    coinDecimals: number
    image?: string
    coinGeckoId?: string
    gasPriceStep?: Record<string, number | string>
}

interface IBIP44 {
    coinType: string | number
}

interface IBech32 {
    bech32PrefixAccAddr: string
    bech32PrefixAccPub: string
    bech32PrefixValAddr: string
    bech32PrefixValPub: string
    bech32PrefixConsAddr: string
    bech32PrefixConsPub: string
}

export interface CosmosChainInfo {
    rpc: string
    rpcConfig?: any
    rest: string
    restConfig?: any
    chainId: string
    chainName: string

    

    // More Chain Info
    stakeCurrency: Currency
    walletetUrlForStaking?: string
    bip44: IBIP44
    bech32Config: IBech32
    currencies: Currency[]
    
    
    //Optional
    isEthereum?: boolean //Support EIP712 transfer throught Ethermint
    beta?: boolean
    walletUrl?:  string
    walletUrlForStaking?: string
    faucets?: string | string[]
    feeCurrencies: Currency[]
    coinType?: string | number
    alternativeBIP44s?: IBIP44[]
    features?: string[]
    gasPriceStep?: {
        low: string | number
        average: string | number
        high: string | number
    },
    defaultFee?: number


    chainSymbolImageUrl?: string
    // Coin98 Exclusive Fields
    disable?: boolean
}