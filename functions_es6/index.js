const functions = require("firebase-functions");
const admin = require('firebase-admin');
import {
  getChannelsTeam,
  getLiveChannels,
} from "./src/services/TwitchAPI";
import {
  verifyToken,
  decodeToken
} from "./src/services/TokenUtil";
import {
  refreshTeam,
  saveTeam,
  queryChannelInfo,
  queryTeamInfo,
  refreshChannelTeams,
  updateChannelInfo,
  setChannelInfo,
  queryTeamLiveChannels,
  setTeamLiveChannels,
} from "./src/Firebase";
import { shouldRefresh } from "./src/Helpers";
require('dotenv').config()

// decoded_token.channel_id = "7676884";

admin.initializeApp(functions.config().firebase);
let db = admin.firestore();

const cors = require('cors')({
  origin: true
});

let SECRET;
// Firebase env variables only work on server so we check to see if it exists
// if not load from ENV
if (functions.config().twitch) {
  SECRET = functions.config().twitch.secret;
} else {
  SECRET = process.env.SECRET;
}

exports.get_panel_information = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    let decoded_token;
    // Get JWT token from header
    const token = req.get("x-extension-jwt");

    try
    {
      // Only decode token, no need to verify if its from broadcaster
      decoded_token = decodeToken(token, SECRET);
    } catch (err)
    {
      console.error("JWT was invalid", err);
      res.status(401).json({});
      return;
    }

    // Get document for channel_id from collection
    let channelInfo = await queryChannelInfo(db, decoded_token.channel_id);

    // If there in information for the channel then fetch its team info
    if (channelInfo)
    {
      console.info('Channel', decoded_token.channel_id, 'info found');
      let teamInfo = await queryTeamInfo(db, channelInfo.selected_team);

      res.json({
        teams: channelInfo.teams,
        selectedTeam: teamInfo
      });

      setTimeout(() => {
        refreshTeam(db, teamInfo);
        refreshChannelTeams(db, channelInfo);
      }, 0);
    } else
    {
      console.info('Find channels', decoded_token.channel_id, 'team info');
      // Request Channels Team
      let channelResponse = await getChannelsTeam(decoded_token.channel_id);
      // Check if user has a team
      if (channelResponse.teams.length === 0)
      {
        res.status(404).end();
        return;
      }

      let selectedTeam = channelResponse.teams[0];
      // get the name on all the channels and make a new array
      let teams = channelResponse.teams.map((selectedTeam) => {
        return selectedTeam.name;
      });

      // Set the team name for a channel
      await setChannelInfo(db, decoded_token.channel_id, {
        channel_id: decoded_token.channel_id,
        selected_team: selectedTeam.name,
        teams,
        refresh_at: Date.now(),
      });

      console.info("Set Channel", decoded_token.channel_id, "teams info");
      // Fetch and save all the teams in db
      teams.forEach(async teamName => {
        try {
          let teamInfoResponse = await saveTeam(db, teamName);

          // Respond with first team selected information
          if (teamInfoResponse.name === selectedTeam.name)
          {
            res.json({
              teams,
              selectedTeam: teamInfoResponse
            });
          }
        } catch (error) {
          console.error('Set info failed for', teamData.name, error);
        }
      });
    }
  });
}); 

// POST STYLE REQUEST FLOW
exports.set_panel_information = functions.https.onRequest((req, res) => {
  // Need to use CORS for Twitch
  cors(req, res, async () => {
    let decoded_token;
    // Get payload from request body
    const { selected_team } = req.body;

    // Get JWT from header
    const token = req.get("x-extension-jwt");

    // Verify if token is valid, belongs to broadcaster and decode
    try {
      decoded_token = verifyToken(token, SECRET);
    } catch (err) {
      console.error("JWT was invalid", err);
      res.status(401).json({});
      return;
    }

    console.info('Channel', decoded_token.channel_id, 'changing team to', selected_team);
    let channelInfo = await queryChannelInfo(db, decoded_token.channel_id);

    // Check if selected team is a team that they are a part of
    if (channelInfo.teams.includes(selected_team))
    {
      try {
       // Update selected team for user
        await updateChannelInfo(db, decoded_token.channel_id, { selected_team: selected_team });

        // Get info for team for response
        let teamInfo = await queryTeamInfo(db, selected_team);

        res.json({
          teams: channelInfo.teams,
          selectedTeam: teamInfo,
        });
      } catch (error) {
        console.error('Error ocurred setting', decoded_token.channel_id, 'selected team', error);
        res.status(400).end();
      }

    } else
    {
      console.error('Could not find channel', decoded_token.channel_id, 'selected team', selected_team);
      res.status(404).end();
    }
  });
});


exports.get_live_channels = functions.https.onRequest((req, res) => {
  // Need to use CORS for Twitch
  cors(req, res, async () => {
    let decoded_token;

    // Get JWT from header
    const token = req.get("x-extension-jwt");

    // Verify if token is valid, belongs to broadcaster and decode
    try {
      decoded_token = verifyToken(token, SECRET);
    } catch (err) {
      console.error("JWT was invalid", err);
      res.status(401).json({});
      return;
    }

    // Get document for channel_id from collection
    let channelInfo = await queryChannelInfo(db, decoded_token.channel_id);

    if (!channelInfo) {
      res.status(404).end();
      return;
    }

    let teamInfo = await queryTeamInfo(db, channelInfo.selected_team);

    // Create an array of live channel ids
    let channelIds = teamInfo.users.map((channel) => channel._id);

    // Extra param for testing
    if (req.query.channel_id) {
      channelIds.push(req.query.channel_id);
    }

    // Query for live channels for team from db
    let liveChannelsData = await queryTeamLiveChannels(db, teamInfo.name);

    // check if live channels for team is stale
    if (liveChannelsData && shouldRefresh( liveChannelsData.refresh_at)) {
      // Refresh data before responding back
      liveChannelsData = await getLiveChannels(channelIds);
      await setTeamLiveChannels(db, teamInfo.name, liveChannelsData)
    } else if(!liveChannelsData) {
      liveChannelsData = await getLiveChannels(channelIds);
      await setTeamLiveChannels(db, teamInfo.name, liveChannelsData)
    }

    res.json(liveChannelsData);
  });
});