![image](https://cloud.githubusercontent.com/assets/22159102/21554484/9d542f5a-cdc4-11e6-8c4c-7730a9e9e2d1.png)

# prerendercloud-lambda-edge

Server-side rendering (prerendering) via Lambda@Edge for single-page apps hosted on CloudFront

Read more:

* https://www.prerender.cloud/
* http://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html
* http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html

## Install

```
$ yarn
```

## Usage/Configuration

Edit [handler.js](/handler.js)

1. set your prerender.cloud API token (cmd+f for `prerenderToken`)
2. see additional configuration options here: https://github.com/sanfrancesco/prerendercloud-nodejs

### Deployment
1. Use an AWS user with any of the following permissions:
  * see refined list from here https://github.com/serverless/serverless/issues/1439
  * root access
  * [AWSLambdaFullAccess, AwsElasticBeanstalkFullAccess] (this is almost root)
2. Set the following environment variables when deploying: CLOUDFRONT_DISTRIBUTION_ID

```
$ make deploy
```
