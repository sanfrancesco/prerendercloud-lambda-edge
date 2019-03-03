const url = require("url");
const USER_AGENT_PLACEHOLDER = "prerendercloud-lambda-edge-original-user-agent";

const getHeader = (cloudFrontRequest, name) =>
  cloudFrontRequest.headers[name] &&
  cloudFrontRequest.headers[name][0] &&
  cloudFrontRequest.headers[name][0].value;

const toBase64 = str => Buffer.from(str).toString("base64");
const fromBase64 = str => Buffer.from(str, "base64").toString("utf8");
const createUri = (uri, shouldPrerender, host) =>
  "/" + toBase64(JSON.stringify({ uri, shouldPrerender, host }));

const parseUriField = uri => {
  // uri has leading slash
  return JSON.parse(fromBase64(uri.slice(1)));
};

const isHtml = require("prerendercloud").util.urlPathIsHtml;

// this function exists in the npm lib: prerendercloud
// but must also exist here since we use it in our 404->/index.html
// functionality when the file has no extension or .html extension
const pathIsBlacklisted = (blacklistedPaths, cloudfrontUri) => {
  const paths = blacklistedPaths;

  if (paths && Array.isArray(paths)) {
    return paths.some(path => {
      if (path === cloudfrontUri) return true;

      if (path.endsWith("*")) {
        const starIndex = path.indexOf("*");
        const pathSlice = path.slice(0, starIndex);

        if (cloudfrontUri.startsWith(pathSlice)) return true;
      }

      return false;
    });
  }

  return false;
};

const shouldRewriteToIndexHtml = (req, cachedOptions, uri) => {
  return (
    isHtml(uri) &&
    (!cachedOptions.blacklistPaths ||
      (cachedOptions.blacklistPaths &&
        !pathIsBlacklisted(cachedOptions.blacklistPaths(req), uri)))
  );
};

module.exports = {
  USER_AGENT_PLACEHOLDER,
  toBase64,
  fromBase64,
  createUri,
  getHeader,
  parseUriField,
  isHtml,
  shouldRewriteToIndexHtml
};
