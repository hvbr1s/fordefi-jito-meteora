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
3. Create a `.env` file in the root directory with the following variables:
   ```
   FORDEFI_API_TOKEN=your_api_token
   VAULT_ID=your_solana_vault_id
   FORDEFI_SOLANA_ADDRESS=your_solana_vault_address
   QUICKNODE_MAINNET_KEY=your_rpc_access_token
   ```
4. Place your API Signer's `.pem` private key file in the `/secret` directory in the root folder.

## Configuration

Open `craft_request.py` and configure the following parameters:
- `jito_tip_amount`: Amount to tip Jito validators
- `priority_fee`: Transaction priority fee

## Usage

Execute the following scripts in order:

1. `python craft_request.py` - Prepares the serialized tx payload
2. `python create_tx.py` - Creates the transaction
3. `python sign_tx.py` - Signs the transaction using Fordefi
4. `python broadcast_to_jito.py` - Broadcasts the signed transaction to Jito's block engine.