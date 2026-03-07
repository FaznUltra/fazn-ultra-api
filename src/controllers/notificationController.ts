import { Response } from 'express';
import Notification from '../models/Notification';
import { AuthRequest } from '../types';
import asyncHandler from '../utils/asyncHandler';

// Get user's notifications
export const getNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  const { isRead, limit = 50, page = 1 } = req.query;

  const query: any = { userId };

  if (isRead !== undefined) {
    query.isRead = isRead === 'true';
  }

  const skip = (Number(page) - 1) * Number(limit);

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip(skip);

  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({ userId, isRead: false });

  res.json({
    success: true,
    data: {
      notifications,
      unreadCount,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

// Mark notification as read
export const markAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?._id;

  const notification = await Notification.findOne({ _id: id, userId });

  if (!notification) {
    res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
    return;
  }

  notification.isRead = true;
  await notification.save();

  res.json({
    success: true,
    message: 'Notification marked as read',
    data: { notification }
  });
});

// Mark all notifications as read
export const markAllAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;

  await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true }
  );

  res.json({
    success: true,
    message: 'All notifications marked as read'
  });
});

// Delete notification
export const deleteNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?._id;

  const notification = await Notification.findOneAndDelete({ _id: id, userId });

  if (!notification) {
    res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
    return;
  }

  res.json({
    success: true,
    message: 'Notification deleted'
  });
});

// Delete all read notifications
export const deleteAllRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;

  const result = await Notification.deleteMany({ userId, isRead: true });

  res.json({
    success: true,
    message: `${result.deletedCount} notifications deleted`
  });
});

// Get unread count
export const getUnreadCount = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;

  const count = await Notification.countDocuments({ userId, isRead: false });

  res.json({
    success: true,
    data: { unreadCount: count }
  });
});
