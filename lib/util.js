const url = require("url");
const USER_AGENT_PLACEHOLDER = "prerendercloud-lambda-edge-original-user-agent";

const getHeader = (cloudFrontRequest, name) =>
  cloudFrontRequest.headers[name] &&
  cloudFrontRequest.headers[name][0] &&
  cloudFrontRequest.headers[name][0].value;

const toBase64 = str => Buffer.from(str).toString("base64");
const fromBase64 = str => Buffer.from(str, "base64").toString("utf8");
const createUri = (uri, shouldPrerender) =>
  "/" + toBase64(JSON.stringify({ uri, shouldPrerender }));

const parseUriField = uri => {
  // uri has leading slash
  return JSON.parse(fromBase64(uri.slice(1)));
};

const isHtml = require("prerendercloud").util.urlPathIsHtml;

module.exports = {
  USER_AGENT_PLACEHOLDER,
  toBase64,
  fromBase64,
  createUri,
  getHeader,
  parseUriField,
  isHtml
};
