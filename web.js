var monty = require('./app');

monty.app.listen(app.get('port'), function() {
  console.log('Dashboard is running at localhost:' + app.get('port'));
});

monty.queue.processNextPullRequest().then(monty.queue.processNextPullRequest.bind(monty.queue));
