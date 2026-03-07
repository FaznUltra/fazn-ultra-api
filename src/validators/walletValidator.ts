import { body } from 'express-validator';

export const depositValidator = [
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isNumeric()
    .withMessage('Amount must be a number')
    .custom((value) => {
      if (value < 100) {
        throw new Error('Minimum deposit amount is ₦100');
      }
      if (value > 1000000) {
        throw new Error('Maximum deposit amount is ₦1,000,000');
      }
      return true;
    })
];
