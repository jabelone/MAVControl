// ====== Actions Tab Stuff ======

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
                return undefined;
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
                console.log("vehicle does not identify as MAVlINK1 or mAVLINK2, assuming server-side-parser.");
                return undefined;
        }
}

$(document).ready(function () {
    // Do Action
    document.getElementById("do_action").addEventListener('click', function () {
        let action = document.getElementById("actions_select").value;
        // TODO implement sending mavlink packet for action
        Materialize.toast('Did ' + action, 2000);
    }, false);

    // Set Next WayPoint number WP that we will fly to.
    document.getElementById("set_wp").addEventListener('click', function () {
        let sysid = document.getElementById("update_connection_settings_sysid").value; 
        let wp = document.getElementById("wp_select").value;        
        socket.emit('set_wp', sysid, wp);
        Materialize.toast('Set WP to ' + wp, 2000);
    }, false);

    // this is for mode-change requests coming from the user, not for displaying the current mode the aircraft thinks its in.
    function set_and_display_mode(mode) { 
        let sysid = document.getElementById("update_connection_settings_sysid").value;
        var m = decide_which_mavlink_obj_and_return_it(sysid);  
        var mavtype = 'server-side';// for console.log display only.
        if ( m == undefined ) {
            socket.emit('do_change_mode', sysid, mode);
        } else { 
            var mp = decide_which_mavlink_parser_and_return_it(sysid);

            mavtype = sysid_to_mavlink_type[sysid]; // 1 or 2, for console.log purposes only
            var _mode_mapping_inv = mode_mapping_inv(); // comes from mav-stuff.js
            var mode = mode.toUpperCase();
            var modenum = _mode_mapping_inv[mode];
            var target_system = sysid; 
            /* base_mode = 217, */ 
            var custom_mode = modenum; 

            var set_mode_message = new m.messages.set_mode(target_system, mavlink10.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED, custom_mode); 
            // finally this causes the parser to call our custom send() and actually emit() them out the websocket, not done here.
            mp.send(set_mode_message,sysid);  // by passing the 2nd param, sysid here, send() can determine which ip/port to send to as 
        }
        console.log(`do_change_mode sysid: ${sysid} to mode: ${mode} and mavlink type: ${mavtype}`);  
        Materialize.toast('Set MODE to ' + mode, 2000);
    } 
    // Set Mode from drop-down list
    document.getElementById("set_mode").addEventListener('click', function () {
        let mode = document.getElementById("mode_select").value;
        set_and_display_mode(mode);
    }, false);

    // set mode with Auto Mode Button
    document.getElementById("auto_button").addEventListener('click', function () {
        mode = "Auto";
        document.getElementById("mode_select").value = mode; // updates other drop-down to also say the mode.
        set_and_display_mode(mode);
    }, false);

    // set mode with RTL Mode Button
    document.getElementById("rtl_button").addEventListener('click', function () {
        mode = "RTL";
        set_and_display_mode(mode);
    }, false);

    // Loiter Mode Button
    document.getElementById("loiter_button").addEventListener('click', function () {
        mode = "Loiter";
        set_and_display_mode(mode);
    }, false);

    // Arm Button
    document.getElementById("arm_button").addEventListener('click', function () {
        let sysid = document.getElementById("update_connection_settings_sysid").value;
        var m = decide_which_mavlink_obj_and_return_it(sysid);  
        if ( m == undefined ) {
            socket.emit('arm', sysid); 
        } else { 
            var mp = decide_which_mavlink_parser_and_return_it(sysid);

            var target_system = sysid, target_component = 0, command = m.MAV_CMD_COMPONENT_ARM_DISARM, confirmation = 0, 
                param1 = 1, param2 = 0, param3 = 0, param4 = 0, param5 = 0, param6 = 0, param7 = 0;
            // param1 is 1 to indicate arm
            var command_long = new m.messages.command_long(target_system, target_component, command, confirmation, 
                                                             param1, param2, param3, param4, param5, param6, param7)

            mp.send(command_long,sysid);
        }
        console.log("arm sysid:"+sysid);
        Materialize.toast("Trying to ARM sysid:"+sysid, 2000); // after vehicle confirms it, it'l have really happened
    }, false);

    // Disarm Button
    document.getElementById("disarm_button").addEventListener('click', function () {
        let sysid = document.getElementById("update_connection_settings_sysid").value;
        var m = decide_which_mavlink_obj_and_return_it(sysid);  
        if ( m == undefined ) {
            socket.emit('disarm', sysid); 
        } else { 
            var mp = decide_which_mavlink_parser_and_return_it(sysid);

            var target_system = sysid, target_component = 0, command = m.MAV_CMD_COMPONENT_ARM_DISARM, confirmation = 0, 
                param1 = 0, param2 = 0, param3 = 0, param4 = 0, param5 = 0, param6 = 0, param7 = 0;
            // param1 is 0 to indicate disarm
            var command_long = new m.messages.command_long(target_system, target_component, command, confirmation, 
                                                             param1, param2, param3, param4, param5, param6, param7)

            mp.send(command_long,sysid);
        }
        console.log("disarm sysid:"+sysid);
        Materialize.toast("Trying to DISARM sysid:"+sysid, 2000); // after vehicle confirms it, it'l have really happened
    }, false);

    // Set Airspeed
    document.getElementById("change_speed_button").addEventListener('click', function () {
        let speed = document.getElementById("change_speed_value").value;
        let sysid = document.getElementById("update_connection_settings_sysid").value;                              
        var m = decide_which_mavlink_obj_and_return_it(sysid);  
        if ( m == undefined ) {
            socket.emit('do_change_speed', sysid, "airspeed", speed, "-1"); //sysid,speed_type, speed, throttle
        } else {
            var mp = decide_which_mavlink_parser_and_return_it(sysid);

            var speed_type = "airspeed"; // todo don't assume this
            var throttle = "-1";

            if (speed_type == "airspeed")
                _speed_type = 0;
            else if (speed_type == "groundspeed")
                _speed_type = 1;

            var target_system = sysid, target_component = 0, command = m.MAV_CMD_DO_CHANGE_SPEED, confirmation = 0, 
                param1 = float(_speed_type), param2 = float(speed), param3 = float(throttle), 
                // param4 is absolute or relative [0,1]
                param4 = 0, 
                param5 = 0, param6 = 0, param7 = 0;
            var command_long = new m.messages.command_long(target_system, target_component, command, confirmation, 
                                                             param1, param2, param3, param4, param5, param6, param7)
            mp.send(command_long,sysid);
        }
        console.log(`do_change_speed sysid: ${sysid} to speed: ${speed}`);
        Materialize.toast("Set target airspeed to " + speed, 3000);
    }, false);

    // Set Altitude
    document.getElementById("change_altitude_button").addEventListener('click', function () {
        let altitude = document.getElementById("change_altitude_value").value;
        let sysid = document.getElementById("update_connection_settings_sysid").value; 
        var m = decide_which_mavlink_obj_and_return_it(sysid);  
        if ( m == undefined ) {
            socket.emit('do_change_altitude', sysid, altitude);
        } else {
            var mp = decide_which_mavlink_parser_and_return_it(sysid);

            var target_system = sysid, target_component = 0, command = m.MAV_CMD_DO_CHANGE_ALTITUDE, confirmation = 0, 
                // param2 = 3  means MAV_FRAME_GLOBAL_RELATIVE_ALT, see https://mavlink.io/en/messages/common.html#MAV_FRAME
                param1 = float(altitude), param2 = 3, param3 = 0, param4 = 0, param5 = 0, param6 = 0, param7 = 0;
            var command_long = new m.messages.command_long(target_system, target_component, command, confirmation, 
                                                             param1, param2, param3, param4, param5, param6, param7)
            mp.send(command_long,sysid);
        }
        console.log(`do_change_altitude sysid: ${sysid} to alt: ${altitude}`);
        Materialize.toast("Set target altitude to " + altitude, 3000);
    }, false);

    // Set Loiter Radius
    document.getElementById("loiter_radius_button").addEventListener('click', function () {
        let radius = document.getElementById("loiter_radius_value").value;
        // TODO implement sending mavlink packet for set loiter radius
        Materialize.toast("Set loiter radius to " + radius, 3000);
    }, false);
});
