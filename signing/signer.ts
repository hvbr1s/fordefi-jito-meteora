import fs from 'fs';
import * as crypto from 'crypto';

// 1. Set the path to your private key in PEM format
const privateKeyFilePath = './secret/private.pem';

// 2. Read the private key from the filesystem
const privateKeyPem = fs.readFileSync(privateKeyFilePath, 'utf8');

export async  function signWithApiSigner(payload: string): Promise<string> {


  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const sign = crypto.createSign('SHA256').update(payload, 'utf8').end();
  const signature = sign.sign(privateKey, 'base64');


  // Return the signature encoded in Base64
  return signature
}