import { Response } from 'express';
import axios from 'axios';
import { AuthRequest } from '../types';
import User from '../models/User';
import asyncHandler from '../utils/asyncHandler';

// Check if YouTube channel is currently live
export const getYoutubeLiveStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user?._id).select('+streamingAccounts.youtube.accessToken');

  if (!user || !user.streamingAccounts?.youtube?.verified) {
    res.status(400).json({
      success: false,
      message: 'YouTube account not connected'
    });
    return;
  }

  const { channelId, accessToken } = user.streamingAccounts.youtube;

  if (!channelId || !accessToken) {
    res.status(400).json({
      success: false,
      message: 'YouTube channel information missing'
    });
    return;
  }

  try {
    // Use liveBroadcasts endpoint to get active broadcasts
    const response = await axios.get(
      'https://www.googleapis.com/youtube/v3/liveBroadcasts',
      {
        params: {
          part: 'snippet,status',
          broadcastStatus: 'active',
          broadcastType: 'all'
        },
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const liveBroadcasts = response.data.items || [];
    
    if (liveBroadcasts.length > 0) {
      const liveBroadcast = liveBroadcasts[0];
      
      // Get the video ID from the broadcast
      const videoId = liveBroadcast.id;
      
      res.json({
        success: true,
        data: {
          isLive: true,
          streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
          title: liveBroadcast.snippet.title,
          thumbnail: liveBroadcast.snippet.thumbnails?.medium?.url || liveBroadcast.snippet.thumbnails?.default?.url,
          startedAt: liveBroadcast.snippet.actualStartTime || liveBroadcast.snippet.scheduledStartTime
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          isLive: false,
          streamUrl: null
        }
      });
    }
  } catch (error: any) {
    console.error('YouTube live status error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to check YouTube live status',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

// Check if Twitch channel is currently live
export const getTwitchLiveStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user?._id).select('+streamingAccounts.twitch.accessToken');

  if (!user || !user.streamingAccounts?.twitch?.verified) {
    res.status(400).json({
      success: false,
      message: 'Twitch account not connected'
    });
    return;
  }

  const { channelId, accessToken } = user.streamingAccounts.twitch;

  if (!channelId || !accessToken) {
    res.status(400).json({
      success: false,
      message: 'Twitch channel information missing'
    });
    return;
  }

  try {
    // Get stream information
    const response = await axios.get(
      `https://api.twitch.tv/helix/streams?user_id=${channelId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Id': process.env.TWITCH_CLIENT_ID!
        }
      }
    );

    const streams = response.data.data || [];
    
    if (streams.length > 0) {
      const stream = streams[0];
      res.json({
        success: true,
        data: {
          isLive: true,
          streamUrl: `https://www.twitch.tv/${stream.user_login}`,
          title: stream.title,
          thumbnail: stream.thumbnail_url.replace('{width}', '640').replace('{height}', '360'),
          viewerCount: stream.viewer_count,
          startedAt: stream.started_at,
          gameName: stream.game_name
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          isLive: false,
          streamUrl: null
        }
      });
    }
  } catch (error: any) {
    console.error('Twitch live status error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to check Twitch live status',
      error: error.response?.data?.message || error.message
    });
  }
});
