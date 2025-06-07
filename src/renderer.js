const information = document.getElementById('info');
information.innerText = `This app is using Chrome (v${window.versions.chrome()}), Node.js (v${window.versions.node()}), and Electron (v${window.versions.electron()})`;

const { ipcRenderer } = window.electron;

const func = async () => {
    const response = await window.versions.ping();
    console.log(response); // prints out 'pong'
};

ipcRenderer.on('set-game-layout', (layoutHtml) => {
    console.log("Handler set-game-layout aktivován, data:",
        layoutHtml ? `délka: ${layoutHtml.length}` : "undefined");
    const gameContent = document.getElementById('game-content');
    if (gameContent) {
        gameContent.innerHTML = layoutHtml;
    } else {
        console.error('Element with id "game-content" not found');
    }
});

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

ipcRenderer.on('clear-output', () => {
    const gameOutput = document.getElementById('game-output');
    if (gameOutput) {
        gameOutput.innerHTML = '';
    } else {
        console.error('Element with id "game-output" not found');
    }
});

ipcRenderer.on('game-update', (data, section) => {
    if (!data && !section) {
        return;
    }
    console.log('Received game-update:', data);

    const targetId = section || 'game-output';
    const outputElement = document.getElementById(targetId);
    if (!outputElement) {
        console.error(`Element with id "${targetId}" not found`);
        return;
    }

    if (section) {
        outputElement.innerHTML = data;
    } else {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = data;
        outputElement.appendChild(wrapper);
        // ensure scrolling occurs after DOM update
        requestAnimationFrame(() => {
            outputElement.scrollTop = outputElement.scrollHeight;
        });
    }
});

ipcRenderer.on('game-command', (event, command) => {
    console.log('Received game-command:', command); // Debugging line
});

document.addEventListener('click', (event) => {
    const target = event.target;

    // Ověř, zda je kliknutý prvek "game-action"
    if (target.classList.contains('game-action')) {
        event.preventDefault();

        const action = target.getAttribute('data-action');
        const param = target.getAttribute('data-param');

        // Pošli akci zpět do hlavního procesu
        window.electron.ipcRenderer.send('game-action', { action, param });
    }
});

func();