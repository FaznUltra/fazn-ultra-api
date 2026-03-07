import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IChallenge extends Document {
  _id: Types.ObjectId;
  challenger: Types.ObjectId;
  opponent: Types.ObjectId;
  game: string;
  stakeAmount: number;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
  winner: Types.ObjectId | null;
  loser: Types.ObjectId | null;
  proofSubmitted: {
    by: Types.ObjectId | null;
    url: string | null;
    submittedAt: Date | null;
  };
  disputeReason: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const challengeSchema = new Schema<IChallenge>(
  {
    challenger: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    opponent: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    game: {
      type: String,
      required: true,
      trim: true
    },
    stakeAmount: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'disputed'],
      default: 'pending'
    },
    winner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    loser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    proofSubmitted: {
      by: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      url: {
        type: String,
        default: null
      },
      submittedAt: {
        type: Date,
        default: null
      }
    },
    disputeReason: {
      type: String,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient queries
challengeSchema.index({ challenger: 1, createdAt: -1 });
challengeSchema.index({ opponent: 1, createdAt: -1 });
challengeSchema.index({ status: 1 });

export default mongoose.model<IChallenge>('Challenge', challengeSchema);
