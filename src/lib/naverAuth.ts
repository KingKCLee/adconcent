/**
 * 네이버 SA API HMAC 서명 생성
 * Web Crypto API 사용 (브라우저 호환)
 */
export async function generateNaverSignature(
  secretKey: string,
  timestamp: number,
  method: string,
  path: string
): Promise<string> {
  const message = `${timestamp}.${method}.${path}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const msgData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
