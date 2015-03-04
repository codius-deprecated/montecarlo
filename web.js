var monty = require('./app');

monty.app.listen(monty.app.get('port'), function() {
  console.log('Dashboard is running at localhost:' + monty.app.get('port'));
});

function proc() {
  return monty.queue.processNextPullRequest().then(proc);
}

proc().catch(function(err) {
  console.exception("Error while processing review queue:", err);
  proc();
});
