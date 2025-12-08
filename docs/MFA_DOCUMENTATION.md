# MFA (Multi-Factor Authentication) Documentation

## GSO IAMS - Two-Factor Authentication System

### Overview

This documentation covers the TOTP-based (Time-based One-Time Password) Multi-Factor Authentication system implemented for the GSO IAMS (Inventory and Asset Management System) for El Salvador City.

The MFA system provides:
- **TOTP Authentication** using Google Authenticator, Authy, or any compatible app
- **Trusted Device** feature to skip MFA on recognized devices for 30 days
- **Backup Codes** for account recovery if authenticator app is lost
- **Device Management** to view and revoke trusted devices

---

## Architecture

### Backend (Laravel)

```
app/
├── Services/
│   └── MFAService.php          # Core MFA logic (TOTP, device tokens)
├── Models/Auth/
│   └── TrustedDevice.php       # Trusted device model
├── Http/Controllers/
│   ├── AuthController.php      # Login with MFA integration
│   └── Auth/MFAController.php  # MFA management endpoints
└── database/migrations/
    ├── 2025_12_05_120000_add_mfa_fields_to_users_table.php
    └── 2025_12_05_120001_create_trusted_devices_table.php
```

### Frontend (Next.js)

```
src/
├── types/
│   └── mfa.ts                  # TypeScript interfaces
├── lib/api/
│   └── mfa.ts                  # API client functions
├── components/auth/
│   ├── MFASetup.tsx            # Enable/disable MFA component
│   ├── MFAVerify.tsx           # TOTP verification during login
│   └── TrustedDevices.tsx      # Device management component
└── app/admin/security/
    └── page.tsx                # Security settings page
```

---

## Database Schema

### User Table (MFA Fields)

```sql
ALTER TABLE `user` ADD COLUMN `MFASecret` TEXT NULL;
ALTER TABLE `user` ADD COLUMN `MFAEnabled` TINYINT(1) DEFAULT 0;
ALTER TABLE `user` ADD COLUMN `BackupCodes` TEXT NULL;
```

| Column | Type | Description |
|--------|------|-------------|
| MFASecret | TEXT | Encrypted TOTP secret key |
| MFAEnabled | BOOLEAN | Whether MFA is enabled for user |
| BackupCodes | TEXT | Encrypted JSON array of backup codes |

### Trusted Devices Table

```sql
CREATE TABLE `trusted_devices` (
  `DeviceID` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `UserID` BIGINT UNSIGNED NOT NULL,
  `DeviceToken` VARCHAR(255) NOT NULL UNIQUE,
  `DeviceName` VARCHAR(255) NULL,
  `UserAgent` VARCHAR(500) NULL,
  `IPAddress` VARCHAR(50) NULL,
  `CreatedDate` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `ExpiresAt` TIMESTAMP NULL,
  `LastUsedAt` TIMESTAMP NULL,
  FOREIGN KEY (`UserID`) REFERENCES `user`(`UserID`) ON DELETE CASCADE
);
```

---

## API Endpoints

### Public Endpoints (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | Login (returns `mfa_required` if MFA enabled) |
| POST | `/api/mfa/verify` | Verify TOTP code and complete login |

### Protected Endpoints (Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mfa/status` | Get MFA status for current user |
| POST | `/api/mfa/generate-secret` | Generate new TOTP secret and QR code URL |
| POST | `/api/mfa/enable` | Enable MFA with verified code |
| POST | `/api/mfa/disable` | Disable MFA (requires password + code) |
| GET | `/api/mfa/trusted-devices` | List all trusted devices |
| POST | `/api/mfa/revoke-device` | Revoke a specific trusted device |

---

## User Flows

### 1. Login Flow (With MFA)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │────▶│  Check MFA  │────▶│  Verify     │────▶│  Dashboard  │
│   Form      │     │  Required?  │     │  TOTP Code  │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼ (MFA not enabled)
                    ┌─────────────┐
                    │  Dashboard  │
                    └─────────────┘
```

### 2. Enable MFA Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Security   │────▶│  Generate   │────▶│  Scan QR    │────▶│  Verify     │
│  Settings   │     │  Secret     │     │  Code       │     │  6-digit    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
                                                            ┌─────────────┐
                                                            │  Save       │
                                                            │  Backup     │
                                                            │  Codes      │
                                                            └─────────────┘
```

### 3. Trusted Device Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Verify     │────▶│  Check      │────▶│  Set        │
│  TOTP Code  │     │  "Trust     │     │  Device     │
│             │     │  Device"    │     │  Cookie     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼ (Not checked)
                    ┌─────────────┐
                    │  No Cookie  │
                    │  (Ask MFA   │
                    │  next time) │
                    └─────────────┘
```

---

## Security Features

### 1. TOTP (Time-based One-Time Password)
- Uses industry-standard RFC 6238 TOTP algorithm
- 6-digit codes valid for 30 seconds
- Compatible with Google Authenticator, Authy, Microsoft Authenticator

### 2. Encrypted Storage
- MFA secrets are encrypted using Laravel's `encrypt()` function
- Backup codes are encrypted before storage
- Device tokens are hashed (SHA-256) before storage

### 3. Secure Device Tokens
- 32-byte (256-bit) random tokens generated using `random_bytes()`
- Tokens stored as SHA-256 hash in database
- Plain token only shown once (when device is trusted)
- HttpOnly, Secure, SameSite=Strict cookies

### 4. Token Expiration
- Trusted device tokens expire after 30 days
- Tokens are invalidated on password change
- Users can manually revoke devices anytime

### 5. Backup Codes
- 10 unique backup codes generated on MFA enable
- Each code can only be used once
- Codes are removed from database after use

---

## Frontend Components

### MFASetup Component

Location: `src/components/auth/MFASetup.tsx`

Features:
- View MFA status (enabled/disabled)
- Generate QR code for authenticator app
- Verify 6-digit code to enable MFA
- Display and copy backup codes
- Disable MFA (requires password + code confirmation)

### MFAVerify Component

Location: `src/components/auth/MFAVerify.tsx`

Features:
- 6-digit TOTP code input
- Backup code fallback option
- "Trust this device" checkbox
- Error handling with user-friendly messages

### TrustedDevices Component

Location: `src/components/auth/TrustedDevices.tsx`

Features:
- List all trusted devices with details
- Show device name, IP, creation date, last used
- Revoke individual devices
- Timezone-aware date display (PH Manila time)

---

## Configuration

### Environment Variables

```env
# Backend (.env)
APP_NAME="GSO IAMS"

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Package Dependencies

**Backend (composer.json):**
```json
{
  "require": {
    "pragmarx/google2fa-laravel": "^2.3"
  }
}
```

**Frontend (package.json):**
```json
{
  "dependencies": {
    "qrcode.react": "^3.x"
  }
}
```

---

## Setup Instructions

### 1. Backend Setup

```bash
# Install dependencies
cd gso_backend/backend
composer install

# Run migrations OR execute SQL script
php artisan migrate
# OR run mfa_database_update.sql in phpMyAdmin
```

### 2. Frontend Setup

```bash
# Install dependencies
cd gso_frontend
npm install

# Start development server
npm run dev
```

### 3. Database Setup (Manual)

If migrations don't work, run this SQL:

```sql
-- Add MFA fields to user table
ALTER TABLE `user`
ADD COLUMN `MFASecret` TEXT NULL AFTER `Password`,
ADD COLUMN `MFAEnabled` TINYINT(1) DEFAULT 0 AFTER `MFASecret`,
ADD COLUMN `BackupCodes` TEXT NULL AFTER `MFAEnabled`;

-- Create trusted_devices table
CREATE TABLE `trusted_devices` (
  `DeviceID` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `UserID` BIGINT UNSIGNED NOT NULL,
  `DeviceToken` VARCHAR(255) NOT NULL UNIQUE,
  `DeviceName` VARCHAR(255) NULL,
  `UserAgent` VARCHAR(500) NULL,
  `IPAddress` VARCHAR(50) NULL,
  `CreatedDate` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `ExpiresAt` TIMESTAMP NULL,
  `LastUsedAt` TIMESTAMP NULL,
  FOREIGN KEY (`UserID`) REFERENCES `user`(`UserID`) ON DELETE CASCADE
);
```

---

## Testing the MFA System

### Test Flow

1. **Login as any user** (e.g., admin/123)
2. **Navigate to Security Settings** (`/admin/security`)
3. **Enable MFA:**
   - Click "Enable Two-Factor Authentication"
   - Scan QR code with Google Authenticator
   - Enter 6-digit code
   - Save backup codes
4. **Logout and Login again:**
   - Enter username/password
   - System prompts for TOTP code
   - Optionally check "Trust this device"
5. **Test Trusted Device:**
   - Login again from same browser
   - Should skip MFA prompt (if trusted)
6. **Revoke Device:**
   - Go to Security Settings > Trusted Devices
   - Click revoke on a device
   - Next login will require MFA again

---

## Error Handling

### Backend Errors

| Status | Error | Description |
|--------|-------|-------------|
| 401 | Unauthorized | User not authenticated |
| 404 | User not found | Invalid user ID during MFA verify |
| 422 | Invalid code | TOTP or backup code is incorrect |
| 422 | Invalid password | Wrong password during disable MFA |
| 500 | MFA configuration error | Decryption failed |

### Frontend Handling

- All errors display user-friendly messages
- Loading states prevent double-submission
- Form validation before API calls
- Automatic redirect on session expiry

---

## Best Practices Followed

✅ **TypeScript** - No 'any' types, full type safety  
✅ **Error Handling** - User-friendly error messages  
✅ **Loading States** - All async operations show loaders  
✅ **Security** - HTTPS, HttpOnly cookies, encrypted secrets  
✅ **Input Validation** - Frontend (Zod) + Backend (Laravel)  
✅ **Proper HTTP Status Codes** - 200, 401, 422, 500  
✅ **Database Relationships** - Foreign keys with CASCADE  
✅ **Mobile Responsive** - Works on all screen sizes  
✅ **Accessibility** - Keyboard navigation, screen reader support  
✅ **Timezone Aware** - PH Manila time for all dates  
✅ **Consistent Code Style** - Same patterns throughout  

---

## Troubleshooting

### "Invalid code" error during setup
- Ensure your device time is correct (TOTP requires accurate time)
- Try generating a new secret and scanning again

### QR code not showing
- Check browser console for errors
- Ensure `qrcode.react` is installed

### Device not being trusted
- Check if cookies are enabled
- Ensure HTTPS is used in production
- Check cookie settings (SameSite, Secure)

### MFA not prompting on login
- Verify MFAEnabled is set to 1 in database
- Check if device_token cookie exists and is valid

---

## Author

**GSO IAMS Development Team**  
El Salvador City, Philippines  
For capstone project - 3rd Year BSIT

---

*Last Updated: December 5, 2025*
