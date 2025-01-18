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
    game.listCommands();
});


///////////////////////////////////////////
// 2) Pomocné funkce pro engine
///////////////////////////////////////////
function parseCondition(cond, game) {
    // Funkce na parsování a vyhodnocení složených podmínek

    // 1. Pomocné funkce
    const evaluateCondition = (c) => {
        let negation = false;

        // Zpracuj negaci (!)
        if (c.startsWith('!')) {
            negation = true;
            c = c.substring(1).trim();
        }

        // Rozpoznání složitých podmínek s operátory
        const match = c.match(/^(.+?)([><!=]=?|==)(.+)$/);
        if (match) {
            const left = match[1].trim();       // Levá strana podmínky
            const operator = match[2].trim();  // Operátor
            const right = match[3].trim();     // Pravá strana podmínky

            // Získání hodnoty levé strany (může to být proměnná, atribut nebo hodnota)
            let leftValue;
            if (game.vars.hasOwnProperty(left)) {
                leftValue = game.vars[left];
            } else {
                const [itemId, attr] = left.split(':');
                const item = game.items[itemId];
                leftValue = item ? item[attr] : undefined;
            }

            // Získání hodnoty pravé strany (číslo, boolean nebo řetězec)
            let rightValue = isNaN(right) ? (right === "true" ? true : (right === "false" ? false : right)) : parseFloat(right);

            // Porovnání podle operátoru
            let result = false;
            switch (operator) {
                case '>':
                    result = leftValue > rightValue;
                    break;
                case '<':
                    result = leftValue < rightValue;
                    break;
                case '>=':
                    result = leftValue >= rightValue;
                    break;
                case '<=':
                    result = leftValue <= rightValue;
                    break;
                case '!=':
                    result = leftValue != rightValue;
                    break;
                case '=': // Podpora pro jediné "="
                case '==':
                    result = leftValue == rightValue;
                    break;
                default:
                    console.error(`Unsupported operator: ${operator}`);
            }
        } else if (game.vars.hasOwnProperty(c)) {
            // Jednoduchá proměnná (bez operátoru)
            result = game.vars[c];
        } else {
            // Pokud podmínka obsahuje "item:attr" bez operátorů
            const parts = c.split(':');
            if (parts.length === 2) {
                const item = game.items[parts[0]];
                result = item ? !!item[parts[1]] : false;
            }
        }

        return negation ? !result : result;
    };


    const tokenize = (input) => {
        // Tokenizace podmínky: oddělíme závorky, operátory a podmínky
        const regex = /\(|\)|\|\||&&|![^(&&|\|\|)]*|[^(&&|\|\|)\s]+/g;
        return input.match(regex) || [];
    };

    const parseTokens = (tokens) => {
        const stack = [];
        const output = [];

        // Priorita operátorů
        const precedence = {
            '||': 1,
            '&&': 2,
            '!': 3,
        };

        const isOperator = (token) => ['&&', '||', '!'].includes(token);

        for (const token of tokens) {
            if (token === '(') {
                stack.push(token);
            } else if (token === ')') {
                while (stack.length > 0 && stack[stack.length - 1] !== '(') {
                    output.push(stack.pop());
                }
                stack.pop(); // Odstraň '(' ze zásobníku
            } else if (isOperator(token)) {
                while (
                    stack.length > 0 &&
                    precedence[token] <= precedence[stack[stack.length - 1]]
                    ) {
                    output.push(stack.pop());
                }
                stack.push(token);
            } else {
                output.push(token); // Operand
            }
        }

        while (stack.length > 0) {
            output.push(stack.pop());
        }

        return output;
    };

    const evaluateAST = (tokens) => {
        const stack = [];

        for (const token of tokens) {
            if (['&&', '||', '!'].includes(token)) {
                if (token === '!') {
                    const operand = stack.pop();
                    stack.push(!operand);
                } else {
                    const b = stack.pop();
                    const a = stack.pop();
                    if (token === '&&') stack.push(a && b);
                    if (token === '||') stack.push(a || b);
                }
            } else {
                stack.push(evaluateCondition(token));
            }
        }

        return stack[0];
    };

    // 2. Tokenizace
    const tokens = tokenize(cond);

    // 3. Parsování do postfixového zápisu (RPN - Reverse Polish Notation)
    const postfixTokens = parseTokens(tokens);

    // 4. Vyhodnocení
    return evaluateAST(postfixTokens);
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
                return defaultDescr + d.description;
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
                // Defaultní parametry
                owner: it.owner || null,
                visible: it.visible === undefined ? true : (it.visible === "true" ? true : (it.visible === "false" ? false : it.visible)),
                movable: it.movable === undefined ? true : (it.movable === "true" ? true : (it.movable === "false" ? false : it.movable))
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
            if (v.value === "true") {
                this.vars[v.id] = true;
            } else if (v.value === "false") {
                this.vars[v.id] = false;
            } else {
                // Pokud je hodnota jiná než "true" nebo "false", uložíme ji přímo
                this.vars[v.id] = v.value;
            }
        });


        // Najdeme player
        this.player = this.characters["player"] || null;
    }

    start() {
        console.log("Starting game...");
        this.sendUpdate(`${this.data.metadata.title}`);
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
            let itemsInLoc = Object.values(this.items)
                .filter(i => i.owner === locId && i.visible !== false)
                .map(i => i.name);
            let joinItems = itemsInLoc.join(", ");
            if (joinItems === "") joinItems = "nic";
            let items = '<span><b>Předměty: </b></span><span class="game-item">' + joinItems + '</span>';
            this.sendUpdate(items);
        }

        // Postavy v této lokaci
        if (this.characters != null) {
            let charactersInLoc = Object.values(this.characters)
                .filter(ch => ch.location === locId && ch.id !== "player")
                .map(ch =>  ch.name);
            let joinCharacters = charactersInLoc.join(", ");
            if (joinCharacters === "") joinCharacters = "nikdo";
            let characters = '<span><b>Postavy: </b></span><span class="game-character">' + joinCharacters + '</span>';
            this.sendUpdate(characters);
        }
    }

    // prozkoumání objektu
    see(itemId) {

        let foundItem = Object.values(this.items).find(i => i.id === itemId);
        if (!foundItem) {
            this.sendUpdate("Takový předmět tu není.");
            return;
        }

        // Musí být viditelný
        if (foundItem.visible === false) {
            this.sendUpdate("To nevidíš.");
            return;
        }

        this.sendUpdate("Prozkoumáváš " + foundItem.name + ".");

        // Musí být v aktuální lokaci nebo u hráče
        if (foundItem.owner !== this.player.location && foundItem.owner !== "player") {
            this.sendUpdate("Tady nic takového neleží.");
            return;
        }


        let descr = getDescription(foundItem.descriptions || [], this);
        this.sendUpdate(descr);

        // increase onSee count
        let variablePath = foundItem.id + ":onSee:count";
        this.setData(variablePath, this.getData(variablePath, 0) + 1);
        // onSee?
        if (foundItem.onSee) {
            for (let action of foundItem.onSee) {
                // Pokud má condition, vyhodnotíme
                if (action.condition) {
                    if (!parseCondition(action.condition, this)) continue;
                }
                this.sendUpdate(action.description);
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

    listCommands() {
        // add possible commands

        const locId = this.player.location;
        const loc = this.locations[locId];

        // look
        let lookHref = '<a href="#" class="game-action" data-action="look">rozhlédnout se</a>';

        // see
        let itemsInLoc = Object.values(this.items)
            .filter(i => i.owner === locId && i.visible);
        let itemsInInventory = Object.values(this.items)
            .filter(i => i.owner === "player" && i.visible);
        let itemsHrefRow = createItemsHrefRow(itemsInLoc, itemsInInventory);

        // take
        let itemsInLocAndTakeable = itemsInLoc.filter(i => (i.owner === locId) && i.movable);
        let takeHrefRow = createTakeHrefRow(itemsInLocAndTakeable);

        // use
        let itemsForLocAndInventory = Object.values(this.items)
            .filter(i => (i.owner === locId || i.owner === "player") && i.visible);
        let useHrefRow = createUseHrefRow(itemsForLocAndInventory);

        // drop
        let itemsInInventoryAndDropable = Object.values(this.items)
            .filter(i => (i.owner === "player" ) && i.movable && i.visible);
        let dropHrefRow = createDropHrefRow(itemsInInventoryAndDropable);

        // go
        let connectionsForLoc = (loc.connections || []);
        let goHrefRow = createDirectionsHrefRow(connectionsForLoc, this.locations);

        if (itemsHrefRow || goHrefRow) {
            this.sendUpdate("<b>Příkazy:</b>");
            this.sendUpdate(lookHref);
            this.sendUpdate(itemsHrefRow);
            this.sendUpdate(useHrefRow);
            this.sendUpdate(takeHrefRow);
            this.sendUpdate(dropHrefRow);
            this.sendUpdate(goHrefRow);
        }
        this.sendUpdate("<hr>")
    }

    sendUpdate(message) {
        console.log("Sending update: ", message);
        if (this.win && this.win.webContents) {
            this.win.webContents.send('game-update', message);
            console.log("Message sent.");
        } else {
            console.error("Failed to send message: win or webContents is not defined.");
        }
    }

    // set variable to gameData
    setData(pathToVariable, value) {
        let parts = pathToVariable.split(':');
        let current = this.data;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                // Pokud klíč neexistuje, vytvoř ho jako prázdný objekt
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        // Nastav poslední část na hodnotu
        current[parts[parts.length - 1]] = value;
    }


    getData(pathToVariable, defaultValue) {
        let parts = pathToVariable.split(':');
        let current = this.data;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                // Pokud klíč neexistuje, vytvoříme ho jako prázdný objekt
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        // Pokud poslední část cesty neexistuje, nastavíme defaultní hodnotu
        if (current[parts[parts.length - 1]] === undefined) {
            current[parts[parts.length - 1]] = defaultValue;
        }

        // Vrátíme hodnotu
        return current[parts[parts.length - 1]];
    }

}

function createItemsHrefRow(items, itemsInInventory) {
    if (!items || items.length === 0) return "";
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