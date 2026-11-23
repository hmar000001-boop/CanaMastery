const KEY = Uint8Array.from([0x4b,0x17,0xa2,0x6d,0x39,0xf1,0x82,0x55,0x2c,0x91,0xe4,0x73,0xb8,0x0f,0xc6,0x44,0x9d,0x28,0x71,0xd3,0x5a,0x0c,0xae,0x66,0x15,0xf8,0x31,0x87,0xc2,0x4e,0x79,0x1b,0xa5]);

function fromBase64(value: string): Uint8Array {
  const binary = globalThis.atob ? globalThis.atob(value) : decodeBase64Fallback(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeBase64Fallback(value: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let buffer = 0;
  let bits = 0;
  let out = '';
  for (const ch of value.replace(/\s+/g, '')) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0 || idx === 64) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) { bits -= 8; out += String.fromCharCode((buffer >> bits) & 0xff); }
  }
  return out;
}

export function decodeContent(payload: string): unknown {
  const input = fromBase64(payload);
  const out = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i += 1) out[i] = input[i] ^ KEY[(i * 7 + 11) % KEY.length] ^ ((i * 31) & 0xff);
  return JSON.parse(new TextDecoder().decode(out)) as unknown;
}
