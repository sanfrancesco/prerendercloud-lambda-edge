// This script is meant to be run from your own laptop, build environment,
// or some separate process (as opposed to the Lambda@Edge function)
// It expects CLOUDFRONT_DISTRIBUTION_ID env var
// and since it uses the aws-sdk lib, it assumes your AWS keys are in either:
//   * in the file: ~/.aws/credentials
//   * or in the env vars: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
// see https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html

if (!process.env["CLOUDFRONT_DISTRIBUTION_ID"]) {
  throw new Error("CLOUDFRONT_DISTRIBUTION_ID env var must be set");
}

CLOUDFRONT_DISTRIBUTION_ID = process.env["CLOUDFRONT_DISTRIBUTION_ID"];

const AWS = require("aws-sdk");
const cloudfront = new AWS.CloudFront();
const util = require("./lib/util");

function createCloudfrontInvalidation(items = []) {
  return cloudfront
    .createInvalidation({
      DistributionId: CLOUDFRONT_DISTRIBUTION_ID,
      InvalidationBatch: {
        Paths: { Quantity: items.length, Items: items },
        CallerReference: new Date().toISOString()
      }
    })
    .promise()
    .then(console.log);
}

// e.g. invalidatePaths(["/docs", "/pricing"])
function invalidatePaths(paths) {
  // map the paths into the custom format this library uses: "/" + toBase64(JSON.stringify({ uri, shouldPrerender }));
  // before: ["/docs", "/pricing"]
  // after:  ["eyJ1cmkiOiIvZG9jcyIsInNob3VsZFByZXJlbmRlciI6dHJ1ZX0=", "/eyJ1cmkiOiIvcHJpY2luZyIsInNob3VsZFByZXJlbmRlciI6dHJ1ZX0="]
  const cloudFrontUrls = paths.map(path => util.createUri(path, true));

  return createCloudfrontInvalidation(cloudFrontUrls);
}

function invalidateEverything() {
  return createCloudfrontInvalidation(["/*"]);
}

invalidateEverything();

// This script calls `invalidateEverything` to invalidate all possible paths on your
// CloudFront distribution. If instead you want to invalidate a distinct set of paths,
// use invalidatePaths.
// invalidatePaths(["/docs", "/pricing"]);
