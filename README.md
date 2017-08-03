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

## Usage

Set the following environment variables: CLOUDFRONT_DISTRIBUTION_ID

```
$ make deploy
```

## Configure

Edit handler.js, see configuration options here: https://github.com/sanfrancesco/prerendercloud-nodejs
