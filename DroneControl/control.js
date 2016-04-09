var http = require('http');
var cv = require('opencv');
var querystring = require('querystring');
var fs = require('fs');
var RollingSpider = require("rolling-spider");

var DroneState = {
  NOT_SET: 0,
  IDLE:1,
  TAKE_OFF_IN_PROGRESS: 2,
  PATROLLING: 3,
  OBSERVING: 4,
  LANDING: 10,
  properties: {
   0 : { name: 'NOT_SET'},
   1 : { name: 'IDLE'},
   2 : { name: 'TAKE_OFF_IN_PROGRESS'},
   3 : { name: 'PATROLLING'},
   4 : { name: 'OBSERVING'},
   10: { name: 'LANDING'},
  }
}
function GetDroneStateName(droneState) {
  return DroneState.properties[droneState].name;
}

// Globals:
var droneState = DroneState.NOT_SET;
var imageToBeSent = '';
var startTimestamp = new Date();
var serverIp = "40.76.51.174";
var camera = new cv.VideoCapture(0);
camera.setWidth(1280);
camera.setHeight(720);

var sessionName = "Session_" + TimeStampToString(startTimestamp);

if (!fs.existsSync(sessionName)){
    fs.mkdirSync(sessionName);
}

var drone = new RollingSpider();
var droneConnected = false;

                             
console.log("Starting session \'" + sessionName + "\'")   

console.log("Connecting to drone...");
drone.connect(function() {
  console.log("Drone connected!");
  drone.setup(function() {
    console.log("Drone configured");
    drone.startPing();
    drone.flatTrim();
    drone.startPing();
    drone.flatTrim();
    droneConnected = true;
  });
});

function IsServerNotifyNeeded() {
 return droneState != DroneState.IDLE;
}

function IsHttpResonseSuccess(httpCode) {
  return (httpCode >= 200 && httpCode <= 299);
}

function TimeStampToString(timestamp) {
  return timestamp.getFullYear()
         + ("0" + (timestamp.getMonth() + 1)).slice(-2)
         + ("0" + timestamp.getDate()).slice(-2)
         + "_"
         + ("0" + timestamp.getHours()).slice(-2)
         + ("0" + timestamp.getMinutes()).slice(-2)
         + ("0" + timestamp.getMinutes()).slice(-2);
}


function CheckPatrolTrigger(callback) {
  //console.log("CheckPatrolTrigger"); 
  var options = {
    hostname: serverIp,
    port: 80,
    path: '/check_flag',
    method: 'GET'
  };
  var req = http.request(options, (res) => {
    //console.log(`CheckPatrolTrigger: HTTP ${res.statusCode}`);
    //Server resonds with 200 if trigger is set
    //               with 204 if triffer is not set
    if(res.statusCode == 200){
      //callback(false);
      //Temp commented:
      callback(true);
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
  //console.log('Patrol trigger is: ' + trigger);
  //console.log('Drone state: ' + GetDroneStateName(droneState));
  if(droneState == DroneState.IDLE) {
    if(trigger) {
      console.log("Patrol trigger set!");
      ChangeState(DroneState.TAKE_OFF_IN_PROGRESS)
    } else {
      //Check again later
      //console.log('Scheduling to control trigger later');
      setTimeout(function() {
        CheckPatrolTrigger(CheckPatrolTriggerResponseHandler)
      }, 5000);
    }
  }
}

// function to encode file data to base64 encoded string
function base64_encode(file) {
    // read binary data
    var bitmap = fs.readFileSync(file);
    // convert binary data to base64 encoded string
    return new Buffer(bitmap).toString('base64');
}

function SendStatusToServer() {
  console.log("SendStatusToServer imageToBeSent=<" + imageToBeSent + ">");
  var postData = {'status': GetDroneStateName(droneState), 'progress': '25%'};

  if(imageToBeSent){
    console.log("Adding image to status:" + imageToBeSent);
    postData['file'] = base64_encode(imageToBeSent);
    imageToBeSent = '';
  }
  var postDataStr = JSON.stringify(postData);
  //console.log(postDataStr);
  var options = {
    hostname: serverIp,
    port: 80,
    path: '/status',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postDataStr.length
    }
  };
  
  //console.log('Using options:' + options);
  var req = http.request(options, (res) => {
    console.log(`SendStatusToServer rsp STATUS: ${res.statusCode}`);
    //console.log(`SendStatusToServer rsp HEADERS: ${JSON.stringify(res.headers)}`);

    if(IsHttpResonseSuccess(res.statusCode)) {
      // Server responded with success
      if(IsServerNotifyNeeded()) {
        setTimeout(SendStatusToServer, 2000);
      }
    } else {
      console.log(`SendStatusToServer failed: ${res.statusCode}`);
    }

    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      //console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
      //console.log('No more data in response.')
    })
  });
  req.on('error', (e) => {
    console.log(`Failed to send status to server: ${e.message}`);
  }); 
  // write data to request body
  req.write(postDataStr);
  req.end()
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
  //isFull(null, im_gray);
  //return;

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
    contours.approxPolyDP(c, 15, true);
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
      /*if(!AproxEqual(distances[0], distances[1])) {
        console.log("Set isSquare=false i=" + i);
        isSquare = false;
        break; 
      }*/
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
    squares.push({
      points: points,
      area: contours.area(c)
    });
  } 
  if(squares.length > 0) {
    var maxArea = 0;
    var square;
    for(i in squares){
      sq = squares[i];
      if(sq.area > maxArea){
        maxArea = sq.area;
        square = sq;
      }
    }

    callback(true, isFull(square, im_gray));   
  } else {
    callback(false, false);
  }
}

function isFull(sq, im){
  var centerX = 0;
  var centerY = 0;

  for(i in sq.points){
    p = sq.points[i];
    centerX += p.x;
    centerY += p.y;
  }
  centerX /= 4;
  centerY /= 4;
  centerX = parseInt(centerX);
  centerY = parseInt(centerY);
  
  var color = 0;
  var range = 5;
  for(var x = centerX - range; x < centerX + range; x++)
    for(var y = centerY - range; y < centerY + range; y++) {
      color += im.pixel(y,x);
      //console.log("[" + y+ "][" + x +"]=" + im.pixel(y,x));
    }
  color /= (range * range * 4);
  //console.log("isFull cx=" + centerX + " cy=" + centerY + " avgColor=" + color);
  return color < 100;
}

function StartPatrolling() {
  PatrollingPeriodicAction();
}

function PatrollingPeriodicAction() {
  //var camera = new cv.VideoCapture(0);
  //camera.setWidth(1280);
  //camera.setHeight(720);
  camera.read(function(err, im) {
  if (err) throw err;
    console.log("Patrolling image captured, size=" + im.size());
    var imName = "im_" + new Date().getTime();
    //im.save(imName);
    // callback();
    ProcessImage(im, function(rectFound, isRectFull) {
     console.log("Patrolling image process result: RectFound=" + rectFound + " IsFull=" + isRectFull);
     if(rectFound) {
       if(isRectFull) {
         //ifs.rename(imFullName, imName + "_full.jpg");
         im.save(sessionName + "/" + imName + '_forest.jpg');
       } else {
         imName = sessionName + "/" + imName + "_noforest.jpg";
         imageToBeSent = imName;
         im.save(imName);
         ChangeState(DroneState.OBSERVING);
       }
     } else {
       console.log("Nothing found");    
       //fs.rename(imFullName, imName + "_notfound.jpg");
     }
     if(droneState == DroneState.PATROLLING) {
       setTimeout(PatrollingPeriodicAction, 2000);
     }
    });
  });
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
    case DroneState.TAKE_OFF_IN_PROGRESS:
      SendStatusToServer();
      //Temp:
      ChangeState(DroneState.PATROLLING);
      break;
    case DroneState.PATROLLING:
      //TODO: Start drone forward
      StartPatrolling();
      break;
    case DroneState.OBSERVING:
      //TODO: Stop drone
      //TODO: Send picture
      break;
  }
};

ChangeState(DroneState.IDLE);

/*
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
          imageToBeSent = imName + "_empty.jpg";
        }
      } else {
        fs.rename(imFullName, imName + "_notfound.jpg");
      }
    });
  });
});
*/
//cv.readImage(imName, function(err, im){
//  ProcessImage(im);
//});

//console.log(cv.Matrix);

//TakePicture('capture_full_rotated_2.jpg');
//SendStatusToServer();


//Test image post:
//imageToBeSent = 'im_1460205369783.jpg' 
//SendStatusToServer();

