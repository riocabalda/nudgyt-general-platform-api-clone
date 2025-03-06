import bcrypt from 'bcrypt';
import jwt, {
  JsonWebTokenError,
  NotBeforeError,
  TokenExpiredError
} from 'jsonwebtoken';
import crypto from 'node:crypto';
import encryptionConfig from '../config/encryption.config';

/**
 * `bcrypt` has maximum input length of 72 bytes
 *
 * https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#input-limits-of-bcrypt
 */
const BCRYPT_INPUT_LIMIT = 72;

type ScryptParams = Parameters<typeof crypto.scrypt>;

/** Node's `promisify` might be better */
async function scryptPromise(
  data: ScryptParams[0],
  salt: ScryptParams[1],
  keylen: ScryptParams[2]
) {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(data, salt, keylen, (error, derivedKey) => {
      if (error !== null) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

function generateToken({
  payload,
  jwtSecret = encryptionConfig.jwtSecret,
  expiresIn = encryptionConfig.jwtExpiration
}: {
  payload: string | object | Buffer;
  jwtSecret?: string;
  expiresIn?: number;
}) {
  const token = jwt.sign(payload, jwtSecret, { expiresIn });

  return token;
}

function verifyToken(
  token: string,
  jwtSecret: string = encryptionConfig.jwtSecret
) {
  const payload = jwt.verify(token, jwtSecret);

  return payload;
}

function verifyTokenSafely(
  token: string,
  jwtSecret: string = encryptionConfig.jwtSecret
) {
  try {
    const payload = jwt.verify(token, jwtSecret);

    return { success: true, data: payload } as const;
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return { success: false, error: 'token expired' } as const;
    }
    if (error instanceof NotBeforeError) {
      return { success: false, error: 'token inactive' } as const;
    }
    if (error instanceof JsonWebTokenError) {
      return { success: false, error: 'token invalid' } as const;
    }

    return { success: false, error: 'unknown' } as const;
  }
}

/** Does not verify token signature! */
function getTokenExpiry(token: string): Date | null {
  const payload = jwt.decode(token);

  if (payload === null) return null;
  if (typeof payload === 'string') return null;
  if (payload.exp === undefined) return null;

  const expMs = payload.exp * 1000;
  const expDate = new Date(expMs);

  return expDate;
}

async function generateHash(password: string, saltRounds: number = 10) {
  if (password.length >= BCRYPT_INPUT_LIMIT) {
    console.warn(
      'Password is at or above bcrypt limit! Collisions likely'
    );
  }

  const hash = await bcrypt.hash(password, saltRounds);

  return hash;
}

async function verifyHash(password: string, hash: string) {
  if (password.length >= BCRYPT_INPUT_LIMIT) {
    console.warn(
      'Password is at or above bcrypt limit! Collisions likely'
    );
  }

  const isSame = await bcrypt.compare(password, hash);

  return isSame;
}

/**
 * https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#password-hashing-algorithms
 * - `Argon2id` > `scrypt` > `bcrypt`
 *
 * https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback
 * - `scrypt` is built-in to Node
 * - "It is recommended that a salt is random and at least 16 bytes long."
 * - Endorsed key length is 64
 *
 * https://github.com/nodejs/help/issues/1626
 * - It might be possible to derive the used salt from the hash key itself
 */
async function generateHashScrypt(
  data: string,
  saltlen = 16,
  keylen = 64,
  encoding: BufferEncoding = 'hex'
) {
  const saltBuffer = crypto.randomBytes(saltlen);
  const salt = saltBuffer.toString(encoding);

  const hashBuffer = await scryptPromise(data, saltBuffer, keylen);
  const hash = hashBuffer.toString(encoding);

  const hashWithSalt = `${hash}:${salt}`;

  return hashWithSalt;
}

async function verifyHashScrypt(
  data: string,
  hashWithSalt: string,
  keylen = 64,
  encoding: BufferEncoding = 'hex'
) {
  const hashParts = hashWithSalt.split(':');
  if (hashParts.length !== 2) return false;

  const [hash, salt] = hashParts;
  const saltBuffer = Buffer.from(salt, encoding);

  const dataHashBuffer = await scryptPromise(data, saltBuffer, keylen);
  const dataHash = dataHashBuffer.toString(encoding);

  const isSame = hash === dataHash;

  return isSame;
}

function generateHashSHA256(
  data: string,
  options: {
    encoding?: crypto.BinaryToTextEncoding;
  } = {}
) {
  const { encoding = 'hex' } = options;

  const hasher = crypto.createHash('sha256');
  hasher.update(data);
  const hash = hasher.digest(encoding);

  return hash;
}

function verifyHashSHA256(data: string, expectedHash: string) {
  const actualHash = generateHashSHA256(data);
  const isSame = expectedHash === actualHash;

  return isSame;
}

/**
 * Must be a 32-byte key
 *
 * One-liner:
 * ```ts
 * require('crypto').randomBytes(32).toString('hex')
 * ```
 */
function generateAESEncryptionKey(
  options: {
    encoding?: BufferEncoding;
  } = {}
) {
  const { encoding = 'hex' } = options;

  const buffer = crypto.randomBytes(32);
  const key = buffer.toString(encoding);

  return key;
}

/**
 * 256 > 192 > 128; higher is better
 *
 * OCB seems to be best but requires specifying auth tag length;
 * GCM is second best and has defaults for auth tag length
 *
 * IV must be 12 bytes
 *
 * Terms "nonce" and "IV" seems to be interchangeable
 *
 * ---
 *
 * - https://blog.shmovahhedi.com/aes-algorithms
 */
function encryptAES(
  data: string,
  options: {
    key?: string;
    encoding?: BufferEncoding;
    delimiter?: string;
    iv?: Buffer;
  } = {}
) {
  const { key = encryptionConfig.aesEncryptionKey } = options;
  const { encoding = 'hex', delimiter = ':' } = options;
  const { iv = crypto.randomBytes(12) } = options;

  const keyBuffer = Buffer.from(key, encoding);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  const cipherResult = Buffer.concat([
    cipher.update(data),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag(); // Must come after encrypting

  const encryptedData = [
    cipherResult.toString(encoding),
    iv.toString(encoding),
    tag.toString(encoding)
  ].join(delimiter);

  return encryptedData;
}

function decryptAES(
  encryptedData: string,
  options: {
    key?: string;
    encoding?: BufferEncoding;
    delimiter?: string;
  } = {}
) {
  const { key = encryptionConfig.aesEncryptionKey } = options;
  const { encoding = 'hex', delimiter = ':' } = options;

  const [cipherResult, iv, tag] = encryptedData
    .split(delimiter)
    .map((part) => Buffer.from(part, encoding));

  const keyBuffer = Buffer.from(key, encoding);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    keyBuffer,
    iv
  );
  decipher.setAuthTag(tag); // Must come before decrypting
  const decipherResult = Buffer.concat([
    decipher.update(cipherResult),
    decipher.final()
  ]);

  const data = decipherResult.toString();

  return data;
}

export default {
  ...{ generateToken, verifyToken, verifyTokenSafely, getTokenExpiry },
  ...{
    ...{ generateHash, verifyHash },
    ...{ generateHashScrypt, verifyHashScrypt },
    ...{ generateHashSHA256, verifyHashSHA256 }
  },
  ...{ encryptAES, decryptAES, generateAESEncryptionKey }
};
