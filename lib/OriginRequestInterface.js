const util = require("./util");

module.exports = class OriginRequestInterface {
  static create(cachedOptions, cloudFrontRequest, callback) {
    const ori = new this(cloudFrontRequest, callback);
    const { req, shouldPrerender } = ori.createReq();
    const next = ori.createNext(req, cachedOptions);
    const res = ori.createRes(next);

    return { req, res, next, shouldPrerender };
  }
  constructor(cloudFrontRequest, callback) {
    this.cloudFrontRequest = cloudFrontRequest;
    this.callback = callback;
    this.headers = {};
  }

  createReq() {
    console.log("about to parse URI", this.cloudFrontRequest.uri);
    const { uri, shouldPrerender, host } = util.parseUriField(
      this.cloudFrontRequest.uri
    );

    this.originalUri = uri;

    console.log("parsed URI", { uri, shouldPrerender, host });

    const req = {
      connection: { encrypted: true },
      method: this.cloudFrontRequest.method,
      originalUrl: uri,
      url: uri,
      headers: {
        host: host,
        "user-agent": util.getHeader(
          this.cloudFrontRequest,
          util.USER_AGENT_PLACEHOLDER
        ),
        "accept-encoding": util.getHeader(
          this.cloudFrontRequest,
          "accept-encoding"
        )
      }
    };

    return { req, shouldPrerender };
  }
  createRes(next) {
    const res = {
      // the vary package in prerendercloud needs getHeader and setHeader
      getHeader: key => {
        return this.headers[key];
      },
      setHeader: (key, val) => {
        this.headers[key] = val;
      },
      end: body => {
        const res = {
          status: this.status,
          statusDescription: "OK",
          headers: this.headers,
          body: body
        };

        if (
          this.originalHeaders["content-encoding"] &&
          this.originalHeaders["content-encoding"].match(/gzip/)
        ) {
          res.body = res.body.toString("base64");
          res.bodyEncoding = "base64";
        }

        if (body && body.length >= 1048000) {
          console.log("bailing out because size is over 1mb");
          return next();
        }

        return this.callback(null, res);
      },
      writeHead: (_status, _headers) => {
        const mergedHeaders = Object.assign({}, _headers, this.headers);

        this.status = `${_status}`;
        this.originalHeaders = Object.assign({}, mergedHeaders);
        this.headers = Object.keys(mergedHeaders).reduce((memo, headerKey) => {
          return Object.assign(memo, {
            [headerKey.toLowerCase()]: [
              {
                key: headerKey,
                value: mergedHeaders[headerKey]
              }
            ]
          });
        }, {});
      }
    };

    return res;
  }
  createNext(req, cachedOptions) {
    // this flow will be called for prerender.cloud LAST_RESORT_TIMEOUT
    // aka "prerendercloud middleware SKIPPED: server error: Request timed out"
    // it will merely fall back to non-prerendered content
    return () => {
      delete this.cloudFrontRequest.headers[util.USER_AGENT_PLACEHOLDER];

      if (util.shouldRewriteToIndexHtml(req, cachedOptions, this.originalUri)) {
        console.log("OriginRequestInterface.next", {
          rewriteToIndexHtml: true
        });
        this.cloudFrontRequest.uri = "/index.html";
      } else {
        console.log("OriginRequestInterface.next", {
          rewriteToIndexHtml: false
        });
        this.cloudFrontRequest.uri = this.originalUri;
      }

      // console.log("OriginRequest calling next", this.cloudFrontRequest);
      this.callback(null, this.cloudFrontRequest);
    };
  }
};
