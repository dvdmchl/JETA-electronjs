class GameData {

    #data;
    #title;
    #intro;
    #locations;
    #items;
    #characters;
    #vars;
    #player;

    constructor(inputData) {
        this.#data = inputData;
        this.validate();
        this.init();
        this.#title = this.#data.metadata.title;
        this.#intro = this.#data.intro;
        this.#locations = this.#data.locations;
        this.#items = this.#data.items;
        this.#characters = this.#data.characters;
        this.#vars = this.#data.variables;
        this.#player = Object.values(this.#data.characters || []).find(c => c.id === "player");
    }

    get title() {
        return this.#title;
    }

    get intro() {
        return this.#intro;
    }

    get locations() {
        return this.#locations;
    }

    get items() {
        return this.#items;
    }

    get characters() {
        return this.#characters;
    }

    get vars() {
        return this.#vars;
    }

    get player() {
        return this.#player;
    }

    getPlayerLocation() {
        return Object.values(this.#locations).find(l => l.id === this.#player.location);
    }

    validate() {
        // all IDs must be unique
        let ids = new Set();
        let checkId = (id) => {
            if (ids.has(id)) {
                throw new Error(`Duplicate ID: ${id}`);
            }
            ids.add(id);
        };
        // check IDs in data
        if (this.#data.locations) {
            this.#data.locations.forEach(l => checkId(l.id));
        }

        if (this.#data.items) {
            this.#data.items.forEach(i => checkId(i.id));
        }

        if (this.#data.characters) {
            this.#data.characters.forEach(c => checkId(c.id));
        }

        if (this.#data.variables) {
            this.#data.variables.forEach(v => checkId(v.id));
        }
    }

    init() {
        // upravit game data
        // locations zatím neupravovat

        // items - normalizovat owner, visible, movable
        this.normalizeItems(this.#data.items);
        // characters - zatím neupravovat

        // variables - upravit boolean hodnoty
        this.normalizeVars(this.#data.variables);

    }

    normalizeVars(variables) {
        if (!variables) {
            this.#data.variables = [];
            return;
        }
        variables.forEach(v => {
            if (v.value === "true") {
                v.value = true;
            } else if (v.value === "false") {
                v.value = false;
            }
            // ostatní nechat být
        });
    }

    normalizeItems(items) {
        if (!items) {
            this.#data.items = [];
            return;
        }
        items.forEach(item => {
            // Normalizace owner
            if (item.owner === undefined) {
                item.owner = null;
            }
            // Normalizace visible
            if (item.visible === undefined) {
                item.visible = true;
            } else {
                item.visible = item.visible === "true";
            }
            // Normalizace movable
            if (item.movable === undefined) {
                item.movable = true;
            } else {
                item.movable = item.movable === "true";
            }
        });
    }

    getDescription(gameObject) {
        // Najdi v poli descriptions tu, která sedí k condition, jinak vem default
        // Tj. popořadě projdeme a pokud je definována condition, testneme parseCondition
        // Pokud sedí, vrátíme description
        // Pokud nic nesedí, vrátíme default (nebo prázdný string)
        let descrArray = gameObject.descriptions || [];
        let defaultDescr = "";
        for (let d of descrArray) {
            if (d.default !== undefined) {
                defaultDescr = d.default;
                break;
            }
        }
        // Teď zkusíme najít tu s condition
        for (let d of descrArray) {
            if (d.condition) {
                if (this.parseCondition(d.condition)) {
                    return defaultDescr + d.description;
                }
            }
        }
        return defaultDescr || "";
    }

    parseCondition(cond) {
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
            let result = false;
            if (match) {
                const left = match[1].trim();       // Levá strana podmínky
                const operator = match[2].trim();  // Operátor
                const right = match[3].trim();     // Pravá strana podmínky

                // Získání hodnoty levé strany (může to být proměnná, atribut nebo hodnota)
                let leftValue;
                if (this.#vars.hasOwnProperty(left)) {
                    leftValue = this.#vars[left];
                } else {
                    const [itemId, attr] = left.split(':');
                    const item = this.#items[itemId];
                    leftValue = item ? item[attr] : undefined;
                }

                // Získání hodnoty pravé strany (číslo, boolean nebo řetězec)
                let rightValue = isNaN(right) ? (right === "true" ? true : (right === "false" ? false : right)) : parseFloat(right);

                // Porovnání podle operátoru

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
            } else if (this.#vars.hasOwnProperty(c)) {
                // Jednoduchá proměnná (bez operátoru)
                result = this.#vars[c];
            } else {
                // Pokud podmínka obsahuje "item:attr" bez operátorů
                const parts = c.split(':');
                if (parts.length === 2) {
                    const item = this.#items[parts[0]];
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

    parseSet(setCmd) {
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
                const item = this.#items[itemId];
                if (item) {
                    // Nastavíme item[attr] = (right === "true")
                    if (right === 'true') item[attr] = true;
                    else if (right === 'false') item[attr] = false;
                    else item[attr] = right;
                }
            } else {
                // Globální proměnné
                if (game.vars[left] !== undefined) {
                    if (right === 'true') this.#vars[left] = true;
                    else if (right === 'false') this.#vars[left] = false;
                    else game.vars[left] = right;
                }
                // Může být i end_game = true
                if (left === 'end_game' && right === 'true') {
                    this.#data.endGame = true;
                }
            }
        });
    }

    // set variable to gameData
    setValue(pathToVariable, value) {
        let parts = pathToVariable.split(':');
        let object = this.getObjectById(parts[0]);

        for (let i = 1; i < parts.length; i++) {
            if (!object[parts[i]]) {
                if (i != parts.length - 1) {
                    object[parts[i]] = [];
                } else {
                    object[parts[i]] = {};
                }
            }
            object = object[parts[i]];
        }

        // Nastav poslední část na hodnotu
        object[parts[parts.length - 1]] = value;
    }


    getValue(pathToVariable, defaultValue) {
        let parts = pathToVariable.split(':');
        let object = this.getObjectById(parts[0]);
        if (!object) {
            return defaultValue;
        }
        for (let i = 1; i < parts.length; i++) {
            if (!object[parts[i]]) {
                if (i != parts.length - 1) {
                    object[parts[i]] = [];
                } else {
                    object[parts[i]] = {};
                }

            }
            object = object[parts[i]];
        }
        // Pokud poslední část cesty neexistuje, nastavíme defaultní hodnotu
        if (object[parts[parts.length - 1]] === undefined) {
            object[parts[parts.length - 1]] = defaultValue;
        }
        return object[parts[parts.length - 1]];
    }

    getObjectById(id) {
        let object = this.#locations.find(l => l.id === id);
        if (object) return object;
        object = this.#items.find(i => i.id === id);
        if (object) return object;
        object = this.#characters.find(c => c.id === id);
        if (object) return object;
        object = this.#vars.find(v => v.id === id);
        return object;
    }
}

module.exports = GameData;