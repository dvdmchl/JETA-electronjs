const { dialog} = require('electron');
const Ajv = require("ajv");
const fs = require("fs");
const yaml = require("js-yaml");
const path = require("path");
const GameData = require("./game_data");

const schema = require("../resources/game_definition_schema.json");

const ajv = new Ajv();
require("ajv-formats")(ajv);

const validate = ajv.compile(schema);

function loadGameFile(filePath) {
    try {
        const fileData = fs.readFileSync(filePath, "utf-8");
        console.log("File data read successfully.");
        const inputData = yaml.load(fileData);
        console.log("YAML data parsed successfully.");

        const valid = validate(inputData);
        if (!valid) {
            console.error("Validation errors:", validate.errors);
            // show modal window with error message
            dialog.showErrorBox("Validation Error", JSON.stringify(validate.errors, null, 2));
            return null;
        }

        console.log("Game file is valid!");
        return  new GameData(inputData);
    } catch (error) {
        console.error("Error loading game file:", error.message);
        return null;
    }
}

module.exports = { loadGameFile };