#!/usr/bin/env node
/**
 * Utility script to generate a secure SQL statement or insert a user directly into the database.
 * No hardcoded credentials. Pass parameters via CLI flags or arguments.
 *
 * Usage:
 *   node scripts/create-user-sql.js <username> <password> [role: ADMIN|USER] [fullName] [email]
 *
 * Example:
 *   node scripts/create-user-sql.js masteradmin "MyP@ssw0rd!2026" ADMIN "Master Admin" "admin@demandflowarm.tech"
 */

const { scryptSync, randomBytes } = require('crypto');

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

const args = process.argv.slice(2);
const username = args[0];
const password = args[1];
const role = (args[2] || 'ADMIN').toUpperCase();
const name = args[3] || (role === 'ADMIN' ? 'System Administrator' : 'Operator User');
const email = args[4] || null;

if (!username || !password) {
  console.log(`
Usage:
  node scripts/create-user-sql.js <username> <password> [role] [fullName] [email]

Examples:
  node scripts/create-user-sql.js myadmin "SecurePass123!" ADMIN "Admin User" "admin@demandflowarm.tech"
  node scripts/create-user-sql.js agent1 "AgentPass456!" USER "Agent 1" "agent@demandflowarm.tech"
`);
  process.exit(1);
}

const { hash, salt } = hashPassword(password);
const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
const emailVal = email ? `'${email.replace(/'/g, "''")}'` : 'NULL';
const safeUsername = username.trim().toLowerCase().replace(/'/g, "''");
const safeName = name.replace(/'/g, "''");

const sql = `
-- ============================================================
-- SQL INSERT QUERY FOR USER: ${safeUsername} (${role})
-- Execute in phpMyAdmin / MySQL CLI on your database server
-- ============================================================
INSERT INTO \`User\` (\`id\`, \`username\`, \`name\`, \`email\`, \`passwordHash\`, \`salt\`, \`role\`, \`createdAt\`, \`updatedAt\`)
VALUES (
  '${id}',
  '${safeUsername}',
  '${safeName}',
  ${emailVal},
  '${hash}',
  '${salt}',
  '${role}',
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  \`name\` = VALUES(\`name\`),
  \`email\` = VALUES(\`email\`),
  \`passwordHash\` = VALUES(\`passwordHash\`),
  \`salt\` = VALUES(\`salt\`),
  \`role\` = VALUES(\`role\`),
  \`updatedAt\` = NOW();
`;

console.log(sql);

