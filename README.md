# Solana Transaction Sender with Fordefi Integration

A tool for creating and broadcasting Solana transactions with Jito's Block Engine integration and the Fordefi API.

## Prerequisites

- Fordefi API user token and API Signer set up ([link to tutorial](https://docs.fordefi.com/reference/getting-started))
- Solana Vault in Foredefi
- RPC token (Quicknode, Helius, etc.)
- Python 3.x installed.

## Setup

1. Create a Fordefi API user and API Signer ([tutorial](https://docs.fordefi.com/reference/getting-started))
2. Clone this repository
3. Run `npm install` to install all the dependencies.
4. Create a `.env` file in the root directory with the following variables:
   ```typescript
   FORDEFI_API_TOKEN=your_api_token
   RPC_PROVIDER_KEY=your_rpc_access_token // only if you're not using a public RPC provider
   ```
5. Create a `/secret` folder at the root of this project and place your API User's `.pem` private key file in the folder.
6. Create an empty `txs` directory at the root of this project.
7. In `create_sign_push.ts`, configure the following
```typescript
const fordefiConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN,
  vaultId: "<your_Fordefi_Solana_Vault_Id>",
  fordefiSolanaVaultAddress:"your_Fordefi_Solana_Vault_address",
  privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions/create-and-wait'
};
``` 

## Example usage for a swap on Meteora

1. Navigate to the `./meteora` folder, select a script and add your variables to the `TO CONFIGURE` section
2. In the `create_sign_push.ts` file, make sure the `main()` function calls `createMeteoraSwapTx()` as in:
```typescript
const jsonBody = await createMeteoraSwapTx(fordefiConfig.vaultId, fordefiConfig.fordefiSolanaVaultAddress)
```
3. Run `npm run tx` to create and sign the transaction with your Fordefi Vault then send the transaction to Jito's Block Engine.

## Example usage for a swap on Jupiter

1. Navigate to the `./jupiter` folder, select a script and add your variables to the `TO CONFIGURE` section
2. In the `create_sign_push.ts` file, make sure the `main()` function calls `createJupiterSwapTx()` as in:
```typescript
const jsonBody = await createJupiterSwapTx(fordefiConfig.vaultId, fordefiConfig.fordefiSolanaVaultAddress)
```
3. Run `npm run tx` to create and sign the transaction with your Fordefi Vault then send the transaction to Jito's Block Engine.
