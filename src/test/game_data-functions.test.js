const GameData = require('../game_data');

describe('GameData utility methods', () => {
    let data;
    beforeEach(() => {
        const input = {
            metadata: { title: 'Test', language: 'en' },
            intro: [],
            locations: [
                {
                    id: 'room1',
                    name: 'Room 1',
                    descriptions: [
                        { default: '<p>Default room</p>' },
                        { condition: 'key:owner = player', description: '<p>Key is here</p>' }
                    ],
                    connections: []
                }
            ],
            items: [
                {
                    id: 'key',
                    name: 'Key',
                    descriptions: [{ default: '<p>Key desc</p>' }],
                    owner: 'room1',
                    movable: 'true'
                }
            ],
            characters: [
                { id: 'player', name: 'Player', location: 'room1' }
            ],
            variables: []
        };
        data = new GameData(input);
    });

    test('getDescription reacts to conditions', () => {
        const loc = data.locations[0];
        // key not owned by player yet
        expect(data.getDescription(loc)).toBe('<p>Default room</p>');
        data.setValue('key:owner', 'player');
        expect(data.getDescription(loc)).toBe('<p>Default room</p><p>Key is here</p>');
    });

    test('toJSON returns parseable string', () => {
        const json = data.toJSON();
        const parsed = JSON.parse(json);
        expect(parsed.metadata.title).toBe('Test');
    });
});
