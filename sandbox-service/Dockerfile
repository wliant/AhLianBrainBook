# Build context must be the project root (set via docker-compose build.context: .)
FROM golang:1.23-alpine AS build

RUN apk add --no-cache git protobuf protobuf-dev

# Install protoc plugins
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.2 && \
    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.5.1

WORKDIR /src

# Copy everything needed for the build
COPY proto/ /proto/
COPY sandbox-service/go.mod sandbox-service/go.sum* ./
COPY sandbox-service/ .

# Generate proto code
RUN mkdir -p gen/sandbox/v1 && \
    protoc \
        --proto_path=/proto \
        --proto_path=/usr/include \
        --go_out=gen --go_opt=paths=source_relative \
        --go-grpc_out=gen --go-grpc_opt=paths=source_relative \
        sandbox/v1/sandbox.proto

# Resolve dependencies (now that all source + generated code is present)
RUN go mod tidy && go mod download

# Build
RUN CGO_ENABLED=0 go build -o /app/server ./cmd/server

# --- Runtime ---
FROM alpine:3.21

RUN apk add --no-cache git ca-certificates tzdata
RUN addgroup -S app && adduser -S app -G app
RUN mkdir -p /data/sandboxes && chown -R app:app /data

COPY --from=build /app/server /app/server

# grpc_health_probe for Docker healthcheck
ADD https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/v0.4.35/grpc_health_probe-linux-amd64 /app/grpc_health_probe
RUN chmod +x /app/grpc_health_probe

USER app
WORKDIR /app
ENV TZ=UTC
EXPOSE 50051
ENTRYPOINT ["/app/server"]
