const util = require("./util");

module.exports = class ViewerRequestInterface {
  static create(cloudFrontRequest, callback) {
    const vri = new this(cloudFrontRequest, callback);

    const req = vri.createReq();
    const res = vri.createRes();
    const next = vri.createNext();

    return { req, res, next };
  }
  constructor(cloudFrontRequest, callback) {
    this.cloudFrontRequest = cloudFrontRequest;
    this.callback = callback;
    this.headers = {};
  }

  createReq() {
    const req = {
      method: this.cloudFrontRequest.method,
      originalUrl: this.cloudFrontRequest.uri,
      url: this.cloudFrontRequest.uri,
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
      end: body => {
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

        this.cloudFrontRequest.uri = util.createUri(
          this.cloudFrontRequest.uri,
          true
        );

        console.log({shouldPrerender: true, uri: this.cloudFrontRequest.uri});

        this.callback(null, this.cloudFrontRequest);
      },
      writeHead(_status, _headers) {}
    };

    res.headers = {};
    return res;
  }
  createNext() {
    return () => {
      if (util.isHtml(this.cloudFrontRequest.uri)) {
        console.log({rewriteToIndexHtml: true});
        this.cloudFrontRequest.uri = "/index.html";
      } else {
        console.log({rewriteToIndexHtml: false});
      }

      this.cloudFrontRequest.uri = util.createUri(
        this.cloudFrontRequest.uri,
        false
      );

      console.log({shouldPrerender: false, uri: this.cloudFrontRequest.uri});
      this.callback(null, this.cloudFrontRequest);
    };
  }
};
