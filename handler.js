// http://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html
// http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html

"use strict";
const ViewerRequestInterface = require("./lib/ViewerRequestInterface");
const OriginRequestInterface = require("./lib/OriginRequestInterface");

const prerendercloud = require("prerendercloud");
// if it takes longer than 2.7s, just bail out so we don't return an error
// since Lambda@Edge max duration is 3s (and there seems to be ~300ms of overhead, sometimes more)
prerendercloud.set("timeout", 2700);

// * CONFIGURATION *

// 1. prerenderToken (API token)
//    get it after signing up at https://www.prerender.cloud/
//    note: Lambda@Edge doesn't support env vars, so hardcoding is your only option
// prerendercloud.set('prerenderToken', 'mySecretToken')

// 2. botsOnly
//    generally not recommended due to potential google SEO cloaking penalties no one fully understands
// prerendercloud.set("botsOnly", true);

// 3. removeScriptsTag
//    removes all scripts/JS, useful if you trying to get under 256kb Lambda@Edge limit
// prerendercloud.set('removeScriptTags', true);

// 4. see all configuration options here: https://github.com/sanfrancesco/prerendercloud-nodejs


module.exports.viewerRequest = (event, context, callback) => {
  const cloudFrontRequest = event.Records[0].cf.request;

  prerendercloud.set("beforeRender", (req, done) => {
    // force the middleware to call res.writeHead and res.end immediately
    // instead of the remote prerender. (this allows us to use most of the
    // code from the prerendercloud lib and bail out at last moment)
    done(null, "noop");
  });

  const { req, res, next } = ViewerRequestInterface.create(
    cloudFrontRequest,
    callback
  );

  prerendercloud(req, res, next);
};

module.exports.originRequest = (event, context, callback) => {
  // temporary until timeout function of prerendercloud or got is fixed
  // so it cancels request when timeout is reached
  // https://github.com/sindresorhus/got/issues/344
  // https://github.com/sindresorhus/got/pull/360
  context.callbackWaitsForEmptyEventLoop = false;

  const cloudFrontRequest = event.Records[0].cf.request;
  console.log(cloudFrontRequest);

  const { req, res, next, shouldPrerender } = OriginRequestInterface.create(
    cloudFrontRequest,
    callback
  );

  // we override the prerendercloud lib's default userAgent logic
  // for deciding when to prerender because we've already computed it
  // in the viewer-request, and encoded it into the URI, which is now in the `shouldPrerender` var
  prerendercloud.set("shouldPrerender", () => shouldPrerender);

  prerendercloud(req, res, next);
};
