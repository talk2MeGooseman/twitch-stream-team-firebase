import axios from 'axios';
import {
  TWITCH_BASE_EXTENSION_URL,
  EXTENSION_ID,
  EXTENSION_VERSION,
  CONFIG_KEY,
} from "../Constants";
import { signToken, signChannelMessageToken } from "./TokenUtil";

export async function setExtensionConfigured(channel_id, secret, version=EXTENSION_VERSION) {
  const token = signToken(secret);

  let response = await axios({
    method: 'PUT',
    url: `${TWITCH_BASE_EXTENSION_URL}/${EXTENSION_ID}/${EXTENSION_VERSION}/required_configuration?channel_id=${channel_id}`,
    data: {
      "required_configuration": CONFIG_KEY,
    },
    headers: {
      'Content-Type': 'application/json',
      'Client-id': EXTENSION_ID,
      'Authorization': `Bearer ${token}`
    }
  });
}

/**
 * Twitch API Requst to Fetch all the teams the channel is apart of
 *
 * @export
 * @param {string} channel_id
 * @returns {object} data
 */
export async function getChannelsTeam(channel_id) {
  let response;

  try {
    response = await axios({
      method: 'GET',
      url: `https://api.twitch.tv/kraken/channels/${channel_id}/teams`,
      headers: {
        'Client-id': EXTENSION_ID,
        "Accept": "application/vnd.twitchtv.v5+json",
      }
    });
  } catch (error) {
    console.error('Get Channel Team Error:', channel_id);
  }

  return response.data;
}

export async function getChannelsInfo(channel_ids) {
  let response;

  let channelNames = channel_ids.map((name) => name.trim());

  try {
    response = await axios({
      method: 'GET',
      url: `https://api.twitch.tv/kraken/users?login=${channelNames.join(',')}`,
      headers: {
        'Client-id': EXTENSION_ID,
        "Accept": "application/vnd.twitchtv.v5+json",
      }
    });

    console.info('getChannelsInfo', channelNames);
  } catch (error) {
    console.error('getChannelsInfo Error:', error);
  }

  return response.data;
}
