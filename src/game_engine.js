const { ipcMain } = require('electron');

///////////////////////////////////////////
// 2) Pomocné funkce pro engine
///////////////////////////////////////////
function parseCondition(cond, game) {
    // Vrátí true/false podle splnění condition
    // Příklady condition:
    //   "šálek-čaje:owner:kuchyně"
    //   "!světlo"
    //   "světlo"
    //   "vypínač:onSee:count>2"
    //   "klíče:visible"
    //   ...
    let negation = false;
    let c = cond.trim();

    // Pokud condition začíná '!', je to negace
    if (c.startsWith('!')) {
        negation = true;
        c = c.substring(1).trim();
    }

    // Rozparsujeme si varianty
    // 1) item:owner:xxx
    // 2) var
    // 3) item:visible
    // 4) item:onSee:count>2 (ukázka složitější podmínky – tady je spíš pro illustraci)
    // 5) player:location:xxx
    // 6) c=== 'světlo'
    let result = false;

    const parts = c.split(':');
    if (parts.length === 3 || parts.length === 4) {
        // Možné formáty:
        // itemId:owner:xxx
        // itemId:visible= true/false
        // itemId:onSee:count>2
        let itemId = parts[0];
        let attr = parts[1];
        let value = parts[2];
        let op = null;
        if (parts.length === 4) {
            // Třeba "vypínač:onSee:count>2"
            op = parts[2];
            value = parts[3];
        }

        // Najdeme item
        const item = game.items[itemId];
        const char = game.characters[itemId];
        const location = game.locations[itemId];

        // 'player:location:xxx'
        if (itemId === 'player' && attr === 'location') {
            result = (game.player.location === value);
        }
        // 'xxx:owner:yyy'
        else if (item && attr === 'owner') {
            result = (item.owner === value);
        }
        // 'xxx:location:yyy' – občas se v definicích plete 'location' vs. 'owner'
        else if (item && attr === 'location') {
            result = (item.location === value);
        }
        // 'xxx:visible'
        else if (item && attr === 'visible') {
            // tady value může být "" nebo 'true' podle definice
            if (value === 'true' || value === 'false') {
                result = (String(item.visible) === value);
            } else {
                // Bez rovnání – jen existence
                result = !!item.visible;
            }
        }
        // 'xxx:onSee:count>2' – jen ukázka
        else if (item && attr === 'onSee' && op === 'count>2') {
            // Tady by sis musel ukládat, kolikrát hráč na item "koukl".
            // Teď jen dám do result = false pro ilustraci.
            // Kdybychom to chtěli řešit, museli bychom to ukládat do stavu itemu.
            result = false;
        }
    }
    else {
        // Je to asi jen jméno globální proměnné: "světlo" / "dveře_odemčeny" ...
        if (game.vars[c] !== undefined) {
            result = !!game.vars[c];
        } else {
            // Může být item s c==id a test jestli je "true"? ...
            result = false;
        }
    }

    if (negation) return !result;
    return result;
}

function parseSet(setCmd, game) {
    // "plný_šálek = false"  nebo  "dveře_otevřeny=true"
    // nebo "klíče:visible=true"
    // nebo "dveře_otevřeny = false; end_game = true"
    let parts = setCmd.split(';');
    parts.forEach(p => {
        let trimmed = p.trim();
        let [left, right] = trimmed.split('=');
        if (!right) return;
        left = left.trim();
        right = right.trim();

        // Např. left = "plný_šálek", right = "false"
        // anebo left = "klíče:visible", right = "true"
        if (left.includes(':')) {
            // itemId:visible = ...
            const subParts = left.split(':');
            const itemId = subParts[0];
            const attr = subParts[1];
            const item = game.items[itemId];
            if (item) {
                // Nastavíme item[attr] = (right === "true")
                if (right === 'true') item[attr] = true;
                else if (right === 'false') item[attr] = false;
                else item[attr] = right;
            }
        } else {
            // Globální proměnné
            if (game.vars[left] !== undefined) {
                if (right === 'true') game.vars[left] = true;
                else if (right === 'false') game.vars[left] = false;
                else game.vars[left] = right;
            }
            // Může být i end_game = true
            if (left === 'end_game' && right === 'true') {
                game.endGame = true;
            }
        }
    });
}

function getDescription(descrArray, game) {
    // Najdi v poli descriptions tu, která sedí k condition, jinak vem default
    // Tj. popořadě projdeme a pokud je definována condition, testneme parseCondition
    // Pokud sedí, vrátíme description
    // Pokud nic nesedí, vrátíme default (nebo prázdný string)
    let defaultDescr = "";
    for (let d of descrArray) {
        if (d.default !== undefined) {
            defaultDescr = d.default;
        }
    }
    // Teď zkusíme najít tu s condition
    for (let d of descrArray) {
        if (d.condition) {
            if (parseCondition(d.condition, game)) {
                return d.description;
            }
        }
    }
    return defaultDescr || "";
}

///////////////////////////////////////////
// 3) Třída hry
///////////////////////////////////////////
class GameEngine {
    constructor(data, win) {
        this.data = data;
        this.win = win;
        this.endGame = false;
        this.init();
    }

    init() {
        // Načteme locations, items, characters, variables do "rychleji" přístupných map
        this.locations = {};
        (this.data.locations || []).forEach(loc => {
            this.locations[loc.id] = {
                ...loc,
            };
        });

        this.items = {};
        (this.data.items || []).forEach(it => {
            this.items[it.id] = {
                ...it,
                // defaultní parametry
                owner: it.owner || null,
                visible: it.visible === undefined ? true : it.visible
            };
        });

        this.characters = {};
        (this.data.characters || []).forEach(ch => {
            this.characters[ch.id] = {
                ...ch
            };
        });

        // Globální proměnné
        this.vars = {};
        (this.data.variables || []).forEach(v => {
            this.vars[v.id] = v.value;
        });

        // Najdeme player
        this.player = this.characters["player"] || null;
    }

    start() {
        console.log("Starting game...");
        this.sendUpdate(`*** ${this.data.metadata.title} ***\n`);
        this.sendUpdate("Intro:");
        (this.data.intro || []).forEach(introPage => {
            this.sendUpdate(introPage.page);
        });
    }

    // Vypíše popis aktuální lokace + viditelné věci a postavy
    look() {
        console.log("Looking around...");
        if (this.player === null) {
            this.sendUpdate("There is no player character defined.");
            return;
        }
        const locId = this.player.location;
        const loc = this.locations[locId];
        if (!loc) return this.sendUpdate("Neznámá lokace.");

        let d = getDescription(loc.descriptions || [], this);
        this.sendUpdate(d);

        // Položky, které "owner" = lokace a jsou "viditelné"
        if (this.items != null) {
            this.sendUpdate("<p>Vidíš předměty:</p><br>");
        }
        for (let itemId in this.items) {
            const it = this.items[itemId];
            if (it.owner === locId && it.visible !== false) {
                let descr = getDescription(it.descriptions || [], this);
                if (descr) this.sendUpdate(descr);
            }
        }

        // Postavy v této lokaci
        for (let charId in this.characters) {
            const ch = this.characters[charId];
            if (ch.location === locId && ch.id !== "player") {
                // Ten popis se může měnit podle condition
                let cDescr = getDescription(ch.descriptions || [], this);
                if (cDescr) this.sendUpdate(cDescr);
            }
        }
    }

    // Přesun hráče
    go(where) {
        // Najdeme v connections
        const locId = this.player.location;
        const loc = this.locations[locId];
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
        this.player.location = conn.target;
        this.look();
    }

    take(itemName) {
        // Najdi item podle jména nebo id
        let found = Object.values(this.items).find(i => i.name.toLowerCase() === itemName.toLowerCase());
        if (!found) {
            this.sendUpdate("Takový předmět tu není.");
            return;
        }
        // Musí být v aktuální lokaci
        if (found.owner !== this.player.location) {
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
        // OnTake?
        if (found.onTake) {
            for (let action of found.onTake) {
                // Pokud má condition, vyhodnotíme
                if (action.condition) {
                    if (!parseCondition(action.condition, this)) continue;
                }
                this.sendUpdate(action.description);
            }
        } else {
            this.sendUpdate("Vzal jsi to.");
        }
    }

    drop(itemName) {
        // Najdi item, který držíme
        let found = Object.values(this.items).find(
            i => i.name.toLowerCase() === itemName.toLowerCase() && i.owner === "player"
        );
        if (!found) {
            this.sendUpdate("Takový předmět u sebe nemáš.");
            return;
        }
        // Položíme do lokace
        found.owner = this.player.location;
        // onDrop?
        if (found.onDrop) {
            for (let action of found.onDrop) {
                if (action.condition && !parseCondition(action.condition, this)) {
                    continue;
                }
                this.sendUpdate(action.description);
            }
        } else {
            this.sendUpdate("Položil jsi to.");
        }
    }

    use(itemName) {
        // Najdi item, ať už je kdekoliv, hlavně existenci
        let found = Object.values(this.items).find(i => i.name.toLowerCase() === itemName.toLowerCase());
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
                if (!parseCondition(action.condition, this)) continue;
            }
            this.sendUpdate(action.description);
            if (action.set) {
                parseSet(action.set, this);
            }
            usedSomething = true;
            // Možná break? Nebo můžeme nechat projet víc pravidel...
        }
        if (!usedSomething) {
            this.sendUpdate("Nic se nestalo.");
        }
    }

    talk(characterName) {
        // Najdu postavu
        let ch = Object.values(this.characters).find(c => c.name.toLowerCase() === characterName.toLowerCase());
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
                if (!parseCondition(t.condition, this)) continue;
            }
            this.sendUpdate(t.description);
            if (t.set) {
                parseSet(t.set, this);
            }
            spoke = true;
        }
        if (!spoke) {
            this.sendUpdate("Nepodařilo se navázat rozhovor.");
        }
    }

    sendUpdate(message) {
        console.log("Sending update: ", message);
        if (this.win && this.win.webContents) {
            this.win.webContents.send('game-update', message);
            console.log("Message sent.");
        }
        else {
            console.error("Failed to send message: win or webContents is not defined.");
        }
    }
}

function play(gameData, win) {
    const game = new GameEngine(gameData, win);
    game.start();
    game.look();
    console.log("Game play method finished.");
}

module.exports = { play };