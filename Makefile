.PHONY: clean check test

REPORTSDIR = reports
LIBDIR = lib

all: node_modules lib

node_modules: package.json
	@npm install
	@touch $@

check:
	@eslint --ext .js,.jsx ./src

test: clean node_modules check
	@jest

clean:
	@rm -rf $(LIBDIR)
	@rm -rf $(REPORTSDIR)

lib: clean
	@NODE_ENV=rollup rollup -c
