# Prerender CloudFront (via AWS Lambda@Edge)

![image](https://cloud.githubusercontent.com/assets/22159102/21554484/9d542f5a-cdc4-11e6-8c4c-7730a9e9e2d1.png)

Server-side rendering (pre-rendering) via Lambda@Edge for single-page apps hosted on CloudFront with an s3 origin.

This is a [serverless](https://github.com/serverless/serverless) project with a `make deploy` command that:

1. deploys 2 functions to Lambda
2. associates them with your CloudFront distribution
3. clears/invalidates your CloudFront cache

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

**(this step is only necessary if you are using an existing CloudFront distribution)**

If you created a new CloudFront distribution per the prerequisites instructions above, you can skip this. If you're using an existing CloudFront distribution, you need to remove this feature.

It has to be removed because it prevents the execution of the viewer-request function. This project replicates that functionality (see caveats)

1. go here: https://console.aws.amazon.com/cloudfront/home
2. click on your CloudFront distribution
3. click the "error pages" tab
4. make note of the TTL settings (in case you need to re-create it)
5. and delete the custom error response (because having the custom error response prevents the `viewer-request` function from executing).

#### 8. Add `s3:ListBucket` permission to CloudFront user

**(this step is only necessary if you want 404s to work)**

Since we can't use the "custom error response", and we're implementing it ourselves, this permission is neccessary for CloudFront+Lambda@Edge to return a 404 for a requested file that doesn't exist (only non HTML files will return 404, see caveats below). If you don't add this, you'll get 403 forbidden instead.

If you're not editing an IAM policy specifically, the UI/UX checkbox for this in the S3 interface is, for the bucket, under the "Permissions" tab, "List Objects"

#### 9. Lambda@Edge function Deployment (only needs to be done once)

1. Make sure there's a "default" section in your ~/.aws/credentials file with aws_access_key_id/aws_secret_access_key that have any of the following permissions: (full root, or see [serverless discussion](https://github.com/serverless/serverless/issues/1439) or you can use the following policies, which are _almost_ root: [AWSLambdaFullAccess, AwsElasticBeanstalkFullAccess])
2. now run: `$ CLOUDFRONT_DISTRIBUTION_ID=whateverYourDistributionIdIs make deploy`
3. See the created Lambda function in Lambda: https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions
4. See the created Lambda function in CloudFront: (refresh it, click your distribution, then the behaviors tab, then the checkbox + edit button for the first item in the list, then scroll to bottom of that page to see "Lambda Function Associations")

#### 10. Deployment (of your single-page application)

1. sync/push the files to s3
2. invalidate CloudFront
3. you're done (no need to deploy the Lambda@Edge function after this initial setup)

caveat: note that prerender.cloud has a 5-minute server cache that you can disable, see `disableServerCache` in [handler.js](/handler.js)

#### 11. You're done!

Visit a URL associated with your CloudFront distribution. **It will take a few seconds** for the first request (because it is pre-rendered on the first request). If for some reason the pre-render request fails or times out, the non-pre-rendered request will be cached.

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

1. If you can't tolerate a slow first request (where subsequent requests are served from cache in CloudFront):
    * crawl before invalidating the CloudFront distrubtion - just hit all of the URLs with [service.prerender.cloud](https://www.prerender.cloud/docs/api) and configure a `prerender-cache-duration` of something longer than the default of 5 minutes (300) - like 1 week (604800).
2. This solution will serve index.html in place of something like `/some-special-file.html` even if `/some-special-file.html` exists on your origin
    * We're waiting for the Lambda@Edge to add a feature to address this
    * in the meantime use the `blacklistPaths` option (see [handler.js](https://github.com/sanfrancesco/prerendercloud-lambda-edge/blob/ccd87b5484a4334d823dbb8f0df16e843b2dc910/handler.js#L81))
3. Redirects (301/302 status codes)
    * if you use `<meta name="prerender-status-code" content="301">` to initiate a redirect, your CloudFront TTL must be zero, otherwise CloudFront will cache the body/response and return status code 200 with the body from the redirected path

## Troubleshooting

* Read through the console output from the `make deploy` command and look for errors
* Check your user-agent if using botsOnly
* Sometimes (rarely) you'll see an error message on the webpage itself.
* Check the AWS logs (see section "Viewing AWS Logs in CloudWatch")
* Check Prerender.cloud logs (see section "Viewing Prerender.cloud logs")
* Sometimes (rarely) there's an actual problem with AWS Lambda and you [may just need to re-deploy](https://www.reddit.com/r/aws/comments/7gumv7/question_aws_lambda_nodejs610_environment_issue/)
