.PHONY: destroy deploy invalidate listinvalidations test destroy

destroy:
	./node_modules/.bin/serverless remove

deploy:
	node ./validate.js
	./node_modules/.bin/serverless deploy
	CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID}" node deploy.js
	CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID}" node create-invalidation.js

invalidate:
	CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID}" node create-invalidation.js

listinvalidations:
	aws cloudfront list-invalidations --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" | tail | head -25

test:
	DEBUG=prerendercloud PRERENDER_SERVICE_URL="https://service.prerender.cloud" ./node_modules/jasmine/bin/jasmine.js
