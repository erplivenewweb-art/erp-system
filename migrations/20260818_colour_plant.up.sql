-- Additive Colour Plant schema for customer-owned material.
-- This migration intentionally has no stock, sticker, billing, sales, or transfer linkage.

CREATE TABLE IF NOT EXISTS colour_job_sequences (
  company_id INT NOT NULL,
  sequence_date DATE NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, sequence_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS colour_job_settings (
  company_id INT PRIMARY KEY,
  weight_warning_threshold DECIMAL(14,3) NOT NULL DEFAULT 0.100,
  due_delivery_policy VARCHAR(40) NOT NULL DEFAULT 'OWNER_ACCOUNTS_OVERRIDE',
  updated_by INT DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS colour_jobs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  branch_id INT DEFAULT NULL,
  job_no VARCHAR(40) NOT NULL,
  customer_id INT DEFAULT NULL,
  customer_name_snapshot VARCHAR(255) NOT NULL,
  mobile VARCHAR(25) NOT NULL DEFAULT '',
  receive_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  work_type VARCHAR(120) NOT NULL,
  item_description VARCHAR(500) NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  received_weight DECIMAL(14,3) NOT NULL,
  final_weight DECIMAL(14,3) DEFAULT NULL,
  weight_difference DECIMAL(14,3) DEFAULT NULL,
  weight_warning_threshold DECIMAL(14,3) NOT NULL DEFAULT 0.100,
  weight_warning_acknowledged TINYINT(1) NOT NULL DEFAULT 0,
  weight_warning_acknowledged_by INT DEFAULT NULL,
  weight_warning_acknowledged_at DATETIME DEFAULT NULL,
  rate_type VARCHAR(30) NOT NULL DEFAULT 'FLAT',
  estimated_rate DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  estimated_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  final_rate DECIMAL(14,2) DEFAULT NULL,
  labour_charge DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  other_charge DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  final_amount DECIMAL(14,2) DEFAULT NULL,
  expected_delivery_date DATE DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  ready_at DATETIME DEFAULT NULL,
  customer_informed_at DATETIME DEFAULT NULL,
  customer_informed_by INT DEFAULT NULL,
  customer_informed_remark VARCHAR(500) NOT NULL DEFAULT '',
  delivered_at DATETIME DEFAULT NULL,
  delivered_by INT DEFAULT NULL,
  received_by_name VARCHAR(255) NOT NULL DEFAULT '',
  delivery_mobile_confirmation VARCHAR(30) NOT NULL DEFAULT '',
  delivery_remarks TEXT DEFAULT NULL,
  due_delivery_authorized TINYINT(1) NOT NULL DEFAULT 0,
  due_delivery_authorized_by INT DEFAULT NULL,
  due_delivery_reason VARCHAR(500) NOT NULL DEFAULT '',
  actual_work_performed TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  qc_notes TEXT DEFAULT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'RECEIVED',
  create_idempotency_key VARCHAR(100) NOT NULL,
  created_by INT NOT NULL,
  updated_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_colour_jobs_company_job_no (company_id, job_no),
  UNIQUE KEY uq_colour_jobs_company_idempotency (company_id, create_idempotency_key),
  INDEX idx_colour_jobs_company_branch (company_id, branch_id),
  INDEX idx_colour_jobs_company_status (company_id, status),
  INDEX idx_colour_jobs_company_mobile (company_id, mobile),
  INDEX idx_colour_jobs_company_received (company_id, receive_datetime),
  INDEX idx_colour_jobs_company_expected (company_id, expected_delivery_date),
  INDEX idx_colour_jobs_customer (company_id, customer_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS colour_job_status_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  branch_id INT DEFAULT NULL,
  colour_job_id BIGINT NOT NULL,
  old_status VARCHAR(30) DEFAULT NULL,
  new_status VARCHAR(30) NOT NULL,
  remarks VARCHAR(500) NOT NULL DEFAULT '',
  changed_by INT NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_colour_status_job (company_id, colour_job_id, changed_at),
  INDEX idx_colour_status_scope (company_id, branch_id, new_status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS colour_job_payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  branch_id INT DEFAULT NULL,
  colour_job_id BIGINT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  payment_mode VARCHAR(30) NOT NULL,
  payment_reference VARCHAR(255) NOT NULL DEFAULT '',
  payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_type VARCHAR(30) NOT NULL DEFAULT 'PAYMENT',
  status VARCHAR(20) NOT NULL DEFAULT 'POSTED',
  idempotency_key VARCHAR(100) NOT NULL,
  remarks VARCHAR(500) NOT NULL DEFAULT '',
  collected_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_colour_payment_company_idempotency (company_id, idempotency_key),
  INDEX idx_colour_payment_job (company_id, colour_job_id, status),
  INDEX idx_colour_payment_scope_date (company_id, branch_id, payment_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS colour_job_audit_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  branch_id INT DEFAULT NULL,
  colour_job_id BIGINT NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  old_data JSON DEFAULT NULL,
  new_data JSON DEFAULT NULL,
  reason VARCHAR(500) NOT NULL DEFAULT '',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_colour_audit_job (company_id, colour_job_id, created_at),
  INDEX idx_colour_audit_scope (company_id, branch_id, event_type)
) ENGINE=InnoDB;
