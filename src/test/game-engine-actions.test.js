jest.mock('electron', () => ({ipcMain: {on: jest.fn()}}));
jest.mock('../debug_window', () => ({sendDebugState: jest.fn()}));

const GameData = require('../game_data');
const {GameEngine} = require('../game_engine');
const {parseGameFile, prepareGameDefinition} = require('../game_definition_loader');

function createGame(overrides = {}) {
    const input = {
        metadata: {title: 'Game', language: 'en'},
        locations: [{id: 'room', name: 'Room', descriptions: [{default: '<p>Room</p>'}], connections: []}],
        items: [],
        characters: [{id: 'player', name: 'Player', location: 'room'}],
        variables: [{id: 'counter', value: 0}],
        endings: [],
        ...overrides
    };
    const sent = [];
    const win = {webContents: {send: (...args) => sent.push(args)}};
    return {data: new GameData(input), engine: new GameEngine(new GameData(JSON.parse(JSON.stringify(input))), win), sent};
}

describe('GameEngine actions and endings', () => {
    test('start without intro renders only the initial location', () => {
        const {engine, sent} = createGame();
        engine.start();
        const location = sent.find(message => message[0] === 'game-update' && message[2] === 'game-location');
        expect(location[1]).toBe('<p>Room</p>');
        expect(location[1]).not.toContain('undefined');
    });

    test('command list excludes the player while keeping visible NPCs', () => {
        const {engine, sent} = createGame({
            characters: [
                {id: 'player', name: 'Player', location: 'room'},
                {id: 'npc', name: 'NPC', location: 'room'}
            ]
        });
        engine.listCommands();
        const characters = sent.find(message => message[0] === 'game-update' && message[2] === 'game-characters');
        expect(characters[1]).toContain('NPC');
        expect(characters[1]).not.toContain('Player');
    });

    test('examining a character without onSee does not execute item hooks or throw', () => {
        const {engine} = createGame({
            characters: [
                {id: 'player', name: 'Player', location: 'room'},
                {id: 'npc', name: 'NPC', location: 'room', descriptions: [{default: '<p>NPC</p>'}]}
            ]
        });
        expect(() => engine.see('npc')).not.toThrow();
        expect(engine.data.getCharacterById('npc').onSee).toBeUndefined();
    });

    test('all item hooks use first-match description and assignment semantics', () => {
        const item = {
            id: 'key', name: 'Key', owner: 'room', descriptions: [{default: '<p>Key</p>'}],
            onTake: [{condition: 'key:owner = room', description: '<p>Taken</p>', set: 'counter = counter + 1'}, {description: 'wrong', set: 'counter = 99'}],
            onDrop: [{condition: 'key:owner = player', description: '<p>Dropped</p>', set: 'counter = counter + 1'}],
            onUse: [{description: '<p>Used</p>', set: 'counter = counter + 1'}],
            onSee: [{description: '<p>Seen</p>', set: 'counter = counter + 1'}]
        };
        const {engine, sent} = createGame({items: [item]});
        engine.take('key');
        engine.drop('key');
        engine.use('key');
        engine.see('key');
        expect(engine.data.getValue('counter')).toBe(4);
        expect(engine.data.items[0].owner).toBe('room');
        expect(sent.flat().join(' ')).toContain('<p>Seen</p>');
        expect(sent.flat().join(' ')).not.toContain('wrong');
    });

    test('conditional connections are hidden and cannot be used until enabled', () => {
        const {engine, sent} = createGame({
            locations: [
                {id: 'room', name: 'Room', descriptions: [{default: '<p>Room</p>'}], connections: [{direction: 'Hall', target: 'hall', condition: 'door_open'}]},
                {id: 'hall', name: 'Hall', descriptions: [{default: '<p>Hall</p>'}], connections: []}
            ],
            variables: [{id: 'door_open', value: false}]
        });

        engine.listCommands();
        expect(sent.find(message => message[2] === 'game-go')[1]).not.toContain('Hall');
        engine.go('hall');
        expect(engine.data.player.location).toBe('room');

        engine.data.setValue('door_open', true);
        engine.listCommands();
        expect(sent.filter(message => message[2] === 'game-go').at(-1)[1]).toContain('Hall');
        engine.go('hall');
        expect(engine.data.player.location).toBe('hall');
    });

    test('immovable items can handle take attempts without changing ownership', () => {
        const {engine, sent} = createGame({
            items: [{
                id: 'safe', name: 'Safe', owner: 'room', movable: false,
                descriptions: [{default: '<p>Heavy.</p>'}],
                onTake: [{description: '<p>Too heavy.</p>'}]
            }]
        });

        engine.listCommands();
        expect(sent.find(message => message[2] === 'game-take')[1]).toContain('Safe');
        engine.take('safe');
        expect(engine.data.items[0].owner).toBe('room');
        expect(sent.flat().join(' ')).toContain('<p>Too heavy.</p>');
    });

    test('ending state changes execute exactly once', () => {
        const {engine} = createGame({
            variables: [{id: 'counter', value: 0}, {id: 'game_end', value: true}, {id: 'game_end_id', value: 'end'}],
            endings: [{id: 'end', descriptions: [{default: '<p>End</p>', set: 'counter = counter + 1'}]}]
        });
        engine.listEndings();
        engine.listEndings();
        expect(engine.data.getValue('counter')).toBe(1);
    });

    test('functional Test sample reaches its dialogue ending with ending-level state changes', () => {
        const {inputData} = parseGameFile('samples/test/Test.yaml');
        const data = new GameData(prepareGameDefinition(inputData));
        const sent = [];
        const engine = new GameEngine(data, {webContents: {send: (...args) => sent.push(args)}});

        engine.go('ložnice');
        engine.use('vypínač');
        engine.see('skříň');
        engine.take('klíče');
        engine.go('kuchyně');
        engine.go('předsíň');
        engine.use('dveře');
        engine.talk('osoba');
        engine.handleDialogChoice({characterId: 'osoba', entryId: 'door_greeting', choiceId: 'deliver_letter'});
        engine.listEndings();

        expect(data.getValue('game_end')).toBe(true);
        expect(data.getValue('game_end_id')).toBe('end_game_1');
        expect(data.getValue('game-location-show')).toBe(true);
        expect(data.getValue('game-drop-show')).toBe(false);
        expect(data.getValue('game-go-show')).toBe(false);
        expect(sent.flat().join(' ')).toContain('game://local/ENDGAME.jpg');
    });

    test('Tux sample completes the legacy puzzle chain', () => {
        const {inputData} = parseGameFile('samples/Tux/Tux.yaml');
        const data = new GameData(prepareGameDefinition(inputData));
        const sent = [];
        const engine = new GameEngine(data, {webContents: {send: (...args) => sent.push(args)}});

        engine.go('Opice');
        engine.take('penezenka');
        engine.go('Automat');
        engine.take('kelimek');
        engine.go('Strom');
        engine.go('Hriste');
        engine.use('kolotoc');
        engine.take('trubka');
        engine.take('kostky');
        engine.go('Obcerstveni');
        engine.use('kelimek');
        engine.go('Zirafy');
        engine.go('Automat');
        engine.go('Klokan');
        engine.use('kelimek_s_olejem');
        engine.go('Automat');
        engine.go('Strom');
        engine.take('klakson');
        engine.go('Automat');
        engine.go('Opice');
        engine.go('PredKralovstvim');
        engine.go('PredKancelari');

        engine.go('UPapoucha');
        expect(data.player.location).toBe('PredKancelari');
        engine.use('trubka');
        engine.go('UPapoucha');
        engine.see('stul');
        engine.use('klakson');

        engine.go('PredKancelari');
        engine.go('PredKralovstvim');
        engine.go('Opice');
        engine.use('buraky');
        engine.go('Automat');
        engine.use('kostky');
        engine.use('mince');
        engine.go('Klokan');
        engine.go('PredKralovstvim');
        engine.go('ZimniKralovstvi');
        engine.talk('beda');
        engine.use('kafe');
        engine.use('sipka');

        engine.go('PredKralovstvim');
        engine.go('Klokan');
        engine.go('Automat');
        engine.go('Zirafy');
        engine.use('pistole_se_sipkou');
        engine.take('stetoskop');
        engine.go('Automat');
        engine.go('Opice');
        engine.go('PredKralovstvim');
        engine.go('PredKancelari');
        engine.go('UPapoucha');
        engine.use('stetoskop');
        engine.listEndings();

        expect(data.getValue('game_end')).toBe(true);
        expect(data.getValue('game_end_id')).toBe('tuxie_search');
        expect(data.getValue('game-go-show')).toBe(false);
        expect(sent.flat().join(' ')).toContain('Tuxie, jdu si pro tebe');
        expect(() => new GameData(JSON.parse(data.toJSON()))).not.toThrow();
    });
});
