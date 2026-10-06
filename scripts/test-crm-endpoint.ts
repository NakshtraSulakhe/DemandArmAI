async function testClientCodes() {
  console.log('Testing client_code parameters against CRM API...');
  const baseUrl = 'https://app.tarajglobal.com/demandflowbridge/api/get_leads.php';
  const codesToTest = ['1020', '1010', '1030', '1001', 'ALL', 'all', '1', '2', '3', '4', '1000', 'softwarefinder'];

  for (const code of codesToTest) {
    try {
      const url = new URL(baseUrl);
      url.searchParams.set('client_code', code);
      url.searchParams.set('limit', '50');

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}

      const leads = data.leads || data.data || (Array.isArray(data) ? data : []);
      const status = data.status || (res.ok ? 'success' : 'error');

      console.log(`Code '${code}': HTTP ${res.status} | Status: ${status} | Leads count: ${leads.length} | Msg: ${data.message || 'OK'}`);

      if (leads.length > 0) {
        console.log(`   --> FOUND ${leads.length} LEADS FOR CODE '${code}'!`);
        console.log('   Sample Lead:', JSON.stringify(leads[0]).slice(0, 200));
      }
    } catch (err: any) {
      console.error(`Code '${code}' error:`, err.message);
    }
  }
}

testClientCodes();
