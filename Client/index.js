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
	    $.ajax({ url: "http://40.76.51.174/get_status", 
	    	success: function(data){
		        //Update your dashboard gauge
		        console.log(data);
		        $("#progressbar").attr('style', 'width:'+data+'%');
		        $("#progressbar").attr('aria-valuenow', data);
		    }, 
		    dataType : "json"});
	}, 2000);
}

// function sendMSG(){
// 	exampleSocket.send("Test");
// }