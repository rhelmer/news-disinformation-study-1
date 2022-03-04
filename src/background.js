import "webextension-polyfill";

async function runStudy() {
    await browser.management.uninstallSelf(
    ).then(() => { console.log('uninstalled extension'); });
}

runStudy();
