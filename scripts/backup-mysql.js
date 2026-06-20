require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const requiredEnv = ['MYSQLHOST', 'MYSQLUSER', 'MYSQLDATABASE'];
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const backupDir = path.resolve(process.cwd(), process.env.BACKUP_DIR || 'backups');
fs.mkdirSync(backupDir, { recursive: true });

function getBackupRetentionCount() {
  const configured = Number(process.env.BACKUP_RETENTION_COUNT || 7);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 7;
}

function pruneOldBackups() {
  const backups = fs.readdirSync(backupDir)
    .filter((file) => file.toLowerCase().endsWith('.sql'))
    .map((file) => {
      const filePath = path.join(backupDir, file);
      return { file, filePath, modifiedAt: fs.statSync(filePath).mtime };
    })
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

  backups.slice(getBackupRetentionCount()).forEach((backup) => {
    fs.unlinkSync(backup.filePath);
    console.log(`Removed old backup: ${backup.file}`);
  });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(
  backupDir,
  `${process.env.MYSQLDATABASE}-backup-${timestamp}.sql`
);

const mysqlBinDir = process.env.MYSQL_BIN_DIR;
const dumpCommand = mysqlBinDir
  ? path.join(mysqlBinDir, process.platform === 'win32' ? 'mysqldump.exe' : 'mysqldump')
  : 'mysqldump';

const args = [
  '-h', process.env.MYSQLHOST,
  '-P', process.env.MYSQLPORT || '3306',
  '-u', process.env.MYSQLUSER,
  '--single-transaction',
  '--routines',
  '--triggers',
  '--events',
  process.env.MYSQLDATABASE
];

const output = fs.createWriteStream(backupFile);
const child = spawn(dumpCommand, args, {
  env: { ...process.env, MYSQL_PWD: process.env.MYSQLPASSWORD || '' },
  stdio: ['ignore', 'pipe', 'pipe']
});

child.stdout.pipe(output);
child.stderr.on('data', (chunk) => process.stderr.write(chunk));

child.on('error', (error) => {
  console.error(`Backup failed to start: ${error.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  output.end();
  if (code !== 0) {
    console.error(`Backup failed with exit code ${code}`);
    process.exit(code || 1);
  }
  pruneOldBackups();
  console.log(`Backup created: ${backupFile}`);
});
