const fs = require('fs');
const path = require('path');
function loadGameLayout(gameDefinition, definitionFilePath, mainWindow) {
    try {
        let layoutPath;
        if (gameDefinition.layout && gameDefinition.layout.path) {
            const definitionDir = path.dirname(definitionFilePath);
            layoutPath = path.resolve(definitionDir, gameDefinition.layout.path);
            const definitionRoot = path.resolve(definitionDir);
            if (layoutPath !== definitionRoot && !layoutPath.startsWith(definitionRoot + path.sep)) {
                console.error(`Layout path escapes the game directory: ${gameDefinition.layout.path}`);
                return false;
            }
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
