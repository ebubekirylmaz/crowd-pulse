const LOCAL_NETWORK_ORIGIN =
  /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

export const corsOrigin: string | RegExp =
  process.env.CORS_ORIGIN || LOCAL_NETWORK_ORIGIN;
