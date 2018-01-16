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

const isHtml = urlStr => {
  const parsedUrl = url.parse(urlStr);
  const path = parsedUrl.pathname;
  const basename = path.split("/").pop();

  if (basename === "") return true;

  // doesn't detect index.whatever.html (multiple dots)
  const hasHtmlOrNoExtension = !!basename.match(/^(([^.]|\.html?)+)$/);

  if (hasHtmlOrNoExtension) return true;

  // hack to handle basenames with multiple dots: index.whatever.html
  const endsInHtml = !!basename.match(/.html?$/);

  if (endsInHtml) return true;

  // hack to detect extensions that are not HTML so we can handle
  // paths with dots in them
  const endsInOtherExtension = basename.match(/\.[a-zA-Z]{1,5}$/);
  if (!endsInOtherExtension) return true;

  return false;
};

module.exports = {
  USER_AGENT_PLACEHOLDER,
  toBase64,
  fromBase64,
  createUri,
  getHeader,
  parseUriField,
  isHtml
};
