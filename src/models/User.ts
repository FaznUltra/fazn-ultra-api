import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from '../types';

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      unique: true,
      trim: true,
      match: [/^@[a-zA-Z0-9_]{3,20}$/, 'Display name must start with @ and be 3-20 characters'],
      maxlength: [21, 'Display name cannot exceed 21 characters (including @)']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address'
      ]
    },
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters'],
      select: false
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true
    },
    profileImage: {
      type: String,
      default: null
    },
    streamingAccounts: {
      youtube: {
        channelUrl: { type: String, default: null },
        channelId: { type: String, default: null },
        channelName: { type: String, default: null },
        verified: { type: Boolean, default: false },
        accessToken: { type: String, default: null, select: false },
        refreshToken: { type: String, default: null, select: false }
      },
      twitch: {
        channelUrl: { type: String, default: null },
        channelId: { type: String, default: null },
        channelName: { type: String, default: null },
        verified: { type: Boolean, default: false },
        accessToken: { type: String, default: null, select: false },
        refreshToken: { type: String, default: null, select: false }
      }
    },
    stats: {
      totalChallenges: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 },
      totalStaked: { type: Number, default: 0 }
    },
    inappropriateDisputeCount: {
      type: Number,
      default: 0
    },
    lastDisputeResetDate: {
      type: Date,
      default: null
    },
    accountStatus: {
      type: String,
      enum: ['ACTIVE', 'RESTRICTED', 'SUSPENDED', 'BANNED'],
      default: 'ACTIVE'
    },
    witnessReputation: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    witnessStatus: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE'
    },
    totalWitnessedMatches: {
      type: Number,
      default: 0
    },
    successfulWitnesses: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    lastLogin: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      }
    }
  }
);

userSchema.index({ email: 1 });
userSchema.index({ displayName: 1 });
userSchema.index({ googleId: 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  next();
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model<IUser>('User', userSchema);

export default User;
