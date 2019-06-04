import { getTeamInfo, getChannelsTeam } from "./services/TwitchAPI";

export const queryTeamInfo = async (db, teamName) => {
  // Get info for team for response
  const docTeamRef = db.collection("team").doc(teamName);

  let doc = await docTeamRef.get();
  console.info("queryTeamInfo", teamName, "info");
  return doc.data();
}

export const setChannelInfo = async (db, channelId, channelData) => {
  // Get document for channel_id from collection
  const docRef = db.collection("channel").doc(channelId);
  // Set the team name for a channel
  await docRef.set(channelData, { merge: true });
}

export const updateChannelInfo = async (db, channelId, channelData) => {
  // Get document for channel_id from collection
  const docRef = db.collection("channel").doc(channelId);
  // Set the team name for a channel
  await docRef.update(channelData);
}

export const queryAllChannelsSnapshot = async (db) => {
  let channelsRef = db.collection('channel');
  return await channelsRef.get()
}

export const queryChannelInfo = async (db, channel_id) => {
  // Get document for channel_id from collection
  const docRef = db.collection("channel").doc(channel_id);

  // Read the document.
  let doc = await docRef.get();
  console.info("queryChannelInfo", channel_id, "info requested");

  return doc.data();
}

export const queryCustomTeamInfo = async (db, channel_id) => {
  // Get info for team for response
  const docTeamRef = db.collection("custom_team").doc(channel_id);

  let doc = await docTeamRef.get();
  console.info("queryCustomTeamInfo", channel_id, "info");
  return doc.data();
}

export const setCustomTeam = async (db, channel_id, data) => {
  console.info('setCustomTeam ', channel_id);

  // Get document for team from collection
  const docRef = db.collection("custom_team").doc(channel_id);

  // Set the team live channels info
  await docRef.set(data);
}
