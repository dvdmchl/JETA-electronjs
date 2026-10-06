jest.mock('electron', () => ({dialog: {showErrorBox: jest.fn()}}));

const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const GameData = require('../game_data');
const {encryptData} = require('../encryption');
const {parseGameFile, prepareGameDefinition} = require('../game_definition_loader');

function definition() {
    return {
        metadata: {title: 'Test', language: 'en'},
        locations: [{id: 'room', name: 'Room', descriptions: [{default: '<p>Room</p>'}], connections: []}],
        items: [],
        characters: [{id: 'player', name: 'Player', location: 'room'}],
        variables: [],
        endings: []
    };
}

describe('game-definition contract', () => {
    test('normalizes native, legacy, and omitted booleans to serialized booleans', () => {
        const input = definition();
        input.items = [
            {id: 'native', name: 'Native', owner: 'room', visible: true, movable: false, descriptions: []},
            {id: 'legacy', name: 'Legacy', owner: 'room', visible: 'false', movable: 'true', descriptions: []},
            {id: 'defaults', name: 'Defaults', owner: 'room', descriptions: []}
        ];
        input.characters.push({id: 'npc', name: 'NPC', location: 'room', visible: 'false'});
        input.variables.push({id: 'flag', value: 'true'});
        const data = new GameData(input);
        const serialized = JSON.parse(data.toJSON());
        expect(serialized.items.map(item => [item.visible, item.movable])).toEqual([[true, false], [false, true], [true, true]]);
        expect(serialized.characters[1].visible).toBe(false);
        expect(serialized.variables.find(variable => variable.id === 'flag').value).toBe(true);
    });

    test.each([
        ['missing player', data => data.characters = [], /exactly one player/],
        ['multiple players', data => data.characters.push({id: 'player', name: 'Other', location: 'room'}), /Duplicate ID.*exactly one player/s],
        ['duplicate ending id', data => data.endings.push({id: 'room', descriptions: []}), /Duplicate ID/],
        ['collision with a system variable', data => data.items.push({id: 'game-title-show', name: 'Collision', owner: 'room', descriptions: []}), /Duplicate ID/],
        ['broken connection', data => data.locations[0].connections.push({direction: 'Void', target: 'void'}), /unknown location "void"/],
        ['broken character location', data => data.characters[0].location = 'void', /Character "player" references unknown location/],
        ['broken item owner', data => data.items.push({id: 'key', name: 'Key', owner: 'void', descriptions: []}), /unknown owner/],
        ['broken ending reference', data => {
            data.items.push({id: 'key', name: 'Key', owner: 'room', descriptions: [], onUse: [{set: 'game_end_id = void'}]});
        }, /unknown ending/]
    ])('rejects %s before runtime construction', (name, mutate, expected) => {
        const input = definition();
        mutate(input);
        expect(() => prepareGameDefinition(input)).toThrow(expected);
    });

    test('schema rejects unsupported gameplay fields', () => {
        const input = definition();
        input.items.push({id: 'key', name: 'Key', descriptions: [], owner: 'room', typoAction: []});
        expect(() => prepareGameDefinition(input)).toThrow(/additional properties/);
    });

    test('schema accepts conditional connections', () => {
        const input = definition();
        input.locations.push({id: 'hall', name: 'Hall', descriptions: [], connections: []});
        input.locations[0].connections.push({direction: 'Hall', target: 'hall', condition: 'door_open'});
        input.variables.push({id: 'door_open', value: false});
        expect(() => prepareGameDefinition(input)).not.toThrow();
    });

    test('legacy item location only supplies a missing owner and legacy action default is retained', () => {
        const input = definition();
        input.items.push({id: 'key', name: 'Key', descriptions: [], owner: 'player', location: 'room', onTake: [{default: '<p>Taken</p>'}]});
        prepareGameDefinition(input);
        expect(input.items[0].owner).toBe('player');
        expect(input.items[0].location).toBeUndefined();
        expect(input.items[0].onTake[0].description).toBe('<p>Taken</p>');
    });

    test('template, resource indexes, and functional samples form a valid corpus', () => {
        const files = ['resources/game_definition_template.yaml', 'resources/index.yaml', 'samples/test/Test.yaml', 'samples/Tux/Tux.yaml', 'samples/stiny_azerothu/stiny_azerothu.yaml'];
        files.forEach(relativePath => {
            const {inputData} = parseGameFile(path.resolve(relativePath));
            expect(() => new GameData(prepareGameDefinition(inputData))).not.toThrow();
        });
    });

    test('YAML, JSON, and encrypted JSON parse to equivalent definitions', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeta-contract-'));
        const input = definition();
        const yamlPath = path.join(tempDir, 'game.yaml');
        const jsonPath = path.join(tempDir, 'game.json');
        const encryptedPath = path.join(tempDir, 'game.enc');
        fs.writeFileSync(yamlPath, yaml.dump(input));
        fs.writeFileSync(jsonPath, JSON.stringify(input));
        fs.writeFileSync(encryptedPath, `aes\n${encryptData(JSON.stringify(input), 'aes')}`);
        const parsed = [yamlPath, jsonPath, encryptedPath].map(file => parseGameFile(file).inputData);
        expect(parsed[1]).toEqual(parsed[0]);
        expect(parsed[2]).toEqual(parsed[0]);
        fs.rmSync(tempDir, {recursive: true, force: true});
    });
});
