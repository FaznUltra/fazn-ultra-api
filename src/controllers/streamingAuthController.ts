import { Request, Response } from 'express';
import axios from 'axios';
import { AuthRequest } from '../types';
import User from '../models/User';
import asyncHandler from '../utils/asyncHandler';

// YouTube OAuth
export const youtubeAuth = asyncHandler(async (req: AuthRequest, res: Response) => {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const redirectUri = `${process.env.API_URL}/api/v1/streaming/youtube/callback`;
  const scope = 'https://www.googleapis.com/auth/youtube.readonly';
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scope)}&` +
    `access_type=offline&` +
    `state=${req.user?._id}&` +
    `prompt=consent`;

  res.json({
    success: true,
    data: { authUrl }
  });
});

export const youtubeCallback = asyncHandler(async (req: Request, res: Response) => {
  const { code, state: userId } = req.query;

  // Detect if request is from web or mobile
  const isWeb = req.headers['user-agent']?.includes('Mozilla') || req.headers.referer?.includes('localhost:3000');
  const baseUrl = isWeb ? (process.env.WEB_URL || 'http://localhost:3000') : process.env.FRONTEND_URL;

  if (!code || !userId) {
    return res.redirect(`${baseUrl}/edit-profile?error=missing_params`);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.YOUTUBE_CLIENT_ID,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET,
      redirect_uri: `${process.env.API_URL}/api/v1/streaming/youtube/callback`,
      grant_type: 'authorization_code'
    });

    const { access_token, refresh_token } = tokenResponse.data;

    // Get channel info with statistics
    const channelResponse = await axios.get(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      {
        headers: { Authorization: `Bearer ${access_token}` }
      }
    );

    const channel = channelResponse.data.items?.[0];
    if (!channel) {
      return res.redirect(`${baseUrl}/edit-profile?error=no_channel`);
    }

    // Update user with YouTube info
    await User.findByIdAndUpdate(userId, {
      'streamingAccounts.youtube': {
        channelId: channel.id,
        channelUrl: `https://youtube.com/channel/${channel.id}`,
        channelName: channel.snippet.title,
        profileImage: channel.snippet.thumbnails?.default?.url || null,
        subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
        verified: true,
        accessToken: access_token,
        refreshToken: refresh_token
      }
    });

    res.redirect(`${baseUrl}/edit-profile?youtube=success`);
  } catch (error: any) {
    console.error('YouTube OAuth error:', error.response?.data || error.message);
    res.redirect(`${baseUrl}/edit-profile?error=youtube_auth_failed`);
  }
});

// Twitch OAuth
export const twitchAuth = asyncHandler(async (req: AuthRequest, res: Response) => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const redirectUri = `${process.env.API_URL}/api/v1/streaming/twitch/callback`;
  const scope = 'user:read:email';
  
  const authUrl = `https://id.twitch.tv/oauth2/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scope)}&` +
    `state=${req.user?._id}`;

  res.json({
    success: true,
    data: { authUrl }
  });
});

export const twitchCallback = asyncHandler(async (req: Request, res: Response) => {
  const { code, state: userId } = req.query;

  // Detect if request is from web or mobile
  const isWeb = req.headers['user-agent']?.includes('Mozilla') || req.headers.referer?.includes('localhost:3000');
  const baseUrl = isWeb ? (process.env.WEB_URL || 'http://localhost:3000') : process.env.FRONTEND_URL;

  if (!code || !userId) {
    return res.redirect(`${baseUrl}/edit-profile?error=missing_params`);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.API_URL}/api/v1/streaming/twitch/callback`
    });

    const { access_token, refresh_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID!
      }
    });

    const twitchUser = userResponse.data.data?.[0];
    if (!twitchUser) {
      return res.redirect(`${baseUrl}/edit-profile?error=no_twitch_user`);
    }

    // Get follower count
    let followerCount = 0;
    try {
      const followersResponse = await axios.get(
        `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${twitchUser.id}`,
        {
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID!
          }
        }
      );
      followerCount = followersResponse.data.total || 0;
    } catch (error) {
      console.log('Could not fetch follower count:', error);
    }

    // Update user with Twitch info
    await User.findByIdAndUpdate(userId, {
      'streamingAccounts.twitch': {
        channelId: twitchUser.id,
        channelUrl: `https://twitch.tv/${twitchUser.login}`,
        channelName: twitchUser.display_name,
        profileImage: twitchUser.profile_image_url || null,
        followerCount: followerCount,
        verified: true,
        accessToken: access_token,
        refreshToken: refresh_token
      }
    });

    res.redirect(`${baseUrl}/edit-profile?twitch=success`);
  } catch (error: any) {
    console.error('Twitch OAuth error:', error.response?.data || error.message);
    res.redirect(`${baseUrl}/edit-profile?error=twitch_auth_failed`);
  }
});

// Disconnect streaming accounts
export const disconnectYoutube = asyncHandler(async (req: AuthRequest, res: Response) => {
  await User.findByIdAndUpdate(req.user?._id, {
    'streamingAccounts.youtube': {
      channelUrl: null,
      channelId: null,
      channelName: null,
      verified: false,
      accessToken: null,
      refreshToken: null
    }
  });

  res.json({
    success: true,
    message: 'YouTube account disconnected'
  });
});

export const disconnectTwitch = asyncHandler(async (req: AuthRequest, res: Response) => {
  await User.findByIdAndUpdate(req.user?._id, {
    'streamingAccounts.twitch': {
      channelUrl: null,
      channelId: null,
      channelName: null,
      verified: false,
      accessToken: null,
      refreshToken: null
    }
  });

  res.json({
    success: true,
    message: 'Twitch account disconnected'
  });
});
