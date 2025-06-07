const {ipcMain} = require('electron');

ipcMain.on('game-action', (event, {action, param}) => {
    console.log(`Action received: ${action}, Parameter: ${param}`);

    if (!event.sender.gameInstance) {
        console.error("Game instance is not attached to this renderer.");
        return;
    }

    const game = event.sender.gameInstance;

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
            game.look(); // Look after using an item
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
        default:
            console.error(`Unknown action: ${action}`);
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
    }


    start() {
        console.log("Starting game...");
        this.sendUpdate(`${this.data.title}`, 'game-title');
        (this.data.intro || []).forEach(introPage => {
            this.sendUpdate(introPage.page, 'game-location');
        });
    }

    // Vypíše popis aktuální lokace + viditelné věci a postavy
    look() {
        console.log("Looking around...");
        if (this.data.player === null) {
            this.sendUpdate("There is no player character defined.");
            return;
        }
        const loc = this.data.getPlayerLocation();
        if (!loc) return this.sendUpdate("Neznámá lokace.");

        let d = this.data.getDescription(loc);
        this.sendUpdate(d, 'game-location');

    }

    // prozkoumání objektu
    see(itemId) {

        let foundItem = Object.values(this.data.items).find(i => i.id === itemId);
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
        if (foundItem.owner !== this.data.player.location && foundItem.owner !== "player") {
            this.sendUpdate("Tady nic takového neleží.");
            return;
        }

        this.sendUpdate("Prozkoumáváš " + foundItem.name + ".");

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

    talk(characterName) {
        // Najdu postavu
        let ch = Object.values(this.data.characters).find(c => c.name.toLowerCase() === characterName.toLowerCase());
        if (!ch) {
            this.sendUpdate("Takovou postavu tu nevidím.");
            return;
        }
        // onTalk
        if (!ch.onTalk) {
            this.sendUpdate("Tahle postava nemá co říct.");
            return;
        }
        let spoke = false;
        for (let t of ch.onTalk) {
            if (t.condition) {
                if (!this.data.parseCondition(t.condition, this)) continue;
            }
            this.sendUpdate(t.description);
            if (t.set) {
                this.data.parseSet(t.set, this);
            }
            spoke = true;
        }
        if (!spoke) {
            this.sendUpdate("Nepodařilo se navázat rozhovor.");
        }
    }

    listEndings() {
        let endDescription = this.data.getEndDescription();
        if (endDescription) {
            this.sendUpdate(endDescription);
        }
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
    }

    sendUpdate(message, section) {
        console.log("Sending update: ", message);
        if (this.win && this.win.webContents) {
            this.win.webContents.send('game-update', message, section);
            console.log("Message sent.");
        } else {
            console.error("Failed to send message: win or webContents is not defined.");
        }
    }


}

function createTalkHrefRow(charactersInLoc) {
    if (!charactersInLoc || charactersInLoc.length === 0) return "";
    let talkHrefRow = "";
    charactersInLoc.forEach(character => {
        if (talkHrefRow !== "") talkHrefRow += " | ";
        talkHrefRow += `<a href="#" class="game-action" data-action="talk" data-param="${character.name}">${character.name}</a>`;
    });
    return '<span>Oslovit: </span>' + talkHrefRow;
}

function createItemsHrefRow(items, itemsInInventory) {
    if ((!items || items.length === 0) && (!itemsInInventory || itemsInInventory.length === 0)) return "";
    let itemsHrefRow = "";
    items.forEach(item => {
        if (itemsHrefRow !== "") itemsHrefRow += " | ";
        itemsHrefRow += `<a href="#" class="game-action" data-action="see" data-param="${item.id}">${item.name}</a>`;
    });
    itemsHrefRow += " Inventář: ";
    itemsInInventory.forEach(item => {
        if (itemsHrefRow !== "") itemsHrefRow += " | ";
        itemsHrefRow += `<a href="#" class="game-action" data-action="see" data-param="${item.id}">${item.name}</a>`;
    });
    return '<span>Prozkoumat: </span>' + itemsHrefRow;
}

function createUseHrefRow(itemsForLocAndInventory) {
    if (!itemsForLocAndInventory || itemsForLocAndInventory.length === 0) return "";
    let useHrefRow = "";
    itemsForLocAndInventory.forEach(item => {
        if (useHrefRow !== "") useHrefRow += " | ";
        useHrefRow += `<a href="#" class="game-action" data-action="use" data-param="${item.id}">${item.name}</a>`;
    });
    return '<span>Použít: </span>' + useHrefRow;
}

function createTakeHrefRow(items) {
    if (!items || items.length === 0) return "";
    let takeHrefRow = "";
    items.forEach(item => {
        if (takeHrefRow !== "") takeHrefRow += " | ";
        takeHrefRow += `<a href="#" class="game-action" data-action="take" data-param="${item.name}">${item.name}</a>`;
    });
    return '<span>Vzít: </span>' + takeHrefRow;
}

function createDropHrefRow(items) {
    if (!items || items.length === 0) return "";
    let dropHrefRow = "";
    items.forEach(item => {
        if (dropHrefRow !== "") dropHrefRow += " | ";
        dropHrefRow += `<a href="#" class="game-action" data-action="drop" data-param="${item.name}">${item.name}</a>`;
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
    game.look();
    game.listCommands();
    console.log("Game play method finished.");
}

module.exports = {play};