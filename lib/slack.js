function do_snack_request(channel) {
  if (Math.random() * 100 < 2) {
    channel.send("I'll sleep on it.");
  } else {
    channel.send('Denied.');
  }
}

module.exports = {
  do_snack_request: do_snack_request
};
