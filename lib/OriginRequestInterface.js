const util = require("./util");



module.exports = class OriginRequestInterface {
  static create(cloudFrontRequest, callback) {
    const ori = new this(cloudFrontRequest, callback);
    const { req, shouldPrerender } = ori.createReq();
    const next = ori.createNext();
    const res = ori.createRes(next);

    return { req, res, next, shouldPrerender };
  }
  constructor(cloudFrontRequest, callback) {
    this.cloudFrontRequest = cloudFrontRequest;
    this.callback = callback;
    this.headers = {};
  }

  createReq() {
    const { uri, shouldPrerender } = util.parseUriField(
      this.cloudFrontRequest.uri
    );

    this.originalUri = uri;

    const req = {
      method: this.cloudFrontRequest.method,
      originalUrl: uri,
      url: uri,
      headers: {
        host: util.getHeader(this.cloudFrontRequest, "host"),
        "user-agent": util.getHeader(
          this.cloudFrontRequest,
          util.USER_AGENT_PLACEHOLDER
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
        if (body && body.length >= 255000) {
          console.log('bailing out because size is over 256kb');
          return next();
        }

        return this.callback(null, {
          status: this.status,
          statusDescription: "OK",
          headers: this.headers,
          body: body
        });
      },
      writeHead: (_status, _headers) => {
        const mergedHeaders = Object.assign({}, _headers, this.headers);

        this.status = `${_status}`;
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
  createNext() {
    return () => {
      delete this.cloudFrontRequest.headers[util.USER_AGENT_PLACEHOLDER];
      this.cloudFrontRequest.uri = this.originalUri;

      if (util.isHtml(this.cloudFrontRequest.uri)) {
        this.cloudFrontRequest.uri = "/index.html";
      }

      this.callback(null, this.cloudFrontRequest);
    };
  }
};
