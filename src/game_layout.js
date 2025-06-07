const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function loadGameLayout(yamlFilePath, mainWindow) {
    try {
        const yamlContent = fs.readFileSync(yamlFilePath, 'utf8');
        const yamlData = yaml.load(yamlContent);

        let layoutPath;
        if (yamlData.layout && yamlData.layout.path) {
            const yamlDir = path.dirname(yamlFilePath);
            layoutPath = path.join(yamlDir, yamlData.layout.path);
        } else {
            layoutPath = path.join(__dirname, '../resources', 'layout_default.html');
        }

        if (fs.existsSync(layoutPath)) {
            const layoutContent = fs.readFileSync(layoutPath, 'utf8');
            mainWindow.webContents.send('set-game-layout', layoutContent);
            console.log(`Layout loaded from: ${layoutPath}`);
            return true;
        } else {
            console.error(`Soubor layoutu nenalezen: ${layoutPath}`);
            return false;
        }
    } catch (error) {
        console.error('Chyba při načítání layoutu:', error);
        return false;
    }
}

module.exports = { loadGameLayout };
