var monty = require('./app');

monty.app.listen(monty.app.get('port'), function() {
  console.log('Dashboard is running at localhost:' + monty.app.get('port'));
});

monty.queue.processNextPullRequest().then(monty.queue.processNextPullRequest.bind(monty.queue));
