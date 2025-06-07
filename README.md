# JETA 
**Javascript Engine for Text Adventures**

## Overview
JETA (Javascript Engine for Text Adventures) is a powerful and flexible engine for creating text-based adventure games using JavaScript. It provides a framework for building interactive fiction with ease.

## Features
- Simple and intuitive API
- Support for complex game logic
- Easily extendable with custom modules
- Cross-platform compatibility

## Installation
To install and run JETA, use npm:

```sh
npm install
npm run start

```

## Game Definition Files

Games are described in YAML files. A template is located in
`resources/game_definition_template.yaml` and a complete example can be found in
`samples/test/Test.yaml`.  The JSON schema in
`resources/game_definition_schema.json` outlines the base structure.

### Top-level Sections

* **metadata** – required information about the game (title, language, author,…)
* **intro** – optional array of pages shown before the game starts
* **endings** – optional list of game endings
* **locations** – places the player can visit
* **items** – objects that can be taken or interacted with
* **characters** – non‑player characters including the player
* **quests** – optional quests for the player
* **variables** – list of custom variables used in conditions

### Example

```yaml
metadata:
  title: "Example Game"
  author: "Author"
  version: "0.0.1"
  description: "Short description of the game"
  language: "en"

intro:
  - page: "<p>Welcome to the game.</p>"

endings:
  - id: "end_game_1"
    descriptions:
      - default: "<p>The end.</p>"

locations:
  - id: "kitchen"
    name: "Kitchen"
    descriptions:
      - default: "<p>You are in the kitchen.</p>"
    connections:
      - direction: "Hall"
        target: "hall"
        
   - id: "hall"
    name: "Hall"
    descriptions:
      - default: "<p>You are in the hall.</p>"
    connections:
      - direction: "Kitchen"
        target: "kitchen"

items:
  - id: "cup"
    name: "Cup of Tea"
    movable: "true"
    owner: "kitchen"
    descriptions:
      - default: "<p>A small cup of tea.</p>"
    onUse:
      - condition: "cup:owner = player && cup_empty = false"
        description: "<p>You drink the tea.</p>"
        set: "cup_empty = true"
      - condition: "cup:owner = player && cup_empty = true"
        description: "<p>The cup is empty.</p>"
        
   - id: "swich"
    name: "Endgame Switch"
    movable: "false"
    owner: "hall"
    descriptions:
      - default: "<p>Switch to end the game.</p>"
    onUse:
      - condition: "switch:visible = true"
        description: "<p>You turn the light on.</p>"
        set: "game_end = true; game_end_id=end_game_1"

characters:
  - id: "player"
    name: "Player"
    location: "kitchen"

variables:
  - id: "cup_empty"
    value: "false"