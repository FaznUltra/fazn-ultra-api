import { Request } from 'express';
import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  password?: string;
  googleId?: string;
  profileImage: string | null;
  streamingAccounts: {
    youtube: {
      channelUrl: string | null;
      channelId: string | null;
      channelName: string | null;
      verified: boolean;
    };
    twitch: {
      channelUrl: string | null;
      channelId: string | null;
      channelName: string | null;
      verified: boolean;
    };
  };
  stats: {
    totalChallenges: number;
    wins: number;
    losses: number;
    draws: number;
    totalEarnings: number;
    totalStaked: number;
  };
  inappropriateDisputeCount: number;
  lastDisputeResetDate: Date | null;
  accountStatus: 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'BANNED';
  witnessReputation: number;
  witnessStatus: 'ACTIVE' | 'SUSPENDED';
  totalWitnessedMatches: number;
  successfulWitnesses: number;
  isActive: boolean;
  isVerified: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface AuthRequest extends Request {
  user?: IUser;
}

export interface JWTPayload {
  userId: Types.ObjectId;
  email: string;
  displayName: string;
}

declare global {
  namespace Express {
    interface User extends IUser {}
  }
}
