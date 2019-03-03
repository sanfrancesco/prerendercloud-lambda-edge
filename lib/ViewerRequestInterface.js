const util = require("./util");

module.exports = class ViewerRequestInterface {
  static create(cachedOptions, cloudFrontRequest, callback) {
    const vri = new this(cloudFrontRequest, callback);

    const req = vri.createReq();
    const res = vri.createRes();
    const next = vri.createNext(req, cachedOptions);

    return { req, res, next };
  }
  constructor(cloudFrontRequest, callback) {
    this.cloudFrontRequest = cloudFrontRequest;
    const querystring = this.cloudFrontRequest.querystring
      ? `?${this.cloudFrontRequest.querystring}`
      : "";
    this.originalUrl = this.cloudFrontRequest.uri + querystring;
    this.callback = callback;
    this.headers = {};
  }

  createReq() {
    const req = {
      method: this.cloudFrontRequest.method,
      originalUrl: this.originalUrl,
      url: this.originalUrl,
      headers: {
        host: util.getHeader(this.cloudFrontRequest, "host"),
        "user-agent": util.getHeader(this.cloudFrontRequest, "user-agent")
      }
    };

    return req;
  }
  createRes() {
    const res = {
      // the vary package in prerendercloud needs getHeader and setHeader
      getHeader: key => {
        return this.headers[key];
      },
      setHeader: (key, val) => {
        this.headers[key] = val;
      },
      writeHead(_status, _headers) {}
    };

    res.end = body => {
      // since the user-agent header will be overwritten with CloudFront
      // we use this to hint at the real one, but:
      // 1. it will not affect the cache-key
      // 2. prerender.cloud will only see it once (after that, the req will be cached in CloudFront)
      // 3. we don't need this for anything other than the potential for user stats/analytics in prerender.cloud
      //    (i.e. the user can see the user-agent of the request that triggered the first CloudFront request)
      this.cloudFrontRequest.headers[util.USER_AGENT_PLACEHOLDER] = [
        {
          key: util.USER_AGENT_PLACEHOLDER,
          value: util.getHeader(this.cloudFrontRequest, "user-agent")
        }
      ];

      const origCloudFrontUri = this.cloudFrontRequest.uri;

      // res.prerender.url.requestedPath is set by https://github.com/sanfrancesco/prerendercloud-nodejs
      // specifically for this Lambda lib - it's the requested path after applying the whitelistQueryParams
      this.cloudFrontRequest.uri = util.createUri(
        res.prerender.url.requestedPath,
        true,
        util.getHeader(this.cloudFrontRequest, "host")
      );

      console.log({
        shouldPrerender: true,
        cloudFrontUriAfterEncode: this.cloudFrontRequest.uri,
        requestedUriAfterWhitelist: res.prerender.url.requestedPath,
        originalCloudFrontUri: origCloudFrontUri,
        originalCloudFrontQuerystring: this.cloudFrontRequest.querystring
      });

      this.callback(null, this.cloudFrontRequest);
    };

    res.headers = {};
    return res;
  }
  createNext(req, cachedOptions) {
    return () => {
      if (
        util.shouldRewriteToIndexHtml(
          req,
          cachedOptions,
          this.cloudFrontRequest.uri
        )
      ) {
        console.log("ViewerRequestInterface.next", {
          rewriteToIndexHtml: true
        });
        this.cloudFrontRequest.uri = "/index.html";
      } else {
        console.log("ViewerRequestInterface.next", {
          rewriteToIndexHtml: false
        });
      }

      // the URI will not include query string when not pre-rendering
      // (because if not pre-rendering, we don't want to mutate the URI field)
      this.cloudFrontRequest.uri = util.createUri(
        this.cloudFrontRequest.uri,
        false
      );

      console.log({ shouldPrerender: false, uri: this.cloudFrontRequest.uri });
      this.callback(null, this.cloudFrontRequest);
    };
  }
};
