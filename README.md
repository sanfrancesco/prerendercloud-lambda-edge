![image](https://cloud.githubusercontent.com/assets/22159102/21554484/9d542f5a-cdc4-11e6-8c4c-7730a9e9e2d1.png)

# prerendercloud-lambda-edge

Server-side rendering (prerendering) via Lambda@Edge for single-page apps hosted on CloudFront with an s3 origin.

This is a [serverless](https://github.com/serverless/serverless) project that deploys 2 functions to Lambda, and then associates them with your CloudFront distribution.

Read more:

* https://www.prerender.cloud/
* [Dec, 2016 Lambda@Edge intro](https://aws.amazon.com/blogs/aws/coming-soon-lambda-at-the-edge/)
* [Lambda@Edge docs](http://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html)
* [CloudFront docs for Lambda@Edge](http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html)

## 1. Install

1. (use yarn because `npm install`'s package-lock.json causes serverless to send the dev dependencies from the node_modules directory which is too big for Lambda@Edge)
2. `$ yarn`

## 2. Usage/Configuration

1. Edit [handler.js](/handler.js)
    * set your prerender.cloud API token (cmd+f for `prerenderToken`)
2. remove your CloudFront custom error response that rewrites 404s to /index.html (this will replicate that functionality)

## 3. Remove CloudFront custom error response

1. go here: https://console.aws.amazon.com/cloudfront/home
2. click on your CloudFront distribution
3. click the "error pages" tab
4. make note of the TTL settings (in case you need to re-create it)
5. and delete the custom error response (because having the custom error response prevents the `viewer-request` function from executing). We've replicated that functionality in this project (see caveats below)

## 4. Deployment

1. Use an AWS user (in your ~/.aws/credentials) with any of the following permissions: (full root, or see [serverless discussion](https://github.com/serverless/serverless/issues/1439) or you can use the following policies, which is _almost_ root: [AWSLambdaFullAccess, AwsElasticBeanstalkFullAccess])
2. Set the following environment variables when deploying: CLOUDFRONT_DISTRIBUTION_ID
3. `$ make deploy`

## 5. You're done!

Visit a URL associated with your CloudFront distribution. It will take ~3s for the first request. If it times out at 3s, it will just return (and cache) the non-prerendered copy. This is a short-term issue with Lambda@Edge. Work around it, for now, by crawling your SPA with prerender.cloud with a long cache-duration.

## Viewing Logs

See logs in CloudFront in region closest to where you made the request from (although the function is deployed to us-east-1, it is replicated in all regions).

## TODO

* normalize trailing slash?


## Caveats

This rewrites all extensionless or HTML paths to /index.html, which is _almost_ the typical single-page app hosting behavior. Usually the path is checked for existence on the origin (s3) _before_ rewriting to index.html.

The consequence is that if you have a file on s3, for example, with a path of `/docs` (or docs.html, or /whatever, or whatever.html), it will not be served. Instead, `/index.html` will be served.
