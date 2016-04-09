var http = require('http');
var querystring = require('querystring');

var DroneState = {
  NOT_SET: 0,
  IDLE:1,
  TAKE_OFF_IN_PROGRESS: 2,
  LANDING: 10,
  properties: {
   0 : { name: 'NOT_SET' },
   1 : { name: 'IDLE' },
   2 : { name: 'TAKE_OFF_IN_PROGRESS'},
   10: { name: 'LANDING'},
  }
}

var droneState = DroneState.NOT_SET;

function GetDroneStateName(droneState) {
  return DroneState.properties[droneState].name;
}

function CheckPatrolTrigger(callback) {
  console.log("CheckPatrolTrigger"); 
  var options = {
    hostname: 'www.google.ro',
    port: 80,
    path: '',
    method: 'GET'
  };
  var req = http.request(options, (res) => {
    console.log(`CheckPatrolTrigger: HTTP ${res.statusCode}`);
    //Server resonds with 200 if trigger is set
    //               with 204 if triffer is not set
    if(res.statusCode == 200){
      callback(false);
      //Temp commented:
      //callback(true);
    } else {
      callback(false);
    }
  });
  req.on('error', (e) => {
    console.log(`Failed to get patrol trigger: ${e.message}`);
  });
  req.end();
}

function CheckPatrolTriggerResponseHandler(trigger) {
  console.log('Patrol trigger is: ' + trigger);
  console.log('Drone state: ' + GetDroneStateName(droneState));
  if(droneState == DroneState.IDLE) {
    if(trigger) {
      //TODO start takeoff
    } else {
      //Check again later
      console.log('Scheduling to control trigger later');
      setTimeout(function() {
        CheckPatrolTrigger(CheckPatrolTriggerResponseHandler)
      }, 5000);
    }
  }
}

function ChangeState(newDroneState) {
  if(newDroneState == droneState) {
    console.log('Skip drone state change, already in state' + DroneState.properties[newState].name);
    return;
  }
  console.log('Changing drone state from ' + GetDroneStateName(droneState) + " to " + GetDroneStateName(newDroneState));
  droneState = newDroneState;
  switch(newDroneState) {
    case DroneState.IDLE:
      //Start checking patrol control trigger
      CheckPatrolTrigger(CheckPatrolTriggerResponseHandler);
      break; 
  }

};

ChangeState(DroneState.IDLE);

console.log("Script end");
