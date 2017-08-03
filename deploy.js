if (!process.env["CLOUDFRONT_DISTRIBUTION_ID"]) {
  throw new Error("CLOUDFRONT_DISTRIBUTION_ID env var must be set");
}

CLOUDFRONT_DISTRIBUTION_ID = process.env["CLOUDFRONT_DISTRIBUTION_ID"]

const lambdaMappings = [
  {
    FunctionName: "Lambda-Edge-Prerendercloud-dev-originRequest",
    EventType: "origin-request"
  },
  {
    FunctionName: "Lambda-Edge-Prerendercloud-dev-viewerRequest",
    EventType: "viewer-request"
  }
];

const AWS = require("aws-sdk");
AWS.config.region = "us-east-1";

const lambda = new AWS.Lambda();
const cloudfront = new AWS.CloudFront();

const getLatestVersion = lambdaMapping =>
  lambda
    .listVersionsByFunction({
      FunctionName: lambdaMapping.FunctionName,
      MaxItems: 1000
    })
    .promise()
    .then(
      res =>
        res.Versions.sort(
          (a, b) => (parseInt(a.Version) > parseInt(b.Version) ? -1 : 1)
        )[0]
    )
    .then(latest => ({
      EventType: lambdaMapping.EventType,
      LambdaFunctionARN: latest.FunctionArn
    }));

const updateCloudFront = (cloudFrontId, lambdaMappings) =>
  cloudfront.getDistributionConfig({ Id: cloudFrontId }).promise().then(res => {
    console.log(
      "b4",
      res.DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations
        .Items
    );
    res.DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations = {
      Quantity: lambdaMappings.length,
      Items: lambdaMappings
    };
    console.log(
      "after",
      res.DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations
        .Items
    );

    const IfMatch = res.ETag;
    delete res.ETag;
    const Id = cloudFrontId;

    return cloudfront
      .updateDistribution(Object.assign(res, { Id, IfMatch }))
      .promise();
  });

return Promise.all(
  lambdaMappings.map(lambdaMapping => getLatestVersion(lambdaMapping))
)
  .then(lambdaMappings =>
    updateCloudFront(CLOUDFRONT_DISTRIBUTION_ID, lambdaMappings)
  )
  .then(console.log);
