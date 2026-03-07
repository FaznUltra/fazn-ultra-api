# Challenge API Documentation

## Overview
The Challenge system allows users to create 1v1 gaming challenges with stake amounts, witnessing, and streaming integration.

## Available Games
- **Dream League Soccer** (Mobile, Football)
- **eFootball Mobile** (Mobile, Football)

## Challenge Types
1. **DIRECT** - Challenge a specific friend directly
2. **FRIENDS** - Open to any of your friends
3. **PUBLIC** - Open to anyone on the platform

## Challenge Status Flow
```
OPEN → PENDING_ACCEPTANCE → ACCEPTED → COMPLETED → SETTLED
                          ↓
                      REJECTED
                          ↓
                      CANCELLED
                          ↓
                      REFUNDED
```

## Financial Structure
- **Stake Amount**: Amount each player puts in
- **Total Pot**: Stake Amount × 2
- **Platform Fee**: 5% of total pot
- **Witness Fee**: 2% of total pot
- **Winner Payout**: Total Pot - Platform Fee - Witness Fee = 93% of total pot

## API Endpoints

### 1. Get Available Games
```
GET /api/v1/challenges/games
```

**Response:**
```json
{
  "success": true,
  "data": {
    "games": [
      {
        "gameType": "FOOTBALL",
        "gameName": "DREAM_LEAGUE_SOCCER",
        "displayName": "Dream League Soccer",
        "platforms": ["MOBILE"],
        "defaultGamePeriod": 10
      }
    ]
  }
}
```

### 2. Create Challenge
```
POST /api/v1/challenges
```

**Request Body:**
```json
{
  "gameType": "FOOTBALL",
  "gameName": "DREAM_LEAGUE_SOCCER",
  "platform": "MOBILE",
  "challengeType": "DIRECT" | "FRIENDS" | "PUBLIC",
  "stakeAmount": 1000,
  "currency": "NGN",
  "acceptanceDueDate": "2024-03-15T10:00:00Z",
  "matchStartTime": "2024-03-15T14:00:00Z",
  "includeExtraTime": false,
  "includePenalty": false,
  "directOpponentId": "userId" // Required for DIRECT challenges
  "creatorStreamingLink": {
    "platform": "YOUTUBE" | "TWITCH",
    "url": "https://youtube.com/..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Challenge created successfully",
  "data": {
    "challenge": {
      "_id": "challengeId",
      "creator": {...},
      "acceptor": {...},
      "gameType": "FOOTBALL",
      "gameName": "DREAM_LEAGUE_SOCCER",
      "platform": "MOBILE",
      "challengeType": "DIRECT",
      "stakeAmount": 1000,
      "currency": "NGN",
      "totalPot": 2000,
      "platformFee": 0.05,
      "witnessFee": 0.02,
      "winnerPayout": 1860,
      "status": "PENDING_ACCEPTANCE",
      "acceptanceDueDate": "2024-03-15T10:00:00Z",
      "matchStartTime": "2024-03-15T14:00:00Z",
      "gamePeriod": 10,
      "includeExtraTime": false,
      "includePenalty": false,
      "createdAt": "2024-03-10T12:00:00Z"
    }
  }
}
```

### 3. Get Challenge History
```
GET /api/v1/challenges/history?status=COMPLETED&page=1&limit=20
```

**Query Parameters:**
- `status` (optional): Filter by status
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

### 4. Get Public Challenges
```
GET /api/v1/challenges/public?page=1&limit=20
```

Returns all open public challenges available for acceptance.

### 5. Get Friends Challenges
```
GET /api/v1/challenges/friends?page=1&limit=20
```

Returns all open challenges from your friends.

### 6. Get Challenge Details
```
GET /api/v1/challenges/:id
```

### 7. Accept Challenge
```
POST /api/v1/challenges/:id/accept
```

**Request Body:**
```json
{
  "acceptorStreamingLink": {
    "platform": "YOUTUBE" | "TWITCH",
    "url": "https://youtube.com/..."
  }
}
```

### 8. Reject Challenge
```
POST /api/v1/challenges/:id/reject
```

**Request Body:**
```json
{
  "reason": "Not available at that time"
}
```

### 9. Cancel Challenge
```
POST /api/v1/challenges/:id/cancel
```

**Request Body:**
```json
{
  "reason": "Changed my mind"
}
```

### 10. Update Streaming Link
```
PATCH /api/v1/challenges/:id/streaming-link
```

**Request Body:**
```json
{
  "platform": "YOUTUBE" | "TWITCH",
  "url": "https://youtube.com/..."
}
```

### 11. Submit Result (Witness)
```
POST /api/v1/challenges/:id/result
```

**Request Body:**
```json
{
  "winnerId": "userId",
  "creatorScore": 3,
  "acceptorScore": 2
}
```

### 12. Get Challenge Statistics
```
GET /api/v1/challenges/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalChallenges": 50,
    "wins": 30,
    "losses": 20,
    "winRate": 60,
    "totalEarnings": 50000,
    "totalStaked": 100000
  }
}
```

## Validation Rules

1. **Acceptance Due Date** must be in the future
2. **Match Start Time** must be after Acceptance Due Date
3. **Stake Amount** must be between MIN_STAKE_AMOUNT and MAX_STAKE_AMOUNT (env variables)
4. **Direct Challenges** require opponent to be a friend
5. **Game Period** is 10 minutes for football games (readonly)
6. **Streaming Links** are optional but recommended
7. **Currency** defaults to NGN

## Notifications

The system creates notifications for:
- Challenge received (DIRECT)
- Challenge accepted
- Challenge rejected
- Challenge cancelled
- Match starting soon
- Result submitted
- Challenge settled

## Transaction Records

All stake debits, refunds, and payouts are recorded in the Transaction model with:
- Type: STAKE_DEBIT, STAKE_REFUND, CHALLENGE_PAYOUT
- Status: COMPLETED
- Metadata: challengeId reference
