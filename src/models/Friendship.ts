import mongoose, { Schema, Document } from 'mongoose';
import { FriendshipStatus } from '../utils/constants';

export interface IFriendship extends Document {
  requester: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
}

const friendshipSchema = new Schema<IFriendship>(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED'],
      default: 'PENDING'
    }
  },
  {
    timestamps: true
  }
);

friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });
friendshipSchema.index({ requester: 1, status: 1 });
friendshipSchema.index({ recipient: 1, status: 1 });

const Friendship = mongoose.model<IFriendship>('Friendship', friendshipSchema);

export default Friendship;
