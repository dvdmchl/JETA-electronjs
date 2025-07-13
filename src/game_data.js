class GameData {

    #data;
    #title;
    #intro;
    #locations;
    #items;
    #characters;
    #vars;
    #player;
    #endings

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
        this.#endings = this.#data.endings;
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

    get endings() {
        return this.#endings;
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
        // Rozdělí řetězec pouze na logické operátory a závorky.
        const tokenize = (input) => {
            return input.split(/(\(|\)|&&|\|\|)/)
                .map(t => t.trim())
                .filter(t => t !== '');
        };

        // Převod do postfix notace (RPN) pomocí shunting-yard algoritmu.
        const parseTokens = (tokens) => {
            const output = [];
            const stack = [];
            const precedence = {'&&': 2, '||': 1};
            const isOperator = token => token === '&&' || token === '||';

            tokens.forEach(token => {
                if (token === '(') {
                    stack.push(token);
                } else if (token === ')') {
                    while (stack.length && stack[stack.length - 1] !== '(') {
                        output.push(stack.pop());
                    }
                    if (stack.length === 0) {
                        throw new Error("Nesouhlas závorek");
                    }
                    stack.pop(); // odstraníme "("
                } else if (isOperator(token)) {
                    while (
                        stack.length &&
                        isOperator(stack[stack.length - 1]) &&
                        precedence[token] <= precedence[stack[stack.length - 1]]
                        ) {
                        output.push(stack.pop());
                    }
                    stack.push(token);
                } else {
                    output.push(token);
                }
            });
            while (stack.length) {
                const op = stack.pop();
                if (op === '(' || op === ')') throw new Error("Nesouhlas závorek");
                output.push(op);
            }
            return output;
        };

        // Vyhodnocení atomické podmínky, např. "plný_šálek" nebo "šálek-čaje:owner = kuchyně".
        const evaluateAtomic = (atom) => {
            let c = atom.trim();
            let negation = false;
            while (c.startsWith('!')) {
                negation = !negation;
                c = c.substring(1).trim();
            }
            // Hledáme operátor (>, <, >=, <=, !=, = nebo ==)
            const operatorMatch = c.match(/^(.+?)([><!]=|[><=]|==)(.+)$/);
            let result;
            if (operatorMatch) {
                const leftStr = operatorMatch[1].trim();
                const operator = operatorMatch[2].trim();
                const rightStr = operatorMatch[3].trim();

                let leftValue;
                if (leftStr.includes(':')) {
                    // Rozdělíme leftStr na všechny části a projdeme je
                    const parts = leftStr.split(':');
                    let obj = this.getObjectById(parts[0]);
                    if (!obj) throw new Error(`Neznámá položka: ${parts[0]}`);
                    for (let i = 1; i < parts.length; i++) {
                        if (!(parts[i] in obj)) {
                            throw new Error(`Neznámý atribut: ${parts[i]} v ${parts[0]}`);
                        }
                        obj = obj[parts[i]];
                    }
                    leftValue = obj;
                } else {
                    const varObj = this.getObjectById(leftStr);
                    if (!varObj || !('value' in varObj))
                        throw new Error(`Neznámá proměnná: ${leftStr}`);
                    leftValue = varObj.value;
                }

                let rightValue = isNaN(rightStr)
                    ? (rightStr === "true" ? true : (rightStr === "false" ? false : rightStr))
                    : parseFloat(rightStr);

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
                    case '=':
                    case '==':
                        result = leftValue == rightValue;
                        break;
                    default:
                        throw new Error(`Nepodporovaný operátor: ${operator}`);
                }
            } else {
                // Pokud není nalezen žádný operátor, předpokládáme, že jde o proměnnou nebo atribut.
                let value;
                if (c.includes(':')) {
                    const parts = c.split(':');
                    let obj = this.getObjectById(parts[0]);
                    if (!obj) throw new Error(`Neznámá položka: ${parts[0]}`);
                    for (let i = 1; i < parts.length; i++) {
                        if (!(parts[i] in obj)) {
                            throw new Error(`Neznámý atribut: ${parts[i]} v ${parts[0]}`);
                        }
                        obj = obj[parts[i]];
                    }
                    value = !!obj;
                } else {
                    const varObj = this.getObjectById(c);
                    if (!varObj || !('value' in varObj))
                        throw new Error(`Neznámá proměnná: ${c}`);
                    value = varObj.value;
                }
                result = value;
            }
            return negation ? !result : result;
        };

        // Vyhodnocení postfixového zápisu.
        const evaluateAST = (postfixTokens) => {
            const stack = [];
            postfixTokens.forEach(token => {
                if (token === '&&' || token === '||') {
                    if (stack.length < 2) throw new Error("Neplatný výraz");
                    const b = stack.pop();
                    const a = stack.pop();
                    stack.push(token === '&&' ? (a && b) : (a || b));
                } else {
                    stack.push(evaluateAtomic(token));
                }
            });
            if (stack.length !== 1) throw new Error("Neplatný výraz");
            return stack[0];
        };

        const tokens = tokenize(cond);
        const postfixTokens = parseTokens(tokens);
        return evaluateAST(postfixTokens);
    }


    parseSet(setCmd) {
        // rozdělíme příkazy středníkem
        let parts = setCmd.split(';');
        parts.forEach(cmd => {
            let trimmed = cmd.trim();
            if (!trimmed) return;
            let [left, right] = trimmed.split('=');
            if (!right) return;
            left = left.trim();
            right = right.trim();

            let value;
            if (right === 'true') value = true;
            else if (right === 'false') value = false;
            else value = right;

            this.setValue(left, value);
        });
    }


    // set variable to gameData
    setValue(pathToVariable, value) {
        let parts = pathToVariable.split(':');
        // when len of parts is on then pathToVariable can be a variable
        if (parts.length === 1) {
            this.setVariableValue(parts[0], value);
            return;
        }
        const lastKey = parts.pop();
        let object = this.getObjectById(parts[0]);
        for (let i = 1; i < parts.length; i++) {
            if (object[parts[i]] === undefined) {
                object[parts[i]] = {};
            }
            object = object[parts[i]];
        }
        object[lastKey] = value;
    }

    setVariableValue(variableId, value) {
        let varObj = this.getObjectById(variableId);
        if (!varObj) {
            this.#vars.push({id: variableId, value: value});
            return;
        }
        varObj.value = value;
    }


    getValue(pathToVariable, defaultValue) {
        const parts = pathToVariable.split(':');
        // when len of parts is on then pathToVariable can be a variable
        if (parts.length === 1) {
            return this.getVariableValue(parts[0], defaultValue);
        }
        let object = this.getObjectById(parts[0]);
        if (!object) return defaultValue;

        // Projdeme všechny části kromě poslední.
        for (let i = 1; i < parts.length - 1; i++) {
            if (object[parts[i]] === undefined) {
                object[parts[i]] = {};
            }
            object = object[parts[i]];
        }

        const lastKey = parts[parts.length - 1];
        if (object[lastKey] === undefined) {
            object[lastKey] = defaultValue;
        }
        return object[lastKey];
    }

    getVariableValue(variableId, defaultValue) {
        let varObj = this.getObjectById(variableId);
        if (!varObj) return defaultValue;
        return varObj.value;
    }


    getObjectById(id) {
        let object = this.#locations.find(l => l.id === id);
        if (object) return object;

        object = this.#items.find(i => i.id === id);
        if (object) return object;

        object = this.#characters.find(c => c.id === id);
        if (object) return object;

        object = this.#endings.find(e => e.id === id);
        if (object) return object;

        object = this.#vars.find(v => v.id === id);
        return object;
    }

    gameEnd() {
        let endObject = this.getObjectById("end_game");
        return endObject;
    }

    getEndDescription() {
        let gameEndId = this.getValue("game_end_id", null);
        if (!gameEndId) return null;
        let end = this.getObjectById(gameEndId);
        return this.getDescription(end);
    }

    toJSON() {
        return JSON.stringify(this.#data, null, 2);
    }
}

module.exports = GameData;