const handler = require("../handler");
const nock = require("nock");

const helper = require("./helper");

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

  function itReturnsOriginalCloudFrontRequestWithNormalPath(userAgent, uri) {
    it("returns original CloudFront request with normal path", function() {
      expect(this.cb).toHaveBeenCalledWith(null, {
        headers: {
          host: [{ value: "d123.cf.net", key: "Host" }],
          // "user-agent": [{ value: "test-agent", key: "User-Agent" }]
          "user-agent": [{ value: userAgent, key: "User-Agent" }]
        },
        clientIp: "2001:cdba::3257:9652",
        uri: uri,
        method: "GET"
      });
    });
  }

  describe("originRequest", function() {
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
                      value: "test-agent",
                      key: "User-Agent"
                    }
                  ]
                },
                clientIp: "2001:cdba::3257:9652",
                uri: helper.createUri("/index.html", "twitterbot"),
                method: "GET"
              }
            }
          }
        ]
      };
      this.context = {};
    });

    function withUserAgentAndUri(userAgent, uri) {
      beforeEach(function() {
        this.event.Records[0].cf.request.uri = helper.createUri(uri, userAgent);
        this.event.Records[0].cf.request.headers[
          "user-agent"
        ][0].value = userAgent;
      });
    }

    describe("when prerendering all user-agents (default)", function() {
      describe("curl user-agent", function() {
        withUserAgentAndUri("curl", "/index.html");
        runHandlerWithOriginRequestEvent();

        itForwardsRequestToPrerenderCloud(
          "curl",
          "/http://d123.cf.net/index.html"
        );
      });
      describe("prerendercloud user-agent", function() {
        withUserAgentAndUri("prerendercloud random-suffix", "/index.html");
        runHandlerWithOriginRequestEvent();

        itReturnsOriginalCloudFrontRequestWithNormalPath(
          "prerendercloud random-suffix",
          "/index.html"
        );
      });
    });

    describe("when prerendering botsOnly user-agents", function() {
      beforeEach(function() {
        prerendercloud.set("botsOnly", true);
      });
      describe("twitterbot user-agent", function() {
        withUserAgentAndUri("twitterbot", "/index.html");
        runHandlerWithOriginRequestEvent();

        itForwardsRequestToPrerenderCloud(
          "twitterbot",
          "/http://d123.cf.net/index.html",
          { vary: [{ key: "Vary", value: "User-Agent" }] }
        );
      });
      describe("curl user-agent", function() {
        withUserAgentAndUri("curl", "/index.html");
        runHandlerWithOriginRequestEvent();

        itReturnsOriginalCloudFrontRequestWithNormalPath("curl", "/index.html");
      });
      describe("prerendercloud user-agent", function() {
        withUserAgentAndUri("prerendercloud random-suffix", "/index.html");
        runHandlerWithOriginRequestEvent();

        itReturnsOriginalCloudFrontRequestWithNormalPath(
          "prerendercloud random-suffix",
          "/index.html"
        );
      });
    });

    describe("spa 404->index.html (custom error response replacement)", function() {
      describe("with botsOnly, curl user-agent causes HTML paths to be converted to index.html", function() {
        beforeEach(function() {
          prerendercloud.set("botsOnly", true);
        });
        describe("when hitting path without trailing slash: /docs", function() {
          withUserAgentAndUri("prerendercloud", "/docs");
          runHandlerWithOriginRequestEvent();
          itReturnsOriginalCloudFrontRequestWithNormalPath(
            "prerendercloud",
            "/index.html"
          );
        });
      });

      describe("prerendercloud user-agent causes HTML paths to be converted to index.html", function() {
        describe("when hitting root path: /", function() {
          withUserAgentAndUri("prerendercloud", "/");
          runHandlerWithOriginRequestEvent();
          itReturnsOriginalCloudFrontRequestWithNormalPath(
            "prerendercloud",
            "/index.html"
          );
        });

        describe("when hitting path without trailing slash: /docs", function() {
          withUserAgentAndUri("prerendercloud", "/docs");
          runHandlerWithOriginRequestEvent();
          itReturnsOriginalCloudFrontRequestWithNormalPath(
            "prerendercloud",
            "/index.html"
          );
        });

        describe("when hitting path with trailing slash: /docs/", function() {
          withUserAgentAndUri("prerendercloud", "/docs/");
          runHandlerWithOriginRequestEvent();
          itReturnsOriginalCloudFrontRequestWithNormalPath(
            "prerendercloud",
            "/index.html"
          );
        });

        describe("when hitting non HTML: /app.js", function() {
          withUserAgentAndUri("prerendercloud", "/app.js");
          runHandlerWithOriginRequestEvent();
          itReturnsOriginalCloudFrontRequestWithNormalPath(
            "prerendercloud",
            "/app.js"
          );
        });
      });
    });
  });
});
