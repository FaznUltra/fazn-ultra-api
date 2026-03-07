import mongoose, { Schema, Document } from 'mongoose';
import { Currency } from '../utils/constants';

export interface ICurrency {
  code: Currency;
  balance: number;
  isActive: boolean;
}

export interface IWallet extends Document {
  userId: mongoose.Types.ObjectId;
  currencies: ICurrency[];
  totalDeposits: number;
  totalWithdrawals: number;
  totalStaked: number;
  totalWinnings: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  getBalance(currencyCode?: Currency): number;
  updateBalance(currencyCode: Currency, amount: number): Promise<void>;
}

const currencySchema = new Schema<ICurrency>(
  {
    code: {
      type: String,
      required: true,
      enum: ['NGN', 'USD', 'EUR', 'GBP']
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Balance cannot be negative']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { _id: false }
);

const walletSchema = new Schema<IWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    currencies: {
      type: [currencySchema],
      default: [{ code: 'NGN', balance: 0, isActive: true }]
    },
    totalDeposits: {
      type: Number,
      default: 0,
      min: 0
    },
    totalWithdrawals: {
      type: Number,
      default: 0,
      min: 0
    },
    totalStaked: {
      type: Number,
      default: 0,
      min: 0
    },
    totalWinnings: {
      type: Number,
      default: 0,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

walletSchema.index({ userId: 1 });

walletSchema.methods.getBalance = function (currencyCode: Currency = 'NGN'): number {
  const currency = this.currencies.find((c: ICurrency) => c.code === currencyCode);
  return currency ? currency.balance : 0;
};

walletSchema.methods.updateBalance = async function (
  currencyCode: Currency,
  amount: number
): Promise<void> {
  const currency = this.currencies.find((c: ICurrency) => c.code === currencyCode);

  if (!currency) {
    throw new Error(`Currency ${currencyCode} not found in wallet`);
  }

  const newBalance = currency.balance + amount;

  if (newBalance < 0) {
    throw new Error('Insufficient balance');
  }

  currency.balance = newBalance;
  await this.save();
};

const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);

export default Wallet;
