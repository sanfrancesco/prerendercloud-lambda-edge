const toBase64 = str => Buffer.from(str).toString("base64");
const fromBase64 = str => Buffer.from(str, "base64").toString("utf8");
const createUri = (uri, userAgent) =>
  "/" + toBase64(JSON.stringify({ uri, userAgent }));

module.exports = { toBase64, fromBase64, createUri };
