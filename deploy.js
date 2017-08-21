if (!process.env["CLOUDFRONT_DISTRIBUTION_ID"]) {
  throw new Error("CLOUDFRONT_DISTRIBUTION_ID env var must be set");
}

CLOUDFRONT_DISTRIBUTION_ID = process.env["CLOUDFRONT_DISTRIBUTION_ID"];

const lambdaMappings = [
  {
    FunctionName: "Lambda-Edge-Prerendercloud-dev-viewerRequest",
    EventType: "viewer-request"
  },
  {
    FunctionName: "Lambda-Edge-Prerendercloud-dev-originRequest",
    EventType: "origin-request"
  }
];

const AWS = require("aws-sdk");
AWS.config.region = "us-east-1";

const lambda = new AWS.Lambda();
const cloudfront = new AWS.CloudFront();

const getLastPageOfVersions = (lambdaMapping, Marker) =>
  lambda
    .listVersionsByFunction({
      FunctionName: lambdaMapping.FunctionName,
      MaxItems: 1000, // there's a bug that causes this to return 50 no matter what https://github.com/aws/aws-sdk-js/issues/1118
      Marker
    })
    .promise()
    .then(res => {
      if (res.NextMarker)
        return getLastPageOfVersions(lambdaMapping, res.NextMarker);

      return res;
    });

const getLatestVersion = lambdaMapping =>
  getLastPageOfVersions(lambdaMapping)
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
      "before",
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
  .catch(err => {
    console.log(
      "\n\n------Error while associating Lambda functions with CloudFront------\n\n"
    );
    console.error(err);
    console.log("\n\n");
  })
  .then(res => {
    console.log("\n\n");
    // console.log(res);
    console.log(
      "\n\nSuccessfully associated Lambda functions with CloudFront\n\n"
    );
  });
