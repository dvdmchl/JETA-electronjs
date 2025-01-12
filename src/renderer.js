const information = document.getElementById('info');
information.innerText = `This app is using Chrome (v${window.versions.chrome()}), Node.js (v${window.versions.node()}), and Electron (v${window.versions.electron()})`;

const { ipcRenderer } = window.electron;

const func = async () => {
    const response = await window.versions.ping();
    console.log(response); // prints out 'pong'
};

ipcRenderer.on('edit-file', (event, filePath) => {
    console.log(`Opening file: ${filePath} in editor.`);
});

ipcRenderer.on('set-language', (translations, lang) => {
    console.log(`Setting language to: ${lang}`);
    console.log('Translations:', translations);
    document.documentElement.lang = lang;
    // document.getElementById('title').innerText = translations.title;
    // document.getElementById('header').innerText = translations.header;
    // document.getElementById('description').innerText = translations.description;
});

document.getElementById('menu-look').addEventListener('click', () => {
    ipcRenderer.send('game-command', 'look');
});

document.getElementById('menu-go').addEventListener('click', () => {
    const direction = prompt('Enter direction:');
    ipcRenderer.send('game-command', `go ${direction}`);
});

ipcRenderer.on('clear-output', () => {
    const gameOutput = document.getElementById('game-output');
    if (gameOutput) {
        gameOutput.innerHTML = '';
    } else {
        console.error('Element with id "game-output" not found');
    }
});

ipcRenderer.on('game-update', (data) => {
    console.log('Received game-update:', data); // Debugging line
    const gameOutput = document.getElementById('game-output');
    // append data to gameOutput as a new DIV element
    if (gameOutput) {
        const newDiv = document.createElement('div');
        newDiv.innerHTML = data;
        gameOutput.appendChild(newDiv);
    } else {
        console.error('Element with id "game-output" not found');
    }

});

ipcRenderer.on('game-command', (event, command) => {
    console.log('Received game-command:', command); // Debugging line
});

func();