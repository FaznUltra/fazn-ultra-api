import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import passport from './config/passport';
import errorHandler from './middlewares/errorHandler';
import notFound from './middlewares/notFound';

const app: Application = express();

app.use(passport.initialize());

app.use(helmet());

app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:8081',
      process.env.WEB_URL || 'http://localhost:3000'
    ],
    credentials: true
  })
);

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(mongoSanitize());
app.use(xss());

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

app.use(`/api/${process.env.API_VERSION || 'v1'}`, limiter);

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

import authRoutes from './routes/authRoutes';
import walletRoutes from './routes/walletRoutes';
import friendshipRoutes from './routes/friendshipRoutes';
import userRoutes from './routes/userRoutes';
import otpRoutes from './routes/otpRoutes';
import streamingRoutes from './routes/streamingRoutes';
import challengeRoutes from './routes/challengeRoutes';
import notificationRoutes from './routes/notificationRoutes';
import supportRoutes from './routes/supportRoutes';
import leaderboardRoutes from './routes/leaderboardRoutes';

app.use(`/api/${process.env.API_VERSION || 'v1'}/auth`, authRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/wallet`, walletRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/friendships`, friendshipRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/users`, userRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/otp`, otpRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/streaming`, streamingRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/challenges`, challengeRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/notifications`, notificationRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/support`, supportRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/leaderboard`, leaderboardRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
