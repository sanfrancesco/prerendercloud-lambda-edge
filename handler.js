// http://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html
// http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html

"use strict";

const prerendercloud = require("prerendercloud");

// you must hardcode your token here (or use something like dotenv)
// because Lambda@Edge doesn't support env vars
// prerendercloud.set('prerenderToken', 'mySecretToken')

// if it takes longer than 2.8s, just bail out so we don't return an error
// since Lambda@Edge max duration is 3s
prerendercloud.set("timeout", 2800);

// not recommended due to potential cloaking penalties
// but may be necessary if you have script errors
// from the server-side rendered content
// prerendercloud.set("botsOnly", true);

// uncomment this if you're trying to be under the 256KB limit
// and you're OK with there being no JS in the prerendered app
// prerendercloud.set('removeScriptTags', true);

const getHeader = (cloudFrontRequest, name) =>
  cloudFrontRequest.headers[name] &&
  cloudFrontRequest.headers[name][0] &&
  cloudFrontRequest.headers[name][0].value;

const parseUriField = uri => {
  // uri has leading slash
  return JSON.parse(fromBase64(uri.slice(1)));
};

// request interface adapter, from cloudFront -> Node/Connect/express
// so it works with prerendercloud middleware
const createRequest = cloudFrontRequest => {
  console.log(JSON.stringify(cloudFrontRequest));
  const { uri, userAgent } = parseUriField(cloudFrontRequest.uri);

  const fakeReqObj = {
    method: cloudFrontRequest.method,
    originalUrl: uri,
    url: uri,
    headers: {
      host: getHeader(cloudFrontRequest, "host"),
      "user-agent": userAgent
    }
  };

  return fakeReqObj;
};

// response interface adapter, from Node/Connect/express -> cloudFront
// so it works with prerendercloud middleware
const createResponse = callback => {
  const res = {
    // the vary package in prerendercloud needs getHeader and setHeader
    getHeader(key) {
      return this.headers[key];
    },
    setHeader(key, val) {
      console.log("setHeader", key, val);
      this.headers[key] = val;
    },
    end(body) {
      return callback(null, {
        status: this.status,
        statusDescription: "OK",
        headers: this.headers,
        body: body
      });
    },
    writeHead(_status, _headers) {
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

  res.headers = {};
  return res;
};

const createNext = (cloudFrontRequest, callback, originalUrl) => {
  cloudFrontRequest.uri = originalUrl;
  const next = () => callback(null, cloudFrontRequest);
  return next;
};

const toBase64 = str => Buffer.from(str).toString("base64");
const fromBase64 = str => Buffer.from(str, "base64").toString("utf8");

module.exports.viewerRequest = (event, context, callback) => {
  const request = event.Records[0].cf.request;

  const json = JSON.stringify({
    uri: request.uri,
    userAgent:
      request.headers["user-agent"] && request.headers["user-agent"][0].value
  });

  // uri must start with /
  request.uri = `/${toBase64(json)}`;

  callback(null, request);
};

module.exports.originRequest = (event, context, callback) => {
  // temporary until timeout function of prerendercloud or got is fixed
  // so it cancels request when timeout is reached
  // https://github.com/sindresorhus/got/issues/344
  context.callbackWaitsForEmptyEventLoop = false;

  const cloudFrontRequest = event.Records[0].cf.request;

  const req = createRequest(cloudFrontRequest);

  const next = createNext(cloudFrontRequest, callback, req.originalUrl);

  const res = createResponse(callback);

  prerendercloud(req, res, next);
};
