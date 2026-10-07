-- Dedicated XAMPP database for lead details.
-- Reads from qa_ai.crmlead. Does not change how the Next.js dev server runs.
-- Re-run this file any time to refresh the copy: mysql -u root < scripts/xampp/create-lead-detail-db.sql

CREATE DATABASE IF NOT EXISTS demandarm_leads
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS demandarm_leads.lead_detail (
  id VARCHAR(191) NOT NULL,
  lead_ref VARCHAR(191) NOT NULL,
  client_code VARCHAR(191) NOT NULL,
  campaign_code VARCHAR(191) NOT NULL,
  campaign_name VARCHAR(255) NULL,
  contact_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  job_title VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  country VARCHAR(128) NULL,
  industry VARCHAR(255) NULL,
  company_size VARCHAR(64) NULL,
  agent_id VARCHAR(64) NULL,
  agent_name VARCHAR(255) NULL,
  recording_url TEXT NULL,
  qa_status VARCHAR(64) NULL,
  lead_status VARCHAR(64) NULL,
  client_delivery_status VARCHAR(64) NULL,
  synced_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lead_detail_ref (lead_ref),
  KEY idx_lead_detail_client (client_code),
  KEY idx_lead_detail_campaign (campaign_code),
  KEY idx_lead_detail_company (company_name)
) ENGINE=InnoDB;

DROP PROCEDURE IF EXISTS demandarm_leads.upsert_lead_detail;

DELIMITER $$
CREATE PROCEDURE demandarm_leads.upsert_lead_detail(
  IN p_id VARCHAR(191),
  IN p_lead_ref VARCHAR(191),
  IN p_client_code VARCHAR(191),
  IN p_campaign_code VARCHAR(191),
  IN p_campaign_name VARCHAR(255),
  IN p_contact_name VARCHAR(255),
  IN p_company_name VARCHAR(255),
  IN p_job_title VARCHAR(255),
  IN p_email VARCHAR(255),
  IN p_phone VARCHAR(64),
  IN p_country VARCHAR(128),
  IN p_industry VARCHAR(255),
  IN p_company_size VARCHAR(64),
  IN p_agent_id VARCHAR(64),
  IN p_agent_name VARCHAR(255),
  IN p_recording_url TEXT,
  IN p_qa_status VARCHAR(64),
  IN p_raw LONGTEXT,
  IN p_synced_at DATETIME(3),
  IN p_created_at DATETIME(3),
  IN p_updated_at DATETIME(3)
)
BEGIN
  INSERT INTO demandarm_leads.lead_detail (
    id, lead_ref, client_code, campaign_code, campaign_name,
    contact_name, company_name, job_title, email, phone,
    country, industry, company_size, agent_id, agent_name,
    recording_url, qa_status, lead_status, client_delivery_status,
    synced_at, created_at, updated_at
  ) VALUES (
    p_id, p_lead_ref, p_client_code, p_campaign_code, p_campaign_name,
    p_contact_name, p_company_name, p_job_title, p_email, p_phone,
    p_country, p_industry, p_company_size, p_agent_id, p_agent_name,
    COALESCE(
      NULLIF(p_recording_url, ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p_raw, '$.recording_path')), 'null'),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p_raw, '$.recording_file_path')), 'null')
    ),
    COALESCE(NULLIF(p_qa_status, ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p_raw, '$.qa_status')), 'null')),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p_raw, '$.lead_status')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p_raw, '$.client_delivery_status')), 'null'),
    p_synced_at, p_created_at, p_updated_at
  )
  ON DUPLICATE KEY UPDATE
    client_code = VALUES(client_code),
    campaign_code = VALUES(campaign_code),
    campaign_name = VALUES(campaign_name),
    contact_name = VALUES(contact_name),
    company_name = VALUES(company_name),
    job_title = VALUES(job_title),
    email = VALUES(email),
    phone = VALUES(phone),
    country = VALUES(country),
    industry = VALUES(industry),
    company_size = VALUES(company_size),
    agent_id = VALUES(agent_id),
    agent_name = VALUES(agent_name),
    recording_url = VALUES(recording_url),
    qa_status = VALUES(qa_status),
    lead_status = VALUES(lead_status),
    client_delivery_status = VALUES(client_delivery_status),
    synced_at = VALUES(synced_at),
    updated_at = VALUES(updated_at);
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS qa_ai.crmlead_lead_detail_insert;
DROP TRIGGER IF EXISTS qa_ai.crmlead_lead_detail_update;

DELIMITER $$
CREATE TRIGGER qa_ai.crmlead_lead_detail_insert
AFTER INSERT ON qa_ai.crmlead
FOR EACH ROW
BEGIN
  CALL demandarm_leads.upsert_lead_detail(
    NEW.id, NEW.leadRef, NEW.clientCode, NEW.campaignCode, NEW.campaignName,
    NEW.contactName, NEW.companyName, NEW.jobTitle, NEW.email, NEW.phone,
    NEW.country, NEW.industry, NEW.companySize, NEW.agentId, NEW.agentName,
    NEW.recordingUrl, NEW.qaStatusCrm, NEW.rawLeadData,
    NEW.syncedAt, NEW.createdAt, NEW.updatedAt
  );
END$$

CREATE TRIGGER qa_ai.crmlead_lead_detail_update
AFTER UPDATE ON qa_ai.crmlead
FOR EACH ROW
BEGIN
  CALL demandarm_leads.upsert_lead_detail(
    NEW.id, NEW.leadRef, NEW.clientCode, NEW.campaignCode, NEW.campaignName,
    NEW.contactName, NEW.companyName, NEW.jobTitle, NEW.email, NEW.phone,
    NEW.country, NEW.industry, NEW.companySize, NEW.agentId, NEW.agentName,
    NEW.recordingUrl, NEW.qaStatusCrm, NEW.rawLeadData,
    NEW.syncedAt, NEW.createdAt, NEW.updatedAt
  );
END$$
DELIMITER ;

INSERT INTO demandarm_leads.lead_detail (
  id, lead_ref, client_code, campaign_code, campaign_name,
  contact_name, company_name, job_title, email, phone,
  country, industry, company_size, agent_id, agent_name,
  recording_url, qa_status, lead_status, client_delivery_status,
  synced_at, created_at, updated_at
)
SELECT
  id, leadRef, clientCode, campaignCode, campaignName,
  contactName, companyName, jobTitle, email, phone,
  country, industry, companySize, agentId, agentName,
  COALESCE(
    NULLIF(recordingUrl, ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawLeadData, '$.recording_path')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawLeadData, '$.recording_file_path')), 'null')
  ),
  COALESCE(NULLIF(qaStatusCrm, ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawLeadData, '$.qa_status')), 'null')),
  NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawLeadData, '$.lead_status')), 'null'),
  NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawLeadData, '$.client_delivery_status')), 'null'),
  syncedAt, createdAt, updatedAt
FROM qa_ai.crmlead
ON DUPLICATE KEY UPDATE
  client_code = VALUES(client_code),
  campaign_code = VALUES(campaign_code),
  campaign_name = VALUES(campaign_name),
  contact_name = VALUES(contact_name),
  company_name = VALUES(company_name),
  job_title = VALUES(job_title),
  email = VALUES(email),
  phone = VALUES(phone),
  country = VALUES(country),
  industry = VALUES(industry),
  company_size = VALUES(company_size),
  agent_id = VALUES(agent_id),
  agent_name = VALUES(agent_name),
  recording_url = VALUES(recording_url),
  qa_status = VALUES(qa_status),
  lead_status = VALUES(lead_status),
  client_delivery_status = VALUES(client_delivery_status),
  synced_at = VALUES(synced_at),
  updated_at = VALUES(updated_at);
