# web-dashboard

Real-time metrics dashboard built with React and TypeScript. It renders live charts from any
JSON metrics endpoint and keeps the last hour of data in the browser.

## Features

- Live line and bar charts with automatic reconnects
- Dark and light themes that follow the system setting
- Keyboard accessible controls and a table view for every chart

## Installation

```bash
git clone https://github.com/alice/web-dashboard.git
cd web-dashboard
npm install
```

## Usage

Start the development server and open http://localhost:5173:

```bash
npm run dev
```

Build and preview the production bundle:

```bash
npm run build
npm run preview
```

## Configuration

Copy `.env.example` to `.env` and set the variables below.

| Variable           | Description                          |
| ------------------ | ------------------------------------ |
| `VITE_METRICS_URL` | Endpoint that returns the metrics    |
| `VITE_REFRESH_MS`  | Polling interval, 5000 by default    |

## API documentation

The expected metrics format is described in [docs/metrics.md](docs/metrics.md).

## Contributing

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first and
run `npm test` before you open a pull request.

## License

MIT
