# Ultra API Endpoints Reference

**Base URL:** `http://localhost:5000/api/v1`

---

## Authentication

### Register User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "displayName": "@johndoe",
  "email": "john@example.com",
  "password": "Password123"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "displayName": "@johndoe",
      "email": "john@example.com",
      "profileImage": null,
      "isVerified": false
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Validation Rules:**
- `firstName`: Required, max 50 chars
- `lastName`: Required, max 50 chars
- `displayName`: Required, must start with @, 3-20 chars (letters, numbers, underscore)
- `email`: Required, valid email format
- `password`: Required, min 8 chars, must contain uppercase, lowercase, and number

---

### Login
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "Password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "displayName": "@johndoe",
      "email": "john@example.com",
      "profileImage": "🎮",
      "isVerified": false,
      "streamingAccounts": {
        "youtube": { "channelUrl": null, "channelId": null, "verified": false },
        "twitch": { "channelUrl": null, "channelId": null, "verified": false }
      },
      "stats": {
        "totalChallenges": 0,
        "wins": 0,
        "losses": 0,
        "totalEarnings": 0,
        "totalStaked": 0
      }
    },
    "token": "...",
    "refreshToken": "..."
  }
}
```

---

### Get Current User
```http
GET /auth/me
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { /* same as login response */ }
  }
}
```

---

### Google OAuth Login
```http
GET /auth/google
```

**Description:**
Redirects user to Google OAuth consent screen.

**Frontend Usage:**
```javascript
// Redirect user to this URL
window.location.href = 'http://localhost:5000/api/v1/auth/google';
```

**Flow:**
1. User clicks "Sign in with Google"
2. Frontend redirects to `/api/v1/auth/google`
3. User authenticates with Google
4. Google redirects to `/api/v1/auth/google/callback`
5. Backend redirects to frontend with tokens

---

### Google OAuth Callback
```http
GET /auth/google/callback
```

**Description:**
Handles Google OAuth callback and redirects to frontend with tokens.

**Success Redirect:**
```
{FRONTEND_URL}/auth/success?token={JWT_TOKEN}&refreshToken={REFRESH_TOKEN}
```

**Error Redirect:**
```
{FRONTEND_URL}/auth/error?message=Authentication failed
```

**Frontend Handler:**
```javascript
// On /auth/success page
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
const refreshToken = urlParams.get('refreshToken');

// Store tokens and redirect to dashboard
localStorage.setItem('token', token);
localStorage.setItem('refreshToken', refreshToken);
window.location.href = '/dashboard';
```

**What Happens:**
- If user exists with Google ID → Login
- If user exists with email → Link Google account
- If new user → Auto-register with Google profile
- Auto-creates wallet for new users
- Email is auto-verified for Google users
- Profile image from Google (if available)

---

## Email Verification (OTP)

### Send Verification OTP
```http
POST /otp/send
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP sent to your email",
  "data": {
    "email": "john@example.com",
    "expiresIn": "10 minutes"
  }
}
```

**Notes:**
- OTP is 6 digits
- Valid for 10 minutes
- Previous unused OTPs are invalidated
- Email must not already be verified

---

### Verify Email with OTP
```http
POST /otp/verify
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "user": {
      "id": "...",
      "email": "john@example.com",
      "isVerified": true
    }
  }
}
```

**Validation:**
- OTP must be 6 digits
- OTP must not be expired
- OTP must not be already used

---

### Resend OTP
```http
POST /otp/resend
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "New OTP sent to your email",
  "data": {
    "email": "john@example.com",
    "expiresIn": "10 minutes"
  }
}
```

**Rate Limiting:**
- Can only request new OTP after 1 minute

---

## Users

### Search Users
```http
GET /users/search?query=john&page=1&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
- `query` (required): Search term
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "displayName": "@johndoe",
        "profileImage": "🎮",
        "stats": { /* user stats */ }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

---

### Get User Profile
```http
GET /users/:userId
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "firstName": "John",
      "lastName": "Doe",
      "displayName": "@johndoe",
      "profileImage": "🎮",
      "stats": { /* stats */ },
      "streamingAccounts": { /* streaming accounts */ },
      "isVerified": false,
      "createdAt": "2026-03-06T10:00:00.000Z"
    }
  }
}
```

---

### Update Profile
```http
PUT /users/profile
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "profileImage": "🎮",
  "streamingAccounts": {
    "youtube": {
      "channelUrl": "https://youtube.com/@johndoe"
    },
    "twitch": {
      "channelUrl": "https://twitch.tv/johndoe"
    }
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": { /* updated user object */ }
  }
}
```

**Validation:**
- `profileImage`: 1-10 characters (emoji)
- `firstName`: Max 50 chars
- `lastName`: Max 50 chars
- Streaming URLs must be valid URLs

---

## Wallet

### Get Wallet
```http
GET /wallet
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "wallet": {
      "id": "...",
      "currencies": [
        {
          "code": "NGN",
          "balance": 5000,
          "isActive": true
        }
      ],
      "totalDeposits": 10000,
      "totalWithdrawals": 0,
      "totalStaked": 5000,
      "totalWinnings": 0
    }
  }
}
```

---

### Initialize Deposit
```http
POST /wallet/deposit/initialize
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "amount": 5000
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "data": {
    "authorizationUrl": "https://checkout.paystack.com/...",
    "accessCode": "...",
    "reference": "DEP-1234567890-123456"
  }
}
```

**Validation:**
- `amount`: Min ₦100, Max ₦1,000,000

---

### Verify Deposit
```http
GET /wallet/deposit/verify/:reference
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Deposit successful",
  "data": {
    "transaction": {
      "id": "...",
      "amount": 5000,
      "currency": "NGN",
      "status": "COMPLETED",
      "reference": "DEP-1234567890-123456",
      "balanceAfter": 5000
    }
  }
}
```

---

### Get Transactions
```http
GET /wallet/transactions?page=1&limit=20&type=DEPOSIT&status=COMPLETED
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `type` (optional): DEPOSIT, WITHDRAWAL, STAKE_DEBIT, WINNING_CREDIT, etc.
- `status` (optional): PENDING, COMPLETED, FAILED, REVERSED

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "_id": "...",
        "type": "DEPOSIT",
        "amount": 5000,
        "currency": "NGN",
        "status": "COMPLETED",
        "reference": "DEP-...",
        "description": "Deposit of ₦5,000",
        "balanceBefore": 0,
        "balanceAfter": 5000,
        "createdAt": "2026-03-06T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "pages": 1
    }
  }
}
```

---

### Get Single Transaction
```http
GET /wallet/transactions/:id
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transaction": { /* transaction object */ }
  }
}
```

---

## Friendships

### Send Friend Request
```http
POST /friendships/request
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "recipientId": "USER_ID_HERE"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Friend request sent successfully",
  "data": {
    "friendship": {
      "_id": "...",
      "requester": "...",
      "recipient": "...",
      "status": "PENDING",
      "createdAt": "..."
    }
  }
}
```

---

### Accept Friend Request
```http
PUT /friendships/accept/:friendshipId
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Friend request accepted",
  "data": {
    "friendship": { /* updated friendship */ }
  }
}
```

---

### Reject Friend Request
```http
DELETE /friendships/reject/:friendshipId
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Friend request rejected"
}
```

---

### Block User
```http
POST /friendships/block
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "userId": "USER_ID_HERE"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "User blocked successfully"
}
```

---

### Unblock User
```http
DELETE /friendships/unblock/:userId
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "User unblocked successfully"
}
```

---

### Unfriend
```http
DELETE /friendships/unfriend/:userId
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Friend removed successfully"
}
```

---

### Get Friends List
```http
GET /friendships/friends?page=1&limit=20
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "friends": [
      {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "displayName": "@johndoe",
        "profileImage": "🎮"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

---

### Get Pending Requests (Incoming)
```http
GET /friendships/requests/pending?page=1&limit=20
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "_id": "...",
        "requester": {
          "_id": "...",
          "firstName": "Jane",
          "lastName": "Smith",
          "displayName": "@janesmith",
          "profileImage": "🎯"
        },
        "status": "PENDING",
        "createdAt": "..."
      }
    ],
    "pagination": { /* pagination */ }
  }
}
```

---

### Get Sent Requests (Outgoing)
```http
GET /friendships/requests/sent?page=1&limit=20
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "_id": "...",
        "recipient": { /* user object */ },
        "status": "PENDING",
        "createdAt": "..."
      }
    ],
    "pagination": { /* pagination */ }
  }
}
```

---

### Get Blocked Users
```http
GET /friendships/blocked?page=1&limit=20
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "blockedUsers": [
      {
        "_id": "...",
        "firstName": "...",
        "lastName": "...",
        "displayName": "...",
        "profileImage": "..."
      }
    ],
    "pagination": { /* pagination */ }
  }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error message here"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (not allowed)
- `404` - Not Found
- `500` - Server Error

---

## Authentication

All endpoints except `/auth/register` and `/auth/login` require authentication.

**Header:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Token Expiry:**
- Access Token: 15 minutes
- Refresh Token: 7 days

---

## Pagination

Endpoints that return lists support pagination:

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Response includes:**
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

---

## Notes

1. **Profile Images**: Use emoji strings (1-10 characters), e.g., "🎮", "⚽", "🎯"
2. **Display Names**: Must start with @ and be 3-20 characters
3. **Amounts**: All amounts in Naira (NGN) are in kobo for Paystack (multiply by 100)
4. **Dates**: All dates in ISO 8601 format
5. **IDs**: All IDs are MongoDB ObjectIds (24-character hex strings)
