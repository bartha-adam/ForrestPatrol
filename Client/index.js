// var exampleSocket = {};

// window.onload = function(){
// 	exampleSocket = new WebSocket("ws://40.76.51.174:8888/");
// 	exampleSocket.onmessage = function (event) {
// 	  console.log(event);
// 	}
// }

function startMonitoring(){
	$("#progressbarContainer").removeClass("hidden");
}

function startDrone(){

	startMonitoring();



	setInterval(function(){
	  //   $.ajax({ url: "http://40.76.51.174/get_status", 
	  //   	success: function(data){
		 //        //Update your dashboard gauge
		 //        console.log(data);
		 //        $("#progressbar").attr('style', 'width:'+data+'%');
		 //        $("#progressbar").attr('aria-valuenow', data);
		 //    },
		 //    xhrFields: {
			//     // The 'xhrFields' property sets additional fields on the XMLHttpRequest.
			//     // This can be used to set the 'withCredentials' property.
			//     // Set the value to 'true' if you'd like to pass cookies to the server.
			//     // If this is enabled, your server must respond with the header
			//     // 'Access-Control-Allow-Credentials: true'.
			//     withCredentials: false
			// },
		 //    beforeSend: function(xhr){xhr.setRequestHeader('Access-Control-Allow-Origin', '*');},
		 //    dataType : "json"});
		 makeCorsRequest('GET', "http://40.76.51.174/get_status");
	}, 2000);
}

// Create the XHR object.
function createCORSRequest(method, url) {
  var xhr = new XMLHttpRequest();
  if ("withCredentials" in xhr) {
    // XHR for Chrome/Firefox/Opera/Safari.
    xhr.open(method, url, true);
  } else if (typeof XDomainRequest != "undefined") {
    // XDomainRequest for IE.
    xhr = new XDomainRequest();
    xhr.open(method, url);
  } else {
    // CORS not supported.
    xhr = null;
  }
  return xhr;
}

// Make the actual CORS request.
function makeCorsRequest(method, url) {

  var xhr = createCORSRequest(method, url);
  xhr.setRequestHeader(
    'Access-Control-Allow-Origin', '*');
  if (!xhr) {
    alert('CORS not supported');
    return;
  }

  // Response handlers.
  xhr.onload = function() {
    var text = xhr.responseText;
    var title = getTitle(text);
    console.log(xhr);
    console.log(text);
    // alert('Response from CORS request to ' + url + ': ' + title);
  };

  xhr.onerror = function(err) {
  	console.log(err);
    // alert('Woops, there was an error making the request.');
  };

  xhr.send();
}

// function sendMSG(){
// 	exampleSocket.send("Test");
// }