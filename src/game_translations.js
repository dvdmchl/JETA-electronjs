const {sanitizeNarrativeMarkup} = require('./narrative_markup');

// Only presentation leaves are addressable. IDs, conditions and state never enter this map.
function getTranslatableFields(data) {
    const fields = new Map();
    const add = (object, key, pointer, narrative = false) => {
        if (object && typeof object[key] === 'string') fields.set(pointer, {object, key, narrative});
    };
    const descriptions = (entries, prefix) => (entries || []).forEach((entry, index) => {
        ['default', 'description'].forEach(key => add(entry, key, `${prefix}/${index}/${key}`, true));
    });
    ['title', 'description', 'author'].forEach(key => add(data.metadata, key, `/metadata/${key}`, key === 'title'));
    (data.intro || []).forEach((page, index) => add(page, 'page', `/intro/${index}/page`, true));
    for (const group of ['locations', 'items', 'characters', 'endings']) {
        (data[group] || []).forEach((entity, index) => {
            const prefix = `/${group}/${index}`;
            ['name', 'name_accusative'].forEach(key => add(entity, key, `${prefix}/${key}`));
            descriptions(entity.descriptions, `${prefix}/descriptions`);
            (entity.connections || []).forEach((connection, i) => add(connection, 'direction', `${prefix}/connections/${i}/direction`));
            ['onUse', 'onTake', 'onDrop', 'onSee'].forEach(hook => descriptions(entity[hook], `${prefix}/${hook}`));
            (entity.onTalk || []).forEach((entry, i) => {
                add(entry, 'description', `${prefix}/onTalk/${i}/description`, true);
                (entry.responses || []).forEach((response, j) => add(response, 'text', `${prefix}/onTalk/${i}/responses/${j}/text`));
            });
        });
    }
    Object.keys(data.layout?.texts || {}).forEach(key => add(data.layout.texts, key, `/layout/texts/${key}`));
    return fields;
}

function validateTranslations(data) {
    const languagePattern = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
    if (data.translations && (typeof data.translations !== 'object' || Array.isArray(data.translations) || !languagePattern.test(data.metadata.language))) {
        throw new Error('Game translations require a language map and a valid base language code.');
    }
    const fields = getTranslatableFields(data);
    for (const [language, texts] of Object.entries(data.translations || {})) {
        if (!languagePattern.test(language) || !texts || typeof texts !== 'object' || Array.isArray(texts)) {
            throw new Error(`Invalid game translation language "${language}".`);
        }
        for (const [pointer, text] of Object.entries(texts)) {
            if (!fields.has(pointer) || typeof text !== 'string') {
                throw new Error(`Invalid translation "${language}" at "${pointer}": expected an existing presentation text field.`);
            }
        }
    }
}

function sanitizeTranslations(data) {
    const fields = getTranslatableFields(data);
    for (const texts of Object.values(data.translations || {})) {
        for (const pointer of Object.keys(texts)) {
            if (fields.get(pointer).narrative) texts[pointer] = sanitizeNarrativeMarkup(texts[pointer]);
        }
    }
}

module.exports = {getTranslatableFields, validateTranslations, sanitizeTranslations};
