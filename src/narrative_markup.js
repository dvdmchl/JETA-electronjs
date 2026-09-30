const ALLOWED_TAGS = new Set([
    'p', 'br', 'hr', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li',
    'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'img'
]);
const GLOBAL_ATTRIBUTES = new Set(['class', 'id', 'title']);

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeAttributes(tag, source) {
    const attributes = [];
    const matcher = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let match;
    while ((match = matcher.exec(source)) !== null) {
        const name = match[1].toLowerCase();
        const value = match[2] ?? match[3] ?? match[4] ?? '';
        if (GLOBAL_ATTRIBUTES.has(name)) {
            attributes.push(`${name}="${escapeHtml(value)}"`);
        } else if (tag === 'img' && (name === 'src' || name === 'alt')) {
            if (name !== 'src' || /^game:\/\/[a-z0-9_./%+\-]+$/i.test(value)) {
                attributes.push(`${name}="${escapeHtml(value)}"`);
            }
        }
    }
    return attributes.length ? ` ${attributes.join(' ')}` : '';
}

function sanitizeNarrativeMarkup(markup) {
    if (markup === null || markup === undefined) return '';
    return String(markup).replace(/<\/?([a-z][a-z0-9-]*)([^>]*)>/gi, (whole, rawTag, rawAttributes) => {
        const tag = rawTag.toLowerCase();
        if (!ALLOWED_TAGS.has(tag)) return escapeHtml(whole);
        if (whole.startsWith('</')) return `</${tag}>`;
        const suffix = /\/\s*>$/.test(whole) ? ' /' : '';
        return `<${tag}${sanitizeAttributes(tag, rawAttributes)}${suffix}>`;
    });
}

function sanitizeGameDefinitionNarrative(data) {
    if (data.metadata) data.metadata.title = sanitizeNarrativeMarkup(data.metadata.title);
    (data.intro || []).forEach(page => page.page = sanitizeNarrativeMarkup(page.page));
    [...(data.locations || []), ...(data.items || []), ...(data.characters || []), ...(data.endings || [])]
        .forEach(object => (object.descriptions || []).forEach(description => {
            if (description.default !== undefined) description.default = sanitizeNarrativeMarkup(description.default);
            if (description.description !== undefined) description.description = sanitizeNarrativeMarkup(description.description);
        }));
    (data.items || []).forEach(item => ['onUse', 'onTake', 'onDrop', 'onSee'].forEach(hook => {
        (item[hook] || []).forEach(action => {
            if (action.description !== undefined) action.description = sanitizeNarrativeMarkup(action.description);
            if (action.default !== undefined) action.default = sanitizeNarrativeMarkup(action.default);
        });
    }));
    (data.characters || []).forEach(character => (character.onTalk || []).forEach(entry => {
        if (entry.description !== undefined) entry.description = sanitizeNarrativeMarkup(entry.description);
    }));
    return data;
}

module.exports = {escapeHtml, sanitizeNarrativeMarkup, sanitizeGameDefinitionNarrative};
