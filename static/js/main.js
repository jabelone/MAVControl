let map, icon, flightPath;
let locationHistory = [];
let maxPathHistory = 300;
let attitude = {roll: 0, pitch: 0, yaw: 0};
let cs = {location: 0, lat: 0, lng: 0, heading: 0, airspeed: 0, altitude_agl: 0, attitude: attitude, ap_type: null};

let delay = 10; //milliseconds
let i = 0;
let auto_scroll_messages = true;

// TODO: these should probably be retreive from an env variable
Cesium.BingMapsApi.defaultKey = 'AuH6cuhWnxa9_mROL0JkjUikRyvmWlrGSOB0zGmoq_pVGOu2GGkOMbGMgSxsded5';
Cesium.MapboxApi.defaultAccessToken = 'pk.eyJ1IjoiamFiZWxvbmUiLCJhIjoiY2pmM2NiczNuMGtwaTJ4cGRoOHhlZHJ0YiJ9.Jf4p2BNYSmriWE5YMNZjPg';
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3ZDgzNGIzYy1jOTFiLTQ4ZTYtOGRmYy1mYzIzZDRjM2I1Y2MiLCJpZCI6MzE4MCwiaWF0IjoxNTM2MjM4NjAwfQ.FggWP7EQBZVPEEmgvXnUvplyJ5JCNGRWqfhUIDSujuY';


// Functions to adapt screen space error and memory use to the device
let isMobile = {
    Android: function () {
        return navigator.userAgent.match(/Android/i);
    },
    BlackBerry: function () {
        return navigator.userAgent.match(/BlackBerry/i);
    },
    iOS: function () {
        return navigator.userAgent.match(/iPhone|iPad|iPod/i);
    },
    Opera: function () {
        return navigator.userAgent.match(/Opera Mini/i);
    },
    Windows: function () {
        return navigator.userAgent.match(/IEMobile/i);
    },
    any: function () {
        return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
    }
};

// Construct the main Cesium viewer with default options
let viewer = new Cesium.Viewer('cesiumContainer', {
    timeline: false, // disable the timeline feature
    animation: false, // disable time animations
    vrButton: true, // enable the VR button
    sceneModePicker: false, // disable the scene mode picker
    infoBox: false, // disable the info box
    scene3DOnly: true, // lock the viewer to 3D only
    shadows: !enableShadows, // set default shadows behaviour
    projectionPicker: false, // disable the projection picker
    baseLayerPicker: false, // disable the base layer picker
    geocoder: false, // disable the search box
});

viewer.scene.globe.depthTestAgainstTerrain = false; // No depth testing against the terrain


// ================== Socket IO init stuff ==================
let namespace = '/MAVControl';
let socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port + namespace);


// ====== Vehicle UI Stuff ======
function updateMapLocation() {
    locationHistory.unshift([cs.lat, cs.lng]);

    if (locationHistory.length > maxPathHistory) {
        locationHistory.pop();
    }

    // Set our rotation
    // planeMarker.setRotationAngle(cs.heading);

    // Set our location
    // planeMarker.setLatLng(cs.location);
    // leafletmap.setView(cs.location);

    // Update flight path
    // flightPath.setLatLngs(locationHistory);

}

$(document).ready(function () {
    // ====== Page Stuff ======
    $('.modal').modal();
    $('select').material_select();

    // ====== Handle Socket IO Messages ======
    socket.on('airspeed', function (message) {
        cs.airspeed = parseFloat(message).toFixed(2);
        document.getElementById('floating-scale-pointer-speed').innerText = String(Math.round(cs.airspeed)) + " m/s";
    });

    socket.on('do_change_speed', function (speed) {
        Materialize.toast("Set target speed to " + speed, 3000);
    });

    socket.on('change_mode', function (mode) {
        Materialize.toast("Set mode to " + mode, 3000);
    });

    socket.on('altitude_agl', function (message) {
        cs.altitude_agl = parseFloat(message).toFixed(2);
        document.getElementById('floating-scale-pointer-altitude').innerText = String(Math.round(cs.altitude_agl)) + " m";
    });

    socket.on('mode', function (message) {
        cs.mode = message;
        document.getElementById('status_mode').innerText = cs.mode;
        document.getElementById('floating-mode-text').innerText = cs.mode;
    })

    socket.on('armed', function (message) {
        Materialize.toast('ARMED!!', 2000);
        document.getElementById('floating-armed-text').style.display = "";
        document.getElementById('floating-disarmed-text').style.display = "none";
        setTimeout(function () {
            document.getElementById('floating-armed-text').style.display = "none";
        }, 5000);
    });

    socket.on('disarmed', function (message) {
        Materialize.toast('DISARMED!!', 2000);
        document.getElementById('floating-armed-text').style.display = "none";
        document.getElementById('floating-disarmed-text').style.display = "";
        setTimeout(function () {
            document.getElementById('floating-disarmed-text').style.display = "none";
        }, 5000);
    });

    socket.on('ap_type', function (message) {
        cs.ap_type = message;
    });

    socket.on('attitude', function (message) {
        cs.attitude.pitch = message.pitch;
        cs.attitude.roll = message.roll;
        cs.attitude.yaw = message.yaw;
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
        cs.heading = coord.heading;
        cs.lat = coord.lat;
        cs.lng = coord.lng;
        cs.location = [coord.lat, coord.lng];
        // updateMapLocation();
    });

    // ====== Handle Messages ======
    socket.on('status_text', function (message) {
        $('#messages').append($('<div/>').text(new Date().toLocaleTimeString() + " - " + message.text).html() + '<br>');
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
        socket.emit('my_event', {data: 'I\'m connected!'});
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

    // Update connection settings emit/receive
    document.getElementById("update_connection_settings").addEventListener("click", function () {
        // Check the values are correct - we're relying on HTML5 validation rules here
        let ip_valid = document.getElementById("update_connection_settings_ip").checkValidity();
        let port_valid = document.getElementById("update_connection_settings_port").checkValidity();

        if (ip_valid && port_valid) {
            // Pull out the values from the form
            let ip = document.getElementById("update_connection_settings_ip").value;
            let port = document.getElementById("update_connection_settings_port").value;
            // Send it to the backend
            socket.emit('update_connection_settings', ip, port);
            $('#modal_conn_settings').modal('close');
        } else {
            Materialize.toast('Unable to save, please check the IP/Port.', 4000) // 4000 is the duration of the toast
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
        document.getElementById('status_airspeed').innerText = String(cs.airspeed);
        document.getElementById('status_altitude').innerText = String(cs.altitude_agl);
        document.getElementById('status_latitude').innerText = String(cs.lat);
        document.getElementById('status_longitude').innerText = String(cs.lng);
        document.getElementById('status_heading').innerText = String(cs.heading);
        document.getElementById('status_pitch').innerText = String(cs.attitude.pitch);
        document.getElementById('status_roll').innerText = String(cs.attitude.roll);
        document.getElementById('status_yaw').innerText = String(cs.attitude.yaw);
        document.getElementById('status_ap_type').innerText = String(cs.ap_type);
        setTimeout(updateStatusTab, 500);
    }

    updateStatusTab();
});