import "webextension-polyfill";

async function runStudy() {
    await browser.management.uninstallSelf();
}

runStudy();
