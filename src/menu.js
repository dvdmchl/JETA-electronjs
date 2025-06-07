const {app, Menu, BrowserWindow, ipcMain, dialog} = require('electron');
const fs = require('fs');
const path = require('path');
const i18next = require('./i18n');
const {exec} = require('child_process');
const {loadGameFile} = require('./game_definition_loader');
const {play} = require('./game_engine');



function updateMenu(currentLanguage, store, win) {
    const menu = createMenu(currentLanguage, store, win);
    Menu.setApplicationMenu(menu);
}

function updateWindowTitle(win, filePath) {
    const fileName = path.basename(filePath);
    win.setTitle(`Jeta - ${fileName}`);
}

function createLanguageMenu(currentLanguage, store, win) {
    const localesPath = path.join(__dirname, '../locales');
    const languageFiles = fs.readdirSync(localesPath);
    const languageMenu = [];

    languageFiles.forEach(file => {
        const lang = path.basename(file, '.json');
        languageMenu.push({
            label: lang.charAt(0).toUpperCase() + lang.slice(1),
            type: 'radio',
            checked: currentLanguage === lang,
            click: () => {
                console.log(`Switching to ${lang}`);
                currentLanguage = lang;
                store.set('language', lang);
                i18next.changeLanguage(lang, (err, t) => {
                    if (err) return console.error('Error changing language:', err);
                    win.webContents.send('set-language', t('index', {returnObjects: true}), lang);
                    updateMenu(currentLanguage, store, win);
                    console.log('Language changed to:', lang);
                });
            }
        });
    });

    return languageMenu;
}

function createMenu(currentLanguage, store, win) {
    return Menu.buildFromTemplate([
        {
            label: i18next.t('menu.file'),
            submenu: [
                {
                    label: i18next.t('menu.loadGameDefinition'),
                    accelerator: 'Ctrl+O',
                    click: async () => {
                        try {
                            const {canceled, filePaths} = await dialog.showOpenDialog(win, {
                                properties: ['openFile'],
                                filters: [{name: 'YAML Files', extensions: ['yaml']}],
                            });

                            if (!canceled && filePaths.length > 0) {
                                let gameFilePath = filePaths[0];
                                const gameData = await loadGameFile(gameFilePath, win);

                                if (gameData) {
                                    console.log('Game data loaded');
                                    win.webContents.send('clear-output');
                                    play(gameData, win);
                                }
                                fs.watchFile(gameFilePath, async (curr, prev) => {
                                    if (curr.mtime !== prev.mtime) {
                                        const gameData = await loadGameFile(gameFilePath, win);
                                        if (gameData) {
                                            console.log('Reloaded game data:', gameData);
                                        }
                                    }
                                });

                                updateWindowTitle(win, gameFilePath);

                            } else {
                                console.log('No file selected');
                            }
                        } catch (error) {
                            console.error('Error loading game definition:', error);
                        }
                    }
                },
                {type: 'separator'},
                {
                    label: i18next.t('menu.loadGameState'),
                    accelerator: 'Ctrl+L'
                },
                {
                    label: i18next.t('menu.saveGameState'),
                    accelerator: 'Ctrl+S'
                },
                {type: 'separator'},
                {
                    label: i18next.t('menu.restartGame'),
                },
                {type: 'separator'},
                {
                    role: 'quit', label: i18next.t('menu.quit'),
                    accelerator: 'Ctrl+Q'
                },
            ],
        },
        {
            label: i18next.t('menu.edit'),
            submenu: [
                {
                    label: i18next.t('menu.reload'),
                    accelerator: 'Ctrl+R',
                    click: () => {
                        win.reload();
                    }
                },
                {type: 'separator'},
                {
                    label: i18next.t('menu.language'),
                    submenu: createLanguageMenu(currentLanguage, store, win)
                },
                {
                    label: i18next.t('menu.newGameDefinition'),
                    accelerator: 'Ctrl+N',
                    click: async () => {
                        const {canceled, filePath} = await dialog.showSaveDialog(win, {
                            title: i18next.t('dialog.saveGameDefinition'),
                            defaultPath: path.join(app.getPath('documents'), 'new_game.yaml'),
                            filters: [{name: 'YAML Files', extensions: ['yaml']}]
                        });

                        if (!canceled && filePath) {
                            const templatePath = path.join(__dirname, '../resources/game_definition_template.yaml');
                            fs.copyFileSync(templatePath, filePath);

                            exec(`start "" "${filePath}"`, (error) => {
                                if (error) {
                                    console.error(`Error opening file: ${error.message}`);
                                } else {
                                    console.log(`File ${filePath} opened successfully.`);
                                }
                            });

                            fs.watchFile(filePath, async (curr, prev) => {
                                if (curr.mtime !== prev.mtime) {
                                    const gameData = await loadGameFile(filePath, win);
                                    if (gameData) {
                                        console.log('Reloaded game data:', gameData);
                                    }
                                }
                            });
                        }
                    }
                },
                {
                    label: i18next.t('menu.editGameDefinition'),
                    accelerator: 'Ctrl+E',
                    id: 'editGameDefinition',
                    enabled: false,
                    click: () => {
                        if (gameFilePath) {
                            exec(`start "" "${gameFilePath}"`, (error) => {
                                if (error) {
                                    console.error(`Error opening file: ${error.message}`);
                                } else {
                                    console.log(`File ${gameFilePath} opened successfully.`);
                                }
                            });

                            updateWindowTitle(win, filePath);
                        }
                    }
                },
                {
                    label: i18next.t('menu.encryptGame'),
                },
                {type: 'separator'},
                {
                    label: i18next.t('menu.openDevTools'),
                    accelerator: 'Ctrl+Shift+I',
                    click: () => {
                        console.log('Opening DevTools'); // Debugging line
                        win.webContents.openDevTools();
                    }
                },
                {type: 'separator'},
            ]
        },
        {
            label: i18next.t('menu.help'),
            submenu: [
                {
                    label: i18next.t('menu.help'),
                    accelerator: 'Ctrl+H'
                },
                {
                    label: i18next.t('menu.about'),
                },
            ],
        },
    ]);
}

module.exports = {createMenu};