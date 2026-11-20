// BD Situation Intelligence: HTTPS GET for hosts that omit their intermediate certificate
// (Node.js runtime only). Browsers repair such chains by downloading the issuer named in the
// leaf certificate's Authority Information Access ("CA Issuers") field; Node does not.
// This helper does the same, then makes the real request with normal verification ON,
// trusting Node's root store plus that one downloaded intermediate.
import tls from 'node:tls';
import https from 'node:https';
import http from 'node:http';

const issuerPemByHost = new Map();

function derToPem(der) {
  const b64 = Buffer.from(der).toString('base64').match(/.{1,64}/g).join('\n');
  return `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`;
}

/** Reads (does not trust) the server's leaf certificate to find its CA Issuers URL. */
function readCaIssuersUrl(host, timeoutMs) {
  return new Promise((resolve, reject) => {
    // Verification is off only for this handshake, which sends no request and reads no data:
    // it inspects the presented certificate so the issuer can be fetched.
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate(false);
      socket.end();
      const info = cert?.infoAccess?.['CA Issuers - URI'];
      if (Array.isArray(info) && info[0]) resolve(info[0]);
      else reject(new Error(`no CA Issuers URL in certificate for ${host}`));
    });
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error(`TLS timeout reading certificate for ${host}`)));
    socket.on('error', reject);
  });
}

function getBuffer(url, options, timeoutMs) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(getBuffer(new URL(res.headers.location, url).toString(), options, timeoutMs));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout fetching ${url}`)));
    req.on('error', reject);
  });
}

async function issuerPemFor(host, timeoutMs) {
  if (issuerPemByHost.has(host)) return issuerPemByHost.get(host);
  const caUrl = await readCaIssuersUrl(host, timeoutMs);
  if (!/^https?:\/\//.test(caUrl)) throw new Error(`unsupported CA Issuers URL for ${host}`);
  const { status, body } = await getBuffer(caUrl, {}, timeoutMs);
  if (status !== 200 || body.length < 200) throw new Error(`CA Issuers download failed (${status}) for ${host}`);
  const text = body.toString('latin1');
  const pem = text.includes('BEGIN CERTIFICATE') ? text : derToPem(body); // usually DER (.crt / .cer)
  issuerPemByHost.set(host, pem);
  return pem;
}

/**
 * GET `url` and return { status, text }. Tries a normal verified request first; if the chain
 * is incomplete, repairs it with the AIA intermediate and retries, still verified.
 */
export async function getTextWithAiaRepair(url, { headers = {}, timeoutMs = 15_000 } = {}) {
  const u = new URL(url);
  const opts = (ca) => ({ headers, ...(ca ? { ca: [...tls.rootCertificates, ca] } : {}) });
  try {
    const { status, body } = await getBuffer(url, opts(null), timeoutMs);
    return { status, text: body.toString('utf8') };
  } catch (err) {
    const code = err?.code || '';
    if (!/UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT/.test(code) && !/unable to (verify|get) the first certificate|issuer certificate/i.test(String(err?.message))) throw err;
    const pem = await issuerPemFor(u.hostname, timeoutMs);
    const { status, body } = await getBuffer(url, opts(pem), timeoutMs);
    return { status, text: body.toString('utf8') };
  }
}
