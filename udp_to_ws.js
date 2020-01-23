// this is a mavlink UDP listener for ArduPlane style vehicles which then uses a websockets enabled web server 
// to deliver a web-based GCS that is a slightly-hacked-on version of MAVControl. 
// incoming UDP mavlink/vehicl/sim data at 0.0.0.0:14550 is sent to the browser as raw mavlink for CLIENT to decode, and the MAVControl instance for
// display of the HUD and MAP etc. 
// uses express 4 + socket.io and as few other dependancies as possible. 
//  delivers most static content from /static and socketio stuff from /socket.io and /node_index.html is the main page.

//-------------------------------------------------------------
//
// libraries
//
//-------------------------------------------------------------

// web server stuff:
var app = require('express')();
var webserver = require('http').Server(app);
var io = require('socket.io')(webserver);
var express = require('express'); // we use 'app' mostly, but need this too.

// no mavlink related stuff needed in node, this is done in browser, here we use websocket only.


require('events').EventEmitter.defaultMaxListeners = 0;

// leave this zero unless u plan on running more than one of this script at a time, it adds onto the UDP listening port AND the webserver port.
offset = 0;

// Logger
var logger = null;//console; //winston.createLogger({transports:[new(winston.transports.File)({ filename:'mavlink.dev.log'})]});


webserver.listen(3000+offset, function(){
  console.log("Express webserver listening on port 3000.  goto: http://127.0.0.1:3000");
});

// webserver anything under /static from /static
app.use('/static', express.static('static'))

//this is a good thing, generally.
app.get('/favicon.ico', function (req, res) {
    res.sendFile(__dirname + '/static/favicon.ico',{headers: {'Content-Type': 'image/vnd.microsoft.icon'}});
});
// this is the most important thing. note we're using the non-template (true html) version of the index.html file as we don't
// implement the same templating library that the python implementation uses, 
// but template/index.html and node_index.html are very similar otherwise.
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/node_index.html');

});

io.on('connection', function (websocket) {
  console.log("Express webserver-SOCKET connection!");
  //console.log("websocket connection");
  websocket.emit('news', { hello: 'world' });
  websocket.on('my other event', function (data) {
    console.log(data);
  });
});

// MAVControl puts most of its WebSockets into a NameSpace, so we honour that and replicate it:
IONameSpace = '/MAVControl';

// socket.io namespace
const nsp = io.of(IONameSpace);


// setup UDP listener
const dgram = require('dgram');
const udpserver = dgram.createSocket('udp4');


// udp writer function works same on both mavlink1 and 2
var udpwriter = function(msg) {
    //console.log(typeof msg);    
    //console.log(msg);

    const b = Buffer.from(msg);// convert from array object to Buffer so we can send it.

    // at startup, till we've had at least one INCOMING packet, we can't send.
    if (udpserver.last_ip_address == null ) { 
        console.log('mavlink write not possible yet,dropped packet.');
        return;
     } 

    console.log(`... sending msg to: ${udpserver.last_ip_address.address}:${udpserver.last_ip_address.port} `);
    //udpserver.last_ip_address.address
    //udpserver.last_ip_address.port

    // send to the last place we had *any* comms from, not perfect, but works for one sysid case 
    udpserver.send( b, udpserver.last_ip_address.port, udpserver.last_ip_address.address ); 

}


//-------------------------------------------------------------
//
//
//
//-------------------------------------------------------------


// hook udp reciever/listener events to actions:
udpserver.on('error', (err) => {
  console.log(`server error:\n${err.stack}`);
  webserver.close();
});

// any incoming UDP mesage (presumably mavlink udp messages) on UDP port is handled here...
udpserver.on('message', (msg, rinfo) => {
    //console.log(udpserver.last_ip_address);
    //console.log(rinfo);

    // first time thru:
    if (udpserver.last_ip_address == null ) { udpserver.last_ip_address = rinfo; udpserver.last_ip_address.port = 0;  udpserver.last_mavlink_type = 0;} 

    // is this a repeat packet from same src and port , if so don't display msg again
    if (( rinfo.address != udpserver.last_ip_address.address ) || ( rinfo.port != udpserver.last_ip_address.port ))  { 
      //console.log(`server got: msg from ${rinfo.address}:${rinfo.port}`);
    }

    var array_of_chars = Uint8Array.from(msg) // from Buffer to byte array

    // hack to only pass mav1 for now...
     if (array_of_chars[0] == 253 ) { 
       // console.log('dropping mav2');
        return;
      } 

     if (array_of_chars[0] == 254 ) { 
       // console.log('sending mav1');
      } 

    // test code to only look at a specific type of packet.
    //if (array_of_chars[5] == 0x93){
        //console.log(msg);
        //console.log(`server got: msg from ${rinfo.address}:${rinfo.port}`);
    //}
 
    // record last ip address we saw, a
    udpserver.last_ip_address = rinfo;


    // we push the incoming mavlink to webocket, basically as-is, just converted to a byte-array first.
    //io.of(IONameSpace).emit('MAVLINK', array_of_chars); // send to client as a naked {} object

    // two options... either with or without the namespace, both wrapped in a length-3 array with ip and port.
    io.of(IONameSpace).emit('MAVLINK', [msg,rinfo.address,rinfo.port]); // send to client as an [ArrayBuffer , source ip, source port triple]
    //io.emit('MAVLINK', [msg,rinfo.address,rinfo.port]); // send to client as an [ArrayBuffer , source ip, source port triple]



    
});


// lookup table we populate later - when we support multiple incoming udp streams (one per sysid)
sysid_to_ip_address = {};


udpserver.bind(14550+offset);



//-------------------------------------------------------------
//
// small utility functions
//
//-------------------------------------------------------------


function getTime() {
    var date = new Date();
    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;
    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;
    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;
    return hour + ":" + min + ":" + sec;
}

// js objects are already double precision, so no need to change a float into anything else, but this is helpful as a label.
function float(thing) { 
    return thing;
}


//-------------------------------------------------------------
//
// websocket messages from the browser-GCS to us via a namespace:
//
//-------------------------------------------------------------

nsp.on('connection', function(websocket) {
//io.on('connection', function(websocket) {

    io.of(IONameSpace).emit('news', { hello: 'Welcome2'});
    //io.emit('news', { hello: 'Welcome2'});
    console.log("Client Re/Connect:"+IONameSpace);

    websocket.on('my_ping', function(msg){
         io.of(IONameSpace).emit('my_pong'); // this is used by the client-side to measure how long the round-trip is 
         //io.emit('my_pong'); // this is used by the client-side to measure how long the round-trip is 
    });

    // periodically, at 1hz we send the webclient a msg to say we are still alive, kinda like a mavlink heartbeat packet, but not.
    setInterval(function() {  
         //console.log("WS heartbeat internal");
         io.of(IONameSpace).emit('heartbeat', getTime() );
         //io.emit('heartbeat', getTime() );
        
    }, 1000);


   websocket.on('do_change_mode',  function(sysid,mode) { 
                     
        console.log(`do_change_mode NOTHING sysid: ${sysid} to mode: ${mode}`);
    });


    // websocket messages from the browser-GCS to us: 

    websocket.on('MAVLINKOUT', function(message){

        const b = Buffer.from(message[0]);// convert from array object to Buffer so we can send it.
        var dst_ip = message[1];
        var dst_port = message[2];
        if ( dst_ip == null || dst_port == null | b == null) {
            console.log('error in mav packet or ip or port, cant send');
            console.log(b);
            console.log(dst_ip);
            console.log(dst_port);
            return;
         }
        udpserver.send( b, dst_port, dst_ip ); 

        console.log("MAVLINKOUT:");
        console.log(message);

        //buffer = new Buffer(message.pack(mavlinkParser));
        //connection.write(buffer);

      });

  
});



