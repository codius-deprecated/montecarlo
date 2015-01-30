var Slack = require('slack-client');
var dotenv = require('dotenv');
var do_snack_request = require('lib/slack').do_snack_request;

dotenv.load();

var token = process.env.SLACK_TOKEN,
    autoReconnect = true,
    autoMark = true;

var slack = new Slack(token, autoReconnect, autoMark);

slack.on('open', function() {
  var channel = slack.getChannelByName('montecarlo-dev');
  channel.send("I've been rebooted!");
});

slack.on('message', function(message) {
  var type = message.type,
      channel = slack.getChannelGroupOrDMByID(message.channel),
      user = slack.getUserByID(message.user),
      time = message.ts,
      text = message.text,
      response = '';

  //console.log('Received: %s %s @%s %s "%s"', type, (channel.is_channel ? '#' : '') + channel.name, user.name, time, text);

  if (type == 'message' && channel.name == 'snack-requests') {
    do_snack_request(channel);
  }
});

slack.on('error', function(error) {
  console.error("Error: %s", error);
});

slack.login();
