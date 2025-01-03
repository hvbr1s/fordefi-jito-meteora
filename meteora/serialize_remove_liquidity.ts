import fs from 'fs'
import { BN } from 'bn.js'
import DLMM from '@meteora-ag/dlmm'
import * as web3 from '@solana/web3.js'
import * as jito from 'jito-ts'
import { getJitoTipAccount } from '../utils/get_jito_tip_account'
import { getPriorityFees } from '../utils/get_priority_fees'
import { getCuLimit } from '../utils/get_cu_limit'
import dotenv from 'dotenv'

//// TO CONFIGURE 
dotenv.config()
const QUICKNODE_KEY = process.env.QUICKNODE_MAINNET_KEY
const VAULT_ID = process.env.VAULT_ID
const FORDEFI_SOLANA_ADDRESS = process.env.FORDEFI_SOLANA_ADDRESS
const connection = new web3.Connection(`https://winter-solemn-sun.solana-mainnet.quiknode.pro/${QUICKNODE_KEY}/`)
const SOL_USDC_POOL = new web3.PublicKey('BVRbyLjjfSBcoyiYFuxbgKYnWuiFaF9CSXEa5vdSZ9Hh') // info can be fetched from block explorer'
const TRADER = new web3.PublicKey(`${FORDEFI_SOLANA_ADDRESS}`)
const JITO_TIP = 1000 // Jito tip amount in lamports (1 SOL = 1e9 lamports)
//// TO CONFIGURE 

async function createDlmm(){

    const dlmmPool = DLMM.create(connection, SOL_USDC_POOL); // your pool
    return dlmmPool

}

async function userPosition() {

    const dlmmPool = await createDlmm()
    const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(TRADER);
    // const activeBin = await dlmmPool.getActiveBin();
    // const binData = userPositions[0].positionData.positionBinData;
    
    return userPositions
}

async function removeLiquidity(onePosition: any, TRADER: web3.PublicKey){
    const dllmPool = await createDlmm()

    const binIdsToRemove = onePosition.positionData.positionBinData.map(
        (bin:any) => bin.binId
    );

    const removeLiquidityTx = await dllmPool.removeLiquidity({
        position: onePosition.publicKey,
        user: TRADER,
        binIds: binIdsToRemove,
        bps: new BN(10000), // we remove 10000 bps (100%) of the positions
        shouldClaimAndClose: true, // and we also close the account and collect unclaimed rewards
    });

    return removeLiquidityTx
}

async function main(){

    const myPositions = await userPosition()
    console.log(myPositions)

    const onePosition = myPositions.find(({ publicKey }) =>
        publicKey.equals(new web3.PublicKey('4s7jqEGTGSBAJQVELMafgzUmaGgB2XjMQENm9A58Tad8')) // adjust depending on output of myPositions
      );

    // Create Jito client instance
    const client = jito.searcher.searcherClient("frankfurt.mainnet.block-engine.jito.wtf") // can customize

    // Get Jito Tip Account
    const jitoTipAccount = await getJitoTipAccount(client)
    console.log(`Tip account -> ${jitoTipAccount}`)

   const priorityFee = await getPriorityFees() // OR set a custom number
   console.log(`Priority fee -> ${priorityFee}`)

   const removeLiquidityTx = new web3.Transaction()

   removeLiquidityTx
   .add(
       web3.SystemProgram.transfer({
           fromPubkey: TRADER,
           toPubkey: jitoTipAccount,
           lamports: JITO_TIP, 
       })
   )
   .add(
        web3.ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: priorityFee, 
        })
    )   
    
    // OPTIONAL -> set CU limits the Meteora SDK is doing it for us`
    // const cuLimit = await getCuLimit(removeLiquidityTx, connection) 
    // removeLiquidityTx
    // .add(
    //     web3.ComputeBudgetProgram.setComputeUnitLimit({
    //         units: targetComputeUnitsAmount ?? 100_000 //
    //     })
    // )

    // Get remove liquidity instructions from Meteora
    const removeLiquidityTxThrowaway = await removeLiquidity(onePosition, TRADER)
    
    // Is Array check
    const removeLiquidityTxArray = Array.isArray(removeLiquidityTxThrowaway) 
        ? removeLiquidityTxThrowaway 
        : [removeLiquidityTxThrowaway];

    // Extract Meteora-specific instructions from first transaction and add to our second transaction
    for (const tx of removeLiquidityTxArray) {
        removeLiquidityTx.add(...tx.instructions);
    }

    // Set blockhash + fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    removeLiquidityTx.recentBlockhash = blockhash;
    removeLiquidityTx.feePayer = TRADER;

    // Compile + serialize the merged transactions
    const comiledMessage = removeLiquidityTx.compileMessage();
    const serializedV0Message = Buffer.from(
        comiledMessage.serialize()
    ).toString('base64');

    // Create JSON
    const jsonBody = {
        "vault_id": VAULT_ID, // Replace with your vault ID
        "signer_type": "api_signer",
        "sign_mode": "auto", // IMPORTANT
        "type": "solana_transaction",
        "details": {
            "type": "solana_serialized_transaction_message",
            "push_mode": "manual", // IMPORTANT,
            "data": serializedV0Message,  // For legacy transactions, use `serializedLegacyMessage`
            "chain": "solana_mainnet"
        },
        "wait_for_state": "signed"
    };

    // Write json body to file
    fs.writeFileSync(
        './txs/serialized_tx.json',
        JSON.stringify(jsonBody, null, 2), 
        'utf8'
    );
    console.log("Tx data written to .txs/serialized_tx.json");
}

main().catch(console.error);