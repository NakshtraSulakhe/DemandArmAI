-- ========================================================================
-- DemandArm AI QA Platform - Database Migration: User Authentication & RBAC
-- Target Engine: MySQL 5.7+ / MySQL 8.0+ / MariaDB / phpMyAdmin
-- Database: demandarmai (or your active DATABASE_URL database)
-- ========================================================================

-- 1. Ensure the database exists (optional if database is already created)
CREATE DATABASE IF NOT EXISTS `demandarmai` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `demandarmai`;

-- 2. Create the User table for authentication and RBAC roles (ADMIN and USER)
CREATE TABLE IF NOT EXISTS `User` (
  `id` VARCHAR(191) NOT NULL,
  `username` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NULL,
  `passwordHash` TEXT NOT NULL,
  `salt` VARCHAR(64) NOT NULL,
  `role` VARCHAR(191) NOT NULL DEFAULT 'USER',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_username_key` (`username`),
  UNIQUE KEY `User_email_key` (`email`),
  INDEX `User_username_idx` (`username`),
  INDEX `User_role_idx` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Notes on User Credentials:
-- Login credentials are NOT hardcoded. Passwords are encrypted using Node crypto scrypt (64-byte key with 16-byte random salt).
-- To create an initial administrator account securely with your own custom password:
--
-- Option A (Recommended):
-- Run the CLI utility locally or on your server to generate an SQL query with your chosen credentials:
--   node scripts/create-user-sql.js <username> <password> ADMIN "<full_name>" "<email>"
--
-- Option B:
-- Set ADMIN_USERNAME and ADMIN_PASSWORD in your .env file on the server:
--   ADMIN_USERNAME="admin"
--   ADMIN_PASSWORD="YourSecurePasswordHere"
-- The server will automatically initialize the administrator upon startup.

