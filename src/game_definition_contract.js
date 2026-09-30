const {LAYOUT_SECTIONS} = require('./layout_sections');

function normalizeBoolean(value, defaultValue) {
    if (value === undefined) {
        return defaultValue;
    }
    if (value === true || value === 'true') {
        return true;
    }
    if (value === false || value === 'false') {
        return false;
    }
    return value;
}

function normalizeActions(actions) {
    (actions || []).forEach(action => {
        if (action.description === undefined && action.default !== undefined) {
            action.description = action.default;
        }
        delete action.default;
    });
}

function normalizeGameDefinition(data) {
    data.intro = data.intro || [];
    data.locations = data.locations || [];
    data.items = data.items || [];
    data.characters = data.characters || [];
    data.variables = data.variables || [];
    data.endings = data.endings || [];

    data.items.forEach(item => {
        if (item.owner === undefined) {
            item.owner = item.location === undefined ? null : item.location;
        }
        delete item.location;
        item.visible = normalizeBoolean(item.visible, true);
        item.movable = normalizeBoolean(item.movable, true);
        ['onUse', 'onTake', 'onDrop', 'onSee'].forEach(hook => normalizeActions(item[hook]));
    });
    data.characters.forEach(character => {
        character.visible = normalizeBoolean(character.visible, true);
    });
    data.variables.forEach(variable => {
        variable.value = normalizeBoolean(variable.value, variable.value);
    });
    return data;
}

function collectSetCommands(data) {
    const commands = [];
    data.items.forEach(item => {
        ['onUse', 'onTake', 'onDrop', 'onSee'].forEach(hook => {
            (item[hook] || []).forEach(action => commands.push(action.set));
        });
    });
    data.characters.forEach(character => {
        (character.onTalk || []).forEach(entry => {
            commands.push(entry.set);
            (entry.responses || []).forEach(response => commands.push(response.set));
        });
    });
    data.endings.forEach(ending => {
        (ending.descriptions || []).forEach(description => commands.push(description.set));
    });
    return commands.filter(Boolean);
}

function validateGameDefinitionSemantics(data) {
    const errors = [];
    const ids = new Map();
    const register = (kind, id) => {
        if (ids.has(id)) {
            errors.push(`Duplicate ID "${id}" (${ids.get(id)} and ${kind}).`);
        } else {
            ids.set(id, kind);
        }
    };

    data.locations.forEach(value => register('location', value.id));
    data.items.forEach(value => register('item', value.id));
    data.characters.forEach(value => register('character', value.id));
    data.variables.forEach(value => register('variable', value.id));
    LAYOUT_SECTIONS.forEach(({variableId}) => {
        if (!data.variables.some(variable => variable.id === variableId)) register('system variable', variableId);
    });
    data.endings.forEach(value => register('ending', value.id));

    const players = data.characters.filter(character => character.id === 'player');
    if (players.length !== 1) {
        errors.push(`Expected exactly one player character, found ${players.length}.`);
    }

    const locationIds = new Set(data.locations.map(location => location.id));
    const itemIds = new Set(data.items.map(item => item.id));
    const endingIds = new Set(data.endings.map(ending => ending.id));
    data.locations.forEach(location => {
        (location.connections || []).forEach(connection => {
            if (!locationIds.has(connection.target)) {
                errors.push(`Connection from "${location.id}" references unknown location "${connection.target}".`);
            }
        });
    });
    data.characters.forEach(character => {
        if (!locationIds.has(character.location)) {
            errors.push(`Character "${character.id}" references unknown location "${character.location}".`);
        }
        const entries = character.onTalk || [];
        const entryIds = new Set();
        entries.forEach(entry => {
            if (entry.id && entryIds.has(entry.id)) {
                errors.push(`Duplicate dialogue id "${entry.id}" for character "${character.id}".`);
            }
            if (entry.id) entryIds.add(entry.id);
            if ((entry.responses || []).length && !entry.id) {
                errors.push(`Dialogue with responses for character "${character.id}" is missing an id.`);
            }
        });
        entries.forEach(entry => {
            const responseIds = new Set();
            (entry.responses || []).forEach(response => {
                if (!response.id) errors.push(`Response without id for character "${character.id}".`);
                if (responseIds.has(response.id)) errors.push(`Duplicate response id "${response.id}" in dialogue "${entry.id}".`);
                responseIds.add(response.id);
                if (response.next && !entryIds.has(response.next)) {
                    errors.push(`Response "${response.id}" of character "${character.id}" references unknown dialogue "${response.next}".`);
                }
            });
        });
    });
    data.items.forEach(item => {
        if (item.owner !== null && item.owner !== 'player' && !locationIds.has(item.owner) && !itemIds.has(item.owner)) {
            errors.push(`Item "${item.id}" references unknown owner "${item.owner}".`);
        }
    });
    collectSetCommands(data).forEach(command => {
        const matches = command.matchAll(/(?:^|;)\s*game_end_id\s*=\s*([^;\s]+)/g);
        for (const match of matches) {
            if (!endingIds.has(match[1])) {
                errors.push(`Assignment references unknown ending "${match[1]}".`);
            }
        }
    });

    if (errors.length) {
        throw new Error(errors.join('\n'));
    }
}

module.exports = {normalizeBoolean, normalizeGameDefinition, validateGameDefinitionSemantics};
