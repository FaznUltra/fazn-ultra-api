import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: 'CHALLENGE' | 'FRIEND_REQUEST' | 'FRIEND_ACCEPT' | 'CHALLENGE_ACCEPTED' | 'CHALLENGE_COMPLETED' | 'PAYMENT' | 'SYSTEM';
  title: string;
  message: string;
  data: {
    challengeId?: Types.ObjectId;
    friendshipId?: Types.ObjectId;
    transactionId?: Types.ObjectId;
    [key: string]: any;
  };
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['CHALLENGE', 'FRIEND_REQUEST', 'FRIEND_ACCEPT', 'CHALLENGE_ACCEPTED', 'CHALLENGE_COMPLETED', 'PAYMENT', 'SYSTEM'],
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    data: {
      type: Schema.Types.Mixed,
      default: {}
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

export default mongoose.model<INotification>('Notification', notificationSchema);
