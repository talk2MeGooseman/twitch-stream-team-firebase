import { REFRESH_INTERVAL } from "./Constants";

export const shouldRefresh = (miliseconds) => {
  return ((Date.now() - miliseconds) > REFRESH_INTERVAL);
};