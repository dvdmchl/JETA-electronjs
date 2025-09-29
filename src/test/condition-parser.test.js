const GameData = require('../game_data'); // Import vaší implementace

describe('GameData', () => {
    let gameData;

    beforeEach(() => {
        const inputData = {
            metadata: {
                title: "<h1>Test - Vendova první</h1>",
                author: "",
                version: "0.0.1",
                description: "Tests for jest",
                language: "cs"
            },
            intro: [
                {page: "<p>Dnes ráno jsem se probudil...</p>"},
                {page: "<p>Musím je co nejrychleji najít...</p>"}
            ],
            locations: [
                {
                    id: "kuchyně",
                    name: "Kuchyně",
                    descriptions: [
                        {default: "<p>Jsem v kuchyni...</p>"},
                        {condition: "šálek-čaje:owner = kuchyně", description: "<p>Jen malý šálek čaje...</p>"}
                    ],
                    connections: [
                        {direction: "Předsíň", target: "předsíň"}
                    ]
                },
                {
                    id: "předsíň",
                    name: "Předsíň",
                    descriptions: [
                        {default: "<p>Jsem v předsíni...</p>"}
                    ],
                    connections: [
                        {direction: "Kuchyně", target: "kuchyně"}
                    ]
                },
            ],
            items: [
                {
                    id: "šálek-čaje",
                    name: "Malý šálek čaje",
                    descriptions: [
                        {
                            condition: "šálek-čaje:owner = player && plný_šálek",
                            description: "<p>Tenhle šálek čaje...</p>"
                        },
                        {
                            condition: "šálek-čaje:owner = player && !plný_šálek",
                            description: "<p>Šálek čaje je prázdný...</p>"
                        }
                    ],
                    movable: "true",
                    owner: "kuchyně"
                },
                {
                    id: "klíče",
                    name: "Klíče od auta",
                    descriptions: [
                        {
                            condition: "klíče:owner = kuchyně",
                            description: "<p>Klíče od auta...</p>"
                        }
                    ],
                    movable: "true",
                    owner: "kuchyně"
                }
            ],
            characters: [
                {
                    id: "player",
                    name: "Venda",
                    location: "kuchyně"
                }
            ],
            endings: [
                {
                    id: "end1",
                    descriptions: [
                        {default: "game ending 1"}
                    ]
                }
            ],
            variables: [
                {id: "plný_šálek", value: "true"}
            ]
        };

        gameData = new GameData(inputData);
    });

    test('Evaluate simple conditions', () => {
        expect(gameData.parseCondition('plný_šálek')).toBe(true);
        expect(gameData.parseCondition('!plný_šálek')).toBe(false);
    });

    test('Evaluate conditions with attributes', () => {
        expect(gameData.parseCondition('šálek-čaje:owner = kuchyně')).toBe(true);
        expect(gameData.parseCondition('šálek-čaje:owner != player')).toBe(true);
    });

    test('Evaluate logical AND conditions', () => {
        expect(gameData.parseCondition('šálek-čaje:owner = kuchyně && plný_šálek')).toBe(true);
        expect(gameData.parseCondition('šálek-čaje:owner = kuchyně && !plný_šálek')).toBe(false);
    });

    test('Evaluate logical OR conditions', () => {
        expect(gameData.parseCondition('šálek-čaje:owner = kuchyně || plný_šálek')).toBe(true);
        expect(gameData.parseCondition('šálek-čaje:owner != kuchyně || !plný_šálek')).toBe(false);
    });

    test('Evaluate nested conditions', () => {
        expect(gameData.parseCondition('(šálek-čaje:owner = kuchyně && plný_šálek) || !plný_šálek')).toBe(true);
        expect(gameData.parseCondition('(šálek-čaje:owner != kuchyně && plný_šálek) || !plný_šálek')).toBe(false);
    });

    test('Evaluate more nested conditions', () => {
        expect(gameData.parseCondition('šálek-čaje:owner = kuchyně && klíče:owner != player && plný_šálek')).toBe(true);
    });

    test('Evaluate invalid conditions', () => {
        expect(() => gameData.parseCondition('unknown_variable')).toThrow();
        expect(() => gameData.parseCondition('šálek-čaje:unknown > 10')).toThrow();
    });

    test('Set value to variable and evaluate condition', () => {
        expect(gameData.parseCondition('šálek-čaje:visible = true')).toBe(true);

        gameData.setValue('šálek-čaje:visible', false);
        gameData.setValue('šálek-čaje:owner', 'předsíň');
        gameData.setValue('plný_šálek', false);
        expect(gameData.parseCondition('šálek-čaje:visible = false')).toBe(true);
        expect(gameData.parseCondition('šálek-čaje:owner = předsíň')).toBe(true);
        expect(gameData.parseCondition('plný_šálek')).toBe(false);

        gameData.parseSet('šálek-čaje:visible = true; šálek-čaje:owner = kuchyně; plný_šálek = true');
        expect(gameData.parseCondition('šálek-čaje:visible = true')).toBe(true);
        expect(gameData.parseCondition('šálek-čaje:owner = kuchyně')).toBe(true);
        expect(gameData.parseCondition('plný_šálek')).toBe(true);
    });

    test('parseSet supports arithmetic expressions', () => {
        gameData.setValue('counter', 1);
        gameData.parseSet('counter = counter + 1');
        expect(gameData.getValue('counter')).toBe(2);

        gameData.parseSet('counter = counter - 1');
        expect(gameData.getValue('counter')).toBe(1);

        gameData.setValue('šálek-čaje:onSee:count', 0);
        gameData.parseSet('šálek-čaje:onSee:count = šálek-čaje:onSee:count + 1');
        expect(gameData.getValue('šálek-čaje:onSee:count')).toBe(1);
    });

    test('Set and avaluate onSee:count', () => {
        gameData.setValue('šálek-čaje:onSee:count', 0);
        var t = gameData.getValue('šálek-čaje:onSee:count');
        expect(t).toBe(0);
        expect(gameData.parseCondition('šálek-čaje:onSee:count = 0')).toBe(true);
    });

    test('Read game ending description', () => {
        gameData.setValue('game_end_id', 'end1');
        let endDescription = gameData.getEndDescription();
        expect(endDescription).toBe('game ending 1');
    });
});
