var http = require('http');
var cv = require('opencv');
var querystring = require('querystring');
var fs = require('fs');


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
    hostname: '40.76.51.174',
    port: 80,
    path: '/check_flag',
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

function TakePicture(imName, callback) {
  try {
    var camera = new cv.VideoCapture(0);
    camera.setWidth(1280);
    camera.setHeight(720);
    camera.read(function(err, im) {
      if (err) throw err;
      console.log(im.size());
      im.save(imName);
      callback();

    });
  } catch (e){
    console.log("Couldn't start camera:", e)
  }
}

function GetDistanceBetween(p1, p2) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function PointToString(p1) {
  return "(" + p1.x + "," + p1.y + ")";
}

function AproxEqual(x, y) {
  if(Math.abs(x-y) < Math.max(Math.abs(x),Math.abs(y)) / 10) // 10% threshold
    return true;
  return false;
}

function ProcessImage(im /* RGB image */, callback) {
  var imWidth = im.size()[1];
  var imHeight = im.size()[0];

  im_gray = im.copy();
  im_gray.convertGrayscale();
  im_gray.save('capture_bw.jpg');


  var lowThresh = 0;
  var highThresh = 100;
  var nIters = 2; 
  im_canny = im_gray.copy();
  im_canny.canny(lowThresh, highThresh);
  im_canny.dilate(nIters);

  var contours = im_canny.findContours();

  var squares = [];
  // Access vertex data of contours
  for(var c = 0; c < contours.size(); ++c) {
    //console.log("Contour " + c + " having area=" + contours.area(c));
    contours.approxPolyDP(c, 5, true);
    if(contours.cornerCount(c) != 4) {
      //console.log('Skip contour ' + c + " has " + contours.cornerCount(c) + " corners");
      /*for(var i = 0; i < contours.cornerCount(c); ++i) {
        var p = contours.point(c, i);
        console.log("P" + i + "(" + p.x + "," + p.y + ")");
      } */
    
      continue;
    }
    if(contours.area(c) < (imWidth * imHeight) * 0.01) {
      //console.log("Skipping countour " + c + ", area too small = " + contours.area(c));
      continue; 
    }
    var points = [];
    for(var i = 0; i < contours.cornerCount(c); ++i) {
      points.push(contours.point(c, i));
      var p = contours.point(c, i);
      console.log("P" + i + "(" + p.x + "," + p.y + ")");
    }
    var isSquare = true;
    for(i in points) {
      var p1 = points[i];
      var distances = [];
      for(j in points) {
        if(i == j)
          continue;
        var p2 = points[j];
        console.log("Dist between " + PointToString(p1) + " and " + PointToString(p2) + " = " + GetDistanceBetween(p1,p2));
        distances.push(GetDistanceBetween(p1,p2));
      }
      distances.sort();
      console.log("point index " + i + " d=" + distances);
      if(!AproxEqual(distances[0], distances[1])) {
        console.log("Set isSquare=false i=" + i);
        isSquare = false;
        break; 
      }
      if(!AproxEqual(Math.pow(distances[0],2) + Math.pow(distances[1],2), Math.pow(distances[2],2))) {
        console.log("Set isSquare=false i=" + i + " step 2");
        isSquare = false;
        break;
      }
    }
    if(!isSquare) {
      continue;
    }
    
    console.log("!!!! SQUARE FOUND   !!!");
    squares.push(points);
  } 
  if(squares.length > 0) {
    callback(true, true /*todo, fix full/empty*/);   
  } else {
    callback(false, false);
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

//ChangeState(DroneState.IDLE);

var imName = "im_" + new Date().getTime();
var imFullName = imName + ".jpg";
TakePicture(imFullName, function() {
  cv.readImage(imFullName, function(err, im){
    ProcessImage(im, function(rectFound, isRectFull) {
      console.log("RectFound=" + rectFound + " IsFull=" + isRectFull);
      if(rectFound) {
        if(isRectFull) {
          fs.rename(imFullName, imName + "_full.jpg");
        } else {
          fs.rename(imFullName, imName + "_empty.jpg");
        }
      } else {
        fs.rename(imFullName, imName + "_notfound.jpg");
      }
    });
  });
});

//cv.readImage(imName, function(err, im){
//  ProcessImage(im);
//});

//console.log(cv.Matrix);

//TakePicture('capture_full_rotated_2.jpg');

console.log("Script end");
