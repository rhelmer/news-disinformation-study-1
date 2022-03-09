import "webextension-polyfill";

async function runStudy() {
    browser.management.uninstallSelf();
    console.log('uninstalled extension');
}

runStudy();
