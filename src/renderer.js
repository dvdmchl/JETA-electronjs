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

ipcRenderer.on('set-language', (event, translations, lang) => {
    console.log(`Setting language to: ${lang}`);
    console.log('Translations:', translations);
    document.documentElement.lang = lang;
    document.getElementById('title').innerText = translations.title;
    document.getElementById('header').innerText = translations.header;
    document.getElementById('description').innerText = translations.description;
});

func();