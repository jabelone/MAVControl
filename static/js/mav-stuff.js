////////////////////////////////////////////////////////////////////////////////////////////////////

//uses class EventEmitter from mav_v1.js a second time for wrapping the client-side parser with outgoing and incoming callback/s.
MSGHANDLER = function(a){
    this.a = a;
}

//var unused_socket_wrapper = function(message) {
   // if (message.type != 5  ) console.log('socket capture',message);
//}
// Implements EventEmitter
inherits(MSGHANDLER, EventEmitter);
var msghandler = new MSGHANDLER();
//msghandler.on('packet', unused_socket_wrapper);

////////////////////////////////////////////////////////////////////////////////////////////////////

var mavlink_outgoing_parser_message_handler = function(x,arguments) {

   event = arguments[0];
    //if (event != 'my_ping') {
    //    console.log('socket._emit ', arguments);
    //}

    var mavtype = sysid_to_mavlink_type[sysid]; // 1 or 2

    if (event == 'do_change_mode') {  
        sysid = arguments[1]; 
        mode = arguments[2]; 
        var _mode_mapping_inv = mode_mapping_inv(); // comes from down below in mav-stuff.js
        var mode = mode.toUpperCase();
        var modenum = _mode_mapping_inv[mode];
        var target_system = sysid; 
        /* base_mode = 217, */ 
        var custom_mode = modenum; 

        console.log(`do_change_mode sysid: ${sysid} to mode: ${mode} and mavlink type: ${mavtype}`);  

        var set_mode_message = undefined;
        if (mavtype == 1 ){
            set_mode_message = new mavlink10.messages.set_mode(target_system, mavlink10.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED, custom_mode); 
            // finally this causes the parser to call our custom send() and actually emit() them out the websocket, not done here.
            mavlinkParser1.send(set_mode_message,sysid);  // by passing the 2nd param, sysid here, send() can determine which ip/port to send to as well.
         }
        if (mavtype == 2 ){
            set_mode_message = new mavlink20.messages.set_mode(target_system, mavlink20.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED, custom_mode); 
            mavlinkParser1.send(set_mode_message,sysid);  // by passing the 2nd param, sysid here, send() can determine which ip/port to send to as well.
         }
        if (set_mode_message == undefined ){ 
            console.log("mavtype error prevented message from being built"); 
        }

    }

  // after turning into proper mavlink, emit it out the real websocket, not here tho.
  //_emit.apply(x, arguments);

}

////////////////////////////////////////////////////////////////////////////////////////////////////

// after INCOMiNG MAVLINK goes thru the mavlink parser in the browser, it dispatches them to here...
//  where we pull the relevant bits of the mavlink packets out into JSON and send them 
//  through the 'msghandler' EventEmitter to the 'msghandler.on(...)' calls to update the UI
var mavlink_incoming_parser_message_handler = function(message,ip,port,mavlinktype) {

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

    // console.log all the uncommon message types we DONT list here.    
    if ( ! [ 'VFR_HUD','GPS_RAW_INT', 'ATTITUDE', 'SYS_STATUS', 'GLOBAL_POSITION_INT', 'HEARTBEAT','VIBRATION',
            'BATTERY_STATUS', 'TERRAIN_REPORT', 'WIND', 'HWSTATUS', 'AHRS', 'AHRS2', 'AHRS3',
            'SIMSTATE', 'RC_CHANNELS','RC_CHANNELS_RAW', 'SERVO_OUTPUT_RAW', 'LOCAL_POSITION_NED',
            'MEMINFO',  'POWER_STATUS', 'SCALED_PRESSURE', 'SCALED_PRESSURE2','SCALED_IMU','SCALED_IMU2','SCALED_IMU3', 'RAW_IMU',
            'EKF_STATUS_REPORT', 'SYSTEM_TIME', 'MISSION_CURRENT' , 'SENSOR_OFFSETS', 
            'TIMESYNC', 'PARAM_VALUE', 'HOME_POSITION', 'POSITION_TARGET_GLOBAL_INT',
            'NAV_CONTROLLER_OUTPUT', 'STATUSTEXT' , 'COMMAND_ACK' , 
            'MISSION_ITEM', 'MISSION_ITEM_INT','MISSION_COUNT','MISSION_REQUEST', 'MISSION_ACK',
            'AIRSPEED_AUTOCAL', 'MISSION_ITEM_REACHED' , 'STAT_FLTTIME' ,'AUTOPILOT_VERSION' ,
             'FENCE_STATUS' , 'AOA_SSA' , 'GPS_GLOBAL_ORIGIN', 'SET_MODE', 'FILE_TRANSFER_PROTOCOL',
            'MISSION_REQUEST_INT' , 'MISSION_REQUEST_LIST',
            'PARAM_SET', ].includes(message.name) ) { 
            
	console.log("unhandled mavlink packet"+JSON.stringify(message));
    } 


    // display STATUSTEXT as simple console.log
    if (  ['STATUSTEXT' ].includes(message.name) ) {
        // drop everything including and after the first null byte.
        var _message = message.text.replace(/\0.*$/g,'');
        console.log(`STATUSTEXT: ${_message}`);

        // arm and disarm confirmation messages are handled like their own events, as they are important.
        if (_message == "Throttle armed" || _message == "Arming motors"){
            msghandler.emit('armed', true); // no sysid in this msg.
        }
        if (_message == "Throttle disarmed" || _message == "Disarming motors"){
            msghandler.emit('disarmed', true); // no sysid in this msg.
        }

        // everything else is just pushed into the 'messages' display box by this event...
        msghandler.emit('status_text', { "sysid": message.header.srcSystem,  "text": _message});

    } 

    if (  ['VFR_HUD' ].includes(message.name) ) {
        // this matches the json format sent by the non-mavlink backend server/s
        msghandler.emit('HUD',{sysid: message.header.srcSystem, airspeed: message.airspeed, 
                groundspeed: message.groundspeed, 
                heading: message.heading, throttle: message.throttle, 
                climb: message.climb, ap_type: "ArduPilot"});
    }

    if (  ['GLOBAL_POSITION_INT' ].includes(message.name) ) {
         // this matches the json format sent by the non-mavlink backend server/s
         msghandler.emit('location', { sysid: message.header.srcSystem,
                                lat: message.lat / 10000000 , 
                                lng: message.lon / 10000000, 
                                heading: message.hdg / 100,
                                altitude_agl: message.relative_alt / 1000 });
    }

    if (  ['SYS_STATUS' ].includes(message.name) ) {
         // this matches the json format sent by the non-mavlink backend server/s
         msghandler.emit('sys_status', { "sysid": message.header.srcSystem,
                                    "v1": message.voltage_battery, 
                                    "c1": message.current_battery, 
                                    "br": message.battery_remaining,
                                    "drop_rate_comm": message.drop_rate_comm,
                                    "errors_comm": message.errors_comm });
    }
    if (  ['ATTITUDE' ].includes(message.name) ) {

       // and we round them to 2 decimal places so the GUI renders nicer on the STATUS tab.
        var pitch = Math.round(message.pitch * 180.0 / 3.14159 * 100) / 100;
        var roll = Math.round(message.roll * 180.0 / 3.14159 * 100) / 100;
        var yaw = Math.round(message.yaw * 180.0 / 3.14159 * 100) / 100;

        // this matches the json format sent by the non-mavlink backend server/s
        // which is in *degrees* and two decimal places.
        msghandler.emit('attitude', { 'sysid': message.header.srcSystem,
                                  'pitch': pitch, 
                                  'roll': roll, 
                                  'yaw': yaw } );
    }
    if (  ['GPS_RAW_INT' ].includes(message.name) ) {
        // this matches the json format sent by the non-mavlink backend server/s
        msghandler.emit('gps_raw_int', { "sysid": message.header.srcSystem,
                                "raw_lat": message.lat / 10000000,
                                "raw_lng": message.lon / 10000000,
                                "raw_alt": message.alt / 1000,
                                "fix_type": message.fix_type,
                                "satellites_visible": message.satellites_visible,
                                "cog": message.cog });
    
    }
    if (  ['HEARTBEAT' ].includes(message.name) ) {
        // this matches the json format sent by the non-mavlink backend server/s

       // todo more if needed

        // this ensures the GUI render/s the current vehicle mode on-screen 
        // arduplane uses heartbeatpacket.custom_mode to index into mode_mapping_apm - TODO copter uses acm
        var _mode = 'unknown-mode';// = mode_mapping_apm[message.custom_mode];
        var vehicle_type = 'unknown-type';// = 'Plane'; // todo handle non-plane things too.

        //copter or plane or something else?
        if (message.type == mavlink20.MAV_TYPE_FIXED_WING ) {
            // arduplane uses packet.custom_mode to index into mode_mapping_apm 
            _mode = mode_mapping_apm[message.custom_mode]; 
            vehicle_type = 'Plane';
        }
        if (message.type == mavlink20.MAV_TYPE_QUADROTOR ) {
            // arducopter uses packet.custom_mode to index into mode_mapping_acm 
            _mode = mode_mapping_acm[message.custom_mode]; 
            vehicle_type = 'Copter';
        }

        //this matches the json format sent by the non-mavlink backend server/s:
        msghandler.emit('mode', { "sysid": message.header.srcSystem,
                            "mode": _mode,
                            "type": vehicle_type });

    }
 
    // add more MAVLINK -> to -> json handlers here for in-browser parsing.
}

////////////////////////////////////////////////////////////////////////////////////////////////////

var mode_mapping_apm = {
    0 : 'MANUAL',
    1 : 'CIRCLE',
    2 : 'STABILIZE',
    3 : 'TRAINING',
    4 : 'ACRO',
    5 : 'FBWA',
    6 : 'FBWB',
    7 : 'CRUISE',
    8 : 'AUTOTUNE',
    10 : 'AUTO',
    11 : 'RTL',
    12 : 'LOITER',
    14 : 'LAND',
    15 : 'GUIDED',
    16 : 'INITIALISING',
    17 : 'QSTABILIZE',
    18 : 'QHOVER',
    19 : 'QLOITER',
    20 : 'QLAND',
    21 : 'QRTL',
    22 : 'QAUTOTUNE',
    };

var mode_mapping_acm = {
    0 : 'STABILIZE',
    1 : 'ACRO',
    2 : 'ALT_HOLD',
    3 : 'AUTO',
    4 : 'GUIDED',
    5 : 'LOITER',
    6 : 'RTL',
    7 : 'CIRCLE',
    8 : 'POSITION',
    9 : 'LAND',
    10 : 'OF_LOITER',
    11 : 'DRIFT',
    13 : 'SPORT',
    14 : 'FLIP',
    15 : 'AUTOTUNE',
    16 : 'POSHOLD',
    17 : 'BRAKE',
    18 : 'THROW',
    19 : 'AVOID_ADSB',
    20 : 'GUIDED_NOGPS',
    21 : 'SMART_RTL',
    22 : 'FLOWHOLD',
    23 : 'FOLLOW',
};

// given a human-readable mode name like 'AUTO' return the mode-num for a custom_mode packet.
function mode_mapping_inv() {

    var result = {};   // empty object to contain reversed key/value paris
    var keys = Object.keys(mode_mapping_apm);   // first get all keys in an array
    keys.forEach(function(key){
      var val = mode_mapping_apm[key];   // get the value for the current key
      result[val] = key;                 // reverse is done here
    });

	return result;
};

// js objects are already double precision, so no need to change a float into anything else, but this is helpful as a label.
function float(thing) { 
    return thing;
}

////////////////////////////////////////////////////////////////////////////////////////////////////

