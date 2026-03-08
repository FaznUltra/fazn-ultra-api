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
      // Return HTML error page
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Authentication Failed</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; text-align: center; }
              h1 { color: #ff3b30; }
            </style>
          </head>
          <body>
            <h1>Authentication Failed</h1>
            <p>Please close this window and try again.</p>
          </body>
        </html>
      `);
    }

    const payload = {
      userId: user._id,
      email: user.email,
      displayName: user.displayName
    };

    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const frontendUrl = process.env.FRONTEND_URL || 'ultra://';
    const deepLink = `${frontendUrl}auth/google-callback?token=${token}&refreshToken=${refreshToken}`;
    
    // Return HTML page that triggers deep link and closes browser
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Sign-In Successful</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              padding: 40px;
              text-align: center;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
            }
            .container {
              background: rgba(255, 255, 255, 0.1);
              padding: 40px;
              border-radius: 20px;
              backdrop-filter: blur(10px);
            }
            h1 { margin: 0 0 20px 0; font-size: 28px; }
            p { margin: 10px 0; font-size: 16px; opacity: 0.9; }
            .spinner {
              border: 4px solid rgba(255, 255, 255, 0.3);
              border-top: 4px solid white;
              border-radius: 50%;
              width: 40px;
              height: 40px;
              animation: spin 1s linear infinite;
              margin: 20px auto;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .success { font-size: 48px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✓</div>
            <h1>Sign-In Successful!</h1>
            <div class="spinner"></div>
            <p>Redirecting back to Ultra Gaming...</p>
            <p style="font-size: 14px; margin-top: 30px;">If you're not redirected, you can close this window.</p>
          </div>
          <script>
            // Try to open the app via deep link
            window.location.href = '${deepLink}';
            
            // Fallback: Try again after a short delay
            setTimeout(function() {
              window.location.href = '${deepLink}';
            }, 500);
            
            // Close the browser window after redirect (works in some browsers)
            setTimeout(function() {
              window.close();
            }, 1000);
          </script>
        </body>
      </html>
    `);
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
