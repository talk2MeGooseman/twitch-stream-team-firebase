const functions = require("firebase-functions");
const admin = require('firebase-admin');
import {
  getChannelsTeam,
  getLiveChannels,
  getChannelsInfo,
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
  queryCustomTeamInfo,
  setCustomTeam,
  deleteTeamLiveChannels,
} from "./src/Firebase";
import { shouldRefresh } from "./src/Helpers";
import { CUSTOM_TEAM_TYPE, TWITCH_TEAM_TYPE } from "./src/Constants";
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
    if (channelInfo) {
      let { teamInfo, customTeam } = await getAllPanelInformation(decoded_token, channelInfo);

      res.json({
        teams: channelInfo.teams || [],
        selectedTeam: teamInfo,
        teamType: channelInfo.team_type,
        customTeam: customTeam,
      });
    } else {
      res.status(404).end();
      return;
    }
  });
}); 

exports.config_get_panel_information = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    let teams = [], teamInfoResponse = null, selectedTeamData = null, selectedTeamName;
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
    console.info('Configuration data requested for channel', decoded_token.channel_id);

    let channelInfo = await queryChannelInfo(db, decoded_token.channel_id);
    if (channelInfo)
    {
      selectedTeamName = channelInfo.selected_team;
    }

    // Request Channels Team
    console.info('Find channels', decoded_token.channel_id, 'team info');
    // let channelTeamsResponse = await getChannelsTeam('7676884');
    let channelTeamsResponse = await getChannelsTeam(decoded_token.channel_id);

    // Check if user has a team
    if (channelTeamsResponse.teams.length > 0)
    {

      // get the name on all the channels and make a new array
      teams = channelTeamsResponse.teams.map(team => {
        return team.name;
      });

      // If the user doesnt have a selected team or they were removed
      // from their selected team, then auto select the first one
      if (!selectedTeamName || !teams.includes(selectedTeamName)) {
        selectedTeamData = channelTeamsResponse.teams[0];
      } else {
        selectedTeamData = await queryTeamInfo(db, selectedTeamName)
      }

      await fetchAndSaveTeamsInfo(teams, selectedTeamData, res);

      // Set the team name for a channel
      await setChannelInfo(db, decoded_token.channel_id, {
        channel_id: decoded_token.channel_id,
        selected_team: selectedTeamData.name,
        teams,
        refresh_at: Date.now(),
      });
    }

    // Get updates for channel_id from collection
    channelInfo = await queryChannelInfo(db, decoded_token.channel_id);
    // If there in information for the channel then fetch its team info
    if (channelInfo)
    {
      let { teamInfo, customTeam } = await getAllPanelInformation(decoded_token, channelInfo);

      res.json({
        teams: channelInfo.teams || [],
        selectedTeam: teamInfo,
        teamType: channelInfo.team_type,
        customTeam: customTeam,
      });
    } else
    {
      res.status(404).end();
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
        await updateChannelInfo(db, decoded_token.channel_id, {
          selected_team: selected_team,
          team_type: TWITCH_TEAM_TYPE,
        });

        // Get info for team for response
        let teamInfo = await queryTeamInfo(db, selected_team);

        res.json({
          teams: channelInfo.teams,
          selectedTeam: teamInfo,
          teamType: TWITCH_TEAM_TYPE,
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
      decoded_token = decodeToken(token, SECRET);
    } catch (err) {
      console.error("JWT was invalid", err);
      res.status(401).json({});
      return;
    }

    console.info('Get live channels for ', decoded_token.channel_id, 'team');
    // Get document for channel_id from collection
    let channelInfo = await queryChannelInfo(db, decoded_token.channel_id);

    if (!channelInfo) {
      res.status(404).end();
      return;
    }

    let teamInfo, liveTeamID;
    if (channelInfo.team_type === CUSTOM_TEAM_TYPE)
    {
      teamInfo = await queryCustomTeamInfo(db, decoded_token.channel_id);
      liveTeamID = decoded_token.channel_id;
    } else {
      teamInfo = await queryTeamInfo(db, channelInfo.selected_team);
      liveTeamID = teamInfo.name;
    }

    // Create an array of live channel ids
    let channelIds = teamInfo.users.map((channel) => channel._id);

    // Query for live channels for team from db
    let liveChannelsData = await queryTeamLiveChannels(db, liveTeamID);

    // check if live channels for team is stale
    if (!liveChannelsData || shouldRefresh(liveChannelsData.refresh_at)) {
      // Refresh data before responding back
      liveChannelsData = await getLiveChannels(channelIds);
      await setTeamLiveChannels(db, liveTeamID, liveChannelsData)
    }

    res.json(liveChannelsData);
  });
});

exports.set_custom_team = functions.https.onRequest((req, res) => {
  // Need to use CORS for Twitch
  cors(req, res, async () => {
    let decoded_token;
    // Get payload from request body
    const { customName, customChannels, logo, banner } = req.body;

    if (!customName || !customName.length || !customChannels || !customChannels.length) {
      res.status(400).end();
      return;
    }

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

    console.info('Channel', decoded_token.channel_id, 'setting custom team info', req.body);

    try
    {
      // 1. Loop through the array of user_ids to get their channel information
      // 2. Format all the information to it looks like twitch team object
      // 3. Save the information in the custom team collection
      let channelsInfo = await getChannelsInfo(customChannels);
      let customTeamObject = {
        _id: decoded_token.channel_id,
        background: null,
        banner: banner || null,
        display_name: customName,
        name: customName,
        logo: logo || null,
        users: channelsInfo.users
      };

      await setCustomTeam(db, decoded_token.channel_id, customTeamObject);

      // Set broadcaster channel info
      await setChannelInfo(db, decoded_token.channel_id, {
        channel_id: decoded_token.channel_id,
        refresh_at: Date.now(),
        team_type: CUSTOM_TEAM_TYPE,
      });

      // Delete the cached live channel information since this is new
      // data
      deleteTeamLiveChannels(db, decoded_token.channel_id);

      res.json({
        customTeam: customTeamObject
      });

    } catch (error)
    {
      console.error('Error ocurred setting', decoded_token.channel_id, 'selected team', error);
      res.status(400).end();
    }

  });
});

async function getAllPanelInformation(decoded_token, channelInfo) {
  console.info('Channel info found', channelInfo);
  let teamInfo;

  // This can be null if they entered through the custom team flow
  if (channelInfo.selected_team)
  {
    teamInfo = await queryTeamInfo(db, channelInfo.selected_team);
  }

  // Get custom team information
  let customTeam = await queryCustomTeamInfo(db, decoded_token.channel_id);

  return { teamInfo, customTeam };
}

/**
 * Fetch all the teams provided, save the data to DB and return back selected team info
 * @param {Array} teams 
 * @param {String} selectedTeam 
 */
async function fetchAndSaveTeamsInfo(teams, selectedTeam) {
  console.info("Set Channel teams info");
  let selectedTeamsInfo;

  // Fetch and save all the teams in db
  teams.forEach(async (teamName) => {
      let teamInfoResponse = await saveTeam(db, teamName);
      // Respond with first team selected information
      if (teamInfoResponse.name === selectedTeam.name)
      {
        selectedTeamsInfo = teamInfoResponse;
      }
  });

  return selectedTeamsInfo;
}
