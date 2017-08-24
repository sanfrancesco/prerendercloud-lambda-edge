const handler = require("../handler");
const nock = require("nock");
const util = require("../lib/util");

describe("originRequest", function() {
  beforeEach(function() {
    handler.setPrerenderCloudOption(prerendercloud => null);
    nock.cleanAll();
    nock.disableNetConnect();
  });

  function runHandlerWithOriginRequestEvent() {
    beforeEach(function(done) {
      this.cb = jasmine.createSpy("originalCallback").and.callFake(done);
      this.handler(this.event, this.context, this.cb);
    });
  }

  function itReturnsPrerenderCloudResponse(extraHeaders = {}) {
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

  function itForwardsRequestToPrerenderCloud(userAgent, uri) {
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
        return [200, self.prerenderedContent || "prerendered-body", { "content-type": "text/html" }];
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

  function withPrerenderedContent(content) {
    beforeEach(function() {
      this.prerenderedContent = content;
    })
  }

  describe("when shouldPrerender is true", function() {
    withInputs("whatever", "/index.html", true);
    runHandlerWithOriginRequestEvent();

    itForwardsRequestToPrerenderCloud(
      "whatever",
      "/http://d123.cf.net/index.html"
    );
    itReturnsPrerenderCloudResponse()
  });

  describe("when shouldPrerender is false", function() {
    withInputs("whatever", "/index.html", false);
    runHandlerWithOriginRequestEvent();

    itReturnsOriginalCloudFrontRequestWithNormalPath("/index.html");
  });

  // lambda has a 256kb max response
  describe("when shouldPrerender is true but size is over 256kb", function() {
    withInputs("whatever", "/index.html", true);
    withPrerenderedContent(new Buffer(256000));

    runHandlerWithOriginRequestEvent();

    itForwardsRequestToPrerenderCloud(
      "whatever",
      "/http://d123.cf.net/index.html"
    );

    itReturnsOriginalCloudFrontRequestWithNormalPath("/index.html");
  });

});
