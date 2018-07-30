import { getTeamInfo, getChannelsTeam } from "./services/TwitchAPI";
import { shouldRefresh } from "./Helpers";

export const refreshTeam = async (db, teamData) => {
  // Check if we need to refresh the team info
  if (shouldRefresh(teamData.refresh_at))
  {
    console.info('Need to refresh team', teamData.name);
    try {
      await saveTeam(db, teamData.name);
      console.info('Refreshed team', teamData.name);
    } catch (error) {
      console.error('Team info update failed for', teamData.name, error);
    }
  }
}

export const queryTeamInfo = async (db, teamName) => {
  // Get info for team for response
  const docTeamRef = db.collection("team").doc(teamName);

  let doc = await docTeamRef.get();
  console.info("Fetched", teamName, "info");
  return doc.data();
}

export const saveTeam = async (db, teamName) => {
  let teamInfoResponse = await getTeamInfo(teamName)
  // Get document for team from collection
  const docTeamRef = db.collection("team").doc(teamName);

  teamInfoResponse.refreshed_at = Date.now();

  // Save the team information in to a team document
  await docTeamRef.set(teamInfoResponse);
  console.info("Set Team Info", teamName);

  return teamInfoResponse;
}

export const refreshChannelTeams = async (db, channelData) => {
  // Check if we need to refresh the team info
  if (shouldRefresh(channelData.refresh_at))
  {
    console.info('Need to refresh channels team', channelData.channel_id);
    try {
      // Request Channels Team
      let channelResponse = await getChannelsTeam(channelData.channel_id);

      // get the name on all the channels and make a new array
      let teams = channelResponse.teams.map((selectedTeam) => {
        return selectedTeam.name;
      });

      await updateChannelInfo(db, channelData.channel_id, {
        teams,
        refresh_at: Date.now(),
      });
      console.info('Refresh channels teams', channelData.channel_id);
    } catch (error) {
      console.error('Channel info update failed for', channelData.channel_id, error);
    }
  }
}

export const setChannelInfo = async (db, channelId, channelData) => {
  // Get document for channel_id from collection
  const docRef = db.collection("channel").doc(channelId);
  // Set the team name for a channel
  await docRef.set(channelData);
}

export const updateChannelInfo = async (db, channelId, channelData) => {
  // Get document for channel_id from collection
  const docRef = db.collection("channel").doc(channelId);
  // Set the team name for a channel
  await docRef.update(channelData);
}

export const queryChannelInfo = async (db, channel_id) => {
  // Get document for channel_id from collection
  const docRef = db.collection("channel").doc(channel_id);

  // Read the document.
  let doc = await docRef.get();
  console.info("Channel ", channel_id, "info requested");

  return doc.data();
}

export const queryTeamLiveChannels = async (db, teamName) => {
  // Get document for team from collection
  const docRef = db.collection("team_live_channels").doc(teamName);

  let doc = await docRef.get();
  console.info("Fetch team live channels", teamName);

  return doc.data();
}

export const setTeamLiveChannels = async (db, teamName, data) => {
  // Get document for team from collection
  const docRef = db.collection("team_live_channels").doc(teamName);
  // Set refresh time stamp
  data.refresh_at = Date.now();
  // Set the team live channels info
  await docRef.set(data);
  console.info("Set team live channel info for", teamName);
}
