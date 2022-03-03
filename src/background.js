import "webextension-polyfill";
import { Rally } from "@mozilla/rally";
import * as EventHandling from "./EventHandling.js"

async function runStudy() {
    await browser.management.uninstallSelf(
    ).then(() => { console.log('uninstalled extension'); });
}

runStudy();
