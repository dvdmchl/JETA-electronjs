const { app, Menu, dialog, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const i18next = require('./i18n');
const { exec } = require('child_process');
const { loadGameFile } = require('./game_definition_loader');

function updateMenu(currentLanguage, store, win) {
    const menu = createMenu(currentLanguage, store, win);
    Menu.setApplicationMenu(menu);
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
                    label: i18next.t('menu.newGameDefinition'),
                    accelerator: 'Ctrl+N',
                    click: async () => {
                        const { canceled, filePath } = await dialog.showSaveDialog(win, {
                            title: i18next.t('dialog.saveGameDefinition'),
                            defaultPath: path.join(app.getPath('documents'), 'new_game.yaml'),
                            filters: [{ name: 'YAML Files', extensions: ['yaml'] }]
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

                            fs.watchFile(filePath, (curr, prev) => {
                                if (curr.mtime !== prev.mtime) {
                                    const gameData = loadGameFile(filePath);
                                    if (gameData) {
                                        console.log('Reloaded game data:', gameData);
                                    }
                                }
                            });
                        }
                    }
                },
                {
                    label: i18next.t('menu.loadGameDefinition'),
                    accelerator: 'Ctrl+O',
                    click: async () => {
                        try {
                            const { canceled, filePaths } = await dialog.showOpenDialog(win, {
                                properties: ['openFile'],
                                filters: [{ name: 'YAML Files', extensions: ['yaml'] }],
                            });

                            if (!canceled && filePaths.length > 0) {
                                gameFilePath = filePaths[0];
                                const gameData = loadGameFile(gameFilePath);

                                if (gameData) {
                                    console.log('Game data loaded');
                                    menu.getMenuItemById('editGameDefinition').enabled = true;

                                    fs.watchFile(gameFilePath, (curr, prev) => {
                                        if (curr.mtime !== prev.mtime) {
                                            const gameData = loadGameFile(gameFilePath);
                                            if (gameData) {
                                                console.log('Reloaded game data:', gameData);
                                            }
                                        }
                                    });
                                }
                            }
                        } catch (error) {
                            console.error('Error loading game definition:', error);
                        }
                    }
                },
                {
                    label: i18next.t('menu.editGameDefinition'),
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
                        }
                    }
                },
                { role: 'quit', label: i18next.t('menu.quit') },
            ],
        },
        {
            label: i18next.t('menu.tools'),
            submenu: [
                {
                    label: i18next.t('menu.openDevTools'),
                    accelerator: 'Ctrl+Shift+I',
                    click: () => {
                        win.webContents.openDevTools();
                    }
                },
                {
                    label: i18next.t('menu.language'),
                    submenu: createLanguageMenu(currentLanguage, store, win)
                },
                { type: 'separator' },
                {
                    label: 'Reload',
                    accelerator: 'Ctrl+R',
                    click: () => {
                        win.reload();
                        win.webContents.once('did-finish-load', () => {
                            i18next.changeLanguage(currentLanguage, (err, t) => {
                                if (err) return console.error('Error changing language:', err);
                                win.webContents.send('set-language', t('index', { returnObjects: true }), currentLanguage);
                            });
                        });
                    }
                },
            ]
        }
    ]);
}

module.exports = { createMenu };