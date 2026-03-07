import mongoose, { Schema, Document } from 'mongoose';
import { TransactionType, TransactionStatus, Currency } from '../utils/constants';

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  walletId: mongoose.Types.ObjectId;
  type: TransactionType;
  amount: number;
  currency: Currency;
  status: TransactionStatus;
  reference: string;
  description: string;
  metadata?: {
    paystackReference?: string;
    challengeId?: mongoose.Types.ObjectId;
    recipientId?: mongoose.Types.ObjectId;
    platformFee?: number;
    [key: string]: any;
  };
  balanceBefore: number;
  balanceAfter: number;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    walletId: {
      type: Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true
    },
    type: {
      type: String,
      required: true,
      enum: [
        'DEPOSIT',
        'WITHDRAWAL',
        'STAKE_DEBIT',
        'STAKE_REFUND',
        'WINNING_CREDIT',
        'PLATFORM_FEE',
        'WITNESS_REWARD'
      ]
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount must be positive']
    },
    currency: {
      type: String,
      required: true,
      enum: ['NGN', 'USD', 'EUR', 'GBP'],
      default: 'NGN'
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'REVERSED'],
      default: 'PENDING'
    },
    reference: {
      type: String,
      required: true,
      unique: true
    },
    description: {
      type: String,
      required: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    balanceBefore: {
      type: Number,
      required: true
    },
    balanceAfter: {
      type: Number,
      required: true
    }
  },
  {
    timestamps: true
  }
);

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ reference: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1 });

const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);

export default Transaction;
