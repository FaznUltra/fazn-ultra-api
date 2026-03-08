import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAdminReview extends Document {
  _id: Types.ObjectId;
  challengeId: Types.ObjectId;
  type: 'DISPUTE' | 'FLAG';
  raisedBy: Types.ObjectId;
  raisedByRole: 'CREATOR' | 'ACCEPTOR' | 'WITNESS';
  reason: string;
  evidence: {
    streamUrl: string | null;
    screenshots: string[];
    additionalNotes: string | null;
  };
  status: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED';
  priority: number; // 1-5, based on stake amount
  assignedTo: Types.ObjectId | null;
  decision: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const adminReviewSchema = new Schema<IAdminReview>(
  {
    challengeId: {
      type: Schema.Types.ObjectId,
      ref: 'Challenge',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['DISPUTE', 'FLAG'],
      required: true
    },
    raisedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    raisedByRole: {
      type: String,
      enum: ['CREATOR', 'ACCEPTOR', 'WITNESS'],
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    evidence: {
      streamUrl: {
        type: String,
        default: null
      },
      screenshots: {
        type: [String],
        default: []
      },
      additionalNotes: {
        type: String,
        default: null
      }
    },
    status: {
      type: String,
      enum: ['PENDING', 'UNDER_REVIEW', 'RESOLVED'],
      default: 'PENDING',
      index: true
    },
    priority: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    decision: {
      type: String,
      default: null
    },
    decidedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient querying
adminReviewSchema.index({ status: 1, priority: -1, createdAt: 1 });
adminReviewSchema.index({ challengeId: 1 });
adminReviewSchema.index({ assignedTo: 1 });

const AdminReview = mongoose.model<IAdminReview>('AdminReview', adminReviewSchema);

export default AdminReview;
