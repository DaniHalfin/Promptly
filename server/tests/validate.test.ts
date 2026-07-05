/**
 * validate.test.ts — HTTP integration tests for POST /api/sources/chatgpt_export/validate
 * Starts the express app on a random OS-assigned port, uses native fetch.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import type { Application } from 'express';
import { createApp } from '../src/index.js';

let app: Application;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  app = await createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Build multipart FormData with a file field named "file" */
function makeFormData(fileContent: string | Buffer, filename = 'conversations.json'): FormData {
  const formData = new FormData();
  const content = typeof fileContent === 'string' ? fileContent : fileContent.toString('utf-8');
  const blob = new Blob([content], { type: 'application/json' });
  formData.append('file', blob, filename);
  return formData;
}

/** Build a valid ChatGPT conversations array with conversations within the date window */
function validConversations(updateTimeIso = '2026-06-15T12:00:00Z') {
  return JSON.stringify([
    {
      id: 'conv-1',
      title: 'Test',
      create_time: new Date(updateTimeIso).getTime() / 1000,
      update_time: new Date(updateTimeIso).getTime() / 1000,
      mapping: {
        node0: { message: { author: { role: 'user' }, content: { parts: ['hi'] }, metadata: {} } },
      },
    },
  ]);
}

describe('validate route', () => {
  it('POST /api/sources/chatgpt_export/validate with valid JSON array returns { valid: true }', async () => {
    const formData = makeFormData(validConversations());
    const res = await fetch(`${baseUrl}/api/sources/chatgpt_export/validate`, {
      method: 'POST',
      body: formData,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(true);
  });

  it('POST /api/sources/chatgpt_export/validate with invalid JSON returns { valid: false } and error message', async () => {
    const formData = makeFormData('this is not valid json {{{');
    const res = await fetch(`${baseUrl}/api/sources/chatgpt_export/validate`, {
      method: 'POST',
      body: formData,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { valid: boolean; error?: string };
    expect(body.valid).toBe(false);
    expect(typeof body.error).toBe('string');
    expect(body.error!.length).toBeGreaterThan(0);
  });

  it('POST /api/sources/chatgpt_export/validate with non-array JSON returns { valid: false }', async () => {
    const formData = makeFormData(JSON.stringify({ not: 'an array' }));
    const res = await fetch(`${baseUrl}/api/sources/chatgpt_export/validate`, {
      method: 'POST',
      body: formData,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(false);
  });

  it('POST /api/sources/chatgpt_export/validate with empty-period conversations returns { valid: false } with period message', async () => {
    // Conversations are all in Jan 2026; request window is Feb 2026
    const conversations = JSON.stringify([
      {
        id: 'old-conv',
        update_time: new Date('2026-01-10T12:00:00Z').getTime() / 1000,
        mapping: {},
      },
    ]);
    const formData = makeFormData(conversations);
    // Add startDate/endDate as form fields
    formData.append('startDate', '2026-02-01');
    formData.append('endDate', '2026-02-28');

    const res = await fetch(`${baseUrl}/api/sources/chatgpt_export/validate`, {
      method: 'POST',
      body: formData,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { valid: boolean; error?: string };
    expect(body.valid).toBe(false);
    // Must surface a message about the period mismatch
    expect(typeof body.error).toBe('string');
    expect(body.error!.toLowerCase()).toContain('period');
  });
});
