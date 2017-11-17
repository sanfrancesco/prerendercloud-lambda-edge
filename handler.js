// http://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html
// http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html

"use strict";
const ViewerRequestInterface = require("./lib/ViewerRequestInterface");
const OriginRequestInterface = require("./lib/OriginRequestInterface");

const prerendercloud = require("prerendercloud");
const resetPrerenderCloud = () => {
  prerendercloud.resetOptions();

  // if it takes longer than 2.5s, just bail out so we don't return an error
  // since Lambda@Edge max duration is 3s (and there seems to be ~300ms of overhead, sometimes more)
  prerendercloud.set("timeout", 2500);

  // don't bother with retries since we only have 2.5s
  prerendercloud.set("retries", 0);

  // * CONFIGURATION *

  // 1. prerenderToken (API token)
  //    get it after signing up at https://www.prerender.cloud/
  //    note: Lambda@Edge doesn't support env vars, so hardcoding is your only option
  // prerendercloud.set("prerenderToken", "mySecretToken")

  // 2. protocol (optional, default is http, so set this if your origin is https only)
  //    use this to force http or https instead of attempts to auto-detect it
  //    useful if your origin is either http or https only
  // prerendercloud.set("protocol", "http");

  // 3. host (mandatory)
  //    use this to force prerender.cloud to visit a certain host,
  //    instead of inferring it from the environment. This is especially important
  //    because in Lambda@Edge, the only host it can infer is the S3 origin
  //    e.g.: d1pxreml448ujs.cloudfront.net or example.com (don't include the protocol)
  // prerendercloud.set("host", "");

  // 4. removeTrailingSlash (recommended)
  //    removes trailing slash from URLs to increase prerender.cloud server cache hit rate
  //    the only reason not to enable this is if you use "strict routing"
  //    that is, you treat /docs/ differently than /docs (trailing slash) which is rare
  // prerendercloud.set("removeTrailingSlash", true);

  // 5. botsOnly
  //    generally not recommended due to potential google SEO cloaking penalties no one fully understands
  // prerendercloud.set("botsOnly", true);

  // 6. removeScriptsTag
  //    removes all scripts/JS, useful if you trying to get under 256kb Lambda@Edge limit
  //    but this also means you're app will no longer be a "single-page app" since
  //    all of the JavaScript will be gone (so we don't recommend this)
  // prerendercloud.set("removeScriptTags", true);

  // 7. see all configuration options here: https://github.com/sanfrancesco/prerendercloud-nodejs

  // for tests
  if (prerenderCloudOption) prerenderCloudOption(prerendercloud);
};

module.exports.viewerRequest = (event, context, callback) => {
  resetPrerenderCloud();

  const cloudFrontRequest = event.Records[0].cf.request;
  console.log(JSON.stringify(cloudFrontRequest));

  prerendercloud.set("beforeRender", (req, done) => {
    // FYI: if this block is called, it means we shouldPrerender

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
  resetPrerenderCloud();

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

// for tests
var prerenderCloudOption;
module.exports.setPrerenderCloudOption = cb => {
  prerenderCloudOption = cb;
};

// for validation
module.exports.resetPrerenderCloud = resetPrerenderCloud;
