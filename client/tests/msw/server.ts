/**
 * Shared MSW server instance for vitest unit/component tests.
 *
 * Lifecycle hooks (beforeAll / afterEach / afterAll) are wired up in
 * tests/setup.ts so every test file automatically gets them without
 * importing this file directly.
 *
 * Individual tests can add one-off handlers with:
 *   server.use(http.post('/api/...', handler))
 * and they are automatically reset after each test via afterEach.
 */
import { setupServer } from 'msw/node';

export const server = setupServer();
