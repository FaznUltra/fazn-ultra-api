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
