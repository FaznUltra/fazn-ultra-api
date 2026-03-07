import { Response } from 'express';
import { AuthRequest } from '../types';
import Wallet from '../models/Wallet';
import Transaction from '../models/Transaction';
import paystackService from '../services/paystackService';
import { generateReference } from '../utils/generateReference';
import asyncHandler from '../utils/asyncHandler';

export const getWallet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const wallet = await Wallet.findOne({ userId: req.user?._id });

  if (!wallet) {
    res.status(404).json({
      success: false,
      message: 'Wallet not found'
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      wallet: {
        id: wallet._id,
        currencies: wallet.currencies,
        totalDeposits: wallet.totalDeposits,
        totalWithdrawals: wallet.totalWithdrawals,
        totalStaked: wallet.totalStaked,
        totalWinnings: wallet.totalWinnings
      }
    }
  });
});

export const initializeDeposit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { amount } = req.body;

  if (!amount || amount < 100) {
    res.status(400).json({
      success: false,
      message: 'Minimum deposit amount is ₦100'
    });
    return;
  }

  const wallet = await Wallet.findOne({ userId: req.user?._id });

  if (!wallet) {
    res.status(404).json({
      success: false,
      message: 'Wallet not found'
    });
    return;
  }

  const reference = generateReference('DEP');

  const currentBalance = wallet.getBalance('NGN');

  const transaction = await Transaction.create({
    userId: req.user?._id,
    walletId: wallet._id,
    type: 'DEPOSIT',
    amount,
    currency: 'NGN',
    status: 'PENDING',
    reference,
    description: `Deposit of ₦${amount.toLocaleString()}`,
    balanceBefore: currentBalance,
    balanceAfter: currentBalance
  });

  try {
    const paymentData = await paystackService.initializePayment(
      req.user?.email as string,
      amount,
      reference,
      {
        userId: req.user?._id,
        transactionId: transaction._id
      }
    );

    transaction.metadata = {
      paystackReference: paymentData.data.reference,
      accessCode: paymentData.data.access_code
    };
    await transaction.save();

    res.status(200).json({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        authorizationUrl: paymentData.data.authorization_url,
        accessCode: paymentData.data.access_code,
        reference: paymentData.data.reference
      }
    });
  } catch (error: any) {
    transaction.status = 'FAILED';
    await transaction.save();

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to initialize payment'
    });
  }
});

export const verifyDeposit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { reference } = req.params;

  const transaction = await Transaction.findOne({ reference });

  if (!transaction) {
    res.status(404).json({
      success: false,
      message: 'Transaction not found'
    });
    return;
  }

  if (transaction.status === 'COMPLETED') {
    res.status(200).json({
      success: true,
      message: 'Transaction already verified',
      data: { transaction }
    });
    return;
  }

  try {
    const verification = await paystackService.verifyPayment(reference);

    if (verification.data.status === 'success') {
      const wallet = await Wallet.findById(transaction.walletId);

      if (!wallet) {
        res.status(404).json({
          success: false,
          message: 'Wallet not found'
        });
        return;
      }

      const amountInNaira = verification.data.amount / 100;

      await wallet.updateBalance('NGN', amountInNaira);

      wallet.totalDeposits += amountInNaira;
      await wallet.save();

      transaction.status = 'COMPLETED';
      transaction.balanceAfter = wallet.getBalance('NGN');
      transaction.metadata = {
        ...transaction.metadata,
        paystackData: verification.data
      };
      await transaction.save();

      res.status(200).json({
        success: true,
        message: 'Deposit successful',
        data: {
          transaction: {
            id: transaction._id,
            amount: transaction.amount,
            currency: transaction.currency,
            status: transaction.status,
            reference: transaction.reference,
            balanceAfter: transaction.balanceAfter
          }
        }
      });
    } else {
      transaction.status = 'FAILED';
      await transaction.save();

      res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }
  } catch (error: any) {
    transaction.status = 'FAILED';
    await transaction.save();

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify payment'
    });
  }
});

export const getTransactions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20, type, status } = req.query;

  const query: any = { userId: req.user?._id };

  if (type) {
    query.type = type;
  }

  if (status) {
    query.status = status;
  }

  const transactions = await Transaction.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit));

  const total = await Transaction.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      transactions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

export const getTransaction = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const transaction = await Transaction.findOne({
    _id: id,
    userId: req.user?._id
  });

  if (!transaction) {
    res.status(404).json({
      success: false,
      message: 'Transaction not found'
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: { transaction }
  });
});

export const getTransactionAnalytics = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { period = '7d' } = req.query;

  let startDate = new Date();
  switch (period) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(startDate.getDate() - 7);
  }

  const transactions = await Transaction.find({
    userId: req.user?._id,
    createdAt: { $gte: startDate },
    status: 'COMPLETED'
  }).sort({ createdAt: 1 });

  // Group by date
  const dailyData: any = {};
  transactions.forEach(tx => {
    const date = tx.createdAt.toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = { date, deposits: 0, withdrawals: 0, balance: 0 };
    }
    
    if (tx.type === 'DEPOSIT' || tx.type === 'WINNING_CREDIT' || tx.type === 'STAKE_REFUND' || tx.type === 'WITNESS_REWARD') {
      dailyData[date].deposits += tx.amount;
    } else if (tx.type === 'WITHDRAWAL' || tx.type === 'STAKE_DEBIT' || tx.type === 'PLATFORM_FEE') {
      dailyData[date].withdrawals += tx.amount;
    }
    dailyData[date].balance = tx.balanceAfter;
  });

  const chartData = Object.values(dailyData);

  // Calculate summary stats
  const summary = {
    totalDeposits: transactions
      .filter(tx => tx.type === 'DEPOSIT' || tx.type === 'WINNING_CREDIT' || tx.type === 'STAKE_REFUND' || tx.type === 'WITNESS_REWARD')
      .reduce((sum, tx) => sum + tx.amount, 0),
    totalWithdrawals: transactions
      .filter(tx => tx.type === 'WITHDRAWAL' || tx.type === 'STAKE_DEBIT' || tx.type === 'PLATFORM_FEE')
      .reduce((sum, tx) => sum + tx.amount, 0),
    transactionCount: transactions.length,
  };

  res.status(200).json({
    success: true,
    data: {
      chartData,
      summary,
      period
    }
  });
});
