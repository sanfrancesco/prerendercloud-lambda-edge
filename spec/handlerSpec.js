const handler = require("../handler");
var nock = require("nock");

const toBase64 = str => Buffer.from(str).toString("base64");
const fromBase64 = str => Buffer.from(str, "base64").toString("utf8");

const createUri = (uri, userAgent) =>
  "/" + toBase64(JSON.stringify({ uri, userAgent }));

describe("handler", function() {
  beforeEach(function() {
    nock.cleanAll();
    nock.disableNetConnect();
  });

  function runIt() {
    beforeEach(function(done) {
      this.cb = jasmine.createSpy("originalCallback").and.callFake(done);
      this.handler(this.event, this.context, this.cb);
    });
  }

  describe("viewerRequest", function() {
    beforeEach(function() {
      this.handler = handler.viewerRequest;
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
                uri: "/index.html",
                method: "GET"
              }
            }
          }
        ]
      };
      this.context = {};
    });
    runIt();

    it("modifies request object with base64 encoded JSON string that has path and user-agent", function() {
      expect(this.cb).toHaveBeenCalledWith(null, {
        headers: {
          host: [{ value: "d123.cf.net", key: "Host" }],
          "user-agent": [{ value: "test-agent", key: "User-Agent" }]
        },
        clientIp: "2001:cdba::3257:9652",
        uri: createUri("/index.html", "test-agent"),
        method: "GET"
      });
    });
  });

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
                uri: createUri("/index.html", "test-agent"),
                method: "GET"
              }
            }
          }
        ]
      };
      this.context = {};
    });

    describe("normal user-agent", function() {
      runIt();

      it("forwards request to prerendercloud", function() {
        expect(this.requestedPrerenderUri).toEqual(
          "/http://d123.cf.net/index.html"
        );
        expect(this.headersSentToServer).toEqual({
          "user-agent": "prerender-cloud-nodejs-middleware",
          "accept-encoding": "gzip",
          "x-original-user-agent": "test-agent",
          host: "service.prerender.cloud"
        });
        expect(this.cb).toHaveBeenCalledWith(null, {
          status: "200",
          statusDescription: "OK",
          headers: {
            "content-type": [{ key: "content-type", value: "text/html" }]
          },
          body: "prerendered-body"
        });
      });
    });

    describe("prerendercloud user-agent", function() {
      beforeEach(function() {
        this.event.Records[0].cf.request.uri = createUri(
          "/some-path",
          "prerendercloud Linux"
        );
      });
      runIt();

      it("returns original CloudFront request with normal path", function() {
        expect(this.cb).toHaveBeenCalledWith(null, {
          headers: {
            host: [{ value: "d123.cf.net", key: "Host" }],
            "user-agent": [{ value: "test-agent", key: "User-Agent" }]
          },
          clientIp: "2001:cdba::3257:9652",
          uri: "/some-path",
          method: "GET"
        });
      });
    });
  });
});
