const handler = require("../handler");
const nock = require("nock");

const helper = require("./helper");

const createUri = (uri, userAgent) =>
  "/" + helper.toBase64(JSON.stringify({ uri, userAgent }));

describe("viewerRequest", function() {
  beforeEach(function() {
    nock.cleanAll();
    nock.disableNetConnect();
  });

  function runHandlerWithViewerRequestEvent() {
    beforeEach(function(done) {
      this.cb = jasmine.createSpy("originalCallback").and.callFake(done);
      this.handler(this.event, this.context, this.cb);
    });
  }

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

  runHandlerWithViewerRequestEvent();

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
