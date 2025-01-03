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
   ```
   FORDEFI_API_TOKEN=your_api_token
   VAULT_ID=your_solana_vault_id
   FORDEFI_SOLANA_ADDRESS=your_solana_vault_address
   QUICKNODE_MAINNET_KEY=your_rpc_access_token
   ```
5. Place your API Signer's `.pem` private key file in the `/secret` directory in the root folder.

## Configuration for Meteora operations:

Navigate to the `./meteora` folder, select a script and add your variables to the `TO CONFIGURE` section

## Example usage for a swap on Meteora

Execute the following scripts in order:

1. `npm run swap-meteora` - Prepares the serialized tx payload
2. `npm run create-tx` - Creates and signs the transaction
3. `npm run jito` - Broadcast the transaction to Jito and returns the transaction hash