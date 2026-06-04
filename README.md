# Jewellery ERP Local Development

## MySQL `.env` Setup

`npm start` reads MySQL settings from the project `.env` file through `js/backend/server.js`.
Use these exact variable names:

```env
MYSQLHOST=localhost
MYSQLUSER=root
MYSQLPASSWORD=your-local-mysql-root-password
MYSQLDATABASE=jewellery_erp
MYSQLPORT=3306
```

Do not quote the password unless the quote characters are part of the real password.

## Test MySQL Workbench Login

1. Open MySQL Workbench.
2. Create or edit a local connection.
3. Set Host Name to `localhost`.
4. Set Port to `3306`.
5. Set Username to `root`.
6. Click Test Connection.
7. Enter the same password used in `.env` for `MYSQLPASSWORD`.

If Workbench shows access denied, fix the MySQL user password first. The ERP app cannot connect with credentials that fail in Workbench.

## Create the Local Database

In MySQL Workbench, open a SQL tab and run:

```sql
CREATE DATABASE IF NOT EXISTS jewellery_erp;
```

Then keep `.env` set to:

```env
MYSQLDATABASE=jewellery_erp
```

The server startup will connect to this database and then run its existing schema setup.

## MySQL CLI on Windows

The app does not require the `mysql` command-line program to be in `PATH` for `npm start`.
If Windows says `mysql is not recognized`, that only means the MySQL CLI folder is not in `PATH`.

For optional backup or restore commands, either add the MySQL Server `bin` folder to `PATH`, or set:

```env
MYSQL_BIN_DIR=C:\Program Files\MySQL\MySQL Server 8.0\bin
```

## Startup Diagnostics

On startup the server prints a safe MySQL config summary:

- host
- user
- database
- port
- whether a password exists

It never prints the actual MySQL password.
