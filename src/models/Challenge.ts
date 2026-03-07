import mongoose, { Schema, Document, Types } from 'mongoose';

export type GameType = 'FOOTBALL' | 'SOCCER' | 'RACING' | 'BASKETBALL' | 'TENNIS';
export type GameName = 'DREAM_LEAGUE_SOCCER' | 'EFOOTBALL_MOBILE';
export type Platform = 'CONSOLE' | 'MOBILE';
export type ChallengeType = 'DIRECT' | 'FRIENDS' | 'PUBLIC';
export type ChallengeStatus = 
  | 'OPEN' 
  | 'PENDING_ACCEPTANCE' 
  | 'ACCEPTED' 
  | 'REJECTED' 
  | 'CANCELLED' 
  | 'REFUNDED' 
  | 'COMPLETED' 
  | 'SETTLED';

export interface IChallenge extends Document {
  _id: Types.ObjectId;
  
  // Creator and Acceptor
  creator: Types.ObjectId;
  creatorUsername: string;
  acceptor: Types.ObjectId | null;
  acceptorUsername: string | null;
  
  // Game Configuration
  gameType: GameType;
  gameName: GameName;
  platform: Platform;
  challengeType: ChallengeType;
  
  // Financial
  stakeAmount: number;
  currency: string;
  platformFee: number; // 5%
  witnessFee: number; // 2%
  totalPot: number; // stakeAmount * 2
  winnerPayout: number; // totalPot - platformFee - witnessFee
  
  // Timing
  acceptanceDueDate: Date;
  matchStartTime: Date;
  gamePeriod: number; // in minutes, default 10 for football
  includeExtraTime: boolean;
  includePenalty: boolean;
  
  // Streaming
  creatorStreamingLink: {
    platform: 'YOUTUBE' | 'TWITCH' | null;
    url: string | null;
  };
  acceptorStreamingLink: {
    platform: 'YOUTUBE' | 'TWITCH' | null;
    url: string | null;
  };
  
  // Witnessing
  witness: Types.ObjectId | null;
  witnessUsername: string | null;
  witnessVerifiedAt: Date | null;
  
  // Results
  status: ChallengeStatus;
  winner: Types.ObjectId | null;
  winnerUsername: string | null;
  loser: Types.ObjectId | null;
  loserUsername: string | null;
  finalScore: {
    creator: number | null;
    acceptor: number | null;
  };
  
  // Metadata
  completedAt: Date | null;
  settledAt: Date | null;
  cancelledBy: Types.ObjectId | null;
  cancellationReason: string | null;
  rejectedBy: Types.ObjectId | null;
  rejectionReason: string | null;
  
  createdAt: Date;
  updatedAt: Date;
}

const challengeSchema = new Schema<IChallenge>(
  {
    // Creator and Acceptor
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    creatorUsername: {
      type: String,
      required: true
    },
    acceptor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    acceptorUsername: {
      type: String,
      default: null
    },
    
    // Game Configuration
    gameType: {
      type: String,
      enum: ['FOOTBALL', 'SOCCER', 'RACING', 'BASKETBALL', 'TENNIS'],
      required: true
    },
    gameName: {
      type: String,
      enum: ['DREAM_LEAGUE_SOCCER', 'EFOOTBALL_MOBILE'],
      required: true
    },
    platform: {
      type: String,
      enum: ['CONSOLE', 'MOBILE'],
      required: true
    },
    challengeType: {
      type: String,
      enum: ['DIRECT', 'FRIENDS', 'PUBLIC'],
      required: true,
      index: true
    },
    
    // Financial
    stakeAmount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      default: 'NGN'
    },
    platformFee: {
      type: Number,
      required: true,
      default: 0.05 // 5%
    },
    witnessFee: {
      type: Number,
      required: true,
      default: 0.02 // 2%
    },
    totalPot: {
      type: Number,
      required: true
    },
    winnerPayout: {
      type: Number,
      required: true
    },
    
    // Timing
    acceptanceDueDate: {
      type: Date,
      required: true
    },
    matchStartTime: {
      type: Date,
      required: true
    },
    gamePeriod: {
      type: Number,
      required: true,
      default: 10 // minutes
    },
    includeExtraTime: {
      type: Boolean,
      default: false
    },
    includePenalty: {
      type: Boolean,
      default: false
    },
    
    // Streaming
    creatorStreamingLink: {
      platform: {
        type: String,
        enum: ['YOUTUBE', 'TWITCH', null],
        default: null
      },
      url: {
        type: String,
        default: null
      }
    },
    acceptorStreamingLink: {
      platform: {
        type: String,
        enum: ['YOUTUBE', 'TWITCH', null],
        default: null
      },
      url: {
        type: String,
        default: null
      }
    },
    
    // Witnessing
    witness: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    witnessUsername: {
      type: String,
      default: null
    },
    witnessVerifiedAt: {
      type: Date,
      default: null
    },
    
    // Results
    status: {
      type: String,
      enum: ['OPEN', 'PENDING_ACCEPTANCE', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'REFUNDED', 'COMPLETED', 'SETTLED'],
      default: 'OPEN',
      index: true
    },
    winner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    winnerUsername: {
      type: String,
      default: null
    },
    loser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    loserUsername: {
      type: String,
      default: null
    },
    finalScore: {
      creator: {
        type: Number,
        default: null
      },
      acceptor: {
        type: Number,
        default: null
      }
    },
    
    // Metadata
    completedAt: {
      type: Date,
      default: null
    },
    settledAt: {
      type: Date,
      default: null
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    cancellationReason: {
      type: String,
      default: null
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    rejectionReason: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient queries
challengeSchema.index({ creator: 1, createdAt: -1 });
challengeSchema.index({ acceptor: 1, createdAt: -1 });
challengeSchema.index({ status: 1, createdAt: -1 });
challengeSchema.index({ challengeType: 1, status: 1 });
challengeSchema.index({ acceptanceDueDate: 1 });
challengeSchema.index({ matchStartTime: 1 });

// Pre-save middleware to calculate financial values
challengeSchema.pre('save', function(next) {
  if (this.isModified('stakeAmount')) {
    this.totalPot = this.stakeAmount * 2;
    const platformFeeAmount = this.totalPot * this.platformFee;
    const witnessFeeAmount = this.totalPot * this.witnessFee;
    this.winnerPayout = this.totalPot - platformFeeAmount - witnessFeeAmount;
  }
  next();
});

export default mongoose.model<IChallenge>('Challenge', challengeSchema);
