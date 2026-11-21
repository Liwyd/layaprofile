# gateway-api

An HTTP API gateway written in Go. It sits in front of your services and adds rate limiting,
JWT authentication and request logging.

## Installation

```bash
go install github.com/alice/gateway-api/cmd/gateway@latest
```

Or run the published image:

```bash
docker run -p 8080:8080 -v $(pwd)/gateway.yaml:/etc/gateway.yaml alice/gateway-api
```

## Usage

```bash
gateway --config gateway.yaml
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/v1/orders
```

## Configuration

Routes, limits and the JWT issuer are set in `gateway.yaml`. Every key can be overridden with an
environment variable such as `GATEWAY_RATE_LIMIT`.

## API reference

The admin API is documented with OpenAPI in [docs/openapi.yaml](docs/openapi.yaml).

## Contributing

Run `make test` and `make lint` before opening a pull request.

## License

Apache-2.0
