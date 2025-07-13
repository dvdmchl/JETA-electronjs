const { encryptData, decryptData } = require('../encryption');

describe('encryption utilities', () => {
    test('AES encrypt/decrypt roundtrip', () => {
        const text = 'Hello world';
        const encrypted = encryptData(text, 'aes');
        expect(encrypted).not.toBe(text);
        const decrypted = decryptData(encrypted, 'aes');
        expect(decrypted).toBe(text);
    });

    test('XOR encrypt/decrypt roundtrip', () => {
        const text = 'Another text';
        const encrypted = encryptData(text);
        expect(encrypted).not.toBe(text);
        const decrypted = decryptData(encrypted);
        expect(decrypted).toBe(text);
    });
});
