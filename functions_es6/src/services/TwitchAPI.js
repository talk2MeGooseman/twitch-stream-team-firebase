import axios from 'axios';
import {
  TWITCH_BASE_EXTENSION_URL,
  EXTENSION_ID,
  EXTENSION_VERSION,
  CONFIG_KEY,
} from "../Constants";
import { signToken } from "./TokenUtil";

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

export async function publishChannelMessage(channel_id, secret) {
  const token = signChannelMessageToken(channel_id, secret);

  // Create payload message, can be anything up to 5kb
  // and 1 message per second per channel
  const message = JSON.stringify({
    refresh: true
  });

  try {
    let response = await axios({
      method: "POST",
      url: `${TWITCH_BASE_EXTENSION_URL}/message/${channel_id}`,
      data: {
        content_type: "application/json",
        message: message,
        targets: ["broadcast"],
      },
      headers: {
        "Content-Type": "application/json",
        "Client-id": EXTENSION_ID,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    console.error('PubSub Message failed', error);
  }
}

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
    console.error('Get Channel Team Error:', error);
  }

  return response.data;
}

export async function getTeamInfo(team_name) {
  let response;
  try {
    response = await axios({
      method: 'GET',
      url: `https://api.twitch.tv/kraken/teams/${team_name}`,
      headers: {
        'Client-id': EXTENSION_ID,
        "Accept": "application/vnd.twitchtv.v5+json",
      }
    });
  } catch (error) {
    console.error('Get Team Info Error:', error);
  }

  return response.data;
}

export async function getLiveChannels(channels) {
  console.info('Check if any of the following channels are live', channels);
  let channelArgs = channels.map((channel_id) => {
    return `user_id=${channel_id}`;
  });

  let channelParams = channelArgs.join('&'); 

  let response;
  try {
    response = await axios({
      method: 'GET',
      url: `https://api.twitch.tv/helix/streams?first=100&${channelParams}`,
      headers: {
        'Client-id': EXTENSION_ID,
      }
    });
  } catch (error) {
    console.error('Get live channel error:', error);
  }

  return response.data;
}