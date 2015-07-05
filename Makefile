
BIN := ./node_modules/.bin
MOCHA := $(BIN)/mocha
ESLINT := $(BIN)/eslint

test: node_modules
	@$(MOCHA)

node_modules: package.json
	@npm install
	@touch $@

lint: node_modules
	@$(ESLINT) .

.PHONY: test lint
