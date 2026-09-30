const {dialog} = require('electron');
const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const GameData = require('./game_data');
const {loadGameLayout} = require('./game_layout');
const {updateGameDirectory} = require('./game_dir');
const {decryptData} = require('./encryption');
const {normalizeGameDefinition, validateGameDefinitionSemantics} = require('./game_definition_contract');
const {sanitizeGameDefinitionNarrative} = require('./narrative_markup');
const schema = require('../resources/game_definition_schema.json');

const ajv = new Ajv({allErrors: true, allowUnionTypes: true});
require('ajv-formats')(ajv);
const validateSchema = ajv.compile(schema);

function parseGameFile(filePath) {
    let fileData = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    let method = null;
    if (ext === '.enc' || ext === '.jenc') {
        const idx = fileData.indexOf('\n');
        method = idx === -1 ? 'aes' : fileData.substring(0, idx).trim();
        fileData = decryptData(idx === -1 ? fileData : fileData.substring(idx + 1), method);
    }
    const inputData = ext === '.json' || ext === '.enc' || ext === '.jenc'
        ? JSON.parse(fileData)
        : yaml.load(fileData);
    return {inputData, method};
}

function prepareGameDefinition(inputData) {
    if (!validateSchema(inputData)) {
        const details = validateSchema.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('\n');
        throw new Error(`Schema validation failed:\n${details}`);
    }
    normalizeGameDefinition(inputData);
    validateGameDefinitionSemantics(inputData);
    sanitizeGameDefinitionNarrative(inputData);
    return inputData;
}

async function loadGameFile(filePath, win) {
    try {
        const {inputData, method} = parseGameFile(filePath);
        prepareGameDefinition(inputData);
        if (!loadGameLayout(inputData, filePath, win)) throw new Error('Unable to load the game layout.');
        updateGameDirectory(filePath);
        win.webContents.encryption = method ? {method} : null;
        return new GameData(inputData);
    } catch (error) {
        console.error('Error loading game file:', error.message);
        if (dialog && dialog.showErrorBox) dialog.showErrorBox('Game definition error', error.message);
        return null;
    }
}

module.exports = {loadGameFile, parseGameFile, prepareGameDefinition};
