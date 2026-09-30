const path = require('path');
const {resolveGameAssetPath} = require('../game_protocol');

describe('game asset protocol paths', () => {
    const gameDirectory = path.resolve('samples/test');

    test('resolves canonical and legacy game URLs inside the game directory', () => {
        expect(resolveGameAssetPath(gameDirectory, 'game:///ENDGAME.jpg'))
            .toBe(path.join(gameDirectory, 'ENDGAME.jpg'));
        expect(resolveGameAssetPath(gameDirectory, 'game://images/map.png'))
            .toBe(path.join(gameDirectory, 'images', 'map.png'));
    });

    test('decodes asset names and ignores query strings', () => {
        expect(resolveGameAssetPath(gameDirectory, 'game:///images/my%20map.png?v=1'))
            .toBe(path.join(gameDirectory, 'images', 'my map.png'));
    });

    test('rejects traversal outside the game directory', () => {
        expect(() => resolveGameAssetPath(gameDirectory, 'game:///../secret.txt')).toThrow(/escapes/);
    });
});
