const BRAZIL_TIMEZONE_OFFSET_MINUTES = -3 * 60;

export const getBrazilNow = () => {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + BRAZIL_TIMEZONE_OFFSET_MINUTES * 60000);
};
