![image](https://cloud.githubusercontent.com/assets/22159102/21554484/9d542f5a-cdc4-11e6-8c4c-7730a9e9e2d1.png)

# prerendercloud-lambda-edge

Server-side rendering (prerendering) via Lambda@Edge for single-page apps hosted on CloudFront with an s3 origin.

This is a [serverless](https://github.com/serverless/serverless) project that deploys 2 functions to Lambda, and then associates them with your CloudFront distribution.

Read more:

* https://www.prerender.cloud/
* [Dec, 2016 Lambda@Edge intro](https://aws.amazon.com/blogs/aws/coming-soon-lambda-at-the-edge/)
* [Lambda@Edge docs](http://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html)
* [CloudFront docs for Lambda@Edge](http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html)


#### 1. Prerequisites

1. S3 bucket with index.html and JavaScript files
2. CloudFront distribution pointing to that S3 bucket (that also has * read access to that bucket)

Start with a new test bucket and CloudFront distribution before modifying your production account:

(it'll be quick because you'll be using the defaults with just 1 exception)

* S3 bucket in us-east-1 with default config (doesn't need to be public and doesn't need static web hosting)
  * yes, us-east-1 makes things easier (using any other region will require a URL change for your CloudFront origin)
* CloudFront distribution with S3 origin with default config except:
  * (give CloudFront access to that bucket)
    * "Restrict Bucket Access" = "Yes"
    * "Origin Access Identity" = "Create a New Identity"
    * "Grant Read Permissions on Bucket" = "Yes, Update Bucket Policy"
    * (alternatively your S3 bucket [can be public - meaning an access policy that allows getObject on `*` for `*`](http://docs.aws.amazon.com/AmazonS3/latest/dev/example-bucket-policies.html#example-bucket-policies-use-case-2))
  * recommend enabling "automatic compression"

That's all you need. Now just wait a few minutes for the CloudFront DNS to propogate.

Note, you **will not be creating** a CloudFront "custom error response" that redirects 404s to index.html, and if you already have one, then remove it - because this project uploads a Lambda@Edge function that replaces that functionality (if you don't remove it, this project won't work).

#### 2. Clone this repo

`$ git clone https://github.com/sanfrancesco/prerendercloud-lambda-edge.git`

#### 3. Install Dependencies

( Node v6, yarn >= v1.1.0 ) (note, yarn before v1.1.0 has a bug that causes dev deps to be installed)

`$ yarn install`

#### 4. Hardcode your prerender.cloud auth token

Edit [handler.js](/handler.js) and set your prerender.cloud API token (cmd+f for `prerenderToken`)

#### 5. Hardcode your CloudFront URL

Edit [handler.js](/handler.js) and set your CLoudFront distribution URL or whatever domain is aliased to your CloudFront distribution (cmd+f for `host`).

If you don't set this, the Lambda@Edge will see the host as the S3 origin, which means that's what prerender.cloud will attempt to hit which means you'd need to configure your s3 origin to be publicly accessible. Plus, it's usually better for prerender.cloud to prerender against the canonical URL, not the S3 origin.

#### 6. Edit any other configs (optional)

e.g. `botsOnly`, `removeTrailingSlash`

#### 7. Remove CloudFront custom error response for 404->index.html

If you created a new CloudFront distribution per the prerequisites instructions above, you can skip this. If you're using an existing CloudFront distribution, you need to remove this feature.

It has to be removed because it prevents the execution of the viewer-request function. This project replicates that functionality (see caveats)

1. go here: https://console.aws.amazon.com/cloudfront/home
2. click on your CloudFront distribution
3. click the "error pages" tab
4. make note of the TTL settings (in case you need to re-create it)
5. and delete the custom error response (because having the custom error response prevents the `viewer-request` function from executing).

#### 8. Add `s3:ListBucket` permission to CloudFront user

Since we can't use the "custom error response", and we're implementing it ourselves, this permission is neccessary for CloudFront+Lambda@Edge to return a 404 for a requested file that doesn't exist (only non HTML files will return 404, see caveats below). If you don't add this, you'll get 403 forbidden instead.

If you're not editing an IAM policy specifically, the UI/UX checkbox for this in the S3 interface is, for the bucket, under the "Permissions" tab, "List Objects"

#### 9. Deployment

1. Use an AWS user (in your ~/.aws/credentials) with any of the following permissions: (full root, or see [serverless discussion](https://github.com/serverless/serverless/issues/1439) or you can use the following policies, which are _almost_ root: [AWSLambdaFullAccess, AwsElasticBeanstalkFullAccess])
2. Set the following environment variables when deploying: CLOUDFRONT_DISTRIBUTION_ID (or just edit the [Makefile](Makefile))
3. `$ make deploy`

#### 10. You're done!

Visit a URL associated with your CloudFront distribution. It will take ~3s for the first request. If it times out at 3s, it will just return (and cache) the non-prerendered copy. This is a short-term issue with Lambda@Edge. Work around it, for now, by crawling your SPA with prerender.cloud with a long cache-duration (more detail in caveats section)

#### Viewing AWS Logs in CloudWatch

See logs in CloudWatch in region closest to where you made the request from (although the function is deployed to us-east-1, it is replicated in all regions).

To view logs from command line:

1. use an AWS account with `CloudWatchLogsReadOnlyAccess`
2. `$ pip install awslogs` ( https://github.com/jorgebastida/awslogs )
    * `AWS_REGION=us-west-2 awslogs get -s '1h' /aws/lambda/us-east-1.Lambda-Edge-Prerendercloud-dev-viewerRequest`
    * `AWS_REGION=us-west-2 awslogs get -s '1h' /aws/lambda/us-east-1.Lambda-Edge-Prerendercloud-dev-originRequest`
    * (change `AWS_REGION` to whatever region is closest to where you physically are since that's where the logs will be)
    * (FYI, for some reason, San Francisco based requests are ending up in us-west-2)

#### Viewing Prerender.cloud logs

Sign in to prerender.cloud and you'll see the last few requests made for your API key.

#### Cleanup

`$ make destroy` will attempt to remove the Lambda@Edge functions - but as of Nov 2017, AWS still doesn't allow deleting "replicated functions" - in which case, just unnassociate them from your CloudFront distribution until delete functionality works.

This also means if you attempt to delete and recreate the functions, it will fail - so you'll need to change the name in [serverless.yml](serverless.yml) and [deploy.js](deploy.js) (just append a v2)

You can also sign into AWS and go to CloudFormation and manually remove things.

## Caveats

1. This solution probably won't work unless you cache your URLs into prerender.cloud's cache first
    * This is because Lambda@Edge has a 3s timeout which is not enough time for the prerendering to complete
    * The best practice then, is: crawling before invalidating the CloudFront distrubtion - just hit all of the URLs with [service.prerender.cloud](https://www.prerender.cloud/docs/api) and configure a prerender-cache-duration of something very long - like 1 week.
    * alternatively you can set the CloudFront TTLs to 0s, so CloudFront will request from prerender.cloud servers on every request - so the first call would probably timeout, but the 2nd will not timeout and will come from prerender.cloud cache. This defeats the purpose of using CloudFront though, since you'll be hitting the "origin" (service.prerender.cloud) on every request.
2. This solution will serve index.html in place of something like `/some-special-file.html` even if `/some-special-file.html` exists on your origin
    * We're waiting for the Lambda@Edge to add a feature to address this
3. Redirects (301/302 status codes)
    * if you use `<meta name="prerender-status-code" content="301">` to initiate a redirect, your CloudFront TTL must be zero, otherwise CloudFront will cache the body/response and return status code 200 with the body from the redirected path
4. No support for query strings yet
