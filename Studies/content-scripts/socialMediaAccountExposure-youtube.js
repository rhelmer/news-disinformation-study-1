/**
 * Content script for measuring exposure to videos from known channels on youtube
 * @module WebScience.Studies.SocialMediaAccountExposure
 */
(
    async function () {

        let privateWindowResults = await browser.storage.local.get("WebScience.Studies.SocialMediaAccountExposure.privateWindows");
        if (("WebScience.Studies.SocialMediaAccountExposure.privateWindows" in privateWindowResults) &&
            !privateWindowResults["WebScience.Studies.SocialMediaAccountExposure.privateWindows"] &&
            browser.extension.inIncognitoContext) {
            return;
        }

        let channelsRegex = await browser.storage.local.get("knownMediaChannelMatcher");
        const knownMediaChannelMatcher = channelsRegex.knownMediaChannelMatcher;

        /** @constant {number} milliseconds */
        const waitMs = 2000;
        /** listener for new videos loaded; youtube doesn't reload page. It uses history api. */
        document.body.addEventListener("yt-navigate-finish", function (event) {
            setTimeout(checkChannel, waitMs);
        });

        /** sleep and then check for news video */
        setTimeout(checkChannel, waitMs);
        /**
         * @function
         * @name checkChannel function checks if the current webpage has youtube watch/embed url
         * for valid youtube videos, it checks if the video category is News & Politics
         * NOTE : if the inner html doesn't contain News & Politics, then the function
         * clicks on Show More and then checks DOM for video category
         */
        function checkChannel() {
            let domLinkElements = Array.from(document.body.querySelectorAll("a[href]"));
            if (domLinkElements.length > 0) {
                sendYoutubeChannelExposureEvent([...new Set(domLinkElements.filter(domLinkElement => knownMediaChannelMatcher.test(domLinkElement.href)).map(domLinkElement => {
                    return domLinkElement.href;
                }))]);
            }
        }
        /**
         * 
         * @param {Array} channels - channels exposed
         */
        function sendYoutubeChannelExposureEvent(channels) {
            browser.runtime.sendMessage({
                type: "WebScience.Studies.SocialMediaAccountExposure",
                posts: [{
                    post: document.location.href,
                    account: channels[0]
                }],
                platform: "YouTube"
            });
        }
    }
)();