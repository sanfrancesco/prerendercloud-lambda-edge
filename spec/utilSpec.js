const util = require("../lib/util");

describe("util", function() {
  describe("isHtml", function() {
    it("detects no extension", function() {
      expect(util.isHtml("/")).toBe(true);
    });
    it("detects html", function() {
      expect(util.isHtml("index.html")).toBe(true);
    });
    it("detects htm", function() {
      expect(util.isHtml("index.htm")).toBe(true);
    });
    it("detects double dot html", function() {
      expect(util.isHtml("index.bak.html")).toBe(true);
    });
    it("does not detect js", function() {
      expect(util.isHtml("index.js")).toBe(false);
    });
    it("handles miscellaneous dots", function() {
      expect(
        util.isHtml(
          "categories/1234;lat=-999999.8888888;lng=12341234.13371337;location=SanFrancisco"
        )
      ).toBe(true);
    });
  });
});
