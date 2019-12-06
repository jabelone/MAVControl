var util = require('util'),
	_ = require('underscore');

// Private references to shared resources
var mavlink;
var mavlinkParser;
var uavConnection;
var log;
var sysid;

// System state/status
var state = {};
var newState = {}; // Used to compare existing and updated state

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


function MavFlightMode(mavlinkObject, mavlinkParserObject, uavConnectionObject, logger,passed_sysid) {
	mavlink = mavlinkObject;
	mavlinkParser = mavlinkParserObject;
	uavConnection = uavConnectionObject;
	log = logger;
    sysid = passed_sysid;
	this.attachHandlers();
    console.log(`MavFlightMode is looking for mode/arming changes with sysid: ${sysid}`);
}

util.inherits(MavFlightMode, events.EventEmitter);

MavFlightMode.prototype.attachHandlers = function() {
	var self = this;
	//mavlinkParser.on('HEARTBEAT', _.debounce(function(heartbeat) {
	mavlinkParser.on('HEARTBEAT', function(heartbeat) {

        //console.log(heartbeat);

        //console.log(`custom mode: ${heartbeat.custom_mode}`);
        //console.log(`base mode: ${heartbeat.base_mode}`);


        // else ignore data for other sysids than the one we are interested in.
        if ( heartbeat.header.srcSystem != sysid ) return; 

        // do a deep copy of the original state. 'newState = state' is not enuf here.
        newState  = JSON.parse(JSON.stringify(state));

		// Translate the bitfields for use in the client.

        // arduplane uses packet.custom_mode to index into mode_mapping_apm - TODO copter uses acm
        newState.mode = mode_mapping_apm[heartbeat.custom_mode]; 
        //console.log("ardumode:"+newState.mode);
		newState.armed = ( mavlink.MAV_MODE_FLAG_SAFETY_ARMED & heartbeat.base_mode ) ? true : false;		


        if ( ( state.auto == newState.auto) &&( state.guided == newState.guided) &&( state.stabilize == newState.stabilize) &&
             ( state.manual == newState.manual) &&( state.armed == newState.armed) &&( state.mode == newState.mode) ) {  
            // pass
        } else { 
            //console.log(">>>>>>>>>>>>>>>>");
            //console.log(newState);
            //console.log("<<<<<<<<<<<<<<<<");
            state = newState;
		    self.emit('change', state, sysid);
		}	

    });

	//}), 1000);
};

MavFlightMode.prototype.getState = function() {
	return state;
};

MavFlightMode.prototype.mode_mapping = function() {
	return mode_mapping_apm;
};

MavFlightMode.prototype.mode_mapping_inv = function() {

    var result = {};   // empty object to contain reversed key/value paris
    var keys = Object.keys(mode_mapping_apm);   // first get all keys in an array
    keys.forEach(function(key){
      var val = mode_mapping_apm[key];   // get the value for the current key
      result[val] = key;                 // reverse is done here
    });

	return result;
};

module.exports = MavFlightMode;