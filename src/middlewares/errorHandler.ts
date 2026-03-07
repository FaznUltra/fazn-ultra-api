import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface CustomError extends Error {
  statusCode?: number;
  code?: number;
  keyValue?: Record<string, unknown>;
  errors?: Record<string, { message: string }>;
}

const errorHandler = (err: CustomError, _req: Request, res: Response, _next: NextFunction) => {
  const error: CustomError = { ...err };
  error.message = err.message;

  logger.error(err);

  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error.message = message;
    error.statusCode = 404;
  }

  if (err.code === 11000) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field';
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    error.message = message;
    error.statusCode = 400;
  }

  if (err.name === 'ValidationError') {
    const message = err.errors
      ? Object.values(err.errors).map(val => val.message)
      : ['Validation error'];
    error.message = message.join(', ');
    error.statusCode = 400;
  }

  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error.message = message;
    error.statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error.message = message;
    error.statusCode = 401;
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export default errorHandler;
