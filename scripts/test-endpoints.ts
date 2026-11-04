import http from 'http';

function testEndpoint(path: string, method = 'GET') {
  return new Promise((resolve) => {
    const req = http.request(
      `http://localhost:3000${path}`,
      {
        method,
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, data: data.slice(0, 200) }));
      }
    );
    req.on('error', (e) => resolve({ error: e.message }));
    if (method === 'POST') req.write('{}');
    req.end();
  });
}

async function runTests() {
  console.log('Testing endpoints on running server:');
  console.log('1. GET /api/jobs/job_1793805601161_6fhl ->', await testEndpoint('/api/jobs/job_1793805601161_6fhl', 'GET'));
  console.log('2. POST /api/jobs/job_1793805601161_6fhl/retry ->', await testEndpoint('/api/jobs/job_1793805601161_6fhl/retry', 'POST'));
  console.log('3. POST /api/jobs/job_1793805601161_6fhl/process ->', await testEndpoint('/api/jobs/job_1793805601161_6fhl/process', 'POST'));
  console.log('4. POST /api/jobs/process ->', await testEndpoint('/api/jobs/process', 'POST'));
}

runTests();

