/**
 * @file Script for computing aggregate statistics
 * @module WebScience.Measurements.AggregateStatistics
 */

/**
 * Event handler for messages from the main thread
 * On receiving data, the function computes aggregate statistics and 
 * sends a message back to the caller with the result object.
 * 
 * @param {MessageEvent} event - message object
 * @listens MessageEvent
 */
onmessage = async event => {
    let data = event.data;
    let stats = {};
    Object.entries(data).forEach(entry => {
        let key = entry[0];
        let storageObj = entry[1];
        let aggregrateStats = (key in functionMapping) ? functionMapping[key](storageObj) : {};
        stats[key] = aggregrateStats;
    });
    sendMessageToCaller("stats ", stats);
}

/**
 * Error handler
 * @param {ErrorEvent} event - error object
 * @listens ErrorEvent
 */
onerror = event => {
    console.error(event.message);
}

/**
 * Sends messages to the main thread that spawned this worker thread.
 * Each message has a type property for the main thread to handle messages.
 * The data property in the message contains the data object that the worker
 * thread intends to send to the main thread. 
 * 
 * @param {string} messageType message type
 * @param {Object} data data to be sent
 */
function sendMessageToCaller(messageType, data) {
    postMessage({
        type: messageType,
        data: data
    });
}

function StorageStatistics(setup, compute, gather) {
    this.setup = setup;
    this.compute = compute;
    this.gather = gather;
}

StorageStatistics.prototype.computeStats = function (storageInstance) {
    let stats = this.setup();
    Object.entries(storageInstance).forEach(entry => {
        this.compute(entry, stats);
    });
    return this.gather(stats);
}

/**
 * Functions for computing statistics 
 */

/**
 * The number of seconds in a day.
 * @private
 * @const {number}
 * @default
 */
const _MS_PER_DAY = 1000 * 60 * 60 * 24;
/**
 * Maximum date supported. Used in computing the earliest
 * date from a list of date objects.
 * @private
 * @const {number}
 * @default
 */
const _MAX_DATE = 8640000000000000;

/**
 * Object that maps the type of data and the stats function to apply on 
 * data object of that type.
 * 
 * @private
 * @const {Object}
 * @default
 */
const functionMapping = {
    "WebScience.Measurements.SocialMediaAccountExposure": socialMediaAccountExposureStats,
    "WebScience.Measurements.SocialMediaNewsExposure": socialMediaNewsExposureStats,
    "WebScience.Measurements.PageNavigation": pageNavigationStats,
    "WebScience.Measurements.LinkExposure": linkExposureStats,
    "WebScience.Measurements.SocialMediaLinkSharing": socialMediaLinkSharingStats
}

/**
 * Given an object containing aggregate statistics, the function unwraps the
 * proxy object, copies the values and revokes proxy.
 * @param {Object} statsObj statistics object
 */
function gatherStats(statsObj) {
    let overallStats = {};
    Object.entries(statsObj).forEach(entry => {
        overallStats[entry[0]] = copyDefaultValueObject(entry[1].proxy);
        entry[1].revoke();
    });
    return overallStats;
}

/**
 * Function for computing page navigation statistics
 * @param {Object} pageNavigationStorage page navigation storage object
 */
function pageNavigationStats(pageNavigationStorage) {
    let statsObj = new StorageStatistics(
        () => {
            let stats = {};
            stats.trackedVisitsByDomain = {};

            return stats;
        },
        (entry, stats) => {
            let navObj = entry[1];
            if (navObj.type == "pageVisit") {
                let domain = getDomain(navObj.url);
                var domainIndex = JSON.stringify({domain: domain});
                var domainObj = stats.trackedVisitsByDomain[domainIndex];
                if (!domainObj) {
                    stats.trackedVisitsByDomain[domainIndex] = {};
                    domainObj = stats.trackedVisitsByDomain[domainIndex];
                    domainObj.visitsByReferrer = {};
                }

                var date = new Date(navObj.visitStart);
                var dayOfWeek = date.getDay();
                var hourOfDay = date.getHours();
                var timeOfDay = Math.floor(hourOfDay / 4) * 4;

                var index = JSON.stringify({
                    referrerDomain: getDomain(navObj.referrer),
                    dayOfWeek: dayOfWeek,
                    timeOfDay: timeOfDay,
                    pageCategory: navObj.classification
                });

                var specificObj = domainObj.visitsByReferrer[index];
                if (specificObj) {
                    specificObj.numVisits += 1;
                    specificObj.totalAttention += navObj.attentionDuration;
                    specificObj.laterSharedCount += navObj.laterShared ? 1 : 0;
                    specificObj.prevExposedCount += navObj.prevExposed ? 1 : 0;
                } else {
                    specificObj = {};
                    specificObj.numVisits = 1;
                    specificObj.totalAttention = navObj.attentionDuration;
                    specificObj.laterSharedCount = navObj.laterShared ? 1 : 0;
                    specificObj.prevExposedCount = navObj.prevExposed ? 1 : 0;
                    domainObj.visitsByReferrer[index] = specificObj;
                }
            } else if (navObj.type = "untrackedVisitCount") {
                stats.numUntrackedVisits = navObj.numUntrackedVisits;
            }
        },
        (r) => {
            for (var domain in r.trackedVisitsByDomain) {
                var trackedVisits = r.trackedVisitsByDomain[domain].visitsByReferrer;
                var trackedVisitsArray = Object.entries(trackedVisits).map((pair) => {
                    var entry = JSON.parse(pair[0]);
                    entry.numVisits = pair[1].numVisits;
                    entry.totalAttention = pair[1].totalAttention;
                    entry.prevExposedCount = pair[1].prevExposedCount;
                    entry.laterSharedCount = pair[1].laterSharedCount;
                    return entry;
                });
                r.trackedVisitsByDomain[domain].visitsByReferrer = trackedVisitsArray;
            }
            var domains = r.trackedVisitsByDomain;
            var domainsArray = Object.entries(domains).map((pair) => {
                var entry = JSON.parse(pair[0]);
                entry.numUntrackedVisits = pair[1].numUntrackedVisits;
                entry.trackedVisitsByReferrer = pair[1].visitsByReferrer;
                return entry;
            });
            r.trackedVisitsByDomain = domainsArray;
            return r;
        }
    );
    return statsObj.computeStats(pageNavigationStorage);

}

/**
 * Function for computing link exposure statistics
 * @param {Object} linkExposureStorage page navigation storage object
 */
function linkExposureStats(linkExposureStorage) {
    let statsObj = new StorageStatistics(
        () => {
            let stats = {};
            stats.untrackedLinkExposures = {};
            stats.linkExposures = {};

            return stats;
        },
        (entry, stats) => {
            let exposureObj = entry[1];
            if (exposureObj.type == "linkExposure") {
                var index = JSON.stringify({
                    sourceDomain: getDomain(exposureObj.metadata.location),
                    destinationDomain: getDomain(exposureObj.url),
                    dayOfWeek: (new Date(exposureObj.firstSeen)).getDay(),
                    visThreshold: exposureObj.visThreshold
                });
                if (!(stats.linkExposures[index])) {
                    stats.linkExposures[index] = {
                        numExposures: 1,
                        laterVisitedCount: exposureObj.laterVisited ? 1 : 0
                    };
                } else {
                    current = stats.linkExposures[index];
                    stats.linkExposures[index] = {
                        numExposures: current.numExposures + 1,
                        laterVisitedCount: current.laterVisitedCount + exposureObj.laterVisited ? 1 : 0
                    }
                }
            } else if (exposureObj.type == "numUntrackedUrls") {
                for (var threshold in exposureObj.untrackedCounts) {
                    var thresholdObj = exposureObj.untrackedCounts[threshold];
                    stats.untrackedLinkExposures[thresholdObj.threshold] = 
                        thresholdObj.numUntracked;
                }
            }
        },
        (r) => {
            var exposuresArray = Object.entries(r.linkExposures).map((pair) => {
                var entry = JSON.parse(pair[0]);
                entry.numExposures = pair[1].numExposures;
                entry.laterVisitedCount = pair[1].laterVisitedCount;
                return entry;
            });
            r.linkExposures = exposuresArray;
            return r;
        }
    );
    return statsObj.computeStats(linkExposureStorage);
}


/**
 * Function for computing social media account exposure statistics
 * @param {Object} socialMediaAccountExposureStorage social media account exposure storage
 */
function socialMediaAccountExposureStats(socialMediaAccountExposureStorage) {
    let statsObj = new StorageStatistics(
        () => {
            let stats = {};
            stats.account_posts = objectWithDefaultValue(function () {
                return {
                    platform: "",
                    count: 0
                }
            });
            return stats;
        },
        (entry, stats) => {
            let val = entry[1];
            val.posts.forEach(post => {
                stats.account_posts.proxy[post.account] = {
                    platform: val.platform,
                    count: stats.account_posts.proxy[post.account].count + 1
                }
            });
        },
        gatherStats
    );
    return statsObj.computeStats(socialMediaAccountExposureStorage);
}

/**
 * Function for computing social media news exposure statistics
 * @param {Object} socialMediaNewsExposureStorage social media news exposure storage
 */
function socialMediaNewsExposureStats(socialMediaNewsExposureStorage) {
    let statsObj = new StorageStatistics(
        () => {
            let stats = {};
            stats.source_counts = objectWithDefaultValue();
            return stats;
        },
        (entry, stats) => {
            let val = entry[1];
            stats.source_counts.proxy[val.type] += 1;
        },
        gatherStats
    );
    return statsObj.computeStats(socialMediaNewsExposureStorage);
}

function socialMediaLinkSharingStats(socialMediaLinkSharingStorage) {
    var fbIndex = JSON.stringify({platform: "facebook"});
    var twIndex = JSON.stringify({platform: "twitter"});
    var rdIndex = JSON.stringify({platform: "reddit"});

    let statsObj = new StorageStatistics(
        () => {
            let stats = {};
            stats.linkSharesByPlatform = {}
            stats.linkSharesByPlatform[fbIndex] = {trackedShares: {}, numUntrackedShares: 0};
            stats.linkSharesByPlatform[twIndex] = {trackedShares: {}, numUntrackedShares: 0};
            stats.linkSharesByPlatform[rdIndex] = {trackedShares: {}, numUntrackedShares: 0};

            return stats;
        },
        (entry, stats) => {
            let val = entry[1];
            if (val.type == "numUntrackedShares") {
                stats.linkSharesByPlatform[fbIndex].numUntrackedShares += val.facebook;
                stats.linkSharesByPlatform[twIndex].numUntrackedShares += val.twitter;
                stats.linkSharesByPlatform[rdIndex].numUntrackedShares += val.reddit;
            }
            if (val.type == "linkShare") {
                var platformIndex = "";
                if (val.platform == "facebook") platformIndex = fbIndex;
                if (val.platform == "twitter") platformIndex = twIndex;
                if (val.platform == "reddit") platformIndex = rdIndex;
                var platformObj = stats.linkSharesByPlatform[platformIndex];
                if (!platformObj) {
                    stats.linkSharesByPlatform[platformIndex] = {};
                    platformObj = stats.linkSharesByPlatform[platformIndex];
                }

                var hostname = getHostName(val.url);
                var prevVisitReferrers = val.prevVisitReferrers;
                var visitReferrer = null;
                if (prevVisitReferrers && prevVisitReferrers.length > 0) {
                    visitReferrer = getDomain(prevVisitReferrers[0]);
                }

                var index = JSON.stringify({
                    domain: hostname,
                    classification: val.classification,
                    audience: val.audience,
                    source: val.source,
                    visitReferrer: visitReferrer,
                });
                var specificObj = platformObj.trackedShares[index];
                if (specificObj) {
                    specificObj.trackedSharesCount += 1;
                    specificObj.prevExposedCount += val.prevExposed ? 1 : 0;
                } else {
                    specificObj = {};
                    specificObj.trackedSharesCount = 1;
                    specificObj.prevExposedCount = val.prevExposed ? 1 : 0;
                    platformObj.trackedShares[index] = specificObj;
                }
            }
        },
        (r) => {
            for (var platform in r.linkSharesByPlatform) {
                var trackedShares = r.linkSharesByPlatform[platform].trackedShares;
                var trackedSharesArray = Object.entries(trackedShares).map((pair) => {
                    var entry = JSON.parse(pair[0]);
                    entry.numShares = pair[1];
                    return entry;
                });
                r.linkSharesByPlatform[platform].trackedShares = trackedSharesArray;
            }
            var platforms = r.linkSharesByPlatform;
            var platformsArray = Object.entries(platforms).map((pair) => {
                var entry = JSON.parse(pair[0]);
                entry.numUntrackedShares = pair[1].numUntrackedShares;
                entry.trackedShares = pair[1].trackedShares;
                return entry;
            });
            r.linkSharesByPlatform = platformsArray;
            return r;
        }
    );
    return statsObj.computeStats(socialMediaLinkSharingStorage);
}

/**
 * Gets hostname from a given url string
 * 
 * @param {string} url url string
 * @returns {string|null} hostname in the input url
 */
function getHostName(url) {
    var match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i);
    if (match != null && match.length > 2 && typeof match[2] === 'string' && match[2].length > 0) {
        return match[2];
    }
    return null;
}


/**
 * Gets domain name from a url
 * 
 * @param {string} url url string
 * @returns {string|null} hostname in the input url
 */
function getDomain(url) {
    try {
        var urlObj = new URL(url);
    } catch { return ""; }
    return urlObj.hostname;
    /*
    var hostName = getHostName(url);
    var domain = hostName;
    if (hostName != null) {
        var parts = hostName.split('.').reverse();
        if (parts != null && parts.length > 1) {
            domain = parts[1] + '.' + parts[0];
        }
    }
    return domain;
    */
}


/**
 * Proxy wraps an empty object that intercepts the get function. When a get
 * is attempted with a missing property, the proxy returns the value of empty
 * function instead of undefined value.
 * @param {function} defaultValue - Function that returns a default value
 */
function objectWithDefaultValue(defaultValue = () => {
    return 0
}) {
    return Proxy.revocable({}, {
        get: (obj, property) => (property in obj) ? obj[property] : defaultValue()
    })
}

/**
 * Copies properties from wrapped object into a barebones object
 * @param {Proxy} defaultValueObject - wrapped object
 */
function copyDefaultValueObject(defaultValueObject) {
    let ret = {};
    Object.entries(defaultValueObject).forEach(entry => {
        ret[entry[0]] = entry[1];
    })
    return ret;
}
