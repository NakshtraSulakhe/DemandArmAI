import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing Prisma Database Connection...');
  try {
    const settings = await prisma.systemSettings.findMany();
    console.log('System Settings count:', settings.length);
    const clients = await prisma.client.findMany();
    console.log('Clients count:', clients.length);
    const campaigns = await prisma.campaign.findMany();
    console.log('Campaigns count:', campaigns.length);
    const leads = await prisma.crmLead.findMany();
    console.log('Leads count:', leads.length);
    const jobs = await prisma.processingJob.findMany();
    console.log('Jobs count:', jobs.length);
    console.log('DB CONNECTION SUCCESSFUL!');
  } catch (err) {
    console.error('DB CONNECTION ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
