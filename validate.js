function monkeyPatchPrerenderCloud(lib, options) {
  const origSet = lib.set;
  lib.set = function(key, val) {
    options[key] = val;
    origSet.apply(undefined, arguments);
  };
}
const prerendercloud = require("prerendercloud");
const options = {};
monkeyPatchPrerenderCloud(prerendercloud, options);

const handler = require("./handler");
handler.resetPrerenderCloud();

if (!options["prerenderToken"]) {
  console.log(
    "warning, prerenderToken was not set, requests will be rate limited"
  );
}
