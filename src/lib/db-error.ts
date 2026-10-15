export const cfMessage = (msg: string, fallback: string) =>
  msg.startsWith("CF:") ? msg.slice(3) : fallback;
