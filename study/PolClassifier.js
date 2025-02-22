/**
 * @module WebScience.Measurements.PolClassifier
 */
/* ngramExports is brought into scope by the importScripts call, tell eslint to ignore it */
/* global ngramExports */
(
    async function() {

        // Classifier state
        let name, featureLabels, coefficients, intercepts, tokenizationParams, idfVector = null;

        /**
         * Handle events from the main thread
         *  init - initialize the classifier
         *  classify - classify new data
         *
         * @param {MessageEvent} event - message
         * @param {MessageEvent.data} event.data - initialization data
         * @listens MessageEvent
         */
        onmessage = event => {
            const pageData = event.data;
            if (pageData.type === "init") {
                name = pageData.name;

                // Parse and store initialization data
                featureLabels = pageData.args.features;
                coefficients = [pageData.args.class0_coefs.split(',').map(i => {return parseFloat(i);}),
                    pageData.args.class1_coefs.split(',').map(i => {return parseFloat(i);}),
                    pageData.args.class2_coefs.split(',').map(i => {return parseFloat(i);})];
                intercepts = [parseFloat(pageData.args.class0_intercept),
                    parseFloat(pageData.args.class1_intercept),
                    parseFloat(pageData.args.class2_intercept)];
                tokenizationParams = {'title': pageData.args.title_tokenization_params,
                    'content': pageData.args.content_tokenization_params,
                    'url': pageData.args.url_tokenization_params};
                idfVector = pageData.args.idf_vector;
            } else if (pageData.type === "classify") {
                sendMessageToCaller("pol-page-classifier",
                    classify(pageData.payload),
                    pageData.payload.url,
                    pageData.payload.pageId
                );
            }
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
         * Send a message to the main thread that spawned this worker thread
         * Each message has a type property for the main thread to handle messages.
         * The data property in the message contains the data object that the worker
         * thread intends to send to the main thread.
         *
         * @param {string} workerId id of the worker
         * @param {Object} data data to be sent
         */
        function sendMessageToCaller(workerId, data, url, pageId) {
            postMessage({
                type: workerId,
                predicted_class: data,
                url: url,
                name: name,
                pageId: pageId
            });
        }

        /**
         * Using a pre-trained model, classify a page based on url, title, and content
         * @param {Object} pageContent - object containing page content
         * @param {string} pageContent.url - page url
         * @param {string} pageContent.title - page title
         * @param {string} pageContent.text - page content as parsed by the readability script
         * @returns {number} class number
         */
        function classify(pageContent) {
            const features = tfidf(getFeaturesFromPage(pageContent.url, pageContent.title, pageContent.text));

            // Predict on a set of features
            // This code block automatically generated by sklearn-porter
            let classIdx = 0,
                classVal = Number.NEGATIVE_INFINITY,
                prob = 0.;
            for (let i = 0, il = intercepts.length; i < il; i++) {
                prob = 0.;
                for (let j = 0, jl = coefficients[0].length; j < jl; j++) {
                    prob += coefficients[i][j] * features[j];
                }
                if (prob + intercepts[i] > classVal) {
                    classVal = prob + intercepts[i];
                    classIdx = i;
                }
            }
            return classIdx;

        }

        /**
         * Process a page into a set of features for our classifier
         * Extract ngrams from the url, title, and content, then generate ngram frequency counts
         * @param {*} url - page url
         * @param {*} title - page title
         * @param {*} content - page content as parsed by the readability script
         * @returns {Object} ngram frequency counts
         */
        function getFeaturesFromPage(url, title, content) {
            self.importScripts("../WebScience/Utilities/Ngrams.js");
            let ngrams = [];

            // Tokenize the title and compute ngrams
            let tokens = tokenizeText(title).map(token => "title__"+token).join(" ");
            let ngramRange = tokenizationParams['title']['ngram_range'].split(/\D/g).filter(t => {
                if (t != ''){
                    return t;
                }
            });
            for (let i = Number(ngramRange[0]); i <= Number(ngramRange[1]); i++) {
                try {
                    ngrams = ngrams.concat(ngramExports.fromSync(tokens,i).map(t => t.join(" ")).flat());
                }
                // it's ok if we don't get ngrams from every source
                catch (err) {
                    // it's ok if we don't get ngrams from every source
                }
            }

            // Tokenize the content and compute ngrams
            tokens = tokenizeText(content).map(token => "content__"+token).join(" ");
            ngramRange = tokenizationParams['content']['ngram_range'].split(/\D/g).filter(t => {
                if (t != ''){
                    return t;
                }
            });
            for (let i = Number(ngramRange[0]); i <= Number(ngramRange[1]); i++) {
                try {
                    ngrams = ngrams.concat(ngramExports.fromSync(tokens,i).map(t => t.join(" ")).flat());
                }
                catch (err) {
                    // it's ok if we don't get ngrams from every source
                }
            }

            // Tokenize the URL and compute ngrams
            // Tokenization: parse the pathname, split on a regex, and lowercase
            const urlRegex = /htm|html|\/|-|_|\.|\?|=|\b[0-9]+\b/ig
            tokens = new URL(url).pathname.split(urlRegex).filter(t => {
                if (t != ''){
                    return t;
                }
            }).map(token => "URL__"+token.toLowerCase()).join(" ");
            ngramRange = tokenizationParams['url']['ngram_range'].split(/\D/g).filter(t => {
                if (t != ''){
                    return t;
                }
            });
            for (let i = Number(ngramRange[0]); i <= Number(ngramRange[1]); i++) {
                try {
                    ngrams = ngrams.concat(ngramExports.fromSync(tokens,i).map(t => t.join(" ")).flat());
                }
                catch (err) {
                    // it's ok if we don't get ngrams from every source
                }
            }
            // Get rid of all ngrams not in the classifier vocabulary, then compute counts
            ngrams = ngrams.filter(n => featureLabels.includes(n));
            const ngramCounts = ngrams.reduce(function (acc, curr) {
                if (typeof acc[curr] == 'undefined') {
                    acc[curr] = 1;
                } else {
                    acc[curr] += 1;
                }

                return acc;
            }, {})

            // Turn the counts into a feature vector (array), adding 0's for features not in this sample
            const featureVector = featureLabels.map(label => {
                if (typeof ngramCounts[label] == 'undefined'){
                    return 0;
                } else {
                    return ngramCounts[label];
                }
            });

            return featureVector;
        }

        /**
         * Using the idf vector from the pre-trained model, convert ngram counts into a tf-idf representation
         * @param {Object} featureVector an array of ngram counts for all ngrams in vocabulary
         */
        function tfidf(featureVector){
            // Compute the frequency of each term and multiply by the model idf for that term
            const numTerms = featureVector.reduce((acc, count) => acc + count)
            const idfFeatures = featureVector.map((curr,index) => {
                return((curr/numTerms) * idfVector[index]);
            })

            // Normalize the TF-IDF representation to an L2 norm of 1
            const l2norm = Math.sqrt(idfFeatures.reduce((sum, x) => sum + Math.pow(x,2)))
            return idfFeatures.map((x) => x/l2norm)
        }

        /**
         * Generate an array of tokens from a string
         * @param {string} text - the string to tokenize
         * @returns {Array} array of tokens
         */
        function tokenizeText(text) {
            let t = text.replace(/'|’/g, "") // Remove apostrophes
            t = t.replace(/[^A-Za-z0-9]+/g, " ") // Replace non-alphanum chars with spaces
            t = t.toLowerCase() // Lowercase all letters
            t = t.split(" ") // Create array
            return t
        }
    }
)();
