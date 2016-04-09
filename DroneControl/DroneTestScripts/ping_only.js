var RollingSpider = require("rolling-spider");

var rollingSpider = new RollingSpider();

console.log('Connecting');

rollingSpider.connect(function() {
  console.log('Connected');
  rollingSpider.setup(function() {
    console.log('Start ping');
    rollingSpider.startPing();
  });
});
