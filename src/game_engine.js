const {ipcMain} = require('electron');
const {sendDebugState} = require("./debug_window");
const { LAYOUT_SECTIONS } = require('./layout_sections');

ipcMain.on('game-action', (event, {action, param}) => {
    console.log(`Action received: ${action}, Parameter: ${param}`);

    if (!event.sender.gameInstance) {
        console.error("Game instance is not attached to this renderer.");
        return;
    }

    const game = event.sender.gameInstance;

    let skipLook = false;

    switch (action) {
        case 'see':
            game.see(param);
            break;
        case 'look':
            game.look();
            break;
        case 'go':
            game.go(param);
            break;
        case 'use':
            game.use(param);
            break;
        case 'take':
            game.take(param);
            break;
        case 'drop':
            game.drop(param);
            break;
        case 'talk':
            game.talk(param);
            break;
        case 'dialog-choice':
            skipLook = true;
            game.handleDialogChoice(param);
            break;
        default:
            console.error(`Unknown action: ${action}`);
    }
    if (!skipLook) {
        game.look();
    }
    if (!game.data.getValue("game_end", false)) {
        game.listCommands();
    } else {
        game.listEndings();
    }
});


///////////////////////////////////////////
// Třída hry

///////////////////////////////////////////
class GameEngine {
    constructor(data, win) {
        this.data = data;
        this.win = win;
        this.endGame = false;
        this.activeDialogues = new Map();
    }


    start() {
        console.log("Starting game...");
        this.sendUpdate(`${this.data.title}`, 'game-title');
        let data;
        (this.data.intro || []).forEach(introPage => {
            if (!data) {
                data = introPage.page;
            } else {
                data = data + "<hr>" + introPage.page;
            }
        });
        data = data + "<hr>" + this.getLookText();
        this.sendUpdate(data, 'game-location');
        this.updateLayoutVisibility();
    }

    // Vypíše popis aktuální lokace + viditelné věci a postavy
    look() {
        let data = this.getLookText();
        this.sendUpdate(data, 'game-location');
    }

    getLookText() {
        console.log("Looking around...");
        if (this.data.player === null) {
            this.sendUpdate("There is no player character defined.");
            return "";
        }
        const loc = this.data.getPlayerLocation();
        if (!loc) {
            this.sendUpdate("Neznámá lokace.");
            return "";
        }

        return this.data.getDescription(loc);
    }

    // prozkoumání objektu / characteru
    see(itemId) {

        let foundItem = Object.values(this.data.items).find(i => i.id === itemId);
        if (!foundItem) {
            // try to find character
            foundItem = Object.values(this.data.characters).find(c => c.id === itemId);
        }
        if (!foundItem) {
            this.sendUpdate("Takový předmět tu není.");
            return;
        }

        // Musí být viditelný
        if (foundItem.visible === false) {
            this.sendUpdate("To nevidíš.");
            return;
        }

        // Musí být v aktuální lokaci nebo u hráče
        if (foundItem.owner !== this.data.player.location && foundItem.owner !== "player" && foundItem.location !== this.data.player.location) {
            this.sendUpdate("Tady nic takového není.");
            return;
        }

        const displayName = getAccusativeName(foundItem);
        this.sendUpdate("Prozkoumáváš " + displayName + ".");

        let descr = this.data.getDescription(foundItem);
        this.sendUpdate(descr,);

        // increase onSee count
        let variablePath = foundItem.id + ":onSee:count";
        this.data.setValue(variablePath, this.data.getValue(variablePath, 0) + 1);
        // onSee and ittearble?
        if (foundItem.onSee && foundItem.onSee.length > 0) {
            for (let action of foundItem.onSee) {
                // Pokud má condition, vyhodnotíme
                if (action.condition) {
                    if (!this.data.parseCondition(action.condition, this)) continue;
                }
                if (action.set) {
                    this.data.parseSet(action.set);
                }
            }
        }
    }

    // Přesun hráče
    go(where) {
        // Najdeme v connections
        const loc = this.data.getPlayerLocation();

        if (!loc) {
            this.sendUpdate("Neznámá lokace.");
            return;
        }
        const conn = (loc.connections || []).find(c => c.direction.toLowerCase() === where.toLowerCase());
        if (!conn) {
            this.sendUpdate("Tam se jít nedá.");
            return;
        }
        // Změníme location
        this.sendUpdate("Přesouváš se do " + conn.direction + ".");
        this.data.player.location = conn.target;
        this.look();
    }

    take(itemName) {
        // Najdi item podle jména nebo id
        let found = Object.values(this.data.items).find(i => i.name.toLowerCase() === itemName.toLowerCase());
        if (!found) {
            this.sendUpdate("Takový předmět tu není.");
            return;
        }
        // Musí být v aktuální lokaci
        if (found.owner !== this.data.player.location) {
            this.sendUpdate("Tady nic takového neleží.");
            return;
        }
        // Musí být movable
        if (!found.movable) {
            this.sendUpdate("To vzít nejde.");
            return;
        }
        // Vezmeme
        found.owner = "player";
        this.sendUpdate("Vzal jsi to.");
        // OnTake?
        if (found.onTake) {
            for (let action of found.onTake) {
                // Pokud má condition, vyhodnotíme
                if (action.condition) {
                    if (!this.data.parseCondition(action.condition, this)) continue;
                }
                this.sendUpdate(action.description);
            }
        }
    }

    drop(itemName) {
        // Najdi item, který držíme
        let found = Object.values(this.data.items).find(
            i => i.name.toLowerCase() === itemName.toLowerCase() && i.owner === "player"
        );
        if (!found) {
            this.sendUpdate("Takový předmět u sebe nemáš.");
            return;
        }
        // Položíme do lokace
        found.owner = this.data.player.location;
        // onDrop?
        if (found.onDrop) {
            for (let action of found.onDrop) {
                if (action.condition && !this.data.parseCondition(action.condition, this)) {
                    continue;
                }
                this.sendUpdate(action.description);
            }
        } else {
            this.sendUpdate("Položil jsi to.");
        }
    }

    use(itemId) {
        // Najdi item, ať už je kdekoliv, hlavně existenci
        let found = Object.values(this.data.items).find(i => i.id.toLowerCase() === itemId.toLowerCase());
        if (!found) {
            this.sendUpdate("Takový předmět neznám.");
            return;
        }
        // Koukni, jestli je definovaný onUse
        if (!found.onUse) {
            this.sendUpdate("Nenapadá mě, jak to použít.");
            return;
        }
        // Projedeme akce
        let usedSomething = false;
        for (let action of found.onUse) {
            if (action.condition) {
                if (!this.data.parseCondition(action.condition, this)) continue;
            }

            this.sendUpdate(action.description);
            if (action.set) {
                this.data.parseSet(action.set, this);
            }
            usedSomething = true;
            // Jakmile je splněna jedna akce, končíme
            break;
        }
        if (!usedSomething) {
            this.sendUpdate("Nic se nestalo.");
        }
    }

    talk(characterIdentifier) {
        const ch = this.findCharacter(characterIdentifier);
        if (!ch) {
            this.sendUpdate("Takovou postavu tu nevidím.");
            return;
        }

        if (!ch.onTalk || !ch.onTalk.length) {
            this.sendUpdate("Tahle postava nemá co říct.");
            return;
        }

        const activeEntryId = this.activeDialogues.get(ch.id);
        if (activeEntryId) {
            const activeEntry = this.data.getDialogueEntry(ch.id, activeEntryId);
            if (activeEntry) {
                const activeResult = this.presentDialogueEntry(ch, activeEntry);
                if (activeResult.hasResponses) {
                    return;
                }
            }
            this.activeDialogues.delete(ch.id);
        }

        let spoke = false;
        for (let entry of ch.onTalk) {
            if (entry.condition && !this.data.parseCondition(entry.condition)) {
                continue;
            }

            const result = this.presentDialogueEntry(ch, entry);
            if (result.spoke) {
                spoke = true;
            }

            if (result.hasResponses) {
                spoke = true;
                return;
            }
        }

        if (!spoke) {
            this.sendUpdate("Nepodařilo se navázat rozhovor.");
        }
    }

    handleDialogChoice(payload) {
        if (!payload || typeof payload !== 'object') {
            this.sendUpdate("Tahle odpověď není dostupná.");
            return;
        }

        const {characterId, choiceId, entryId} = payload;
        const character = this.data.getCharacterById(characterId) || this.findCharacter(characterId);
        if (!character) {
            this.sendUpdate("Takovou postavu tu nevidím.");
            return;
        }

        const currentEntryId = entryId || this.activeDialogues.get(character.id);
        if (!currentEntryId) {
            this.sendUpdate("Žádný rozhovor není aktivní.");
            return;
        }

        const entry = this.data.getDialogueEntry(character.id, currentEntryId);
        if (!entry || !entry.responses) {
            this.activeDialogues.delete(character.id);
            this.sendUpdate("Tahle replika není dostupná.");
            return;
        }

        const response = entry.responses.find(r => r.id === choiceId);
        if (!response) {
            this.sendUpdate("Takovou odpověď nemáš.");
            return;
        }

        if (response.condition && !this.data.parseCondition(response.condition)) {
            this.sendUpdate("Tahle odpověď není dostupná.");
            return;
        }

        if (response.text) {
            this.sendUpdate(`<p class="dialogue-choice">${escapeHtml(response.text)}</p>`);
        }

        if (response.set) {
            this.data.parseSet(response.set);
        }

        if (response.next) {
            const nextEntry = this.data.getDialogueEntry(character.id, response.next);
            if (nextEntry) {
                const result = this.presentDialogueEntry(character, nextEntry);
                if (!result.hasResponses) {
                    this.activeDialogues.delete(character.id);
                }
                return;
            }
            this.sendUpdate("Chybí navazující replika v rozhovoru.");
        }

        this.activeDialogues.delete(character.id);
    }

    presentDialogueEntry(character, entry) {
        if (entry.condition && !this.data.parseCondition(entry.condition)) {
            this.activeDialogues.delete(character.id);
            return {spoke: false, hasResponses: false};
        }

        let spoke = false;
        if (entry.description) {
            this.sendUpdate(entry.description);
            spoke = true;
        }

        if (entry.set) {
            this.data.parseSet(entry.set);
            spoke = true;
        }

        let hasResponses = false;
        if (entry.responses && entry.responses.length) {
            if (!entry.id) {
                this.activeDialogues.delete(character.id);
            } else {
                const options = this.data.getDialogueOptions(character.id, entry.id);
                if (options.length) {
                    const markup = this.renderDialogueOptions(character.id, entry.id, options);
                    this.sendUpdate(markup);
                    this.activeDialogues.set(character.id, entry.id);
                    hasResponses = true;
                    if (!spoke) {
                        spoke = true;
                    }
                } else {
                    this.activeDialogues.delete(character.id);
                }
            }
        } else {
            this.activeDialogues.delete(character.id);
        }

        return {spoke, hasResponses};
    }

    renderDialogueOptions(characterId, entryId, options) {
        const encodedCharacter = encodeDataAttribute(characterId);
        const encodedEntry = encodeDataAttribute(entryId);
        const links = options.map(option => {
            const encodedChoice = encodeDataAttribute(option.id);
            return `<a href="#" class="game-action dialog-option" data-action="dialog-choice" data-character="${encodedCharacter}" data-entry="${encodedEntry}" data-choice="${encodedChoice}">${escapeHtml(option.text)}</a>`;
        }).join(' | ');
        return `<div class="dialogue-options" data-character="${encodedCharacter}" data-entry="${encodedEntry}">${links}</div>`;
    }

    findCharacter(identifier) {
        if (!identifier) {
            return null;
        }
        const value = identifier.toString().toLowerCase();
        return Object.values(this.data.characters).find(c => {
            const byId = (c.id || '').toLowerCase() === value;
            const byName = (c.name || '').toLowerCase() === value;
            return byId || byName;
        }) || null;
    }

    listEndings() {
        let endDescription = this.data.getEndDescription();
        if (endDescription) {
            this.sendUpdate(endDescription, 'game-location');
        }
        this.updateLayoutVisibility();
    }

    listCommands() {
        // add possible commands

        const loc = this.data.getPlayerLocation();

        // look
        let lookHref = '<a href="#" class="game-action" data-action="look">rozhlédnout se</a>';

        // talk to
        let charactersInLoc = Object.values(this.data.characters)
            .filter(c => c.location === loc.id && c.visible);
        let talkHrefRow = createTalkHrefRow(charactersInLoc);

        // see
        let itemsInLoc = Object.values(this.data.items)
            .filter(i => i.owner === loc.id && i.visible);
        let itemsInInventory = Object.values(this.data.items)
            .filter(i => i.owner === "player" && i.visible);
        let itemsHrefRow = createItemsHrefRow(itemsInLoc, itemsInInventory);

        // take
        let itemsInLocAndTakeable = itemsInLoc.filter(i => (i.owner === loc.id) && i.movable);
        let takeHrefRow = createTakeHrefRow(itemsInLocAndTakeable);

        // use
        let itemsForLocAndInventory = Object.values(this.data.items)
            .filter(i => (i.owner === loc.id || i.owner === "player") && i.visible);
        let useHrefRow = createUseHrefRow(itemsForLocAndInventory);

        // drop
        let itemsInInventoryAndDropable = Object.values(this.data.items)
            .filter(i => (i.owner === "player") && i.movable && i.visible);
        let dropHrefRow = createDropHrefRow(itemsInInventoryAndDropable);

        // go
        let connectionsForLoc = (loc.connections || []);
        let goHrefRow = createDirectionsHrefRow(connectionsForLoc, this.data.locations);

        if (itemsHrefRow || goHrefRow) {
            this.sendUpdate(lookHref, 'game-commands');
            this.sendUpdate(talkHrefRow, 'game-characters');
            this.sendUpdate(itemsHrefRow, 'game-items');
            this.sendUpdate(useHrefRow, 'game-use');
            this.sendUpdate(takeHrefRow, 'game-take');
            this.sendUpdate(dropHrefRow, 'game-drop');
            this.sendUpdate(goHrefRow, 'game-go');
        }
        this.updateLayoutVisibility();
    }

    sendUpdate(message, section) {
        console.log("Sending update: ", message);
        if (this.win && this.win.webContents) {
            this.win.webContents.send('game-update', message, section);
            console.log("Message sent.");
            sendDebugState(this);
        } else {
            console.error("Failed to send message: win or webContents is not defined.");
        }
    }

    updateLayoutVisibility() {
        if (!this.win || !this.win.webContents) {
            return;
        }

        LAYOUT_SECTIONS.forEach(({id, variableId, defaultVisible}) => {
            const rawValue = this.data.getValue(variableId, defaultVisible);
            const isVisible = !(rawValue === false || rawValue === 'false');
            this.setSectionVisibility(id, isVisible);
        });
    }

    setSectionVisibility(sectionId, isVisible) {
        if (!this.win || !this.win.webContents) {
            return;
        }
        this.win.webContents.send('game-section-visibility', sectionId, Boolean(isVisible));
    }


}

function getAccusativeName(entity) {
    if (!entity) return "";
    return entity.name_accusative || entity.name || "";
}

function encodeDataAttribute(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return encodeURIComponent(value.toString());
}

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return value
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function createTalkHrefRow(charactersInLoc) {
    if (!charactersInLoc || charactersInLoc.length === 0) return "";
    let seeHrefRow = "";
    let talkHrefRow = "";
    charactersInLoc.forEach(character => {
        const displayName = getAccusativeName(character);
        if (seeHrefRow !== "") seeHrefRow += " | ";
        seeHrefRow += `<a href="#" class="game-action" data-action="see" data-param="${character.id}">${displayName}</a>`;
        if (talkHrefRow !== "") talkHrefRow += " | ";
        talkHrefRow += `<a href="#" class="game-action" data-action="talk" data-param="${character.id}">${displayName}</a>`;
    });
    return '<span>Prozkoumat:</span>' + seeHrefRow + '<br><span>Oslovit: </span>' + talkHrefRow;
}

function createItemsHrefRow(items, itemsInInventory) {
    if ((!items || items.length === 0) && (!itemsInInventory || itemsInInventory.length === 0)) return "";
    let itemsHrefRow = "";
    items.forEach(item => {
        if (itemsHrefRow !== "") itemsHrefRow += " | ";
        const displayName = getAccusativeName(item);
        itemsHrefRow += `<a href="#" class="game-action" data-action="see" data-param="${item.id}">${displayName}</a>`;
    });
    itemsHrefRow += " Inventář: ";
    itemsInInventory.forEach(item => {
        if (itemsHrefRow !== "") itemsHrefRow += " | ";
        const displayName = getAccusativeName(item);
        itemsHrefRow += `<a href="#" class="game-action" data-action="see" data-param="${item.id}">${displayName}</a>`;
    });
    return '<span>Prozkoumat: </span>' + itemsHrefRow;
}

function createUseHrefRow(itemsForLocAndInventory) {
    if (!itemsForLocAndInventory || itemsForLocAndInventory.length === 0) return "";
    let useHrefRow = "";
    itemsForLocAndInventory.forEach(item => {
        if (useHrefRow !== "") useHrefRow += " | ";
        const displayName = getAccusativeName(item);
        useHrefRow += `<a href="#" class="game-action" data-action="use" data-param="${item.id}">${displayName}</a>`;
    });
    return '<span>Použít: </span>' + useHrefRow;
}

function createTakeHrefRow(items) {
    if (!items || items.length === 0) return "";
    let takeHrefRow = "";
    items.forEach(item => {
        if (takeHrefRow !== "") takeHrefRow += " | ";
        const displayName = getAccusativeName(item);
        takeHrefRow += `<a href="#" class="game-action" data-action="take" data-param="${item.name}">${displayName}</a>`;
    });
    return '<span>Vzít: </span>' + takeHrefRow;
}

function createDropHrefRow(items) {
    if (!items || items.length === 0) return "";
    let dropHrefRow = "";
    items.forEach(item => {
        if (dropHrefRow !== "") dropHrefRow += " | ";
        const displayName = getAccusativeName(item);
        dropHrefRow += `<a href="#" class="game-action" data-action="drop" data-param="${item.name}">${displayName}</a>`;
    });
    return '<span>Položit: </span>' + dropHrefRow;
}

function createDirectionsHrefRow(directions, locations) {
    if (!directions || directions.length === 0) return "";
    let locationsHrefRow = "";
    directions.forEach(direction => {
        let locId = Object.values(locations).find(l => l.id === direction.target).id;
        if (locationsHrefRow !== "") locationsHrefRow += " | ";
        locationsHrefRow += `<a href="#" class="game-action" data-action="go" data-param="${locId}">${direction.direction}</a>`;
    });
    return '<span>Jít: </span>' + locationsHrefRow;
}


function play(gameData, win) {
    const game = new GameEngine(gameData, win);

    // Připoj hru k rendereru
    win.webContents.gameInstance = game;

    game.start();
    game.listCommands();
    console.log("Game play method finished.");
}

module.exports = {play};