if (!process.env["CLOUDFRONT_DISTRIBUTION_ID"]) {
  throw new Error("CLOUDFRONT_DISTRIBUTION_ID env var must be set");
}

CLOUDFRONT_DISTRIBUTION_ID = process.env["CLOUDFRONT_DISTRIBUTION_ID"]

const AWS = require("aws-sdk");
const cloudfront = new AWS.CloudFront();

cloudfront
  .createInvalidation({
    DistributionId: CLOUDFRONT_DISTRIBUTION_ID,
    InvalidationBatch: {
      Paths: { Quantity: 1, Items: ["/*"] },
      CallerReference: new Date().toISOString()
    }
  })
  .promise()
  .then(console.log);
