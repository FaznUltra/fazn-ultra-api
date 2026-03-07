import { body } from 'express-validator';

export const updateProfileValidator = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),

  body('profileImage')
    .optional()
    .isString()
    .withMessage('Profile image must be a string')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Profile image must be between 1-10 characters (emoji)'),

  body('streamingAccounts.youtube.channelUrl')
    .optional()
    .isURL()
    .withMessage('YouTube channel URL must be valid'),

  body('streamingAccounts.twitch.channelUrl')
    .optional()
    .isURL()
    .withMessage('Twitch channel URL must be valid')
];
