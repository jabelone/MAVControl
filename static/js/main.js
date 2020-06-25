let map, icon; //, flightPath;

let maxPathHistory = 300;

let states = [];
let current_vehicle = 0; // only changed by user selection, this reflects what's being drawn on-screen in the HUD and which vehicle the action/s button take effect on. etc.
// we'll dynamically keep states[current_vehicle].xxx variables/objects populated on a 
// per-vehicle thing, later including attitude, position, location history, etc

let delay = 10; //milliseconds
let i = 0;
let auto_scroll_messages = true;

// we can do multiple vehicles at a time... 
// the index into this array is a list of incoming sysid and the value is the IP and port that it points to.
sysid_to_ip_address = {};
sysid_to_mavlink_type = {}; // so we know which parser to use when sending.

var mavlinkParser1 =  null; 
var mavlinkParser2 =  null; 
// the in-browser mavlink parser is optional depending on what server backend you are using.
// eg 'node udp_to_ws.js' backend assumes all mavlink is handled in-browser, see MAVLINK and MAVLINKOUT references in code.
// eg 'node mavudp_to_ws_server.js' backend assumes all mavlink is handled by the server and sends JSON type stuff to the browser.

// ================== Socket IO init stuff ==================
let namespace = '/MAVControl';

let socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port + namespace);

//  wrap the socket reciever object 
var _onevent = socket.onevent;
socket.onevent = function (packet) {
    //console.log('[S] On: ', packet);
    //msghandler.emit('packet',packet);

     _onevent.call(socket, packet);

};

// optionally wrap the socket sender object if we are parsing mavlink in-broser...
var _emit = socket.emit;


socket.emit = function () {
        event = arguments[0];

        // the usual internal suspects, just handle them in all cases and move on..
        if (['connect','connect_error','reconnecting','reconnect','reconnect_error','reconnect_attempt','disconnect'].includes(event)){
            _emit.apply(this, arguments);
            return this;
        }

        // these pingy things happen a lot, so don't log them as it's just clutter
        if (event != 'my_ping' && event != 'ping' && event != 'pong' ) {
            console.log('Xsocket._emit ', arguments);
        }


        // after going from parsed packet into raw MAVLINK bytes, we loop around again and then really emit them here as a special case
        if (event == "MAVLINKOUT" ){
            _emit.apply(this, arguments);
            return this;
        }

        // no parser instantiated means we aren't doing it on-browser, so we just send the json msg straight to the server as-is
        if (mavlinkParser1 == null && mavlinkParser2 == null ){
            _emit.apply(this, arguments);
            return this;

        } else { 
        // if we have a in-browser mavlink parser, and the message isn't flagged as MAVLINK
        // then we pass it off to the parser to be converted from json back onto mavlink before letting it go out as MAVLINKOUT above.
            mavlink_outgoing_parser_message_handler(this,arguments);  // see mav-stuff.js
        }
        
};

// ================== MAV init stuff and mav callbacks is mostly in mav-stuff.js  ==================



////////////////////////////////////////////////////////////////////////////////////////////////////

$(document).ready(function () {
    // ====== Page Stuff, using Materialize features like modal and fancy select-drop-downs ======
    $('.modal').modal();

    $('select').material_select();


////////////////////////////////////////////////////////////////////////////////////////////////////
    // ====== Handle Socket IO Messages ======
////////////////////////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////////////////////////
    // this specific MAVLINK message is used when the in-browser mavlink parser is in-use
    // and after parsing, the massage object is passed to the relevant msghandler.on() down below
////////////////////////////////////////////////////////////////////////////////////////////////////

    // this is for the alternative case where there's a nearly raw MAVLINK stream being sent over the websocket by the server ( experimental)
    socket.on('MAVLINK', function (message) {
    // Now we're going to allow these messages to be parsed, and the 
    //  derived data faked in a way that makes them look like they cam in via the websocket
        // for now we'll build both parsers in-browser if we ar ebuilding either.
         if (mavlinkParser1 == null ) {  

            // create the parser
            mavlinkParser1 = new MAVLink10Processor(null, 11,0); 

            // we overwrite the default send() instead of overwriting write() or using setConnection(), which don't know the ip or port info.
            // and we accept ip/port either as part of the mavmsg object, or as a sysid in the OPTIONAL 2nd parameter
            //var origsend = MAVLink10Processor.prototype.send;
            MAVLink10Processor.prototype.send = function(mavmsg,sysid) {
                // this is really just part of the original send()
                buf = mavmsg.pack(this);

                  // where we want the packet to go on the network.. sneak it into the already parsed object that still wraps the raw bytes.
                if (mavmsg.ip == undefined || mavmsg.port == undefined){
                    mavmsg.ip = sysid_to_ip_address[sysid].ip;
                    mavmsg.port = sysid_to_ip_address[sysid].port;
                }
                if (mavmsg.ip == undefined || mavmsg.port == undefined){
                 console.log("unable to determine SEND ip/port from packet or sysid, sorry, discarding. sysid:${sysid}  msg:${mavmsg}");
                 return;
                }

                //this.file.write(buf); // we replace this
                socket.emit('MAVLINKOUT', [buf,mavmsg.ip,mavmsg.port]); // with this..

                // this is really just part of the original send()
                this.seq = (this.seq + 1) % 256;
                this.total_packets_sent +=1;
                this.total_bytes_sent += buf.length;
            }


        }

         if (mavlinkParser2 == null ) {  

            // create the parser
            mavlinkParser2 = new MAVLink20Processor(null, 12,0); 

            // we overwrite the default send() instead of overwriting write() or using setConnection(), which don't know the ip or port info.
            // and we accept ip/port either as part of the mavmsg object, or as a sysid in the OPTIONAL 2nd parameter
            //var origsend = MAVLink10Processor.prototype.send;
            MAVLink20Processor.prototype.send = function(mavmsg,sysid) {
                // this is really just part of the original send()
                buf = mavmsg.pack(this);

                  // where we want the packet to go on the network.. sneak it into the already parsed object that still wraps the raw bytes.
                if (mavmsg.ip == undefined || mavmsg.port == undefined){
                    mavmsg.ip = sysid_to_ip_address[sysid].ip;
                    mavmsg.port = sysid_to_ip_address[sysid].port;
                }
                if (mavmsg.ip == undefined || mavmsg.port == undefined){
                 console.log("unable to determine SEND ip/port from packet or sysid, sorry, discarding. sysid:${sysid}  msg:${mavmsg}");
                 return;
                }

                //this.file.write(buf); // we replace this
                socket.emit('MAVLINKOUT', [buf,mavmsg.ip,mavmsg.port]); // with this..

                // this is really just part of the original send()
                this.seq = (this.seq + 1) % 256;
                this.total_packets_sent +=1;
                this.total_bytes_sent += buf.length;
            }


        }

        // when coming from udp_to_ws.js node server
        // message = [data,sourceip,sourceport]

        //Create a UInt8Array view referring to the buffer
        var array_of_chars = new Uint8Array(message[0]) // from generic ArrayBuffer to specific Uint8Array byte-array-buffer
        // store away the source ip and sorce port for use in mavlink_incoming_parser_message_handler later


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

        //parseBuffer COULD 'emit' messages with the parsed result, because of the 'generic' capture using mavlinkParser1.on(..) above
        // , the packets would trigger a call to mavlink_incoming_parser_message_handler with the result, but no ip/port data would be kept through 
        //   the 'emit()' process. 
        // we instead / ALSO returns the array-of-chars as an array of mavlink packets, possibly 'none', [ p] single packet , or [p,p,p] packets.

        // here's where we store the sorce ip and port with each packet we just made, AFTER the now-useless 'emit' which can't easily do this..
        for (msg of packetlist){  
            mavlink_incoming_parser_message_handler(msg,message[1],message[2],mavlinktype );  // [1] = ip  and [2] = port
        }

    });

////////////////////////////////////////////////////////////////////////////////////////////////////
    // Each of these either come thru the websocket from server 
    //   OR equivalently thru the in-browser mavlink parser, so there 
    //   are 'socket.on' (direct from server) and 'msghandler.on' (direct from parser) for each of them
////////////////////////////////////////////////////////////////////////////////////////////////////

    socket.on('HUD', function (message) {  msghandler.emit('HUD',message); });
    // either socket from server, or parsed mavlink in-browser.
    msghandler.on('HUD', function (message) {
        if ( ! states[message.sysid] ) return; // don't accept this type of data till we know basic state this sysid

        // store airspeed with incoming aircraft
        states[message.sysid].cs.airspeed = parseFloat(message.airspeed).toFixed(2); 
        // display airspeed in HUD of 'current' aircraft ( possibly different):
        document.getElementById('floating-scale-pointer-speed').innerText = String(Math.round(states[current_vehicle].cs.airspeed)) + "m/s";
        // others:
        states[message.sysid].cs.groundspeed = parseFloat(message.groundspeed).toFixed(2);
        //states[message.sysid].cs.heading = parseFloat(message.heading).toFixed(2); skip heading, it's in 'location' packet
        states[message.sysid].cs.throttle = parseFloat(message.throttle).toFixed(2);
        states[message.sysid].cs.climbrate = parseFloat(message.climb).toFixed(2);
        states[message.sysid].cs.ap_type = message.ap_type
    });

    // socket from server
    socket.on('waypoints', function (message) {  msghandler.emit('waypoints',message); });
    // either socket from server, or parsed mavlink in-browser.
    // we get sent a list of waypoints, which we total up, and list in the drop-down "select"
    msghandler.on('waypoints', function (message) {
        var next_id = $("#wp_select");
        //empty it of prior content
        $("select").empty().html(' ');
        // put back "Home" was WP Zero:
        $(next_id).append($("<option></option>").attr("value", 0).text("Home"));
        //message.list should be an array
        $.each(message, function(key, value) {
            $(next_id).append($("<option></option>").attr("value", value.id).text(value.name));
        });
        // re-render the material select box/s on the page.
        $(next_id).material_select();
    });

    // socket from server
    socket.on('do_change_speed', function (message) {  msghandler.emit('do_change_speed',message); });
    // either socket from server, or parsed mavlink in-browser.
    msghandler.on('do_change_speed', function (speed) {
        //Materialize.toast("Set target speed to " + speed, 3000); // done in actions_tab.js
    });

    // socket from server
    socket.on('change_mode', function (message) {  msghandler.emit('change_mode',message); });
    // either socket from server, or parsed mavlink in-browser.
    msghandler.on('change_mode', function (mode) {
        Materialize.toast("Set mode to " + mode, 3000);
    });

    // socket from server
    socket.on('mode', function (message) {  msghandler.emit('mode',message); });
    // either socket from server, or parsed mavlink in-browser.
    msghandler.on('mode', function (message) {
        if ( ! states[message.sysid] ) return; // don't accept this type of data till we know basic state this sysid

        // store data from packet
        states[message.sysid].cs.mode = message.mode; // states already has human-readable mode, so just display it.
        states[message.sysid].cs.vehicle_type = message.vehicle_type;
        // redraw current_vehicle that's onscreen
        document.getElementById('status_mode').innerText = states[current_vehicle].cs.mode;
        document.getElementById('floating-mode-text').innerText = states[current_vehicle].cs.mode;

    })

    // socket from server
    socket.on('armed', function (message) {  msghandler.emit('armed',message); });
    // either socket from server, or parsed mavlink in-browser.
    msghandler.on('armed', function (message) {
    // the JSON-style message recieved here is just true or false as to wether to display [ARMED] in the hud or not.
        // we don't really care which sysid generated it at this point, so there's nothing else needed.
        // so message = true or message = false

        // we are displaying it on-screen in two places... in a toast popup
        Materialize.toast('ARMED!!', 2000);
        // ... and in the HUD as a yellow on-screen bo for a few seconds..
        document.getElementById('floating-armed-text').style.display = "";
        document.getElementById('floating-disarmed-text').style.display = "none";
        setTimeout(function () {
            document.getElementById('floating-armed-text').style.display = "none";
        }, 5000);
    });

    // socket from server
    socket.on('disarmed', function (message) {  msghandler.emit('disarmed',message); });
    // either socket from server, or parsed mavlink in-browser.
    msghandler.on('disarmed', function (message) {
        // message = true or message = false, no sysid in the mesage.
        Materialize.toast('DISARMED!!', 2000);
        document.getElementById('floating-armed-text').style.display = "none";
        document.getElementById('floating-disarmed-text').style.display = "";
        setTimeout(function () {
            document.getElementById('floating-disarmed-text').style.display = "none";
        }, 5000);
    });

    // socket from server
    socket.on('ap_type', function (message) {  msghandler.emit('ap_type',message); });
    // either socket from server, or parsed mavlink in-browser.
    msghandler.on('ap_type', function (message) {
        if ( ! states[message.sysid] ) return; // don't accept this type of data till we know basic state this sysid

        states[current_vehicle].cs.ap_type = message;
    });

    // socket from server
    socket.on('attitude', function (message) {   msghandler.emit('attitude',message);  });
    // either socket from server, or parsed mavlink in-browser.
    msghandler.on('attitude', function (message) {
        var sysid = message.sysid;
        if ( ! states[sysid] ) return;

        // this block assumes data coming into it is degrees, not radians, as degrees matches the JSON format python 
        //  gives, but not the raw mavlink packet, which we may fix in mav-stuff.js before the data gets here.
        states[sysid].cs.attitude.pitch = message.pitch; 
        states[sysid].cs.attitude.roll = message.roll; 
        states[sysid].cs.attitude.yaw = message.yaw; 

        // identify vehicle currently being rendered in browser...         
        let r_sysid = document.getElementById("update_connection_settings_sysid").value;

        // don't update the HUD unless it's for the vehicle we are currently using, exit early.
        if ( r_sysid != message.sysid ) { return;}

        let hud_roll = -states[sysid].cs.attitude.roll;
        //let hud_roll = 0;
        let pitch_movement = (states[sysid].cs.attitude.pitch * 0.426) - 50;

        let movingPanel = document.getElementById('moving-hud-panel');
        let movingBG = document.getElementById('moving-hud-bg');

        movingPanel.style.webkitTransform = 'rotate(' + hud_roll + 'deg)';
        movingPanel.style.mozTransform = 'rotate(' + hud_roll + 'deg)';
        movingPanel.style.msTransform = 'rotate(' + hud_roll + 'deg)';
        movingPanel.style.oTransform = 'rotate(' + hud_roll + 'deg)';
        movingPanel.style.transform = 'rotate(' + hud_roll + 'deg)';
        movingBG.style.transform = 'translateX(-50%) translateY(' + pitch_movement + '%)';
    });

    // socket from server
    socket.on('location', function (message) {   msghandler.emit('location',message); });
    // either socket from server, or parsed mavlink in-browser.
    msghandler.on('location', function (message) {

        // new vehicle sysid and doesn't exist in the 'states' variable create the sub-objects and 0-fill them.
        // what this means is that with a new vehicle, until we get a 'location' call to here, any packet/s for 
        //  the new vehicle are thrown away by the other handler/s. 
        if ( states[message.sysid] == undefined ) { 
            states[message.sysid] = [];
            console.log('got first location for sysid'+message.sysid);

            // a few parts of the gui need a list of sysid/s.. give them all 
            gui_register_new_sysids(Object.keys(states)); 
        } 

        // set this vehical as the current, unless we already have one, so note that the below code does not
        //   rely on 'current_vehicle' to be equal to the incoming 'message.sysid', which is better data.
        if (! current_vehicle) { current_vehicle = message.sysid; } 

        // if we don't already have .cs .cs.attitude, .locationHistory, planemarker, etc for this aircraft, create them, empty:
        if  (!( "attitude" in states[message.sysid] )){
            states[message.sysid].attitude = {roll: 0, pitch: 0, yaw: 0};
        }
        if  (!( "cs" in states[message.sysid] )){
            states[message.sysid].cs = {location: 0, lat: 0, lng: 0, heading: 0, airspeed: 0, groundspeed: 0, altitude_agl: 0, attitude: states[message.sysid].attitude, ap_type: null, throttle: 0, climbrate: 0};
        }
        if  (!( "locationHistory" in states[message.sysid] )){
            states[message.sysid].locationHistory = [];
        }

        // handle alt data from the incoming packet now, store it in the states[] area:
        states[message.sysid].cs.altitude_agl = parseFloat(message.altitude_agl).toFixed(2);


        // create an initial marker with very little going on, in a default place.
        if  (!( "planeMarker" in states[message.sysid] )){
            x = message.sysid%7; // pick a color from the 7 avail
            states[message.sysid].planeMarker = L.marker(defaultMapLocation, {
                icon: iconlist[x], rotationOrigin: "center center",
                title: "id:"+message.sysid //minimal mouse-over to start with, updated later elsewhere
            }).addTo(leafletmap);
        }
        // create an empty polygon for the flightpath to be filled later..
        if (!( "flightPath" in states[message.sysid] )){
             states[message.sysid].flightPath = L.polyline([], {color: 'red'}).addTo(leafletmap);
        } 

        // now actually handle this message.. store the values into the states[] 
        states[message.sysid].cs.heading = message.heading;
        states[message.sysid].cs.lat = message.lat;
        states[message.sysid].cs.lng = message.lng;
        states[message.sysid].cs.location = [message.lat, message.lng];

        // display it is the last thing we do, noting that right now we explicity re-draw this data on every packet even if its not the 
        // HUD currently being displayed ( which is whatever current_vehicle is set to )
        document.getElementById('floating-scale-pointer-altitude').innerText = String(Math.round(states[current_vehicle].cs.altitude_agl)) + "m";
        updateMapLocation(message.sysid);
    });


    // socket from server
    socket.on('status_text', function (message) {  msghandler.emit('status_text',message); });
    // either socket from server, or parsed mavlink in-browser.
    msghandler.on('status_text', function (message) {
        $('#messages').append($('<div/>').text(new Date().toLocaleTimeString() + " - (id:" + message.sysid+")"+ message.text).html() + '<br>');
        if (auto_scroll_messages) {
            document.getElementById('messages').scrollTop = 999999;
        }
        special_messages = [];
        if (special_messages.indexOf(message.text) > -1) {

        }
    });

    // socket from server
    socket.on('heartbeat', function (message) {  msghandler.emit('heartbeat',message); });
    // either socket from server, or parsed mavlink in-browser.
    msghandler.on('heartbeat', function (message) {
        document.getElementById("footer-heartbeat").innerText = message;
    });



////////////////////////////////////////////////////////////////////////////////////////////////////
    // these 'connect' 'reconnect' 'disconnect' etc events are socket-only, no need for 'msghandler' equivalents
////////////////////////////////////////////////////////////////////////////////////////////////////

    // Event handler for new socket io connections.
    socket.on('connect', function () {
        console.log('Connected to backend');
        //Materialize.toast('Backend connected', 2000);

        //socket.emit('connect', {data: 'I\'m connected'});
    });

    // custom reconnect message that includes an initial_sysid from the settings.json
    socket.on('reconnect', function (message) {

        Materialize.toast('Backend REconnected', 2000);

        current_vehicle =  message.initial_sysid; // document.getElementById("update_connection_settings_sysid").value;
        updateSYSIDDisplay(current_vehicle);
        document.getElementById("update_connection_settings_sysid").value = current_vehicle;
        //socket.emit('reconnect', {data: 'I\'m re-connected to id:'+is});

        
    });

    // custom reconnect message that includes an initial_sysid from the settings.json
    socket.on('reconnecting', function (message) {

        Materialize.toast('Backend disconnected....trying...', 2000);
        
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

////////////////////////////////////////////////////////////////////////////////////////////////////
    // ====== Vehicle UI Stuff ======
////////////////////////////////////////////////////////////////////////////////////////////////////


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


    // three-par popup menu that's only on phones, works on narrow pc screens, but not my galaxy.... todo.
    // see more here: https://materializecss.com/modals.html
    document.getElementById("phonemenu").addEventListener("click", function () {
        $('#modal_conn_settings').modal('open');
    })
 
    // define this function in the global scope for calling from the onclick() below.
     dropdown1_clicked = function (i){
        document.getElementById("update_connection_settings_sysid").value = i; // inside the 'connection settings' dialog box
        document.getElementById("sysid").innerHTML = i; // displayed on the 'sysid' span on the 'aircraft id:' button 
        current_vehicle = i; // save it to the global we use too in places.
    }

    function gui_register_new_sysids(sysid_list){
        // populate 'dropdown1' in top-right of screen
        var h = '';  
        for (i of sysid_list) {
                h = h.concat('<li><a href="#!" onclick="dropdown1_clicked(',i,')">SysId:',i,'</a></li>');

        }
        document.getElementById('dropdown1').innerHTML = h;  

        // todo any other places the gui needs to display a list of sysids, or per-vehicle things ?
    }

    function updateMapLocation(current_vehicle) {
        states[current_vehicle].locationHistory.unshift([states[current_vehicle].cs.lat, states[current_vehicle].cs.lng]);

        if (states[current_vehicle].locationHistory.length > maxPathHistory) {
            states[current_vehicle].locationHistory.pop();
        }

        // Set our rotation
        states[current_vehicle].planeMarker.setRotationAngle(states[current_vehicle].cs.heading);

        // Set our location
        states[current_vehicle].planeMarker.setLatLng(states[current_vehicle].cs.location);

        //  update the little bubble of text on the on-mouse-over of the planemarker.
        states[current_vehicle].planeMarker.options.title = 
                        String(Math.round(states[current_vehicle].cs.altitude_agl))+"m | "
                      +String(Math.round(states[current_vehicle].cs.airspeed))+"m/s | id: "+current_vehicle;
        // a remove-and-add is required to get the options.title to re-render the planemarker
        states[current_vehicle].planeMarker.remove();
        states[current_vehicle].planeMarker.addTo(leafletmap);

        // which plane is the center of our focus etc? 
        initial_sysid = document.getElementById("update_connection_settings_sysid").value;
        // if we got nothing, grab the current pseudo-random one ( if we have more than one in-use) and use it..
        if ((initial_sysid == "" ) || (initial_sysid == -1 ) || (initial_sysid == 0 )) { 
            initial_sysid = current_vehicle;
            document.getElementById("update_connection_settings_sysid").value = initial_sysid;
            document.getElementById("sysid").innerHTML = initial_sysid;
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



////////////////////////////////////////////////////////////////////////////////////////////////////

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
