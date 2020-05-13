.PHONY: build push

build:
	docker build -t coopernurse/maelstrom-dashboard .

push:
	docker push coopernurse/maelstrom-dashboard
