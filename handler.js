// http://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html
// http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html
// http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html#limits-lambda-at-edge

"use strict";
const ViewerRequestInterface = require("./lib/ViewerRequestInterface");
const OriginRequestInterface = require("./lib/OriginRequestInterface");

const prerendercloud = require("prerendercloud");

const origSet = prerendercloud.set;
let cachedOptions = {};
prerendercloud.set = function (optName, val) {
  origSet.apply(undefined, arguments);
  cachedOptions[optName] = val;
};

const resetPrerenderCloud = () => {
  prerendercloud.resetOptions();
  cachedOptions = {};

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

  // 3. host (optional, will infer from host header if not set here)
  //    If having issues, try setting this to your custom domain (something like example.com)
  //    or if you don't have one, then the CloudFront distribution URL (something like d1pxreml448ujs.cloudfront.net).
  //    Note, setting this config option shouldn't be necessary
  //    example value: example.com or d1pxreml448ujs.cloudfront.net (don't include the protocol)
  // prerendercloud.set("host", "");

  // 4. removeTrailingSlash (recommended)
  //    Removes trailing slash from URLs to increase prerender.cloud server cache hit rate
  //    the only reason not to enable this is if you use "strict routing"
  //    that is, you treat /docs/ differently than /docs (trailing slash) which is rare
  // prerendercloud.set("removeTrailingSlash", true);

  // 5. whitelistQueryParams (recommended)
  //    improves cache hit rate by dropping query params not in the whitelist
  //    must be a function that returns null or array
  //    * default (null) preserves all query params
  //    * empty array drops all query params
  // prerendercloud.set("whitelistQueryParams", req => ["page"]);

  // 6. botsOnly
  //    generally not recommended due to potential google SEO cloaking penalties no one fully understands
  // prerendercloud.set("botsOnly", true);

  // 7. whitelistUserAgents
  //    specify your own list of bots
  //    useful when you only care about open graph previews (in which case, metaOnly also makes sense)
  // prerendercloud.set('whitelistUserAgents', ['twitterbot', 'slackbot', 'facebookexternalhit']);

  // 8. metaOnly
  //    only prerender the <title> and <meta> tags in the <head> section. The returned HTML payload will otherwise be unmodified.
  //    useful if you don't care about server-side rendering but want open-graph previews to work everywhere
  //    must be a function that receives a req object, and returns a bool
  // eg1:
  //   prerendercloud.set('metaOnly', req => req.url === "/long-page-insuitable-for-full-prerender" ? true : false);
  // eg2:
  //   prerendercloud.set('metaOnly', () => true);

  // 9. disableServerCache
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

  // 10. blacklistPaths (not for blacklisting paths in your SPA, but for static files that shouldn't be pre-rendered)
  //    the viewer-request function can't see what files exist on origin so you may need this
  //    if you have HTML files that should not be pre-rendered (e.g. google/apple/fb verification files)
  //    trailing * works as a wildcard
  //    NOTE: this is for static files that you don't want pre-rendered, not SPA routes - for those, use shouldPrerenderAdditionalCheck
  // prerendercloud.set('blacklistPaths', req => ['/facebook-domain-verification.html', '/signin/*', '/google*']);

  // 11. removeScriptsTag (not recommended)
  //    Removes all scripts/JS, useful if:
  //      - trying to get under 1MB Lambda@Edge limit
  //      - having problems with your JS app taking over from the pre-rendered content
  //    Huge caveat: this also means your app will no longer be a "single-page app" since
  //    all of the JavaScript will be gone
  // prerendercloud.set("removeScriptTags", true);

  // 12. disableAjaxPreload
  //    "Ajax Preload" is a monkey-patch, included by default when metaOnly is false/null.
  //     It prevents screen flicker/repaint/flashing, but increases initial page load size
  //     (because it embeds the AJAX responses into your HTML).
  //     you can disable this if:
  //       * you have metaOnly set to true
  //       * you don't make any AJAX/XHR requests
  //       * you don't care about a brief flicker/flash
  //       * or finally, the best option: you manage your own via prerender.cloud's __PRELOADED_STATE__ special global var
  //     Read more:
  //       - https://www.prerender.cloud/docs/server-client-transition
  //       - https://github.com/sanfrancesco/prerendercloud-ajaxmonkeypatch
  // prerendercloud.set("disableAjaxPreload", true);

  // 13. shouldPrerenderAdditionalCheck
  //     Runs in addition to the default user-agent check. Useful if you have your own conditions
  //     e.g. blacklisting paths in your SPA, or only pre-rendering certain paths
  //     just return true or false, your data is: req.headers and req.url
  // const blacklistSpaPaths = [
  //   "/some-page-that-prerenders-poorly",
  //   "/auth/customer-profile/*",
  //   "/interactive*",
  // ];
  // prerendercloud.set("shouldPrerenderAdditionalCheck", (req) =>
  //   isNotBlocked(blacklistSpaPaths, req)
  // );

  // 14. see all configuration options here: https://github.com/sanfrancesco/prerendercloud-nodejs

  // for tests
  if (prerenderCloudOption) prerenderCloudOption(prerendercloud);
};

const isNotBlocked = (blacklistSpaPaths, req) => {
  return !blacklistSpaPaths.some((pattern) => {
    if (pattern.endsWith("*")) {
      return req.url.startsWith(pattern.slice(0, -1));
    }
    return req.url === pattern;
  });
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
    cachedOptions,
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
    cachedOptions,
    cloudFrontRequest,
    callback
  );

  // we override the prerendercloud lib's default userAgent logic
  // for deciding when to prerender because we've already computed it
  // in the viewer-request, and encoded it into the URI, which is now in the `shouldPrerender` var
  prerendercloud.set("shouldPrerender", () => shouldPrerender);

  if (shouldPrerender) {
    console.log("originRequest calling service.prerender.cloud:", {
      host: req.headers.host,
      url: req.url,
    });
  } else {
    console.log("originRequest calling next", {
      host: req.headers.host,
      url: req.url,
    });
  }

  prerendercloud(req, res, next);
};

module.exports.originResponse = (event, context, callback) => {
  const cloudFrontResponse = event.Records[0].cf.response;
  // console.log("originResponse", JSON.stringify(cloudFrontResponse));

  if (cloudFrontResponse.status === "404") {
    cloudFrontResponse.body = `
      <html>
        <head>
          <title>Not Found</title>
        </head>
        <body>404 - Not Found</body>
      </html>
    `;
    cloudFrontResponse.headers["content-type"] = [
      { key: "Content-Type", value: "text/html" },
    ];
  }

  callback(null, cloudFrontResponse);
};

// for tests
var prerenderCloudOption;
module.exports.setPrerenderCloudOption = (cb) => {
  prerenderCloudOption = cb;
};

// for validation
module.exports.resetPrerenderCloud = resetPrerenderCloud;
