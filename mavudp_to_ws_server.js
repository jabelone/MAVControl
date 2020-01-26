// this is a mavlink UDP listener for ArduPlane style vehicles which then uses a websockets enabled web server 
// to deliver a web-based GCS that is a slightly-hacked-on version of MAVControl. 
// incoming UDP mavlink/vehicl/sim data at 0.0.0.0:14550 is parsed SERVER SIDE IN NODE.js to generate json messages that are passed off to the MAVControl instance for
// display of the HUD and MAP etc. 
// uses express 4 + socket.io and 'backbone.js' as a server-side Model for the Vehicle state and a group of Vehicles, and as few other dependancies as possible. 
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

// mavlink related stuff:
var {mavlink10, MAVLink10Processor} = require("./mav_v1.js"); 
var mavlinkParser1 = new MAVLink10Processor(logger, 11,0);

var {mavlink20, MAVLink20Processor} = require("./mav_v2.js"); 
var mavlinkParser2 = new MAVLink20Processor(logger, 11,0);

// create the output hooks for the parser/s
// we overwrite the default send() instead of overwriting write() or using setConnection(), which don't know the ip or port info.
// and we accept ip/port either as part of the mavmsg object, or as a sysid in the OPTIONAL 2nd parameter
generic_mav_udp_sender = function(mavmsg,sysid) {
    // this is really just part of the original send()
    buf = mavmsg.pack(this);

      // where we want the packet to go on the network.. we sneak it into the already parsed object that still wraps the raw bytes.
    if (mavmsg.ip == undefined || mavmsg.port == undefined){
        //console.log(sysid_to_ip_address);
        //console.log(sysid);
        mavmsg.ip = sysid_to_ip_address[sysid].ip;
        mavmsg.port = sysid_to_ip_address[sysid].port;
    }
    if (mavmsg.ip == undefined || mavmsg.port == undefined){
        console.log("unable to determine SEND ip/port from packet or sysid, sorry, discarding. sysid:${sysid}  msg:${mavmsg}");
        return;
    }
    // at startup, till we've had at least one INCOMING packet, we can't send.
    if (udpserver.have_we_recieved_anything_yet == null ) { 
        console.log('mavlink write not possible yet,dropped packet.');
        return;
    } 

    const b = Buffer.from(buf);// convert from array object to Buffer so we can UDP send it.

    console.log(`... sending msg to: ${mavmsg.ip}:${mavmsg.port} `);

    // send to the place we had comms for this sysid come from, this is the critical line change from the default send()
    udpserver.send( b, mavmsg.port, mavmsg.ip ); 

    // this is really just part of the original send()
    this.seq = (this.seq + 1) % 256;
    this.total_packets_sent +=1;
    this.total_bytes_sent += buf.length;
}
//var origsend1 = MAVLink10Processor.prototype.send;
MAVLink10Processor.prototype.send = generic_mav_udp_sender
//var origsend2 = MAVLink20Processor.prototype.send;
MAVLink20Processor.prototype.send = generic_mav_udp_sender

var MavParams = require("./assets/mavParam.js");   // these are server-side js libraries for handling some more complicated bits of mavlink
var MavFlightMode = require("./assets/mavFlightMode.js");
var MavMission = require('./assets/mavMission.js');

console.log(JSON.stringify(MavFlightMode));

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


webserver.listen(5000+offset, function(){
  console.log(`Express webserver listening on port ${5000+offset}.  goto: http://127.0.0.1:${5000+offset}`);
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


//-------------------------------------------------------------
//
//
//
//-------------------------------------------------------------

// after INCOMiNG MAVLINK goes thru the mavlink parser in the browser, it dispatches them to here where we save the source ip/port for each sysid
var mavlink_ip_and_port_handler = function(message,ip,port,mavlinktype) {

    if (typeof message.header == 'undefined'){ 
        console.log('message.header UNDEFINED, skipping packet:'); 
        console.log(message); 
        return; 
    }

  // it's been parsed, and must be a valid mavlink packet, and thus must have a sysid available now..
    if (  sysid_to_ip_address[message.header.srcSystem] == null )  {
          console.log(`Got first PARSED MSG from sysid:${message.header.srcSystem} src:${ip}:${port}, mav-proto:${mavlinktype}. Not repeating this. `);
    }
    // by having this inside the above if() the source port and ip can't change without a page reload, having it below, it keeps uptodate.
    sysid_to_ip_address[message.header.srcSystem] = {'ip':ip, 'port':port}; 
    sysid_to_mavlink_type[message.header.srcSystem] =    mavlinktype; // 1 or 2


}

//-------------------------------------------------------------

// hook udp listener events to actions:
udpserver.on('error', (err) => {
  console.log(`server error:\n${err.stack}`);
  webserver.close();
});
udpserver.on('message', (msg, rinfo) => {
    //console.log(udpserver.have_we_recieved_anything_yet);
    //console.log(rinfo);

    // first time thru:
    if (udpserver.have_we_recieved_anything_yet == null ) { udpserver.have_we_recieved_anything_yet = true } 

    var array_of_chars = Uint8Array.from(msg) // from Buffer to byte array

    var packetlist = [];
    var mavlinktype = undefined;
    // lets try to support mav1/mav2 with dual parsers.
    if (array_of_chars[0] == 253 ) { 
        packetlist = mavlinkParser2.parseBuffer(array_of_chars); 
        mavlinktype = 2; // known bug, at the moment we assume that if we parsed ONE packet for this sysid in the start of the stream as mav1 or mav2, then they all are
    } 
    if (array_of_chars[0] == 254 ) { 
        packetlist = mavlinkParser1.parseBuffer(array_of_chars); 
        mavlinktype = 1; 
    }
    // if neither, then we do nothing with the empty [] packet list anyway.

    //parseBuffer CAN and does 'emit' messages with the parsed result, because of the 'generic' capture/s elsewhere using mavlinkParser1.on(..) 
    // , the packets trigger a call to mavlink_ip_and_port_handler with the result, but no ip/port data would be kept through 
    //   the 'emit()' process, so we ALSO return the array-of-chars as an array of mavlink packets, possibly 'none', [ p] single packet , or [p,p,p] packets.
    // here's where we store the sorce ip and port with each packet we just made, AFTER the now-useless 'emit' which can't easily do this.
    for (msg of packetlist){  
        mavlink_ip_and_port_handler(msg,rinfo.address,rinfo.port,mavlinktype );  // [1] = ip  and [2] = port
    }

    //console.log(msg);    
    //console.log(array_of_chars);

    
});

// Attach an event handler for any valid MAVLink message - we use this mostly for unknown packet types, console.log and debug messages. 
// the majority of specific responses to specifc messages are not handled in the 'generic' handler, but in specific message handlers for each 
// type of message.   eg mavlinkParser1.on('HEATBEAT') is better than here, as this 'generic' block might go away at some point.
var generic_message_handler = function(message) {

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
             'FENCE_STATUS' , 'AOA_SSA' , 'GPS_GLOBAL_ORIGIN',  ].includes(message.name) ) { 
            
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
        //console.log(`STATUSTEXT: ${message.text}`);    

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

}

// Attach the event handler for any valid MAVLink message in either stream, its agnostic at this stage
mavlinkParser1.on('message', generic_message_handler);
mavlinkParser2.on('message', generic_message_handler);

// lookup table we populate later.
sysid_to_ip_address = {};
sysid_to_mavlink_type = {};


udpserver.bind(14550+offset);

var sysid = 12; // lets assume just one sysid to start with.

// looks for flight-mode changes on this specific sysid only
var mavFlightModes = [];
mavFlightModes.push(new MavFlightMode(mavlink10, mavlinkParser1, null, logger,sysid));
mavFlightModes.push(new MavFlightMode(mavlink20, mavlinkParser2, null, logger,sysid));


// MavParams are for handling loading parameters
// Just hacking/playing code for now, compiles but not properly tested.
var mavParams = new MavParams(mavlinkParser1,logger);
var mavParams2 = new MavParams(mavlinkParser2,logger);


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


// the '2' in this name is not a mavlink2 thing, it's becasue we've got two different hooks on the 'heartbeat' right now for convenience.
// we can surely merge them as some point.
var heartbeat_handler =  function(message) {
    //console.log(`Got a HEARTBEAT message from ${udpserver.last_ip_address.address}:${udpserver.last_ip_address.port} `);
    //console.log(message);
    //console.log(`got HEARTBEAT with ID: ${message.header.srcSystem}`);
    var tmp_sysid = message.header.srcSystem;
    var current_vehicle = AllVehicles.get(tmp_sysid); // returns the entire vehicle object
    // if we already have the vehicle in the collection: 
    if ( current_vehicle) {  
        //console.log("------------------------------------");
        //console.log(current_vehicle.get('id'));
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
        // mode is either undefined or a human-readable mode string like 'AUTO' or 'RTL'
        //console.log({ "sysid": current_vehicle.get('id'), 
        //                    "mode": current_vehicle.get('mode'),
        //                    "type": vehicle_type });
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
        mavFlightModes.push(new MavFlightMode(mavlink10, mavlinkParser1, null, logger,tmp_sysid));
        // todo
        mavFlightModes.push(new MavFlightMode(mavlink20, mavlinkParser2, null, logger,tmp_sysid));



        // re-hook all the MavFlightMode objects to their respective events, since we just added a new one.
        mavFlightModes.forEach(  function(m) {
            m.removeAllListeners('change');
            //console.log("change hook mavFlightModes.length"+mavFlightModes.length);

            // this event is generated locally by mavFlightMode.js, and it passed the entire 'state' AND sysid as params
            m.on('change', function(state,sysid) {
                console.log(`----------Got a MODE-CHANGE message from ${sysid_to_ip_address[sysid].ip}:${sysid_to_ip_address[sysid].port} `);
                console.log(`... with armed-state: ${state.armed} and sysid: ${sysid} and mode: ${state.mode}`);

                // change the mode in the state subsystem to match this, but only if its changed.
                var current_vehicle = AllVehicles.get(sysid);  
                if (current_vehicle.get('mode') != state.mode ) {
                    current_vehicle.set( { 'mode': state.mode});
                }
                // old way, not sure it worked in all cases.
                //if ( current_vehicle) {  
                //    current_vehicle.set( m.getState());  // or 'state' is equiv, hopefuly
                //}

            });
        });
    }

}

mavlinkParser1.on('HEARTBEAT', heartbeat_handler);
mavlinkParser2.on('HEARTBEAT', heartbeat_handler);


var gpi_handler = function(message) {
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
}
mavlinkParser1.on('GLOBAL_POSITION_INT', gpi_handler);
mavlinkParser2.on('GLOBAL_POSITION_INT', gpi_handler);




var sysstatus_handler = function(message) {
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
}
mavlinkParser1.on('SYS_STATUS', sysstatus_handler);
mavlinkParser2.on('SYS_STATUS', sysstatus_handler);



var att_handler = function(message) {
    var current_vehicle = AllVehicles.get(message.header.srcSystem); 
    // if we already have the vehicle in the collection: 
    if ( current_vehicle) {  
        //console.log(`Got a ATTITUDE message from ${udpserver.last_ip_address.address}:${udpserver.last_ip_address.port} `);

       // radians * 180.0 / 3.14159 = Angle_in_degrees 
        current_vehicle.set( {
            pitch: message.pitch * 180.0 / 3.14159,
            roll: message.roll * 180.0 / 3.14159,
            yaw: message.yaw * 180.0 / 3.14159,
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
}
mavlinkParser1.on('ATTITUDE', att_handler);
mavlinkParser2.on('ATTITUDE', att_handler);


var vfrhud_handler = function(message) {
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
}
mavlinkParser1.on('VFR_HUD', vfrhud_handler);
mavlinkParser2.on('VFR_HUD', vfrhud_handler);


var gpsrawint_handler = function(message) {
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
}
mavlinkParser1.on('GPS_RAW_INT', gpsrawint_handler);
mavlinkParser2.on('GPS_RAW_INT', gpsrawint_handler);

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

function decide_which_mavlink_obj_and_return_it(id){
        var mavlink = null;
        switch (sysid_to_mavlink_type[id]) 
        {
            case 1:
                return mavlink10;
                break;
            case 2:
                return mavlink20;
                break;
            default:
             console.log("ERROR, vehicle does not identify as MAVlINK1 or mAVLINK2!!!");
        }
}
function decide_which_mavlink_parser_and_return_it(id){
        var mavlink = null;
        switch (sysid_to_mavlink_type[id]) 
        {
            case 1:
                return mavlinkParser1;
                break;
            case 2:
                return mavlinkParser2;
                break;
            default:
             console.log("ERROR, vehicle does not identify as MAVlINK1 or mAVLINK2!!!");
        }
}

nsp.on('connection', function(websocket) {

    io.of(IONameSpace).emit('news', { hello: 'Welcome2'});
    console.log("Client Re/Connect:"+IONameSpace);

    websocket.on('my_ping', function(msg){
         io.of(IONameSpace).emit('my_pong'); // this is used by the client-side to measure how long the round-trip is 
    });

    // periodically, at 1hz we send the webclient a msg to say we are still alive, kinda like a mavlink heartbeat packet, but not.
    setInterval(function() {  
         //console.log("WS heartbeat internal");
         io.of(IONameSpace).emit('heartbeat', getTime() );
        
    }, 1000);

    // websocket messages from the browser-GCS to us: 

    websocket.on('arm', function(sysid){
        var m = decide_which_mavlink_obj_and_return_it(sysid);  
        var mp = decide_which_mavlink_parser_and_return_it(sysid);

        var target_system = sysid, target_component = 0, command = m.MAV_CMD_COMPONENT_ARM_DISARM, confirmation = 0, 
            param1 = 1, param2 = 0, param3 = 0, param4 = 0, param5 = 0, param6 = 0, param7 = 0;
        // param1 is 1 to indicate arm
        var command_long = new m.messages.command_long(target_system, target_component, command, confirmation, 
                                                         param1, param2, param3, param4, param5, param6, param7)
        mp.send(command_long,sysid);
        console.log("arm sysid:"+sysid);
      });

    websocket.on('disarm', function(sysid){
        var m = decide_which_mavlink_obj_and_return_it(sysid);  
        var mp = decide_which_mavlink_parser_and_return_it(sysid);

        var target_system = sysid, target_component = 0, command = m.MAV_CMD_COMPONENT_ARM_DISARM, confirmation = 0, 
            param1 = 0, param2 = 0, param3 = 0, param4 = 0, param5 = 0, param6 = 0, param7 = 0;
        // param1 is 0 to indicate disarm
        var command_long = new m.messages.command_long(target_system, target_component, command, confirmation, 
                                                         param1, param2, param3, param4, param5, param6, param7)
        mp.send(command_long,sysid);
        console.log("disarm sysid:"+sysid);
      });

    websocket.on('do_change_speed',  function(sysid,speed_type, speed, throttle) { 
        if (speed_type == "airspeed")
            speed_type = 0;
        else if (speed_type == "groundspeed")
            speed_type = 1;

        var m = decide_which_mavlink_obj_and_return_it(sysid);  
        var mp = decide_which_mavlink_parser_and_return_it(sysid);

        var target_system = sysid, target_component = 0, command = m.MAV_CMD_DO_CHANGE_SPEED, confirmation = 0, 
            param1 = float(speed_type), param2 = float(speed), param3 = float(throttle), 
            // param4 is absolute or relative [0,1]
            param4 = 0, 
            param5 = 0, param6 = 0, param7 = 0;
        var command_long = new m.messages.command_long(target_system, target_component, command, confirmation, 
                                                         param1, param2, param3, param4, param5, param6, param7)
        mp.send(command_long,sysid);
        console.log(`do_change_speed sysid: ${sysid} to speed: ${speed}`);
    });

    websocket.on('do_change_altitude',  function(sysid,alt) { 
        var m = decide_which_mavlink_obj_and_return_it(sysid);  
        var mp = decide_which_mavlink_parser_and_return_it(sysid);

        var target_system = sysid, target_component = 0, command = m.MAV_CMD_DO_CHANGE_ALTITUDE, confirmation = 0, 
            // param2 = 3  means MAV_FRAME_GLOBAL_RELATIVE_ALT, see https://mavlink.io/en/messages/common.html#MAV_FRAME
            param1 = float(alt), param2 = 3, param3 = 0, param4 = 0, param5 = 0, param6 = 0, param7 = 0;
        var command_long = new m.messages.command_long(target_system, target_component, command, confirmation, 
                                                         param1, param2, param3, param4, param5, param6, param7)
        mp.send(command_long,sysid);
        console.log(`do_change_altitude sysid: ${sysid} to alt: ${alt}`);
    });

    websocket.on('do_change_mode',  function(sysid,mode) { 
        var m = decide_which_mavlink_obj_and_return_it(sysid);  
        var mp = decide_which_mavlink_parser_and_return_it(sysid);

        // any instance of a MavFlightMode will do ,so we pick the Zeroth element of the list as it's probably there.
        var mode_mapping_inv = mavFlightModes[0].mode_mapping_inv();
        mode = mode.toUpperCase();
        modenum = mode_mapping_inv[mode];
        var target_system = sysid, /* base_mode = 217, */ custom_mode = modenum; 

        set_mode_message = new m.messages.set_mode(target_system, m.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED, custom_mode);                        
        mp.send(set_mode_message,sysid);
                     
        console.log(`do_change_mode sysid: ${sysid} to mode: ${mode}`);
        console.log(set_mode_message);
    });

    // 
    websocket.on('set_wp', function(sysid,seq) {  
        var m = decide_which_mavlink_obj_and_return_it(sysid);  
        var mp = decide_which_mavlink_parser_and_return_it(sysid);

        var target_system = sysid, target_component = 0;
        var mission_set_current = new m.messages.mission_set_current(target_system, target_component, seq);

        mp.send(mission_set_current,sysid);
        console.log(`set_wp/mission_set_current sysid: ${sysid} to alt: ${seq}`);
        
    });

    // TODO test these...

    // we don't try to get missions or even run the get-mission code unless the client asks us to.
    websocket.on('enableGetMission', function(sysid,msg) {
        var m = decide_which_mavlink_obj_and_return_it(sysid);  
        var mp = decide_which_mavlink_parser_and_return_it(sysid);

        console.log('ENABLING MISSION GETTING')
        var mm= new MavMission(m, mp, null, logger);
        mm.enableGetMission();

        // after getting mission re-load to plane as a rtest
        //everyone.now.loadMission();
    });

    websocket.on('loadMission', function(sysid,msg) {
        var m = decide_which_mavlink_obj_and_return_it(sysid);  
        var mp = decide_which_mavlink_parser_and_return_it(sysid);

        console.log('LOADING MISSION')
        var mm= new MavMission(m, mp, null, logger);
        mm.loadMission();

     });


    // TODO add more here 

/*  untested
    // setGuided
    websocket.on('setGuided',function(sysid) {
        var m = decide_which_mavlink_obj_and_return_it(sysid);  
        var mp = decide_which_mavlink_parser_and_return_it(sysid);

        var target_system = sysid;
        message = new m.messages.set_mode(target_system, m.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED, 4);                        
        //buffer = new Buffer(message.pack(mp));
        //connection.write(buffer)
        mp.send(message,sysid);
        console.log('Set guided mode');  
    }

    //takeOff
    websocket.on('takeOff',function(sysid) {
        var m = decide_which_mavlink_obj_and_return_it(sysid);  
        var mp = decide_which_mavlink_parser_and_return_it(sysid);

        var target_system = sysid;
        message = new m.messages.command_long(target_system, 0, m.MAV_CMD_NAV_TAKEOFF, 0,  0, 0 ,0, 0, -35.363261, 149.165230, 10);                        
        //buffer = new Buffer(message.pack(mp));
        //connection.write(buffer)
        mp.send(message,sysid);
        console.log('Takeoff');  
    }

    //streamAll
    websocket.on('streamAll',function(sysid) {
        var m = decide_which_mavlink_obj_and_return_it(sysid);  
        var mp = decide_which_mavlink_parser_and_return_it(sysid);
        var target_system = sysid;
        message = new m.messages.request_data_stream(target_system, 1, m.MAV_DATA_STREAM_ALL, 1, 1);
        //buffer = new Buffer(message.pack(mp));
        //connection.write(buffer);
        mp.send(message,sysid);
    }
*/

});



