const crypto = require('crypto');

const SECRET = 'jeta-secret-key';
const ALGORITHM = 'aes-256-cbc';
const KEY = crypto.scryptSync(SECRET, 'salt', 32);
const IV = Buffer.alloc(16, 0); // static IV for simplicity

function encryptData(data, method) {
    if (method === 'aes') {
        const cipher = crypto.createCipheriv(ALGORITHM, KEY, IV);
        let encrypted = cipher.update(data, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return encrypted;
    }
    // default XOR obfuscation
    const keyBuf = Buffer.from(SECRET);
    const buffer = Buffer.from(data);
    const out = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        out[i] = buffer[i] ^ keyBuf[i % keyBuf.length];
    }
    return out.toString('base64');
}

function decryptData(data, method) {
    if (method === 'aes') {
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, IV);
        let decrypted = decipher.update(data, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    const keyBuf = Buffer.from(SECRET);
    const buffer = Buffer.from(data, 'base64');
    const out = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        out[i] = buffer[i] ^ keyBuf[i % keyBuf.length];
    }
    return out.toString('utf8');
}

module.exports = { encryptData, decryptData };
