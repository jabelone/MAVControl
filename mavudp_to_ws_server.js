// this is a mavlink UDP listener for ArduPlane style vehicles which then uses a websockets enabled web server 
// to deliver a web-based GCS that is a slightly-hacked-on version of MAVControl. 
// incoming UDP mavlink/vehicl/sim data at 0.0.0.0:14550 is parsed to generate messages that are passed off to the MAVControl instance for
// display of the HUD and MAP etc. 
// uses express 4 + socket.io and 'backbone.js' as a server-side Model for the Vehicle state and a group of Vehicles, and as few other dependancies as possible. 
//  delivers most static content from public/static and socketio stuff from /socket.io and public/index.html is the main page.

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

// mavlink related stuff:
var mavlink = require("./mav_v1.js");  // this is the autogeneraterd js mavlink library  
var MavParams = require("./assets/mavParam.js");   // these are server-side js libraries for handling some more complicated bits of mavlink
var MavFlightMode = require("./assets/mavFlightMode.js");
var MavMission = require('./assets/mavMission.js');

// config and backend libraries:
var nconf = require("nconf");
var Backbone = require("backbone");


//-------------------------------------------------------------
//
// Globals Variables, State Variables, Initialization.
//
//-------------------------------------------------------------


require('events').EventEmitter.defaultMaxListeners = 0;

// leave this zero unless u plan on running more than one of this script at a time, it adds onto the UDP listening port AND the webserver port.
offset = 0;

// Logger
var logger = null;//console; //winston.createLogger({transports:[new(winston.transports.File)({ filename:'mavlink.dev.log'})]});


webserver.listen(3000+offset, function(){
  console.log("Express webserver listening on port 3000.  goto: http://127.0.0.1:3000");
});

// webserver anything under /static from /public/static
app.use('/static', express.static('public/static'))

//this is a good thing, generally.
app.get('/favicon.ico', function (req, res) {
    res.sendFile(__dirname + '/public/static/favicon.ico',{headers: {'Content-Type': 'image/vnd.microsoft.icon'}});
});
// this is the most important thing.
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/public/index.html');

});

io.on('connection', function (socket) {
  //console.log("socket connection");
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    console.log(data);
  });
});

// MAVControl puts most of its WebSockets into a NameSpace, so we honour that and replicate it:
IONameSpace = '/MAVControl';

// socket.io namespace
const nsp = io.of(IONameSpace);

// Establish parser
var mavlinkParser = new MAVLink(logger, 11,0);
// Allow the client to assign a connection handler to this object
mavlinkParser.setConnection = function(connection) {
    this.file = connection;
}

// setup UDP listener
const dgram = require('dgram');
const udpserver = dgram.createSocket('udp4');


// tell mavlink library where to write() to? 
mavlinkParser.file = new Object();
mavlinkParser.file.write  = function(msg) {
    //console.log('mavlink write not impl yet - todo');
    
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


// hook udp listener events to actions:
udpserver.on('error', (err) => {
  console.log(`server error:\n${err.stack}`);
  webserver.close();
});
udpserver.on('message', (msg, rinfo) => {
    //console.log(udpserver.last_ip_address);
    //console.log(rinfo);

    // first time thru:
    if (udpserver.last_ip_address == null ) { udpserver.last_ip_address = rinfo; udpserver.last_ip_address.port = 0; } 

    // is this a repeat packet from same src and port , if so don't display msg again
    if (( rinfo.address != udpserver.last_ip_address.address ) || ( rinfo.port != udpserver.last_ip_address.port ))  { 
      //console.log(`server got: msg from ${rinfo.address}:${rinfo.port}`);
    }
    // record last ip address we saw.
    udpserver.last_ip_address = rinfo

    var array_of_chars = Uint8Array.from(msg) // from Buffer to byte array

    //console.log(msg);    
    //console.log(array_of_chars);

    if (array_of_chars[0] == 253 ) { 
    console.log(`ERROR: seems like a MAVLINK2 packet, unsupported, need to do this in mavproxy: "param set serial0_protocol 1" .`);
    } 
    
    mavlinkParser.parseBuffer(array_of_chars);
});

// Attach an event handler for any valid MAVLink message
mavlinkParser.on('message', function(message) {

    // console.log all the uncommon message types we DONT list here. 
    if ( ! ['GPS_RAW_INT', 'VFR_HUD', 'ATTITUDE', 'SYS_STATUS', 'GLOBAL_POSITION_INT', 'HEARTBEAT','VIBRATION',
            'BATTERY_STATUS', 'TERRAIN_REPORT', 'WIND', 'HWSTATUS', 'AHRS', 'AHRS2', 'AHRS3',
            'SIMSTATE', 'RC_CHANNELS','RC_CHANNELS_RAW', 'SERVO_OUTPUT_RAW', 'LOCAL_POSITION_NED',
            'MEMINFO',  'POWER_STATUS', 'SCALED_PRESSURE', 'SCALED_IMU','SCALED_IMU2','SCALED_IMU3', 'RAW_IMU',
            'EKF_STATUS_REPORT', 'SYSTEM_TIME', 'MISSION_CURRENT' , 'SENSOR_OFFSETS', 
            'TIMESYNC', 'PARAM_VALUE', 'HOME_POSITION', 'POSITION_TARGET_GLOBAL_INT',
            'NAV_CONTROLLER_OUTPUT', 'STATUSTEXT' , 'COMMAND_ACK' , 
            'MISSION_ITEM', 'MISSION_ITEM_INT','MISSION_COUNT','MISSION_REQUEST', 'MISSION_ACK',
            'AIRSPEED_AUTOCAL', 'MISSION_ITEM_REACHED' , 'STAT_FLTTIME' ,'AUTOPILOT_VERSION' ,
             'FENCE_STATUS'   ].includes(message.name) ) { 
            
	console.log(message);
    } 
    // log PARAM_VALUE differently to exclude common ones like where param_id starts with 'STAT_RUNTIME' etc
    if (  ['PARAM_VALUE' ].includes(message.name) ) { 
        if (  message.param_id.startsWith('STAT_RUNTIME') || 
              message.param_id.startsWith('STAT_FLTTIME')  ||
              message.param_id.startsWith('COMPASS_')  ||
              message.param_id.startsWith('SR0_')  || 
              message.param_id.startsWith('GND_ABS_PRESS')  ){ 
            // pass
        } else { 
            console.log(`param fetch ${message.param_id} -> ${message.param_value} ` );
        }
    }

    // display STATUSTEXT as simple console.log
    if (  ['STATUSTEXT' ].includes(message.name) ) {
        console.log(`STATUSTEXT: ${message.text}`);
    } 

    if (  ['COMMAND_ACK' ].includes(message.name) ) {
        console.log(`COMMAND_ACK command= ${message.command} result= ${message.result} `);
    } 


    if (  ['MISSION_ITEM' ].includes(message.name) ) {
       // console.log(`MISSION_ITEM command= ${message.command} x= ${message.x} y= ${message.y} z= ${message.z} `);
    } 

    if (  ['MISSION_ITEM_INT' ].includes(message.name) ) {
        console.log(`MISSION_ITEM_INT seq= ${message.seq} command= ${message.command} x= ${message.x} y= ${message.y} z= ${message.z} `);
        //console.log(message);
    } 

    if (  ['MISSION_COUNT' ].includes(message.name) ) {
       // console.log(`MISSION_COUNT number of mission items:= ${message.count} `); moved to mavMission.js

    } 

    if (  ['MISSION_ACK' ].includes(message.name) ) {
        console.log(`MISSION_ACK recieved `);
    } 

    if (  ['MISSION_ITEM_REACHED' ].includes(message.name) ) {
        console.log(`MISSION_ITEM_REACHED recieved num:= ${message.seq} `);
    }

    if (  ['PARAM_VALUE' ].includes(message.name) &&  message.param_id.startsWith('STAT_FLTTIME')){
        mins = parseInt(message.param_value/60,10);
        secs = parseInt(message.param_value%60,10);
        console.log(`TIME IN AIR:  ${mins}min:${secs}secs `);
    }

});

// lookup table we populate later.
sysid_to_ip_address = {};


udpserver.bind(14550+offset);


// Attach an event handler for a specific MAVLink message
mavlinkParser.on('HEARTBEAT', function(message) {
    //udpserver.last_ip_address object looks like this: { address: '127.0.0.1', family: 'IPv4', port: 41721, size: 17 }
	//console.log(`Got a heartbeat message from ${udpserver.last_ip_address.address}:${udpserver.last_ip_address.port} `);
	//console.log(message); // message is a HEARTBEAT message


    if (  (sysid_to_ip_address[message.header.srcSystem] != null ) && ( sysid_to_ip_address[message.header.srcSystem].address == udpserver.last_ip_address.address) && 
        ( sysid_to_ip_address[message.header.srcSystem].port == udpserver.last_ip_address.port )  )  { 

    } else { 
      console.log(`Got first heartbeat message from ${udpserver.last_ip_address.address}:${udpserver.last_ip_address.port}, not repeating this. `);
    } 

    //    keep a record of the sysid <-> ip address and port info on-hand for when we want to *send*.
    sysid_to_ip_address[message.header.srcSystem] = udpserver.last_ip_address;

    //console.log(sysid_to_ip_address); 
});

var sysid = 12; // lets assume just one sysid for now.

// looks for flight-mode changes on this specific sysid only
var mavFlightModes = [];
mavFlightModes.push(new MavFlightMode(mavlink, mavlinkParser, null, logger,sysid));


// MavParams are for handling loading parameters
// Just hacking/playing code for now
var mavParams = new MavParams(mavlinkParser,logger);


//-------------------------------------------------------------
//
// This is the Backbone Model that stores and accumulates all the information that is specific to a singular Vehicle.
//  ( we have a group of these ) 
//
//-------------------------------------------------------------

// a singular aircraft
var VehicleClass = Backbone.Model.extend({

initialize: function(){
        console.log("Vehicle-Backbone is initialized");
    },

defaults: {
  
  //sysid: 0,    // mavlink THIS_MAV ID of this aircraft
  speed: undefined, // kph.  Who the hell sets this?? TODO =P
  // this can likely be removed since we are most likely interested in ground speed

  // Set by mavlink.global_position_int packets
  lat: undefined,
  lon: undefined,
  alt: undefined,
  relative_alt: undefined,
  vx: undefined,
  vy: undefined,
  vz: undefined,
  hdg: undefined,

  // Set by mavlink.gps_raw_int packets
  fix_type: undefined,
  satellites_visible: undefined,
  raw_lat: undefined,
  raw_lon: undefined,
  raw_alt: undefined,
  eph: undefined,
  epv: undefined,
  vel: undefined,
  cog: undefined,

  // set by mavlink.attitude packets
  pitch: undefined,
  roll: undefined,
  yaw: undefined,
  pitchspeed: undefined, // acceleration
  rollspeed: undefined, // acceleration
  yawspeed: undefined, // acceleration

  // Set by mavFlightMode interpreting mavlink.HEATBEAT etc
  stateMode: undefined,
  stateArmed: undefined,

  // Set by mavlink.SYS_STATUS packets
  voltage_battery: undefined,
  current_battery: undefined,
  battery_remaining: undefined,
  drop_rate_comm: undefined,
  errors_comm: undefined,

  // Set by mavlink.vfr_hud packets
  airspeed: undefined,
  groundspeed: undefined,
  heading: undefined,
  throttle: undefined,
  climb: undefined

},

validate: function(attrs) {
  attrs.lat /= 1e07;
  attrs.lon /= 1e07;
  attrs.alt /= 100;
}

});

//-------------------------------------------------------------
//
// this is the backbone state that has us create a "Collection" ( group ) of Vehicles, each with its own unique state,
//
//-------------------------------------------------------------

var AllVehiclesClass = Backbone.Collection.extend({
    model: VehicleClass
} );

//-------------------------------------------------------------
// we instantiate a group, and just for convenience also instantiate the first vehicle in it too with a fixed/default sysid.
// ( the vehicle isn't needed to be done as it's done dynamically elsewhere ) 
//-------------------------------------------------------------

AllVehicles = new AllVehiclesClass();
FirstVehicle = new VehicleClass({id:sysid});

// put the vehicle into the collection:
AllVehicles.add(FirstVehicle); 


//console.log(AllVehicles);
//console.log(FirstVehicle);
console.log("ALL:"+JSON.stringify(AllVehicles));


/* 
TIP: What does _.extend do?
In simple terms, it adds properties from other objects (source) on to a target object. 
  Which properties will be added? Own and inherited properties which are enumerable, including those up the prototype chain.. etc
 see more here: https://medium.com/@ee7klt/deconstructing-extend-492a33333079
*/


// these change/s are vehicle specific events, and so are bound to a specific vehicle in the collection, not the whole collection.
// We pull the Vehicle from the Collection by its sysid "current_vehicle = AllVehicles.get(message.header.srcSystem); "


//-------------------------------------------------------------
//
// handle all the parsed MAVLINK messages coming in to us, from UDP link th actual Vehicle. 
//
// (the heartbeat msg is the most complex, as we use it to create new vehicles in the collection and hook state-change events.)
//
//-------------------------------------------------------------

mavlinkParser.on('HEARTBEAT', function(message) {
    //console.log(`Got a HEARTBEAT message from ${udpserver.last_ip_address.address}:${udpserver.last_ip_address.port} `);
    //console.log(message);
    //console.log(`got HEARTBEAT with ID: ${message.header.srcSystem}`);
    var tmp_sysid = message.header.srcSystem;
    var current_vehicle = AllVehicles.get(tmp_sysid); 
    // if we already have the vehicle in the collection: 
    if ( current_vehicle) {  
        current_vehicle.set( {
           // type: message.type,
          //  autopilot: message.autopilot,
          //  base_mode: message.base_mode,
          //  custom_mode: message.custom_mode,
          //  system_status: message.system_status,
            last_heartbeat: Date.now(), //returns the number of milliseconds elapsed since January 1, 1970
            mavlink_version: message.mavlink_version
        });

        var vehicle_type = 'Plane'; // todo state.vehicle_type
        io.of(IONameSpace).emit('mode', { "sysid": current_vehicle.get('id'), 
                            "mode": current_vehicle.get('mode'),
                            "type": vehicle_type });

        //console.log("UPDATE:"+JSON.stringify(AllVehicles));
    // we only CREATE new vehicle object/s when we successfully see a HEARTBEAT from them:
    } else { 
        var tmpVehicle = new VehicleClass({id:message.header.srcSystem});
        // put the modified temporary object back onto the collection
        AllVehicles.add(tmpVehicle, {merge: true}); // 'add' can do "update" when merge=true, in case theres 2 of them somehow.
        //console.log("ADD:"+JSON.stringify(AllVehicles));

        // assemble a new MavFlightMode hook to watch for this sysid:
        mavFlightModes.push(new MavFlightMode(mavlink, mavlinkParser, null, logger,tmp_sysid));

        // re-hook all the MavFlightMode objects to their respective events, since we just added a new one.
        mavFlightModes.forEach(  function(m) {
            m.removeAllListeners('change');
            // this event is generated locally by mavFlightMode.js, and it passed the entire 'state' AND sysid as params
            m.on('change', function(state,sysid) {
                console.log(`----------Got a MODE-CHANGE message from ${udpserver.last_ip_address.address}:${udpserver.last_ip_address.port} `);
                console.log(`... with armed-state: ${state.armed} and sysid: ${sysid} and mode: ${state.mode}`);

                var current_vehicle = AllVehicles.get(sysid); 
                if ( current_vehicle) {  
                    current_vehicle.set( m.getState());  // or 'state' is equiv, hopefuly
                }

            });
        });
    }

});

mavlinkParser.on('GLOBAL_POSITION_INT', function(message) {
    var current_vehicle = AllVehicles.get(message.header.srcSystem); 
    // if we already have the vehicle in the collection: 
    if ( current_vehicle) {  
        //console.log(`Got a GLOBAL_POSITION_INT message from ${udpserver.last_ip_address.address}:${udpserver.last_ip_address.port} `);
        current_vehicle.set( {
            lat: message.lat / 10000000,
            lon: message.lon / 10000000,
            alt: message.alt / 1000,
            relative_alt: message.relative_alt / 1000,
            vx: message.vx / 100,
            vy: message.vy / 100,
            vz: message.vz / 100,
            hdg: message.hdg / 100
        });
        //console.log("UPDATE GLOBAL_POSITION_INT:"+JSON.stringify(AllVehicles));

        io.of(IONameSpace).emit('location', { "sysid": current_vehicle.get('id'), 
                                        "lat": current_vehicle.get('lat'), 
                                    "lng": current_vehicle.get('lon'), 
                                    "heading": current_vehicle.get('hdg'),
                                    "altitude_agl": current_vehicle.get('relative_alt')});
    }
});

mavlinkParser.on('SYS_STATUS', function(message) {
    var current_vehicle = AllVehicles.get(message.header.srcSystem); 
    // if we already have the vehicle in the collection: 
    if ( current_vehicle) {  
        //console.log(`Got a SYS_STATUS message from ${udpserver.last_ip_address.address}:${udpserver.last_ip_address.port} `);
        current_vehicle.set( {
            voltage_battery: message.voltage_battery,
            current_battery: message.current_battery,
            battery_remaining: message.battery_remaining,
            drop_rate_comm: message.drop_rate_comm,
            errors_comm: message.errors_comm
        });
        //console.log("UPDATE SYS_STATUS:"+JSON.stringify(AllVehicles));

        io.of(IONameSpace).emit('sys_status', { "sysid": current_vehicle.get('id'), 
                                    "v1": current_vehicle.get('voltage_battery'), 
                                    "c1": current_vehicle.get('current_battery'), 
                                    "br": current_vehicle.get('battery_remaining'),
                                    "drop_rate_comm": current_vehicle.get('drop_rate_comm'),
                                    "errors_comm": current_vehicle.get('errors_comm')});
    }
});

mavlinkParser.on('ATTITUDE', function(message) {
    var current_vehicle = AllVehicles.get(message.header.srcSystem); 
    // if we already have the vehicle in the collection: 
    if ( current_vehicle) {  
        //console.log(`Got a ATTITUDE message from ${udpserver.last_ip_address.address}:${udpserver.last_ip_address.port} `);
        current_vehicle.set( {
            pitch: message.pitch,
            roll: message.roll,
            yaw: message.yaw,
            pitchspeed: message.pitchspeed,
            rollspeed: message.rollspeed,
            yawspeed: message.yawspeed
        });
        //console.log("UPDATE ATTITUDE:"+JSON.stringify(AllVehicles));

        io.of(IONameSpace).emit('attitude', { 'sysid': current_vehicle.get('id'), 
                                       'pitch': current_vehicle.get('pitch'), 
                                      'roll': current_vehicle.get('roll'), 
                                      'yaw': current_vehicle.get('yaw')} );
    }
});

mavlinkParser.on('VFR_HUD', function(message) {
    var current_vehicle = AllVehicles.get(message.header.srcSystem); 
    // if we already have the vehicle in the collection: 
    if ( current_vehicle) {  
        //console.log(`Got a VFR_HUD message from ${udpserver.last_ip_address.address}:${udpserver.last_ip_address.port} `);
        current_vehicle.set( {
            airspeed: message.airspeed,
            groundspeed: message.groundspeed,
            heading: message.heading,
            throttle: message.throttle,
            climb: message.climb
        });
        //console.log("UPDATE VFR_HUD:"+JSON.stringify(AllVehicles));

        io.of(IONameSpace).emit('HUD', { 'sysid': current_vehicle.get('id'), 
                                    'airspeed': current_vehicle.get('airspeed'),
                                    'groundspeed': current_vehicle.get('groundspeed'),
                                    'heading': current_vehicle.get('heading'), 
                                    'throttle': current_vehicle.get('throttle'),
                                    'climb': current_vehicle.get('climb'),
                                    'ap_type': "ArduPilot" }); // todo calculate ap_type
    }
});

mavlinkParser.on('GPS_RAW_INT', function(message) {
    var current_vehicle = AllVehicles.get(message.header.srcSystem); 
    // if we already have the vehicle in the collection: 
    if ( current_vehicle) {  
        //console.log(`Got a GPS_RAW_INT message from ${udpserver.last_ip_address.address}:${udpserver.last_ip_address.port} `);
        current_vehicle.set( {
            fix_type: message.fix_type,
            satellites_visible: message.satellites_visible,
            raw_lat: message.lat / 10000000,
            raw_lon: message.lon / 10000000,
            raw_alt: message.alt / 1000,
            eph: message.eph,
            epv: message.epv,
            vel: message.vel,
            cog: message.cog
        });
        //console.log("UPDATE GPS_RAW_INT:"+JSON.stringify(AllVehicles));

        io.of(IONameSpace).emit('gps_raw_int', { "sysid": current_vehicle.get('id'), 
                                        "raw_lat": current_vehicle.get('raw_lat'), 
                                    "raw_lng": current_vehicle.get('raw_lon'), 
                                    "raw_alt": current_vehicle.get('raw_alt'),
                                    "fix_type": current_vehicle.get('fix_type'),
                                    "satellites_visible": current_vehicle.get('satellites_visible'),
                                    "cog": current_vehicle.get('cog')});
    }
});

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

nsp.on('connection', function(socket) {

    io.of(IONameSpace).emit('news', { hello: 'Welcome2'});
    console.log("Client Re/Connect:"+IONameSpace);

    socket.on('my_ping', function(msg){
         io.of(IONameSpace).emit('my_pong'); // this is used by the client-side to measure how long the round-trip is 
    });

    // periodically, at 1hz we send the webclient a msg to say we are still alive, kinda like a mavlink heartbeat packet, but not.
    setInterval(function() {  
         //console.log("WS heartbeat internal");
         io.of(IONameSpace).emit('heartbeat', getTime() );
        
    }, 1000);

    // websocket messages from the browser-GCS to us: 

    socket.on('arm', function(id){
        var target_system = id, target_component = 0, command = mavlink.MAV_CMD_COMPONENT_ARM_DISARM, confirmation = 0, 
            param1 = 1, param2 = 0, param3 = 0, param4 = 0, param5 = 0, param6 = 0, param7 = 0;
        // param1 is 1 to indicate arm
        var command_long = new mavlink.messages.command_long(target_system, target_component, command, confirmation, 
                                                         param1, param2, param3, param4, param5, param6, param7)
        mavlinkParser.send(command_long);
        console.log("arm sysid:"+id);
      });

    socket.on('disarm', function(sysid){
        var target_system = sysid, target_component = 0, command = mavlink.MAV_CMD_COMPONENT_ARM_DISARM, confirmation = 0, 
            param1 = 0, param2 = 0, param3 = 0, param4 = 0, param5 = 0, param6 = 0, param7 = 0;
        // param1 is 0 to indicate disarm
        var command_long = new mavlink.messages.command_long(target_system, target_component, command, confirmation, 
                                                         param1, param2, param3, param4, param5, param6, param7)
        mavlinkParser.send(command_long);
        console.log("arm sysid:"+sysid);
      });

    socket.on('do_change_speed',  function(sysid,speed_type, speed, throttle) { 
        if (speed_type == "airspeed")
            speed_type = 0;
        else if (speed_type == "groundspeed")
            speed_type = 1;

        var target_system = sysid, target_component = 0, command = mavlink.MAV_CMD_DO_CHANGE_SPEED, confirmation = 0, 
            param1 = float(speed_type), param2 = float(speed), param3 = float(throttle), 
            // param4 is absolute or relative [0,1]
            param4 = 0, 
            param5 = 0, param6 = 0, param7 = 0;
        var command_long = new mavlink.messages.command_long(target_system, target_component, command, confirmation, 
                                                         param1, param2, param3, param4, param5, param6, param7)
        mavlinkParser.send(command_long);
        console.log(`do_change_speed sysid: ${sysid} to speed: ${speed}`);
    });

    socket.on('do_change_altitude',  function(sysid,alt) { 

        var target_system = sysid, target_component = 0, command = mavlink.MAV_CMD_DO_CHANGE_ALTITUDE, confirmation = 0, 
            // param2 = 3  means MAV_FRAME_GLOBAL_RELATIVE_ALT, see https://mavlink.io/en/messages/common.html#MAV_FRAME
            param1 = float(alt), param2 = 3, param3 = 0, param4 = 0, param5 = 0, param6 = 0, param7 = 0;
        var command_long = new mavlink.messages.command_long(target_system, target_component, command, confirmation, 
                                                         param1, param2, param3, param4, param5, param6, param7)
        mavlinkParser.send(command_long);
        console.log(`do_change_altitude sysid: ${sysid} to alt: ${alt}`);
    });

    socket.on('do_change_mode',  function(sysid,mode) { 

        // any instance of a MavFlightMode will do ,so we pick the Zeroth element of the list as it's probably there.
        var mode_mapping_inv = mavFlightModes[0].mode_mapping_inv();
        mode = mode.toUpperCase();
        modenum = mode_mapping_inv[mode];
        var target_system = sysid, /* base_mode = 217, */ custom_mode = modenum; 

        set_mode_message = new mavlink.messages.set_mode(target_system, mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED, custom_mode);                        
        mavlinkParser.send(set_mode_message);
                     
        console.log(`do_change_mode sysid: ${sysid} to mode: ${mode}`);
    });

    // 
    socket.on('set_wp', function(sysid,seq) {  

        var target_system = sysid, target_component = 0;

        var mission_set_current = new mavlink.messages.mission_set_current(target_system, target_component, seq);

        mavlinkParser.send(mission_set_current);
        console.log(`set_wp/mission_set_current sysid: ${sysid} to alt: ${seq}`);
        
    });

    // TODO test these...

    // we don't try to get missions or even run the get-mission code unless the client asks us to.
    socket.on('enableGetMission', function(sysid,msg) {
        console.log('ENABLING MISSION GETTING')
        var mm= new MavMission(mavlink, mavlinkParser, null, logger);
        mm.enableGetMission();

        // after getting mission re-load to plane as a rtest
        //everyone.now.loadMission();
    });

    socket.on('loadMission', function(sysid,msg) {
        console.log('LOADING MISSION')
        var mm= new MavMission(mavlink, mavlinkParser, null, logger);
        mm.loadMission();

     });


    // TODO add more here 

/*  untested
    // setGuided
    socket.on('setGuided',function(sysid) {
        var target_system = sysid;
        message = new mavlink.messages.set_mode(target_system, mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED, 4);                        
        buffer = new Buffer(message.pack(mavlinkParser));
        connection.write(buffer)
        console.log('Set guided mode');  
    }

    //takeOff
    socket.on('takeOff',function(sysid) {
        var target_system = sysid;
        message = new mavlink.messages.command_long(target_system, 0, mavlink.MAV_CMD_NAV_TAKEOFF, 0,  0, 0 ,0, 0, -35.363261, 149.165230, 10);                        
        buffer = new Buffer(message.pack(mavlinkParser));
        connection.write(buffer)
        console.log('Takeoff');  
    }

    //streamAll
    socket.on('streamAll',function(sysid) {
        var target_system = sysid;
        message = new mavlink.messages.request_data_stream(target_system, 1, mavlink.MAV_DATA_STREAM_ALL, 1, 1);
        buffer = new Buffer(message.pack(mavlinkParser));
        connection.write(buffer);
    }
*/

});



