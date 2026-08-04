const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

function dataFile() {
  return path.join(app.getPath('userData'), 'involveme-data.json');
}

const DEFAULTS = { leadMinutes: 10, google: null };

function load() {
  try {
    const raw = fs.readFileSync(dataFile(), 'utf8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
  fs.writeFileSync(dataFile(), JSON.stringify(data, null, 2), 'utf8');
}

function encrypt(plainText) {
  if (safeStorage.isEncryptionAvailable()) {
    return { enc: true, value: safeStorage.encryptString(plainText).toString('base64') };
  }
  return { enc: false, value: plainText };
}

function decrypt(stored) {
  if (!stored) return null;
  if (stored.enc) {
    return safeStorage.decryptString(Buffer.from(stored.value, 'base64'));
  }
  return stored.value;
}

module.exports = { load, save, encrypt, decrypt };
