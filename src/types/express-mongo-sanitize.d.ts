declare module 'express-mongo-sanitize' {
  import { RequestHandler } from 'express';
  
  interface SanitizeOptions {
    replaceWith?: string;
    onSanitize?: (options: { req: any; key: string }) => void;
  }
  
  function mongoSanitize(options?: SanitizeOptions): RequestHandler;
  
  export = mongoSanitize;
}
