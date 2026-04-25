const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const requiredEnv = ['MYSQLHOST', 'MYSQLUSER', 'MYSQLDATABASE', 'BACKUP_FILE'];
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

if (process.env.CONFIRM_RESTORE !== 'YES') {
  console.error('Restore blocked. Set CONFIRM_RESTORE=YES to continue.');
  process.exit(1);
}

const backupFile = path.resolve(process.cwd(), process.env.BACKUP_FILE);
if (!fs.existsSync(backupFile)) {
  console.error(`Backup file not found: ${backupFile}`);
  process.exit(1);
}

const mysqlBinDir = process.env.MYSQL_BIN_DIR;
const restoreCommand = mysqlBinDir
  ? path.join(mysqlBinDir, process.platform === 'win32' ? 'mysql.exe' : 'mysql')
  : 'mysql';

const args = [
  '-h', process.env.MYSQLHOST,
  '-P', process.env.MYSQLPORT || '3306',
  '-u', process.env.MYSQLUSER,
  process.env.MYSQLDATABASE
];

const input = fs.createReadStream(backupFile);
const child = spawn(restoreCommand, args, {
  env: { ...process.env, MYSQL_PWD: process.env.MYSQLPASSWORD || '' },
  stdio: ['pipe', 'inherit', 'inherit']
});

input.pipe(child.stdin);

child.on('error', (error) => {
  console.error(`Restore failed to start: ${error.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`Restore failed with exit code ${code}`);
    process.exit(code || 1);
  }
  console.log(`Restore completed from: ${backupFile}`);
});
