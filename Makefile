
test:
	@node_modules/.bin/mocha \
		--reporter spec \
		--timeout 4s

.PHONY: test
