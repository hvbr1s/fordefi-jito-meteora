import fs from 'fs'
import { BN } from 'bn.js'
import DLMM from '@meteora-ag/dlmm'
import * as web3 from '@solana/web3.js'
import * as jito from 'jito-ts'
import { getJitoTipAccount } from '../utils/get_jito_tip_account'
import { getPriorityFees } from '../utils/get_priority_fees'
import { getCuLimit } from '../utils/get_cu_limit'
import dotenv from 'dotenv'


dotenv.config()
const QUICKNODE_KEY = process.env.QUICKNODE_MAINNET_KEY
const VAULT_ID = process.env.VAULT_ID
const FORDEFI_SOLANA_ADDRESS = process.env.FORDEFI_SOLANA_ADDRESS
const connection = new web3.Connection(`https://winter-solemn-sun.solana-mainnet.quiknode.pro/${QUICKNODE_KEY}/`)
const SOL_USDC_POOL = new web3.PublicKey('BVRbyLjjfSBcoyiYFuxbgKYnWuiFaF9CSXEa5vdSZ9Hh') // info can be fetched from block explorer'
const TRADER = new web3.PublicKey(`${FORDEFI_SOLANA_ADDRESS}`)

async function createDlmm(){

    const dlmmPool = DLMM.create(connection, SOL_USDC_POOL); // your pool
    return dlmmPool

}

async function userPosition() {

    const dlmmPool = await createDlmm()
    // const activeBin = await dlmmPool.getActiveBin();

    const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(TRADER);
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
        bps: new BN(10000), // we remove 1000 bps (100%) of the positions
        shouldClaimAndClose: true, // and we also close the account and rewards
    });

    return removeLiquidityTx
}

async function main(){

    const myPositions = await userPosition()
    console.log(myPositions)

    const onePosition = myPositions.find(({ publicKey }) =>
        publicKey.equals(new web3.PublicKey('4s7jqEGTGSBAJQVELMafgzUmaGgB2XjMQENm9A58Tad8')) // adjust depending on output of myPositions
      );

    const removeLiquidityTx = await removeLiquidity(onePosition, TRADER)
    
    // Create Jito client instance
    const client = jito.searcher.searcherClient("frankfurt.mainnet.block-engine.jito.wtf") // can customize

    // Get Jito Tip Account
    const jitoTipAccount = await getJitoTipAccount(client)
    console.log(`Tip account -> ${jitoTipAccount}`)

   const jitoTip = 1000 // Jito tip amount in lamports (1 SOL = 1e9 lamports)
   const priorityFee = await getPriorityFees() // OR set a custom number
   console.log(`Priority fee -> ${priorityFee}`)
   // const cuLimit = await getCuLimit(tippingTx, connection) // OPTIONAL -> the Meteora SDK is doing it for us`

   const tippingTx = new web3.Transaction()
   .add(
       web3.SystemProgram.transfer({
           fromPubkey: TRADER,
           toPubkey: jitoTipAccount,
           lamports: jitoTip, 
       })
   )
   // OPTIONAL -> Setting CU limits and priority fee to instructions
   .add(
       web3.ComputeBudgetProgram.setComputeUnitPrice({
           microLamports: priorityFee, 
       })
   )
   // .add(
   //     web3.ComputeBudgetProgram.setComputeUnitLimit({
   //         units: targetComputeUnitsAmount ?? 100_000 //
   //     })
   // )

    // Set blockhash + fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    tippingTx.recentBlockhash = blockhash;
    tippingTx.feePayer = TRADER;

    // Is Array check
    const removeLiquidityTxs = Array.isArray(removeLiquidityTx) 
        ? removeLiquidityTx 
        : [removeLiquidityTx];

    // Add removeLiquidityTx instructions to Jito tippingTx instructions
    for (const tx of removeLiquidityTxs) {
        tippingTx.add(...tx.instructions);
    }

    // Compile + serialize the merged transactions
    const mergedMessage = tippingTx.compileMessage();
    const serializedV0Message = Buffer.from(
        mergedMessage.serialize()
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