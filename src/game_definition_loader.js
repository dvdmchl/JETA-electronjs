const Ajv = require("ajv");
const fs = require("fs");
const yaml = require("js-yaml");
const path = require("path");

const schema = require("../resources/game_definition_schema.json");

const ajv = new Ajv();
require("ajv-formats")(ajv);

const validate = ajv.compile(schema);

function loadGameFile(filePath) {
    try {
        const fileData = fs.readFileSync(filePath, "utf-8");
        const gameData = yaml.load(fileData);

        const valid = validate(gameData);
        if (!valid) {
            console.error("Validation errors:", validate.errors);
            return null;
        }

        console.log("Game file is valid!");
        return gameData;
    } catch (error) {
        console.error("Error loading game file:", error.message);
        return null;
    }
}

module.exports = { loadGameFile };