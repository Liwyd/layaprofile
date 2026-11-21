// Ports and URLs shared by the Playwright config, the mock server and the specs. Both ports can
// be overridden (for example when 3125 or 3126 is taken on a developer machine).
export const APP_PORT = Number(process.env.E2E_APP_PORT) || 3125;
export const MOCK_PORT = Number(process.env.E2E_MOCK_PORT) || 3126;
export const HOST = '127.0.0.1';
export const APP_URL = `http://${HOST}:${APP_PORT}`;
export const MOCK_URL = `http://${HOST}:${MOCK_PORT}`;
