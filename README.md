# Solana Transaction Sender with Fordefi Integration

A tool for creating and broadcasting Solana transactions with Jito's Block Engine integration and the Fordefi API.

## Prerequisites

- Fordefi API user token and API Signer set up ([link to tutorial](https://docs.fordefi.com/developers/program-overview))
- Solana Vault in Foredefi
- OPTIONAL: RPC token (Quicknode, Helius, etc.) if you do not want to use Solana's public RPC endpoint

## Setup

1. Create a Fordefi API user and API Signer ([tutorial](https://docs.fordefi.com/developers/program-overview))
2. Register your API User's key with your API Signer ([tutorial](https://docs.fordefi.com/developers/getting-started/pair-an-api-client-with-the-api-signer))
3. Clone this repository.
4. Run `npm install` to install all the dependencies.
5. Create a `.env` file in the root directory with the following variable:
   ```typescript
   FORDEFI_API_TOKEN="<your_api_token>" // Your Fordefi API User JWT
   VAULT_ID="<you_Fordefi_Solana_Vault_ID>"
   VAULT_ADDRESS="<you_Fordefi_Solana_Vault_address>"
   ```
6. Create a `/secret` folder at the root of the `fordefi-jito` project and place your API User's `private.pem` private key file in the folder.
7. Create an empty `txs` at the root of the `fordefi-jito` project.

## Example usage for a swap on Meteora

1. Ensure your API Signer is running.
2. In `meteora_swap.ts`, configure the `swapConfig`:
```typescript
const swapConfig = {
  jitoTip: 1000, // Jito tip amount in lamports (1 SOL = 1e9 lamports)
  swapAmount: new BN(100), // in lamports
  pool: new PublicKey('<pool_address>')
}
```
3. Run `npm run meteora_swap`. The script will create and sign a swap transaction with your Fordefi Vault and send the transaction to Jito's Block Engine.

## Example usage for a swap on Jupiter

1. Ensure your API Signer is running. 
2. In `jupiter_swap.ts`, configure the `swapConfig`:
```typescript
const swapConfig = {
  jitoTip: 1000, // Jito tip amount in lamports (1 SOL = 1e9 lamports)
  swapAmount: '1000000', // in lamports
  slippage: '50', // in bps
  inputToken: '<address_of_input_token>', 
  outputToken: '<address_of_output_token>'
}
```
3. Run `npm run jupiter_swap`. The script will create and sign a swap transaction with your Fordefi Vault and send the transaction to Jito's Block Engine.
