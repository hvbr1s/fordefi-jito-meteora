import fs from 'fs';
import axios from 'axios';
import { signWithApiSigner } from '../signing/signer'
import { get_tx } from '../utils/prepare_request'



async function main(): Promise<void> {
  try {
    // 1. Read JSON file
    const fileContent = fs.readFileSync('./txs/tx_to_broadcast.json', 'utf8');
    const data = JSON.parse(fileContent);
    const transactionId = data.id;
    console.log(`Preparing to push ${transactionId}`);

    // 2. Gather variables
    const accessToken = process.env.FORDEFI_API_TOKEN || '';
    const path = `/api/v1/transactions/${transactionId}`;
    const requestBody = '';
    const timestamp = new Date().getTime();; 
    
    // 3. Create payload to sign
    const payload = `${path}|${timestamp}|${requestBody}`;
    const signature = await signWithApiSigner(payload);

    // 4. Fetch raw signature from get_tx
    const fetchRawSignature = await get_tx(path, accessToken, signature, timestamp, requestBody);
    const rawTransactionBase64 = (await fetchRawSignature.raw_transaction);
    console.log(`Raw signature -> ${rawTransactionBase64}`);

    // 5. Prepare request for Jito
    const url = 'https://mainnet.block-engine.jito.wtf/api/v1/transactions';
    const jitoPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: [rawTransactionBase64, { encoding: 'base64' }],
    };

    // 6. Set headers and send request
    const headers = { 'Content-Type': 'application/json' };

    const response = await axios.post(url, jitoPayload, { headers });
    console.log(`Successfully sent transaction to Jito. Response: ${JSON.stringify(response.data, null, 2)}`);
  } catch (error: any) {
    console.error(`Error sending transaction: ${error}`);

    // If the error is an Axios error with a response
    if (error.response) {
      console.error(`Response content: ${error.response.data}`);
    }
  }
}

// Execute main
main().catch((err) => {
  console.error('Unhandled error:', err);
});