import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types';

export const generateToken = (payload: JWTPayload): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');
  
  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRE || '15m'
  } as any);
};

export const generateRefreshToken = (payload: JWTPayload): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not defined');
  
  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
  } as any);
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, process.env.JWT_SECRET as string) as JWTPayload;
};

export const verifyRefreshToken = (token: string): JWTPayload => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as JWTPayload;
};
