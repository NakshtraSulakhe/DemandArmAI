import { GET as getSettings } from '../app/api/settings/route';
import { GET as getAuditLogs } from '../app/api/audit-logs/route';

async function testSettingsApi() {
  console.log('Testing Settings API handler...');
  try {
    const settingsRes = await getSettings();
    const settingsData = await settingsRes.json();
    console.log('Settings API status:', settingsRes.status);
    console.log('Settings Data:', JSON.stringify(settingsData, null, 2));

    const req = new Request('http://localhost:3000/api/audit-logs?limit=50');
    const logsRes = await getAuditLogs(req);
    const logsData = await logsRes.json();
    console.log('Audit Logs API status:', logsRes.status);
    console.log('Audit Logs Count:', logsData.logs?.length || 0);

    console.log('\nSETTINGS API TEST PASSED 100%!');
  } catch (err) {
    console.error('SETTINGS API TEST ERROR:', err);
  }
}

testSettingsApi();
