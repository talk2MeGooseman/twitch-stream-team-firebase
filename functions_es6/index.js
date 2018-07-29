const functions = require("firebase-functions");
const admin = require('firebase-admin');
import { publishChannelMessage, getChannelsTeam, getTeamInfo } from "./src/services/TwitchAPI";
import {
  verifyToken,
  decodeToken
} from "./src/services/TokenUtil";
import { shouldRefresh } from "./src/Helpers";
require('dotenv').config()

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
  cors(req, res, () => {
    let decoded_token;
    // Get JWT token from header
    const token = req.get("x-extension-jwt");

    try {
      // Only decode token, no need to verify if its from broadcaster
      decoded_token = decodeToken(token, SECRET);
      // decoded_token.channel_id = "7676884";
      // decoded_token.channel_id = "146431491";
    } catch (err) {
      console.error("JWT was invalid", err);
      res.status(401).json({});
      return;
    }

    // Get document for channel_id from collection
    const docRef = db.collection("channel").doc(decoded_token.channel_id);

    // Read the document.
    docRef
      .get()
      .then(doc => {
        console.info("Channel ", decoded_token.channel_id, "info requested");

        let channelInfo = doc.data();

        // If there in information for the channel then fetch its team info
        if (channelInfo) {
          console.info('Channel', decoded_token.channel_id, 'info found');
          const docTeamRef = db.collection("team").doc(channelInfo.selected_team);
          docTeamRef
            .get()
            .then((teamInfo) => {
              console.log('Fetched', channelInfo.selected_team, 'info');
              let data = teamInfo.data();

              res.json({
                teams: channelInfo.teams,
                selectedTeam: data
              });

              // Check if we need to refresh the team info
              if ( shouldRefresh(data.refresh_at) ) {
                console.info('Need to refresh team', channelInfo.selected_team);
                getTeamInfo(channelInfo.selected_team).then((teamInfoResponse) => {
                  // Get document for team from collection
                  const docTeamRef = db.collection("team").doc(channelInfo.selected_team);

                  teamInfoResponse.refreshed_at = Date.now();

                  // Save the team information in to a team document
                  console.info('Setting refresh team', channelInfo.selected_team, 'information')
                  docTeamRef
                    .set(teamInfoResponse)
                    .then(() => {
                      console.info("Set Team Info", channelInfo.selected_team);
                    });
                });
              }
            });
        } else {
          console.info('Find channels', decoded_token.channel_id, 'team info');
          // Request Channels Team
          getChannelsTeam(decoded_token.channel_id).then((channelResponse) => {
            // Check if user has a team
            if (channelResponse.teams.length === 0)
            {
              return res.status(404).end();
            }

            let selectedTeam = channelResponse.teams[0];
            // get the name on all the channels and make a new array
            let teams = channelResponse.teams.map((selectedTeam) => {
              return selectedTeam.name;
            });

            // Set the team name for a channel
            const setAda = docRef
              .set({
                selected_team: selectedTeam.name,
                teams,
                refresh_at: Date.now(),
              })
              .then(() => {
                console.info("Set Channel", decoded_token.user_id, "team name info");
                teams.forEach(teamName => {
                  // Request the team info
                  getTeamInfo(teamName).then((teamInfoResponse) => {
                    // Get document for team from collection
                    const docTeamRef = db.collection("team").doc(teamInfoResponse.name);

                    teamInfoResponse.refreshed_at = Date.now();

                    // Save the team information in to a team document
                    docTeamRef
                      .set(teamInfoResponse)
                      .then(() => {
                        console.info("Set Team Info", teamInfoResponse.name);
                        if (teamInfoResponse.name === selectedTeam.name)
                        {
                          res.json({
                            teams,
                            selectedTeam: teamInfoResponse
                          });
                        }
                      });
                  });
                });
              })
              .catch(error => {
                console.error(
                  error
                );
                return res.status(400).end();
              });

          });
        }

        // Respond back with data stored in document for Channel ID
        // return res.json(doc.data());
      })
      .catch(error => {
        console.error(error);
        return res.status(400);
      });

      return;
  });
});


// POST STYLE REQUEST FLOW
exports.set_panel_information = functions.https.onRequest((req, res) => {
  // Need to use CORS for Twitch
  cors(req, res, () => {
    let decoded_token;
    // Get payload from request body
    const { selected_team } = req.body;

    // Get JWT from header
    const token = req.get("x-extension-jwt");

    // Verify if token is valid, belongs to broadcaster and decode
    try {
      decoded_token = verifyToken(token, SECRET);
      decoded_token.channel_id = "7676884";
    } catch (err) {
      console.error("JWT was invalid", err);
      res.status(401).json({});
      return;
    }

    console.info('Channel', decoded_token.channel_id, 'changing team to', selected_team);
    // Get document for channel_id from collection
    const docRef = db.collection("channel").doc(decoded_token.channel_id);

    // Read the document.
    docRef
      .get()
      .then(doc => {
        let channelInfo = doc.data();

        // Check if selected team is a team that they are a part of
        if (channelInfo.teams.includes(selected_team)) {
          // Updated selected team for user
          docRef
            .update({
              selected_team: selected_team,
            })
            .then(() => {
              // Get info for team for response
              const docTeamRef = db.collection("team").doc(selected_team);
              docTeamRef
                .get()
                .then((teamDoc) => {
                  let teamInfo = teamDoc.data();

                  res.json({
                    teams: channelInfo.teams,
                    selectedTeam: teamInfo,
                  });
                });
            }).catch((error) => {
              console.error('Error ocurred setting', decoded_token.channel_id, 'selected team', error);
              res.status(400).end();
            })

        } else {
          console.error('Could not find channel', decoded_token.channel_id, 'selected team');
          res.status(404).end();
        }
      });

    return;
  });
});