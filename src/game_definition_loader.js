const { dialog, ipcRenderer } = require('electron');
const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const GameData = require('./game_data');
const { loadGameLayout } = require('./game_layout');
const { updateGameDirectory } = require('./game_dir');
const { decryptData } = require('./encryption');

const schema = require("../resources/game_definition_schema.json");

const ajv = new Ajv();
require("ajv-formats")(ajv);

const validate = ajv.compile(schema);

async function loadGameFile(filePath, win) {
    try {
        let fileData = fs.readFileSync(filePath, 'utf-8');
        console.log('File data read successfully.');

        const ext = path.extname(filePath);
        let method = 'yaml';

        if (ext === '.enc' || ext === '.jenc') {
            const idx = fileData.indexOf('\n');
            if (idx !== -1) {
                method = fileData.substring(0, idx).trim();
                fileData = fileData.substring(idx + 1);
            } else {
                method = 'aes';
            }
            fileData = decryptData(fileData, method);
        }

        let inputData;
        if (ext === '.json' || ext === '.jenc' || ext === '.enc') {
            inputData = JSON.parse(fileData);
        } else {
            inputData = yaml.load(fileData);
        }
        console.log('Game data parsed successfully.');

        const valid = validate(inputData);
        if (!valid) {
            console.error('Validation errors:', validate.errors);
            dialog.showErrorBox('Validation Error', JSON.stringify(validate.errors, null, 2));
            return null;
        }
        console.log('Game file is valid!');
        const layoutLoaded = loadGameLayout(filePath, win);
        updateGameDirectory(filePath);
        if (ext === '.enc' || ext === '.jenc') {
            win.webContents.encryption = { method };
        } else {
            win.webContents.encryption = null;
        }
        if (!layoutLoaded) {
            console.error('Chyba při načítání layoutu');
        }
        return new GameData(inputData);
    } catch (error) {
        console.error("Error loading game file:", error.message);
        return null;
    }
}


module.exports = {loadGameFile};