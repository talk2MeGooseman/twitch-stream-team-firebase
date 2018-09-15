import { REFRESH_INTERVAL } from "./Constants";

export const shouldRefresh = (miliseconds) => {
  return ((Date.now() - miliseconds) > REFRESH_INTERVAL);
};


export const sleep = function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
};