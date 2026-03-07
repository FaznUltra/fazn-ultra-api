import { Response } from 'express';
import SupportTicket from '../models/SupportTicket';
import { AuthRequest } from '../types';
import asyncHandler from '../utils/asyncHandler';

// Get user's support tickets
export const getSupportTickets = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  const { status, limit = 20, page = 1 } = req.query;

  console.log('🎫 SUPPORT TICKETS REQUEST:');
  console.log('- User ID:', userId);
  console.log('- Status filter:', status);
  console.log('- Page:', page, 'Limit:', limit);

  const query: any = { userId };

  if (status) {
    query.status = status;
  }

  console.log('- MongoDB Query:', query);

  const skip = (Number(page) - 1) * Number(limit);

  const tickets = await SupportTicket.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip(skip);

  const total = await SupportTicket.countDocuments(query);

  console.log('📊 SUPPORT TICKETS RESULT:');
  console.log('- Total tickets found:', total);
  console.log('- Tickets returned:', tickets.length);
  console.log('- Tickets:', JSON.stringify(tickets, null, 2));

  res.json({
    success: true,
    data: {
      tickets,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

// Get single ticket details
export const getTicketById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?._id;

  const ticket = await SupportTicket.findOne({ _id: id, userId });

  if (!ticket) {
    res.status(404).json({
      success: false,
      message: 'Ticket not found'
    });
    return;
  }

  res.json({
    success: true,
    data: { ticket }
  });
});

// Create a new support ticket
export const createSupportTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { subject, category, message } = req.body;
  const userId = req.user?._id;

  if (!subject || !category || !message) {
    res.status(400).json({
      success: false,
      message: 'Subject, category, and message are required'
    });
    return;
  }

  const ticket = await SupportTicket.create({
    userId,
    subject,
    category,
    messages: [
      {
        sender: 'user',
        message,
        createdAt: new Date()
      }
    ]
  });

  res.status(201).json({
    success: true,
    message: 'Support ticket created successfully',
    data: { ticket }
  });
});

// Add message to ticket
export const addMessageToTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { message } = req.body;
  const userId = req.user?._id;

  if (!message) {
    res.status(400).json({
      success: false,
      message: 'Message is required'
    });
    return;
  }

  const ticket = await SupportTicket.findOne({ _id: id, userId });

  if (!ticket) {
    res.status(404).json({
      success: false,
      message: 'Ticket not found'
    });
    return;
  }

  if (ticket.status === 'closed') {
    res.status(400).json({
      success: false,
      message: 'Cannot add message to closed ticket'
    });
    return;
  }

  ticket.messages.push({
    sender: 'user',
    message,
    createdAt: new Date()
  });

  // Update status to in_progress if it was open
  if (ticket.status === 'open') {
    ticket.status = 'in_progress';
  }

  await ticket.save();

  res.json({
    success: true,
    message: 'Message added successfully',
    data: { ticket }
  });
});

// Close ticket
export const closeTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?._id;

  const ticket = await SupportTicket.findOne({ _id: id, userId });

  if (!ticket) {
    res.status(404).json({
      success: false,
      message: 'Ticket not found'
    });
    return;
  }

  if (ticket.status === 'closed') {
    res.status(400).json({
      success: false,
      message: 'Ticket is already closed'
    });
    return;
  }

  ticket.status = 'closed';
  await ticket.save();

  res.json({
    success: true,
    message: 'Ticket closed successfully',
    data: { ticket }
  });
});

// Get ticket statistics
export const getTicketStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;

  const stats = await SupportTicket.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0
  };

  stats.forEach(stat => {
    result[stat._id as keyof typeof result] = stat.count;
    result.total += stat.count;
  });

  res.json({
    success: true,
    data: result
  });
});
