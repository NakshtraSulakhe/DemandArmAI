async function main() {
  console.log('Sending sync request for 2026-11-03...');
  const res = await fetch('http://localhost:3000/api/crm/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dateFrom: '2026-11-03' }),
  });
  console.log('HTTP status:', res.status);
  const data = await res.json();
  console.log('Sync Metrics:', JSON.stringify(data.metrics?.clientMetrics, null, 2));

  // Now query All Leads for 2026-11-03
  const resLeads = await fetch('http://localhost:3000/api/leads?dateFrom=2026-11-03&dateTo=2026-11-03&limit=10');
  const dataLeads = await resLeads.json();
  console.log('\n--- All Leads for 2026-11-03 ---');
  console.log('Total 3 Nov leads:', dataLeads.pagination?.totalLeads);
  if (dataLeads.jobs?.length > 0) {
    console.log('First lead on 3 Nov:');
    const j = dataLeads.jobs[0];
    console.log({
      id: j.id,
      leadRef: j.leadRef,
      contactName: j.lead?.contactName,
      companyName: j.lead?.companyName,
      clientCode: j.lead?.clientCode,
      campaignName: j.lead?.campaignName || j.lead?.campaignCode,
      qaStatus: j.lead?.qaStatusCrm,
      createdAt: j.lead?.createdAt,
      procStatus: j.processingStatus,
    });
  }

  // Now query Active Queue for 2026-11-03
  const resQueue = await fetch('http://localhost:3000/api/queue?tab=active&dateFrom=2026-11-03&dateTo=2026-11-03&limit=10');
  const dataQueue = await resQueue.json();
  console.log('\n--- Active Queue for 2026-11-03 ---');
  console.log('Total jobs in active queue for 3 Nov:', dataQueue.pagination?.totalJobs);
}

main().catch(console.error);

