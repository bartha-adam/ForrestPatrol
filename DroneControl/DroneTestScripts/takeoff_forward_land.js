'use strict';

var RollingSpider = require('rolling-spider');
var temporal = require('temporal');
var rollingSpider = new RollingSpider();

console.log('Connecting...');

rollingSpider.connect(function () {
  console.log('Connected');
  rollingSpider.setup(function () {
    console.log('Setup complete');
    rollingSpider.flatTrim();
    rollingSpider.startPing();
    rollingSpider.flatTrim();

    temporal.queue([
      {
        delay: 5000,
        task: function () {
          console.log('Takeoff');
          rollingSpider.takeOff();
          rollingSpider.flatTrim();
        }
      },
      {
        delay: 8000,
        task: function () {
          console.log('Forward');
          rollingSpider.forward({speed: 10, steps: 60});
        }
      },
      {
        delay: 5000,
        task: function () {
          console.log('Land');
          rollingSpider.land();
        }
      },
      {
        delay: 5000,
        task: function () {
          console.log('Cleanup');
          temporal.clear();
          process.exit(0);
        }
      }
    ]);
  });
});
