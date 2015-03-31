var winston = require('./lib/winston');
var monty = require('./app');

monty.app.listen(monty.app.get('port'), function() {
  winston.info('Dashboard is running at localhost:' + monty.app.get('port'));
});

function proc() {
  return monty.queue.processNextPullRequest().then(proc);
}

proc().catch(function(err) {
  winston.error("Error while processing review queue:");
  winston.error(err);
  proc();
});
