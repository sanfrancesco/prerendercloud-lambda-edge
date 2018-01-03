// http://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html
// http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html
// http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html#limits-lambda-at-edge

"use strict";
const ViewerRequestInterface = require("./lib/ViewerRequestInterface");
const OriginRequestInterface = require("./lib/OriginRequestInterface");

const prerendercloud = require("prerendercloud");
const resetPrerenderCloud = () => {
  prerendercloud.resetOptions();

  // default prerender.cloud timeout is 10s
  //   - so if it takes longer than 11s, either prerender.cloud is down or backed up
  // max Lambda@Edge timeout is 30s
  prerendercloud.set("retries", 1);
  prerendercloud.set("timeout", 11000);

  // * CONFIGURATION *

  // 1. prerenderToken (API token, you'll be rate limited without it)
  //    Get it after signing up at https://www.prerender.cloud/
  //    note: Lambda@Edge doesn't support env vars, so hardcoding is your only option.
  // prerendercloud.set("prerenderToken", "mySecretToken")

  // 2. protocol (optional, default is https)
  //    use this to force a certain protocol for requests from service.prerender.cloud to your origin
  //    example use case: if your origin is http only
  // prerendercloud.set("protocol", "http");

  // 3. host (mandatory)
  //    Set this to your CloudFront distribution URL (or whatever your official host is).
  //    This is what service.prerender.cloud will prerender, and if we didn't
  //    set it, the only info we'd have access to during Lambda@Edge runtime is the host of the origin (S3)
  //    which would require additional configuration to make it publicly accessible (and it just makes things more confusing).
  //    example value: d1pxreml448ujs.cloudfront.net or example.com (don't include the protocol)
  // prerendercloud.set("host", "");

  // 4. removeTrailingSlash (recommended)
  //    Removes trailing slash from URLs to increase prerender.cloud server cache hit rate
  //    the only reason not to enable this is if you use "strict routing"
  //    that is, you treat /docs/ differently than /docs (trailing slash) which is rare
  // prerendercloud.set("removeTrailingSlash", true);

  // 5. botsOnly
  //    generally not recommended due to potential google SEO cloaking penalties no one fully understands
  // prerendercloud.set("botsOnly", true);

  // 6. removeScriptsTag (not recommended)
  //    Removes all scripts/JS, useful if:
  //      - trying to get under 1MB Lambda@Edge limit
  //      - having problems with your JS app taking over from the pre-rendered content
  //    Huge caveat: this also means your app will no longer be a "single-page app" since
  //    all of the JavaScript will be gone
  // prerendercloud.set("removeScriptTags", true);

  // 7. disableServerCache
  //    Disable the cache on prerender.cloud (default is enabled with 5 minute duration).
  //    It probably makes sense to disable the prerender.cloud server cache
  //    since CloudFront is caching things for you.
  //    Pros/Cons of disabling prerender.cloud server cache:
  //      Pros
  //        - when you invalidate CloudFront, the next page load will be guaranteed fresh
  //      Cons
  //        - when you invalid CloudFront each page load will require a new prerender call
  //          (so if you regularly invalidate even if the content hasn't changed, you're slowing
  //           things down unnecessarily)
  // prerendercloud.set('disableServerCache', true);

  // 8. see all configuration options here: https://github.com/sanfrancesco/prerendercloud-nodejs

  // for tests
  if (prerenderCloudOption) prerenderCloudOption(prerendercloud);
};

module.exports.viewerRequest = (event, context, callback) => {
  resetPrerenderCloud();

  const cloudFrontRequest = event.Records[0].cf.request;
  console.log("viewerRequest", JSON.stringify(cloudFrontRequest));

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
  console.log("originRequest", JSON.stringify(cloudFrontRequest));

  const { req, res, next, shouldPrerender } = OriginRequestInterface.create(
    cloudFrontRequest,
    callback
  );

  // we override the prerendercloud lib's default userAgent logic
  // for deciding when to prerender because we've already computed it
  // in the viewer-request, and encoded it into the URI, which is now in the `shouldPrerender` var
  prerendercloud.set("shouldPrerender", () => shouldPrerender);

  console.log("originRequest calling service.prerender.cloud:", {
    host: req.headers.host,
    url: req.url
  });

  prerendercloud(req, res, next);
};

// for tests
var prerenderCloudOption;
module.exports.setPrerenderCloudOption = cb => {
  prerenderCloudOption = cb;
};

// for validation
module.exports.resetPrerenderCloud = resetPrerenderCloud;
