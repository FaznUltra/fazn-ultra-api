import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User';
import Wallet from '../models/Wallet';

// Only initialize Google OAuth if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && 
    process.env.GOOGLE_CLIENT_SECRET && 
    process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id.apps.googleusercontent.com') {
  
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL
      },
      async (_accessToken, _refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          user.lastLogin = new Date();
          await user.save();
          return done(null, user);
        }

        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email found in Google profile'), undefined);
        }

        user = await User.findOne({ email });

        if (user) {
          user.googleId = profile.id;
          user.isVerified = true;
          user.lastLogin = new Date();
          if (!user.profileImage && profile.photos?.[0]?.value) {
            user.profileImage = profile.photos[0].value;
          }
          await user.save();
          return done(null, user);
        }

        const firstName = profile.name?.givenName || 'User';
        const lastName = profile.name?.familyName || '';
        const displayName = `@${profile.displayName?.replace(/\s+/g, '').toLowerCase() || email.split('@')[0]}`;

        let finalDisplayName = displayName;
        let counter = 1;
        while (await User.findOne({ displayName: finalDisplayName })) {
          finalDisplayName = `${displayName}${counter}`;
          counter++;
        }

        const newUser = await User.create({
          firstName,
          lastName,
          displayName: finalDisplayName,
          email,
          googleId: profile.id,
          profileImage: profile.photos?.[0]?.value || null,
          isVerified: true,
          lastLogin: new Date()
        });

        await Wallet.create({
          userId: newUser._id,
          currencies: [{ code: 'NGN', balance: 0, isActive: true }]
        });

        return done(null, newUser);
      } catch (error: any) {
        return done(error, undefined);
      }
    }
  )
);
}

passport.serializeUser((user: any, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
