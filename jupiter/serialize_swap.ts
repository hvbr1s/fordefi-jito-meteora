import fs from 'fs'
import axios from 'axios';
import * as web3 from '@solana/web3.js'
import * as jito from 'jito-ts'
import bs58 from 'bs58';
import dotenv from 'dotenv'
import { PublicKey } from '@solana/web3.js';
import { getJitoTipAccount } from '../utils/get_jito_tip_account'
import { getPriorityFees } from '../utils/get_priority_fees'

////// TO CONFIGURE //////
dotenv.config()
const QUICKNODE_KEY = process.env.QUICKNODE_MAINNET_KEY
const connection = new web3.Connection(`${QUICKNODE_KEY}`)
const VAULT_ID = process.env.VAULT_ID
const FORDEFI_SOLANA_ADDRESS_PUBKEY = new web3.PublicKey("CtvSEG7ph7SQumMtbnSKtDTLoUQoy8bxPUcjwvmNgGim")
const JITO_TIP = 1000 // Jito tip amount in lamports (1 SOL = 1e9 lamports)
const SWAP_AMOUNT = '10000000' // in lamports
const SLIPPAGE =  '50' //in bps
const INPUT_TOKEN = 'So11111111111111111111111111111111111111112' // SOL
const OUTPUT_TOKEN = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC Mint'
////// TO CONFIGURE //////


// Get quote from Jupiter
async function getSwapQuote(swap_amount: string, slippage: string, input_token: string, output_token: string): Promise<any> {

    const quoteResponse = await axios.get('https://quote-api.jup.ag/v6/quote', {
        params: {
            inputMint:input_token,
            outputMint: output_token,
            amount: swap_amount,
            slippageBps: slippage
        }
    });
    
    return quoteResponse.data;
}

async function getSwapTxIx(quote: any, user: PublicKey) {
    const response = await axios.post('https://quote-api.jup.ag/v6/swap-instructions', {
        quoteResponse: quote,
        userPublicKey: user.toBase58(),
    }, {
        headers: {
            'Content-Type': 'application/json'
        }
    });

    console.log(response.data)
    
    // The API returns { computeBudgetInstructions, setupInstructions, swapInstruction, cleanupInstruction }
    const { computeBudgetInstructions, setupInstructions, swapInstruction, cleanupInstruction } = response.data;
    
    // Combine all instructions in the correct order
    return [
        ...(computeBudgetInstructions ?? []),
        ...(setupInstructions ?? []),
        swapInstruction,
        ...(cleanupInstruction ? [cleanupInstruction] : [])
    ].map((ix) => {
        return {
            programId: new PublicKey(ix.programId),
            keys: ix.accounts.map((key: any) => ({
                pubkey: new PublicKey(key.pubkey),
                isSigner: key.isSigner,
                isWritable: key.isWritable
            })),
            data: Buffer.from(ix.data, 'base64')
        };
    });
}

async function main(){

    const quote = await getSwapQuote(SWAP_AMOUNT, SLIPPAGE, INPUT_TOKEN, OUTPUT_TOKEN)

    const serializedJupiterSwapTxIx =  await getSwapTxIx(quote, FORDEFI_SOLANA_ADDRESS_PUBKEY)

    // Create Jito client instance
    const client = jito.searcher.searcherClient("frankfurt.mainnet.block-engine.jito.wtf") // can customize the client enpoint based on location

    // Get Jito Tip Account
    const jitoTipAccount = await getJitoTipAccount(client)
    console.log(`Tip amount -> ${JITO_TIP}`)

    // Create Tx
    const swapTx = new web3.Transaction()

    // Add instructions
    swapTx
    .add(
        web3.SystemProgram.transfer({
            fromPubkey: FORDEFI_SOLANA_ADDRESS_PUBKEY,
            toPubkey: jitoTipAccount,
            lamports: JITO_TIP, 
        })
    )
    .add(
        ...serializedJupiterSwapTxIx
    )

    // Set blockhash + fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    swapTx.recentBlockhash = blockhash;
    swapTx.feePayer = FORDEFI_SOLANA_ADDRESS_PUBKEY;

    // INSPECT TX - FOR DEBUGGING ONLY

    // console.log("Tx instructions:");
    // swapTx.instructions.forEach((ix, idx) => {
    // console.log(`Instruction #${idx}:`);
    // console.log("  ProgramID:", ix.programId.toBase58());
    // console.log("  Keys:", ix.keys.map(k => k.pubkey.toBase58()));
    // console.log("  Data:", ix.data.toString("hex"));
    // });

    // Compile + serialize the swap tx
    const compiledSwapTx = swapTx.compileMessage();
    const serializedV0Message = Buffer.from(
        compiledSwapTx.serialize()
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
        "wait_for_state": "signed" // only for create-and-wait
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