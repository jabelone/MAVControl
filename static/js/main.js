let map, icon; //, flightPath;
//let locationHistory = [];
let maxPathHistory = 300;
//let attitude = {roll: 0, pitch: 0, yaw: 0};
//let cs = {location: 0, lat: 0, lng: 0, heading: 0, airspeed: 0, altitude_agl: 0, attitude: attitude, ap_type: null};

let states = [];
let current_vehicle = 0; // only changed by user selection? 

//states[current_vehicle].attitude = {roll: 0, pitch: 0, yaw: 0};
//states[current_vehicle].cs = {location: 0, lat: 0, lng: 0, heading: 0, airspeed: 0, altitude_agl: 0, attitude: states[current_vehicle].attitude, ap_type: null};
//states[current_vehicle].locationHistory = [];
//states[current_vehicle].flightPath = null;

let delay = 10; //milliseconds
let i = 0;
let auto_scroll_messages = true;

// ================== Socket IO init stuff ==================
let namespace = '/MAVControl';
let socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port + namespace);


// ====== Vehicle UI Stuff ======
function updateMapLocation(current_vehicle) {
    states[current_vehicle].locationHistory.unshift([states[current_vehicle].cs.lat, states[current_vehicle].cs.lng]);

    if (states[current_vehicle].locationHistory.length > maxPathHistory) {
        states[current_vehicle].locationHistory.pop();
    }

    // Set our rotation
    states[current_vehicle].planeMarker.setRotationAngle(states[current_vehicle].cs.heading);

    // Set our location
    states[current_vehicle].planeMarker.setLatLng(states[current_vehicle].cs.location);

    // which plane is the center of our focus etc? 
    initial_sysid = document.getElementById("update_connection_settings_sysid").value;
    // if we got nothing, grab the current pseudo-random one ( if we have more than one in-use) and use it..
    if ((initial_sysid == "" ) || (initial_sysid == -1 ) || (initial_sysid == 0 )) { 
        initial_sysid = current_vehicle;
        document.getElementById("update_connection_settings_sysid").value = initial_sysid;
        } 
    if ( current_vehicle == initial_sysid ) { 
        leafletmap.setView(states[current_vehicle].cs.location);
    } 

    // Update flight path
    states[current_vehicle].flightPath.setLatLngs(states[current_vehicle].locationHistory);

}

function updateSYSIDDisplay(sysid) { 

                current_vehicle = document.getElementById("update_connection_settings_sysid").value;

                span = document.getElementById("sysid");
                while( span.firstChild ) {
                    span.removeChild( span.firstChild );
                }
                span.appendChild( document.createTextNode(document.getElementById("update_connection_settings_sysid").value) );
} 

$(document).ready(function () {
    // ====== Page Stuff ======
    $('.modal').modal();
    $('select').material_select();

    // ====== Handle Socket IO Messages ======

    socket.on('HUD', function (message) {
        if ( ! states[message.sysid] ) return; // don't accept this type of data till we know basic state this sysid

        // store airspeed with incoming aircraft
        states[message.sysid].cs.airspeed = parseFloat(message.airspeed).toFixed(2); 
        // display airspeed in HUD of 'current' aircraft ( possibly different):
        document.getElementById('floating-scale-pointer-speed').innerText = String(Math.round(states[current_vehicle].cs.airspeed)) + " m/s";
        // others:
        states[message.sysid].cs.groundspeed = parseFloat(message.groundspeed).toFixed(2);
        //states[message.sysid].cs.heading = parseFloat(message.heading).toFixed(2); skip heading, it's in 'location' packet
        states[message.sysid].cs.throttle = parseFloat(message.throttle).toFixed(2);
        states[message.sysid].cs.climbrate = parseFloat(message.climb).toFixed(2);
        states[message.sysid].cs.ap_type = message.ap_type

    });

    socket.on('do_change_speed', function (speed) {
        //Materialize.toast("Set target speed to " + speed, 3000); // done in actions_tab.js
    });

    socket.on('change_mode', function (mode) {
        Materialize.toast("Set mode to " + mode, 3000);
    });

    socket.on('mode', function (message) {
        if ( ! states[message.sysid] ) return; // don't accept this type of data till we know basic state this sysid

        states[current_vehicle].cs.mode = message.mode;
        document.getElementById('status_mode').innerText = states[current_vehicle].cs.mode;
        document.getElementById('floating-mode-text').innerText = states[current_vehicle].cs.mode;

        states[current_vehicle].cs.vehicle_type = message.vehicle_type;

    })

    socket.on('armed', function (message) {
        if ( ! states[message.sysid] ) return; // don't accept this type of data till we know basic state this sysid

        Materialize.toast('ARMED!!', 2000);
        document.getElementById('floating-armed-text').style.display = "";
        document.getElementById('floating-disarmed-text').style.display = "none";
        setTimeout(function () {
            document.getElementById('floating-armed-text').style.display = "none";
        }, 5000);
    });

    socket.on('disarmed', function (message) {
        if ( ! states[message.sysid] ) return; // don't accept this type of data till we know basic state this sysid

        Materialize.toast('DISARMED!!', 2000);
        document.getElementById('floating-armed-text').style.display = "none";
        document.getElementById('floating-disarmed-text').style.display = "";
        setTimeout(function () {
            document.getElementById('floating-disarmed-text').style.display = "none";
        }, 5000);
    });

    socket.on('ap_type', function (message) {
        if ( ! states[message.sysid] ) return; // don't accept this type of data till we know basic state this sysid

        states[current_vehicle].cs.ap_type = message;
    });

    socket.on('attitude', function (message) {

        if ( states[current_vehicle] ) {
            states[current_vehicle].cs.attitude.pitch = message.pitch;
            states[current_vehicle].cs.attitude.roll = message.roll;
            states[current_vehicle].cs.attitude.yaw = message.yaw;
        }

        // don't update the HUD unless it's for the vehicle we are currently using:
        if ( states[current_vehicle] != message.sysid ) return;

        let hud_roll = -message.roll;
        //let hud_roll = 0;
        let pitch_movement = (message.pitch * 0.426) - 50;

        let movingPanel = document.getElementById('moving-hud-panel');
        let movingBG = document.getElementById('moving-hud-bg');

        movingPanel.style.webkitTransform = 'rotate(' + hud_roll + 'deg)';
        movingPanel.style.mozTransform = 'rotate(' + hud_roll + 'deg)';
        movingPanel.style.msTransform = 'rotate(' + hud_roll + 'deg)';
        movingPanel.style.oTransform = 'rotate(' + hud_roll + 'deg)';
        movingPanel.style.transform = 'rotate(' + hud_roll + 'deg)';
        movingBG.style.transform = 'translateX(-50%) translateY(' + pitch_movement + '%)';
    });

    socket.on('location', function (coord) {
        tmp_current_vehicle = coord.sysid;

        // new and dopesn't exist? create it.
        if ( states[tmp_current_vehicle] == undefined ) { 
            states[tmp_current_vehicle] = [];
        } 

        // set this vehical as the current, unless we already have one:
        if (! current_vehicle) { current_vehicle = tmp_current_vehicle; } 

        // if we don't already have .cs .cs.attitude, .locationHistory, planemarker, etc for this aircraft, create them:
        if  (!( "attitude" in states[tmp_current_vehicle] )){
            states[tmp_current_vehicle].attitude = {roll: 0, pitch: 0, yaw: 0};
        }
        if  (!( "cs" in states[tmp_current_vehicle] )){
            states[tmp_current_vehicle].cs = {location: 0, lat: 0, lng: 0, heading: 0, airspeed: 0, groundspeed: 0, altitude_agl: 0, attitude: states[tmp_current_vehicle].attitude, ap_type: null, throttle: 0, climbrate: 0};
        }
        if  (!( "locationHistory" in states[tmp_current_vehicle] )){
            states[tmp_current_vehicle].locationHistory = [];
        }
        if  (!( "planeMarker" in states[tmp_current_vehicle] )){
            x = tmp_current_vehicle%7; // pick a color from the 7 avail
            states[tmp_current_vehicle].planeMarker = L.marker(defaultMapLocation, {
                icon: iconlist[x], rotationOrigin: "center center",
                title: "id:"+tmp_current_vehicle
                       //+" altagl:"+states[current_vehicle].cs.altitude_agl+
                       //" airspeed:"+states[current_vehicle].cs.airspeed
            }).addTo(leafletmap);
        }

        if (!( "flightPath" in states[tmp_current_vehicle] )){
             states[tmp_current_vehicle].flightPath = L.polyline([], {color: 'red'}).addTo(leafletmap);
        } 
        states[tmp_current_vehicle].cs.heading = coord.heading;
        states[tmp_current_vehicle].cs.lat = coord.lat;
        states[tmp_current_vehicle].cs.lng = coord.lng;
        states[tmp_current_vehicle].cs.location = [coord.lat, coord.lng];

        // handle alt data too:
        states[tmp_current_vehicle].cs.altitude_agl = parseFloat(coord.altitude_agl).toFixed(2);
        document.getElementById('floating-scale-pointer-altitude').innerText = String(Math.round(states[current_vehicle].cs.altitude_agl)) + " m";

        updateMapLocation(coord.sysid);
    });

    // ====== Handle Messages ======
    socket.on('status_text', function (message) {
        $('#messages').append($('<div/>').text(new Date().toLocaleTimeString() + " - (id:" + message.sysid+")"+ message.text).html() + '<br>');
        if (auto_scroll_messages) {
            document.getElementById('messages').scrollTop = 999999;
        }
        special_messages = [];
        if (special_messages.indexOf(message.text) > -1) {

        }
    });

    document.getElementsByName("auto_scroll_toggle")[0].addEventListener('change', function () {
        let is_checked = document.getElementsByName('auto_scroll_toggle')[0].checked;
        if (is_checked) {
            auto_scroll_messages = true;
            document.getElementById('messages').scrollTop = 9999999;
        } else {
            auto_scroll_messages = false;
        }
    });

    document.getElementById("clear_message_btn").addEventListener('click', function () {
        document.getElementById('messages').innerHTML = "";
        Materialize.toast('Messages cleared', 2000);
    });

    // ================== Mavlink Stuff ==================
    socket.on('heartbeat', function (message) {
        document.getElementById("footer-heartbeat").innerText = message;
    });

    // Event handler for new socket io connections.
    socket.on('connect', function () {
        console.log('Connected to backend');
        Materialize.toast('Backend connected', 2000);

        socket.emit('connect', {data: 'I\'m connected to id:'+is});
    });

    // custom reconnect message that includes an initial_sysid from the settings.json
    socket.on('reconnect', function (message) {

        Materialize.toast('Backend REconnected', 2000);

        current_vehicle =  message.initial_sysid; // document.getElementById("update_connection_settings_sysid").value;
        updateSYSIDDisplay(current_vehicle);
        document.getElementById("update_connection_settings_sysid").value = current_vehicle;
        //socket.emit('reconnect', {data: 'I\'m re-connected to id:'+is});
    });


    socket.on('disconnect', function (message) {

        Materialize.toast('Backend DISconnected', 2000);

        //current_vehicle =  message.initial_sysid; // document.getElementById("update_connection_settings_sysid").value;
        //updateSYSIDDisplay(current_vehicle);
        //document.getElementById("update_connection_settings_sysid").value = current_vehicle;
        //socket.emit('reconnect', {data: 'I\'m re-connected to id:'+is});
    });

    // Interval function that tests message latency by sending a "ping"
    // message. The server then responds with a "pong" message and the
    // round trip time is measured.
    let ping_pong_times = [];
    let start_time;
    window.setInterval(function () {
        start_time = (new Date).getTime();
        socket.emit('my_ping');
    }, 1000);

    // Handler for the "pong" message. When the pong is received, the
    // time from the ping is stored, and the average of the last 30
    // samples is average and displayed.
    socket.on('my_pong', function () {
        let latency = (new Date).getTime() - start_time;
        ping_pong_times.push(latency);
        ping_pong_times = ping_pong_times.slice(-5); // keep last 30 samples
        let sum = 0;
        for (let i = 0; i < ping_pong_times.length; i++)
            sum += ping_pong_times[i];
        $('#footer-ping-pong').text(Math.round(10 * sum / ping_pong_times.length) / 10);
        $('#about-ping-pong').text(Math.round(10 * sum / ping_pong_times.length) / 10);
    });

    // When we get a successful message, pop the toast
    socket.on("conn_update_success", function () {
        Materialize.toast('Successfully updated connection settings.', 4000);
    });


    document.getElementById("close_connection_settings").addEventListener("click", function () {

        // different dialog, same idea, but ok of it's invalid as we just assume things:
        let sysid_valid = document.getElementById("update_connection_settings_sysid").checkValidity();

        if  (sysid_valid ==true) { 
                current_vehicle = document.getElementById("update_connection_settings_sysid").value;
                updateSYSIDDisplay(current_vehicle);
        } 
    })

    // Update connection settings emit/receive
    document.getElementById("update_connection_settings").addEventListener("click", function () {
        // Check the values are correct - we're relying on HTML5 validation rules here
        let ip_valid = document.getElementById("update_connection_settings_ip").checkValidity();
        let port_valid = document.getElementById("update_connection_settings_port").checkValidity();

        // different dialog, same idea, but ok of it's invalid as we just assume things:
        let sysid_valid = document.getElementById("update_connection_settings_sysid").checkValidity();

        if  (sysid_valid ==true) { 
                current_vehicle = document.getElementById("update_connection_settings_sysid").value;

                updateSYSIDDisplay(current_vehicle); 

        } 

          // override ip, if not properly given, with the default ip:
         if ((ip_valid == false) && (sysid_valid ==true)) { //  
                ip_valid == true;
                document.getElementById("update_connection_settings_ip").value = "127.0.0.1";
                document.getElementById("update_connection_settings_port").value = "14550";      
         }
  
        if (ip_valid && port_valid) {
            // Pull out the values from the form
            let ip = document.getElementById("update_connection_settings_ip").value;
            let port = document.getElementById("update_connection_settings_port").value;
            let initial_sysid = document.getElementById("update_connection_settings_sysid").value;
            // Send it to the backend
            socket.emit('update_connection_settings', ip, port,initial_sysid);
            $('#modal_conn_settings').modal('close');
        } else {
            Materialize.toast('Unable to save, please check the IP/Port and retry.', 4000) // 4000 is the duration of the toast
        }


        
    });

    $('form#emit').submit(function () {
        socket.emit('my_event', {data: $('#emit_data').val()});
        return false;
    });

    $('form#disconnect').submit(function () {
        socket.emit('disconnect_request');
        return false;
    });


    // Update the status tab twice per second
    function updateStatusTab() {

        if ( states[current_vehicle] ) { 
            document.getElementById('status_airspeed').innerText = String(states[current_vehicle].cs.airspeed);
            document.getElementById('status_altitude').innerText = String(states[current_vehicle].cs.altitude_agl);
            document.getElementById('status_latitude').innerText = String(states[current_vehicle].cs.lat);
            document.getElementById('status_longitude').innerText = String(states[current_vehicle].cs.lng);
            document.getElementById('status_heading').innerText = String(states[current_vehicle].cs.heading);
            document.getElementById('status_pitch').innerText = String(states[current_vehicle].cs.attitude.pitch);
            document.getElementById('status_roll').innerText = String(states[current_vehicle].cs.attitude.roll);
            document.getElementById('status_yaw').innerText = String(states[current_vehicle].cs.attitude.yaw);
            document.getElementById('status_ap_type').innerText = String(states[current_vehicle].cs.ap_type);
        }
        setTimeout(updateStatusTab, 500);

    }

    updateStatusTab();
});
