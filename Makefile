.PHONY: deploy test

deploy:
	./node_modules/.bin/serverless deploy
	node deploy.js
	node create-invalidation.js

test:
	DEBUG=prerendercloud PRERENDER_SERVICE_URL="https://service.prerender.cloud" ./node_modules/jasmine/bin/jasmine.js
