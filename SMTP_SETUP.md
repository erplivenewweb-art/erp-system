# SMTP / Email Setup

This ERP uses SMTP email for OTP and verification-code flows, including Settings > Send Code.

Staff/Admin note: Settings me "Send Code" tabhi chalega jab SMTP enabled aur properly configured ho. Gmail ke liye normal password nahi, Gmail App Password use karein.

## What Uses SMTP

- Settings unlock code: `POST /otp/request`
- Password reset OTP: `POST /otp/request`

If SMTP is disabled, incomplete, or fails provider verification, the ERP keeps starting normally, but OTP email features return:

```text
Email service is not configured. Please contact admin.
```

## Required `.env` Variables

Set these in local `.env` or in the hosting provider environment variables:

```env
SMTP_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM=your_email@gmail.com
```

Alternative Gmail SSL format:

```env
SMTP_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM=your_email@gmail.com
```

Do not commit real SMTP passwords.

## Gmail App Password Setup

Gmail does not accept your normal account password for SMTP in most setups. Use an App Password.

1. Open your Google Account security settings.
2. Enable 2-Step Verification if it is not already enabled.
3. Go to App Passwords.
4. Create an app password for Mail.
5. Put that generated password in `SMTP_PASS`.
6. Use the same Gmail address for `SMTP_USER` and usually `SMTP_FROM`.

## Localhost Testing

For local development, SMTP can be intentionally disabled:

```env
SMTP_ENABLED=false
```

With SMTP disabled, the ERP starts normally, but Settings > Send Code and forgot-password OTP emails will not send.

To test email locally:

1. Set `SMTP_ENABLED=true`.
2. Fill all required SMTP variables.
3. Restart the backend server.
4. Watch startup logs for SMTP status.
5. Open Settings and click Send Code using an allowed owner/admin email.

## Startup Logs

Safe startup logs may mention:

- whether SMTP is disabled
- which required variable names are missing
- whether authentication or connection verification failed

Logs must not print `SMTP_PASS`.

Optional safe debug mode:

```env
SMTP_DEBUG=true
```

This prints non-secret SMTP diagnostics such as host, port, secure mode, email domains, and whether the password is set or placeholder.

## Common Problems

### `Email service is not configured. Please contact admin.`

Usually one of these is true:

- `SMTP_ENABLED=false`
- a required SMTP variable is missing
- a placeholder value is still present
- Gmail App Password is wrong or not created
- `SMTP_PORT` and `SMTP_SECURE` do not match
- hosting provider blocks outbound SMTP

### Gmail Authentication Fails

Use an App Password, not the Gmail login password.

Recommended Gmail settings:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
```

or:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
```

## Restart Required

After changing `.env`, restart the backend server. SMTP is checked during startup.
