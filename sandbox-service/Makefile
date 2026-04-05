.PHONY: generate build test clean

# Install protoc plugins and generate Go code from proto files
generate:
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	mkdir -p gen/sandbox/v1
	protoc \
		--proto_path=../proto \
		--go_out=gen --go_opt=paths=source_relative \
		--go-grpc_out=gen --go-grpc_opt=paths=source_relative \
		sandbox/v1/sandbox.proto

build:
	CGO_ENABLED=0 go build -o bin/server ./cmd/server

test:
	go test ./...

clean:
	rm -rf bin/ gen/
