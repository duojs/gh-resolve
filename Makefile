
test:
	@node_modules/.bin/mocha \
		--reporter spec \
		--timeout 8s

.PHONY: test
