import fs from 'fs'
import axios from 'axios';
import * as web3 from '@solana/web3.js'
import * as jito from 'jito-ts'
import dotenv from 'dotenv'
import { PublicKey } from '@solana/web3.js';
import { getJitoTipAccount } from '../utils/get_jito_tip_account'


dotenv.config()

const QUICKNODE_KEY = process.env.QUICKNODE_MAINNET_KEY;
const connection = new web3.Connection(`${QUICKNODE_KEY}`);
const VAULT_ID = process.env.VAULT_ID;
const FORDEFI_SOLANA_ADDRESS_PUBKEY = new web3.PublicKey("CtvSEG7ph7SQumMtbnSKtDTLoUQoy8bxPUcjwvmNgGim");
const JITO_TIP = 1000; // lamports
const SLIPPAGE = '500'; // in bps
// Mints 
const SOL = 'So11111111111111111111111111111111111111112'
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; 
const TRUMP_MINT = "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN";
// Ratio: 50% TRUMP, 50% USDC
const TARGET_TRUMP_PCT = 0.50;
const TARGET_USDC_PCT  = 0.50;
const THRESHOLD = 0.05;  // 5% off, we only rebalance if we're off by 5%


async function getTokenBalance(
  ownerPubkey: PublicKey,
  mintAddress: string
): Promise<number> {
  const tokenAccounts = await connection.getTokenAccountsByOwner(
    ownerPubkey,
    { mint: new PublicKey(mintAddress) }
  );

  // If no associated token account found, balance is 0
  if (tokenAccounts.value.length === 0) {
    return 0;
  }

  // Typically there's only one associated token account
  const accountInfo = await connection.getParsedAccountInfo(
    tokenAccounts.value[0].pubkey
  );

  if (accountInfo.value === null) {
    return 0;
  }

  // In parsed data, the token balance is in `uiAmountString`
  const parsed = (accountInfo.value.data as web3.ParsedAccountData).parsed;
  const balanceStr = parsed.info.tokenAmount.uiAmountString;
  return parseFloat(balanceStr);
}


async function getTRUMPPriceInUSDC(): Promise<number> {
    const priceResponse = await axios.get("https://api.jup.ag/price/v2", {
        params: {
          ids: TRUMP_MINT,
          showExtraInfo: false
        }
      });
      console.log(priceResponse)
    
      const priceData = priceResponse.data.data;
      if (!priceData?.[TRUMP_MINT]?.price) {
        throw new Error("No Jupiter price data for TRUMP");
      }
  
      const trumpPrice = priceData[TRUMP_MINT].price;
      console.log(`TRUMP price -> ${trumpPrice}`)
    
      return trumpPrice
  }

// -------------------------------------
// 4) Jupiter helpers for constructing swap instructions
// -------------------------------------
async function getSwapQuote(
  swapAmount: string, 
  slippage: string, 
  inputToken: string, 
  outputToken: string
): Promise<any> {
  const quoteResponse = await axios.get('https://quote-api.jup.ag/v6/quote', {
    params: {
      inputMint: inputToken,
      outputMint: outputToken,
      amount: swapAmount,
      slippageBps: slippage,
      maxAccounts: 32,
      restrictIntermediateTokens: false,
      onlyDirectRoutes: false
    }
  });

  return quoteResponse.data;
}

async function getSwapTxIx(
  quote: any, 
  user: PublicKey
): Promise<[web3.TransactionInstruction[], string]> {

  const response = await axios.post(
    'https://quote-api.jup.ag/v6/swap-instructions',
    {
      quoteResponse: quote,
      userPublicKey: user.toBase58(),
      minimizeSteps: true
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  const {
    computeBudgetInstructions, 
    setupInstructions, 
    swapInstruction, 
    cleanupInstruction
  } = response.data;
  const lookUpTable = response.data.addressLookupTableAddresses[0];

  const instructions: web3.TransactionInstruction[] = [
    ...(computeBudgetInstructions ?? []),
    ...(setupInstructions ?? []),
    swapInstruction,
    ...(cleanupInstruction ? [cleanupInstruction] : []),
  ].map((ix: any) => ({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map((key: any) => ({
      pubkey: new PublicKey(key.pubkey),
      isSigner: key.isSigner,
      isWritable: key.isWritable
    })),
    data: Buffer.from(ix.data, 'base64')
  }));

  return [instructions, lookUpTable];
}

// -------------------------------------
// 5) Main rebalance logic
// -------------------------------------
async function main() {
  // -------------------------------------
  // (A) Fetch current balances
  // -------------------------------------
  const trumpBalance = await getTokenBalance(FORDEFI_SOLANA_ADDRESS_PUBKEY, TRUMP_MINT);
  const usdcBalance  = await getTokenBalance(FORDEFI_SOLANA_ADDRESS_PUBKEY, USDC_MINT);

  // -------------------------------------
  // (B) Get TRUMP price in USDC 
  // -------------------------------------
  const trumpPriceInUsdc = await getTRUMPPriceInUSDC();

  // Convert your TRUMP holdings to USDC value
  const trumpValueInUsdc = trumpBalance * trumpPriceInUsdc;

  // Your total “portfolio” in USDC terms
  const totalValueInUsdc = trumpValueInUsdc + usdcBalance;
  if (totalValueInUsdc === 0) {
    console.log("You have no TRUMP or USDC at all—nothing to rebalance.");
    return;
  }

  // Current ratio of TRUMP (in USDC terms)
  const currentTrumpRatio = trumpValueInUsdc / totalValueInUsdc;

  console.log(`Current TRUMP ratio: ${(currentTrumpRatio * 100).toFixed(2)}%`);
  console.log(`TRUMP balance: ${trumpBalance.toFixed(4)} (≈ ${trumpValueInUsdc.toFixed(2)} USDC)`);
  console.log(`USDC balance:  ${usdcBalance.toFixed(4)}`);

  // -------------------------------------
  // (C) Check if we are within threshold
  // -------------------------------------
  // If the difference from 70% is less than 2% (for example), skip
  const diff = Math.abs(currentTrumpRatio - TARGET_TRUMP_PCT);
  if (diff < THRESHOLD) {
    console.log("Already within target ratio; no rebalance needed.");
    return;
  }

  // -------------------------------------
  // (D) Figure out how much to swap 
  // -------------------------------------
  // We want final TRUMP to be: totalValueInUsdc * 0.70 / trumpPriceInUsdc
  const desiredTrumpTokens = (totalValueInUsdc * TARGET_TRUMP_PCT) / trumpPriceInUsdc;
  const tokenDelta = desiredTrumpTokens - trumpBalance;

  // If tokenDelta > 0, we need to buy TRUMP (swap from USDC -> TRUMP).
  // If tokenDelta < 0, we need to sell TRUMP (swap from TRUMP -> USDC).
  const absDelta = Math.abs(tokenDelta);

  if (absDelta < 0.000001) {
    console.log("Delta is negligible; skipping trade.");
    return;
  }

  // We'll convert that into raw integer "amount" for Jupiter quotes
  // *Important*: USDC has 6 decimals, TRUMP presumably has 6 decimals (check the mint!). 
  // We'll assume 6 decimals for TRUMP here.
  const deltaForJupiter = Math.floor(absDelta * 1_000_000);  // 6 decimals

  // -------------------------------------
  // (E) Prepare the Jupiter swap
  // -------------------------------------
  let inputMint, outputMint;
  let swapMsg = "";

  if (tokenDelta > 0) {
    // Need to buy TRUMP => swap USDC -> TRUMP
    inputMint = USDC_MINT;     // Changed from TRUMP_MINT
    outputMint = TRUMP_MINT;   // Changed from USDC_MINT
    swapMsg = `Swapping ~${absDelta.toFixed(4)} USDC -> TRUMP`;
  } else {
    // Need to sell TRUMP => swap TRUMP -> USDC
    inputMint = TRUMP_MINT;    // Changed from SOL
    outputMint = USDC_MINT;    // Changed from TRUMP_MINT
    swapMsg = `Swapping ~${absDelta.toFixed(4)} TRUMP -> USDC`;
  }

  console.log(swapMsg);

  // 1) Get Jupiter quote
  const quote = await getSwapQuote(
    deltaForJupiter.toString(),
    SLIPPAGE,
    inputMint,
    outputMint
  );

  // 2) Build Jupiter Swap Instructions
  const [jupiterSwapTxIx, lookupTableAddress] = await getSwapTxIx(
    quote,
    FORDEFI_SOLANA_ADDRESS_PUBKEY
  );

  // 3) Fetch the actual lookup table
  const lookupTableAccount = await connection
    .getAddressLookupTable(new web3.PublicKey(lookupTableAddress))
    .then((result) => result.value);

  if (!lookupTableAccount) {
    throw new Error("Lookup table not found");
  }

  // -------------------------------------
  // (F) Jito + finalize transaction
  // -------------------------------------
  const client = jito.searcher.searcherClient(
    "frankfurt.mainnet.block-engine.jito.wtf"
  );
  const jitoTipAccount = await getJitoTipAccount(client);
  console.log(`Tip amount -> ${JITO_TIP}`);

  // Insert Jito tip as first instruction
  const swapTxIx = [
    web3.SystemProgram.transfer({
      fromPubkey: FORDEFI_SOLANA_ADDRESS_PUBKEY,
      toPubkey: jitoTipAccount,
      lamports: JITO_TIP,
    }),
    ...jupiterSwapTxIx,
  ];

  // Latest blockhash
  const { blockhash } = await connection.getLatestBlockhash();

  // Build a Versioned Transaction 
  const messageV0 = new web3.VersionedTransaction(
    new web3.TransactionMessage({
      payerKey: FORDEFI_SOLANA_ADDRESS_PUBKEY,
      recentBlockhash: blockhash,
      instructions: swapTxIx
    }).compileToV0Message([lookupTableAccount])
  );

  // Serialize
  const serializedMessage = Buffer
    .from(messageV0.message.serialize())
    .toString('base64');

  // Create JSON body (for off-chain signer, etc.)
  const jsonBody = {
    vault_id: VAULT_ID,
    signer_type: "api_signer",
    sign_mode: "auto",
    type: "solana_transaction",
    details: {
      type: "solana_serialized_transaction_message",
      push_mode: "manual",
      data: serializedMessage,
      chain: "solana_mainnet"
    },
    wait_for_state: "signed"
  };

  fs.writeFileSync(
    './txs/serialized_rebalance_tx.json',
    JSON.stringify(jsonBody, null, 2),
    'utf8'
  );

  console.log("Rebalance transaction data written to ./txs/serialized_rebalance_tx.json");
}

main().catch(console.error);
