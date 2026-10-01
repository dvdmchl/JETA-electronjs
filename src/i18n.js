const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const path = require('path');

i18next.use(Backend).init({
    lng: 'en', // default language
    fallbackLng: 'en',
    resources: {
        en: {translation: require('../locales/en.json')},
        cs: {translation: require('../locales/cs.json')}
    },
    partialBundledLanguages: true,
    backend: {
        loadPath: path.join(__dirname, '../locales/{{lng}}.json')
    }
});

module.exports = i18next;
