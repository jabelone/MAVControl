let mapsLoaded = false;
let map, marker, icon, flightPath, deltaLat, deltaLng;
let locationHistory = [];
let defaultLocation = {lat: -27.506537, lng: 153.023248};
let maxPathHistory = 200;
let cs = {lat: 0, lng: 0, heading: 0};

let numDeltas = 100;
let delay = 10; //milliseconds
let i = 0;
let auto_scroll_messages = true;


function initMap() {
    mapsLoaded = true;

    icon = {
        url: "/static/img/plane.png",
        scaledSize: new google.maps.Size(100, 100), // scaled size
        anchor: new google.maps.Point(50, 50) // anchor
    };

    marker = new google.maps.Marker({
        position: defaultLocation,
        title: "Current Vehicle Location",
        icon: icon,
        optimized: false
    });

    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 17,
        streetViewControl: false,
        center: defaultLocation
    });

    flightPath = new google.maps.Polyline({
        path: locationHistory,
        geodesic: true,
        strokeColor: '#d32f2f',
        strokeOpacity: 1.0,
        strokeWeight: 2
    });
    flightPath.setMap(map);
    marker.setMap(map);
}

function moveMarker() {
    locationHistory[0].lat += deltaLat;
    locationHistory[0].lng += deltaLng;
    let currentLocation = new google.maps.LatLng(locationHistory[0].lat, locationHistory[0].lng);
    //marker.setPosition(currentLocation);
    map.setCenter(currentLocation);
    if (i !== numDeltas) {
        i++;
        setTimeout(moveMarker, delay);
    }

    let rotate = cs.heading;
    $('img[src="/static/img/plane.png"]').css(
        {
            '-webkit-transform': 'rotate(' + rotate + 'deg)',
            '-moz-transform': 'rotate(' + rotate + 'deg)',
            '-ms-transform': 'rotate(' + rotate + 'deg)',
            'transform': 'rotate(' + rotate + 'deg)'
        });
}

function transition(lat, lng) {
    i = 0;
    deltaLat = (lat - locationHistory[0].lat) / numDeltas;
    deltaLng = (lng - locationHistory[0].lng) / numDeltas;
    moveMarker();
}

// ====== Vehicle UI Stuff ======
function updateMapLocation(lat, lng, heading) {
    if (mapsLoaded) {
        let prevLocation = {lat: marker.getPosition().lat(), lng: marker.getPosition().lng()};
        let currentLocation = new google.maps.LatLng(lat, lng);
        locationHistory.unshift(prevLocation);
        if (locationHistory.length > maxPathHistory) {
            locationHistory.pop();
        }

        // Draw our flightpath
        flightPath.setPath(locationHistory);

        // Set our rotation
        icon.rotation = Math.round(heading);
        marker.setPosition(currentLocation);

        // Update our marker location
        transition(lat, lng);
        //map.setCenter(currentLocation);

    } else {
        Materialize.toast("Can't update map! Google Maps API not loaded.", 4000);

    }
}

$(document).ready(function () {
    // ================== Socket IO init stuff ==================
    let namespace = '/MAVControl';
    let socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port + namespace);


    // ====== Page Stuff ======
    $('.modal').modal();
    $('select').material_select();

    // ====== Servo Tab Stuff ======
    let servo_toggle = document.getElementsByClassName("servo_toggle");
    for (let i = 0; i < servo_toggle.length; i++) {
        servo_toggle[i].addEventListener('click', function () {
            let servo_toggled = $(this).data("servo_number");
            Materialize.toast('Servo ' + servo_toggled + " toggled", 2000);
        }, false);
    }

    for (let i = 5; i < 15; i++) {
        let number = i;
        let servo_row = `<div data-servo_number="${number}" class="servo_row row">
                            <div class="valign-wrapper col s12 m4 l2">
                                <h6>Servo ${number}</h6>
                            </div>
                            <div class="col s12 m4 l2">
                                <a data-servo_number="${number}" class="low_servo waves-effect blue waves-light btn">
                                    Low
                                </a>
                            </div>
                            <div class="col s12 m4 l2">
                                <a data-servo_number="${number}" class="high_servo waves-effect blue waves-light btn">
                                    High
                                </a>
                            </div>
                            <div class="col s12 m4 l3">
                                <div class="input-field">
                                    <input id="low_servo_value" placeholder="1000 us" data-servo_number="${number}"
                                           type="number" min="800" max="2200" step="10" class="validate">
                                </div>
                            </div>
                            <div class="col s12 m4 l3">
                                <div class="input-field">
                                    <input id="high_servo_value" placeholder="2000 us" data-servo_number="${number}"
                                           type="number" min="800" max="2200" step="10" class="validate">
                                </div>
                            </div>
                        </div>`;
        document.getElementById("servo_tab").insertAdjacentHTML('beforeend', servo_row);
    }

    // ====== Servo High Buttons ======
    let servo_high = document.getElementsByClassName("high_servo");
    for (let i = 0; i < servo_high.length; i++) {
        servo_high[i].addEventListener('click', function () {
            let servo_toggled = $(this).data("servo_number");
            Materialize.toast('Servo ' + servo_toggled + " high", 2000);
        }, false);
    }

    // ====== Servo Low Buttons ======
    let servo_low = document.getElementsByClassName("low_servo");
    for (let i = 0; i < servo_low.length; i++) {
        servo_low[i].addEventListener('click', function () {
            let servo_toggled = $(this).data("servo_number");
            Materialize.toast('Servo ' + servo_toggled + " low", 2000);
        }, false);
    }


    // ====== Handle Socket IO Messages ======
    socket.on('location', function (coord) {
        updateMapLocation(coord.lat, coord.lng, coord.heading);
        cs.heading = coord.heading;
        cs.lat = coord.lat;
        cs.lng = coord.lng;
    });

    // ====== Handle Messages ======
    socket.on('status_text', function (message) {
        $('#messages').append($('<div/>').text(message.text).html() + '<br>');
        if (auto_scroll_messages) {
            document.getElementById('messages').scrollTop = 999999;
        }
    });

    document.getElementsByName("auto_scroll_toggle")[0].addEventListener('change', function (thing) {
        let is_checked = document.getElementsByName('auto_scroll_toggle')[0].checked;
        console.log("Auto scroll messages: " + is_checked);
        if (is_checked) {
            auto_scroll_messages = true;
            document.getElementById('messages').scrollTop = 999999;
        } else {
            auto_scroll_messages = false;
        }
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
});