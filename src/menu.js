const {app, Menu, BrowserWindow, ipcMain, dialog} = require('electron');
const fs = require('fs');
const path = require('path');
const i18next = require('./i18n');
const {exec} = require('child_process');
const {loadGameFile} = require('./game_definition_loader');
const {play} = require('./game_engine');
const { createDebugWindow } = require("./debug_window");



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
    const encryptionActive = !!(win && win.webContents.encryption);
    return Menu.buildFromTemplate([
        {
            label: i18next.t('menu.file'),
            submenu: [
                {
                    label: i18next.t('menu.loadGameDefinition'),
                    accelerator: 'Ctrl+O',
                    click: async () => {
                        try {
                            const { canceled, filePaths } = await dialog.showOpenDialog(win, {
                                properties: ['openFile'],
                                filters: [
                                    { name: 'Game Files', extensions: ['yaml', 'json', 'enc', 'jenc'] }
                                ]
                            });

                            if (!canceled && filePaths.length > 0) {
                                let gameFilePath = filePaths[0];
                                const gameData = await loadGameFile(gameFilePath, win);

                                if (gameData) {
                                    console.log('Game data loaded');
                                    win.webContents.send('clear-output');
                                    play(gameData, win);
                                    updateMenu(currentLanguage, store, win);
                                }
                                fs.watchFile(gameFilePath, async (curr, prev) => {
                                    if (curr.mtime !== prev.mtime) {
                                        const gameData = await loadGameFile(gameFilePath, win);
                                        if (gameData) {
                                            console.log('Reloaded game data:', gameData);
                                            updateMenu(currentLanguage, store, win);
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
                    ,
                    click: async () => {
                        const { canceled, filePath } = await dialog.showSaveDialog(win, {
                            title: i18next.t('dialog.saveGameState'),
                            defaultPath: path.join(app.getPath('documents'), 'jeta_state.json'),
                            filters: [{ name: 'JSON Files', extensions: ['json'] }]
                        });
                        if (!canceled && filePath) {
                            const gameInstance = win.webContents.gameInstance;
                            if (gameInstance && gameInstance.data && gameInstance.data.toJSON) {
                                const json = gameInstance.data.toJSON();
                                if (win.webContents.encryption) {
                                    const { encryptData } = require('./encryption');
                                    const m = win.webContents.encryption.method;
                                    const enc = encryptData(json, m);
                                    fs.writeFileSync(filePath, m + '\n' + enc);
                                } else {
                                    fs.writeFileSync(filePath, json);
                                }
                            }
                        }
                    }
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
                                        updateMenu(currentLanguage, store, win);
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
                    click: async () => {
                        const { canceled, filePaths } = await dialog.showOpenDialog(win, {
                            properties: ['openFile'],
                            filters: [{ name: 'JSON Files', extensions: ['json'] }]
                        });
                        if (canceled || filePaths.length === 0) return;
                        const inputPath = filePaths[0];

                        const { response } = await dialog.showMessageBox(win, {
                            type: 'question',
                            buttons: ['AES', 'XOR', 'Cancel'],
                            defaultId: 0,
                            cancelId: 2,
                            message: 'Select encryption method'
                        });
                        if (response === 2) return;
                        const method = response === 0 ? 'aes' : 'xor';

                        const data = fs.readFileSync(inputPath, 'utf8');
                        const { encryptData } = require('./encryption');
                        const encrypted = encryptData(data, method);
                        const outputPath = inputPath + '.enc';
                        fs.writeFileSync(outputPath, method + '\n' + encrypted);
                        dialog.showMessageBox(win, { message: `Encrypted file saved to ${outputPath}` });
                    }
                },
                {type: 'separator'},
                {
                    label: i18next.t('menu.openDevTools'),
                    accelerator: 'Ctrl+Shift+I',
                    enabled: !encryptionActive,
                    click: () => {
                        if (encryptionActive) return;
                        console.log('Opening DevTools');
                        win.webContents.openDevTools();
                    }
                },
                {
                    label: i18next.t('menu.debug'),
                    enabled: !encryptionActive,
                    click: () => {
                        if (!encryptionActive) createDebugWindow(win);
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