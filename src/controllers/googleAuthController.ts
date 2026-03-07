import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import { IUser } from '../types';

export const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false
});

export const googleAuthCallback = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', { session: false }, (err: any, user: IUser) => {
    if (err || !user) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=Authentication failed`);
    }

    const payload = {
      userId: user._id,
      email: user.email,
      displayName: user.displayName
    };

    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return res.redirect(
      `${process.env.FRONTEND_URL}/auth/success?token=${token}&refreshToken=${refreshToken}`
    );
  })(req, res, next);
};
