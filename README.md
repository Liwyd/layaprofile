# LayaProfile

Local intelligence for GitHub profiles and repositories.

LayaProfile is an evolution of [OctoProfile](https://github.com/bchiang7/octoprofile) by Brittany
Chiang, used under the MIT license (see [LICENSE](LICENSE)).

![demo](public/og.png)

Built with:

- [Next.js](https://nextjs.org/) (Pages Router)
- [React](https://react.dev/)
- [Chart.js](https://www.chartjs.org/)
- [Styled Components](https://styled-components.com/)

## Getting Started

Requires Node.js 20 or newer (`.nvmrc` pins 22).

1. Install dependencies

   ```bash
   npm install
   ```

2. Fire up the dev server

   ```bash
   npm run dev
   ```

3. Open http://localhost:3000 and search for a GitHub username. Profiles live at `/user/<username>`.

## Scripts

| Script               | Purpose                                  |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start the development server             |
| `npm run build`      | Create the production (standalone) build |
| `npm start`          | Serve the production build               |
| `npm run lint`       | Run ESLint                               |
| `npm run format`     | Format the source with Prettier          |
| `npm test`           | Run the unit tests once (Vitest)         |
| `npm run test:watch` | Run the unit tests in watch mode         |
