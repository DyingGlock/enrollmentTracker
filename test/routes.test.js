const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../src/app');

async function withServer(run) {
  const server = app.listen(0);

  try {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

test('GET /api/health returns health payload', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      ok: true,
      service: 'enrollment-tracker',
    });
  });
});

test('GET /health returns the same health payload', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      ok: true,
      service: 'enrollment-tracker',
    });
  });
});

test('HEAD webhook works on both route shapes', async () => {
  await withServer(async (baseUrl) => {
    const apiResponse = await fetch(`${baseUrl}/api/trello-webhook`, {
      method: 'HEAD',
    });
    const compatResponse = await fetch(`${baseUrl}/trello-webhook`, {
      method: 'HEAD',
    });

    assert.equal(apiResponse.status, 200);
    assert.equal(compatResponse.status, 200);
  });
});

test('GET webhook readiness works on both route shapes', async () => {
  await withServer(async (baseUrl) => {
    const apiResponse = await fetch(`${baseUrl}/api/trello-webhook`);
    const compatResponse = await fetch(`${baseUrl}/trello-webhook`);

    assert.equal(apiResponse.status, 200);
    assert.equal(compatResponse.status, 200);
    assert.deepEqual(await apiResponse.json(), {
      message: 'trello webhook endpoint ready',
    });
    assert.deepEqual(await compatResponse.json(), {
      message: 'trello webhook endpoint ready',
    });
  });
});

test('POST webhook accepts valid JSON on both route shapes', async () => {
  await withServer(async (baseUrl) => {
    const payload = {
      action: {
        type: 'updateCard',
        data: {
          card: {
            id: 'test-card-id',
            name: 'Test User:12345',
          },
        },
      },
    };

    const apiResponse = await fetch(`${baseUrl}/api/trello-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const compatResponse = await fetch(`${baseUrl}/trello-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(apiResponse.status, 200);
    assert.equal(compatResponse.status, 200);

    const apiBody = await apiResponse.json();
    const compatBody = await compatResponse.json();

    assert.deepEqual(apiBody, { ok: true });
    assert.deepEqual(compatBody, { ok: true });
  });
});

test('GET /api/current-class returns current class data', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/current-class`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.currentClass, /^Class \d+$/);
    assert.ok(Array.isArray(body.statusCounts));
    assert.equal(typeof body.totalApplications, 'number');
  });
});

test('tracker pages render successfully', async () => {
  await withServer(async (baseUrl) => {
    const [activeResponse, archivedResponse] = await Promise.all([
      fetch(`${baseUrl}/`),
      fetch(`${baseUrl}/archived`),
    ]);

    assert.equal(activeResponse.status, 200);
    assert.equal(archivedResponse.status, 200);
    assert.match(await activeResponse.text(), /POST Enrollment Tracker/);
    assert.match(await archivedResponse.text(), /Archived Applications/);
  });
});

test('unknown routes still return the 404 payload', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/does-not-exist`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, {
      ok: false,
      message: 'Not found',
    });
  });
});
