/**
 * Provides indexedStorage objects for the data stored by the study.
 * Listing these in an external file allows them to be shared by the
 * background page and the analysis script/
 */

import * as indexedStorage from "./indexedStorage.js"

export const storageClassifications = new indexedStorage.indexedStorage(
    "newsAndDisinfo.classifications", {classResults: "++,url,pageId"});

export const storagePN = new indexedStorage.indexedStorage(
    "newsAndDisinfo.pageNavigation", {
        pageVisits: "++, pageId, url, pageVisitStartTime",
    });
storagePN.setTimeKey("pageVisitStartTime");

export const storageSMLS = new indexedStorage.indexedStorage(
    "newsAndDisinfo.socialMediaLinkSharing", {
        linkShares:"shareId++, url, shareTime",
    });
storageSMLS.setTimeKey("shareTime");

export const storageLE = new indexedStorage.indexedStorage(
    "newsAndDisinfo.linkExposure", {
        linkExposures: "exposureId++, url, firstSeen",
    });
storageLE.setTimeKey("firstSeen");

export const storageTransitions = new indexedStorage.indexedStorage(
    "newsAndDisinfo.pageTransitions", {
        transitions: "++, pageId",
    });
