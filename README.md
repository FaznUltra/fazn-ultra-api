# Ultra Backend API (TypeScript)

Backend API for Ultra Tournament Management Platform built with TypeScript.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

This will install all dependencies including TypeScript, type definitions, and development tools.

### 2. Environment Configuration

Create a `.env` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

Then update the values in `.env` with your actual configuration:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ultra
JWT_SECRET=your_super_secret_jwt_key_here_minimum_32_characters_long
# ... (update all other values)
```

### 3. Start MongoDB

Make sure MongoDB is running on your system:

**Local MongoDB:**
```bash
mongod
```

**Or use MongoDB Atlas:**
Update `MONGODB_URI` in `.env` with your Atlas connection string.

### 4. Run the Server

**Development mode (with auto-reload and TypeScript compilation):**
```bash
npm run dev
```

**Build TypeScript to JavaScript:**
```bash
npm run build
```

**Production mode (requires build first):**
```bash
npm run build
npm start
```

The server will start on `http://localhost:5000`

### 5. Test the Server

Open your browser or use curl to test the health endpoint:

```bash
curl http://localhost:5000/health
```

You should see:
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2026-03-06T10:00:00.000Z",
  "environment": "development"
}
```

## Project Structure

```
backend/
├── src/                 # TypeScript source files
│   ├── config/          # Configuration files
│   │   └── database.ts  # MongoDB connection
│   ├── middlewares/     # Custom middlewares
│   │   ├── errorHandler.ts
│   │   └── notFound.ts
│   ├── utils/           # Utility functions
│   │   ├── logger.ts    # Winston logger
│   │   └── constants.ts # App constants
│   ├── types/           # TypeScript type definitions
│   │   └── index.ts     # Shared types
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server entry point
├── dist/                # Compiled JavaScript (auto-generated)
├── logs/                # Log files (auto-created)
├── .env                 # Environment variables (create this)
├── .env.example         # Environment template
├── .gitignore           # Git ignore rules
├── tsconfig.json        # TypeScript configuration
├── package.json         # Dependencies
└── README.md            # This file
```

## Available Scripts

- `npm run dev` - Start development server with ts-node-dev (auto-reload)
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server (requires build)
- `npm run typecheck` - Type check without emitting files
- `npm test` - Run tests with Jest
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Fix ESLint errors automatically
- `npm run format` - Format code with Prettier

## Next Steps

1. ✅ Basic server setup complete
2. ⏳ Create database models (User, Wallet, Challenge, etc.)
3. ⏳ Implement authentication routes
4. ⏳ Implement API endpoints
5. ⏳ Add Socket.io for real-time features
6. ⏳ Integrate Paystack
7. ⏳ Integrate Cloudinary
8. ⏳ Write tests

## Environment Variables

See `.env.example` for all required environment variables.

**Critical variables:**
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT tokens (min 32 characters)
- `PAYSTACK_SECRET_KEY` - Paystack API key
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name

## Security Features

- ✅ Helmet.js for HTTP headers security
- ✅ CORS configuration
- ✅ Rate limiting
- ✅ Input sanitization (mongo-sanitize, xss-clean)
- ✅ Error handling middleware
- ✅ Request logging

## Logging

Logs are stored in the `logs/` directory:
- `error.log` - Error logs only
- `combined.log` - All logs

In development, logs also appear in the console with colors.

## API Documentation

API documentation will be available at `/api/v1/docs` (coming soon).

For now, refer to `/docs/API_REFERENCE.md` in the project root.
