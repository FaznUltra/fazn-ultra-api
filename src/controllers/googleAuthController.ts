import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { OAuth2Client } from 'google-auth-library';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import { IUser } from '../types';
import User from '../models/User';
import Wallet from '../models/Wallet';
import asyncHandler from '../utils/asyncHandler';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false
});

export const googleAuthCallback = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', { session: false }, (err: any, user: IUser) => {
    if (err || !user) {
      // Check if request is from web or mobile based on user agent or referer
      const isWeb = req.headers['user-agent']?.includes('Mozilla') || req.headers.referer?.includes('localhost:3000');
      const errorUrl = isWeb 
        ? `${process.env.WEB_URL || 'http://localhost:3000'}/sign-in?error=Authentication failed`
        : `${process.env.FRONTEND_URL}auth/error?message=Authentication failed`;
      return res.redirect(errorUrl);
    }

    const payload = {
      userId: user._id,
      email: user.email,
      displayName: user.displayName
    };

    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Check if request is from web or mobile
    const isWeb = req.headers['user-agent']?.includes('Mozilla') || req.headers.referer?.includes('localhost:3000');
    
    const redirectUrl = isWeb
      ? `${process.env.WEB_URL || 'http://localhost:3000'}/google-callback?token=${token}&refreshToken=${refreshToken}`
      : `${process.env.FRONTEND_URL}auth/google-callback?token=${token}&refreshToken=${refreshToken}`;
    
    return res.redirect(redirectUrl);
  })(req, res, next);
};

// Mobile Google Sign-In endpoint
export const googleMobileAuth = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body;

  if (!idToken) {
    res.status(400).json({
      success: false,
      message: 'ID token is required'
    });
    return;
  }

  try {
    // Verify the ID token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: [
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_IOS_CLIENT_ID!,
        process.env.GOOGLE_ANDROID_CLIENT_ID!
      ].filter(Boolean),
    });

    const payload = ticket.getPayload();
    
    if (!payload) {
      res.status(401).json({
        success: false,
        message: 'Invalid ID token'
      });
      return;
    }

    const { sub: googleId, email, given_name, family_name, picture, name } = payload;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email not found in Google profile'
      });
      return;
    }

    // Check if user exists by Google ID
    let user = await User.findOne({ googleId });

    if (user) {
      // Update last login
      user.lastLogin = new Date();
      await user.save();
    } else {
      // Check if user exists by email
      user = await User.findOne({ email });

      if (user) {
        // Link Google account to existing user
        user.googleId = googleId;
        user.isVerified = true;
        user.lastLogin = new Date();
        if (!user.profileImage && picture) {
          user.profileImage = picture;
        }
        await user.save();
      } else {
        // Create new user
        const firstName = given_name || 'User';
        const lastName = family_name || '';
        const displayName = `@${name?.replace(/\s+/g, '').toLowerCase() || email.split('@')[0]}`;

        // Ensure unique display name
        let finalDisplayName = displayName;
        let counter = 1;
        while (await User.findOne({ displayName: finalDisplayName })) {
          finalDisplayName = `${displayName}${counter}`;
          counter++;
        }

        user = await User.create({
          firstName,
          lastName,
          displayName: finalDisplayName,
          email,
          googleId,
          profileImage: picture || null,
          isVerified: true,
          lastLogin: new Date()
        });

        // Create wallet for new user
        await Wallet.create({
          userId: user._id,
          currencies: [{ code: 'NGN', balance: 0, isActive: true }]
        });
      }
    }

    // Generate JWT tokens
    const jwtPayload = {
      userId: user._id,
      email: user.email,
      displayName: user.displayName
    };

    const token = generateToken(jwtPayload);
    const refreshToken = generateRefreshToken(jwtPayload);

    res.status(200).json({
      success: true,
      message: 'Google sign-in successful',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          displayName: user.displayName,
          email: user.email,
          profileImage: user.profileImage,
          isVerified: user.isVerified,
          stats: user.stats,
          streamingAccounts: user.streamingAccounts,
          createdAt: user.createdAt
        },
        token,
        refreshToken
      }
    });
  } catch (error: any) {
    console.error('❌ Google Mobile Auth Error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid Google ID token',
      error: error.message
    });
  }
});
