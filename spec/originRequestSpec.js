const handler = require("../handler");
const nock = require("nock");
const util = require("../lib/util");
const prerendercloud = require("prerendercloud");

describe("originRequest", function() {
  beforeEach(function() {
    prerendercloud.resetOptions();
    nock.cleanAll();
    nock.disableNetConnect();
  });

  function runHandlerWithOriginRequestEvent() {
    beforeEach(function(done) {
      this.cb = jasmine.createSpy("originalCallback").and.callFake(done);
      this.handler(this.event, this.context, this.cb);
    });
  }

  function itForwardsRequestToPrerenderCloud(
    userAgent,
    uri,
    extraHeaders = {}
  ) {
    it("sends exact URL to prerender server with leading slash", function() {
      expect(this.requestedPrerenderUri).toEqual(uri);
    });

    it("sends prerendercloud middleware user-agent, and curl x-original-user-agent, and gzip", function() {
      expect(this.headersSentToServer).toEqual({
        "user-agent": "prerender-cloud-nodejs-middleware",
        "accept-encoding": "gzip",
        "x-original-user-agent": userAgent,
        host: "service.prerender.cloud"
      });
    });

    it("calls callback with prerendered body and headers", function() {
      expect(this.cb).toHaveBeenCalledWith(null, {
        status: "200",
        statusDescription: "OK",
        headers: Object.assign(
          {},
          {
            "content-type": [{ key: "content-type", value: "text/html" }]
          },
          extraHeaders
        ),
        body: "prerendered-body"
      });
    });
  }

  function itReturnsOriginalCloudFrontRequestWithNormalPath(uri) {
    it("returns original CloudFront request with normal path", function() {
      expect(this.cb).toHaveBeenCalledWith(null, {
        headers: {
          host: [{ value: "d123.cf.net", key: "Host" }],
          // "user-agent": [{ value: "test-agent", key: "User-Agent" }]
          "user-agent": [{ value: "CloudFront", key: "User-Agent" }]
        },
        clientIp: "2001:cdba::3257:9652",
        uri: uri,
        method: "GET"
      });
    });
  }

  beforeEach(function() {
    const self = this;
    this.prerenderServer = nock("https://service.prerender.cloud")
      .get(/.*/)
      .reply(function(uri) {
        self.requestedPrerenderUri = uri;
        self.headersSentToServer = this.req.headers;
        // return [200, "prerendered-body", {wut: 'kok'}];
        return [200, "prerendered-body", { "content-type": "text/html" }];
      });
    this.handler = handler.originRequest;
    this.event = {
      Records: [
        {
          cf: {
            request: {
              headers: {
                host: [
                  {
                    value: "d123.cf.net",
                    key: "Host"
                  }
                ],
                "user-agent": [
                  {
                    value: "CloudFront",
                    key: "User-Agent"
                  }
                ]
              },
              clientIp: "2001:cdba::3257:9652",
              uri: "",
              method: "GET"
            }
          }
        }
      ]
    };
    this.context = {};
  });

  function withInputs(userAgent, uri, shouldPrerender) {
    beforeEach(function() {
      this.event.Records[0].cf.request.uri = util.createUri(
        uri,
        shouldPrerender
      );
      const headerPlaceholder = (this.event.Records[0].cf.request.headers[
        "prerendercloud-lambda-edge-original-user-agent"
      ] = [
        {
          value: userAgent,
          key: "prerendercloud-lambda-edge-original-user-agent"
        }
      ]);
    });
  }

  describe("when shouldPrerender is true", function() {
    withInputs("whatever", "/index.html", true);
    runHandlerWithOriginRequestEvent();

    itForwardsRequestToPrerenderCloud(
      "whatever",
      "/http://d123.cf.net/index.html"
    );
  });

  describe("when shouldPrerender is false", function() {
    withInputs("whatever", "/index.html", false);
    runHandlerWithOriginRequestEvent();

    itReturnsOriginalCloudFrontRequestWithNormalPath("/index.html");
  });

  describe("404->index.html-custom error response replacement", function() {
    describe("when shouldPrerender is true", function() {
      describe("/nested/path no trailing slash", function() {
        withInputs("whatever", "/nested/path", true);
        runHandlerWithOriginRequestEvent();

        // it does not rewrite path (it preserves path)
        itForwardsRequestToPrerenderCloud(
          "whatever",
          "/http://d123.cf.net/nested/path"
        );
      });
    });
    describe("when shouldPrerender is false", function() {
      describe("/ root path", function() {
        withInputs("whatever", "/", false);
        runHandlerWithOriginRequestEvent();

        // it rewrites to /index.html
        itReturnsOriginalCloudFrontRequestWithNormalPath("/index.html");
      });

      describe("/nested/path no trailing slash", function() {
        withInputs("whatever", "/nested/path", false);
        runHandlerWithOriginRequestEvent();

        // it rewrites to /index.html
        itReturnsOriginalCloudFrontRequestWithNormalPath("/index.html");
      });
      describe("/nested/path/ with trailing slash", function() {
        withInputs("whatever", "/nested/path/", false);
        runHandlerWithOriginRequestEvent();

        // it rewrites to /index.html
        itReturnsOriginalCloudFrontRequestWithNormalPath("/index.html");
      });
      describe("non HTML", function() {
        withInputs("whatever", "/app.js", false);
        runHandlerWithOriginRequestEvent();

        // it does not rewrite path (it preserves path)
        itReturnsOriginalCloudFrontRequestWithNormalPath("/app.js");
      });
    });
  });
});
