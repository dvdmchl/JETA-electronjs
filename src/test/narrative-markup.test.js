const {sanitizeNarrativeMarkup} = require('../narrative_markup');

describe('safe narrative markup', () => {
    test('preserves documented formatting and local game assets', () => {
        expect(sanitizeNarrativeMarkup('<p><strong>Safe</strong><img src="game://local/images/map.png" alt="Map"></p>'))
            .toBe('<p><strong>Safe</strong><img src="game://local/images/map.png" alt="Map"></p>');
    });

    test('neutralizes executable markup and external assets', () => {
        const result = sanitizeNarrativeMarkup('<script>alert(1)</script><p onclick="run()">Text</p><img src="https://example.com/x" onerror="run()">');
        expect(result).toContain('&lt;script&gt;');
        expect(result).not.toContain('onclick');
        expect(result).not.toContain('onerror');
        expect(result).not.toContain('https://');
    });
});
