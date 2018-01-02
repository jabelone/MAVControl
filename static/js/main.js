var mapsLoaded = false;
var map, marker, icon, flightPath, deltaLat, deltaLng;
var locationHistory = [];
var defaultLocation = {lat: -27.506537, lng: 153.023248};
var maxPathHistory = 200;
var cs = {lat: 0, lng: 0, heading: 0};

var numDeltas = 100;
var delay = 10; //milliseconds
var i = 0;


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
    var currentLocation = new google.maps.LatLng(locationHistory[0].lat, locationHistory[0].lng);
    //marker.setPosition(currentLocation);
    map.setCenter(currentLocation);
    if (i !== numDeltas) {
        i++;
        setTimeout(moveMarker, delay);
    }

    var rotate = cs.heading;
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
            var prevLocation = {lat: marker.getPosition().lat(), lng: marker.getPosition().lng()};
            var currentLocation = new google.maps.LatLng(lat, lng);
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
        var namespace = '/MAVControl';
        var socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port + namespace);


        // ====== Page Stuff ======
        $('.modal').modal();


        // ====== Vehicle UI Stuff ======
        socket.on('location', function (coord) {
            updateMapLocation(coord.lat, coord.lng, coord.heading);
            cs.heading = coord.heading;
            cs.lat = coord.lat;
            cs.lng = coord.lng;
        });


        updateMapLocation(-25.363882, 131.044922);

        // ================== Mavlink Stuff ==================
        socket.on('heartbeat', function (message) {
            document.getElementById("footer-heartbeat").innerText = message;
        });

        // Event handler for new connections.
        // The callback function is invoked when a connection with the
        // server is established.
        socket.on('connect', function () {
            console.log('Connected to backend');
            Materialize.toast('Backend connected', 2000);
            socket.emit('my_event', {data: 'I\'m connected!'});
        });

        // Event handler for server sent data.
        // The callback function is invoked whenever the server emits data
        // to the client. The data is then displayed in the "Received"
        // section of the page.
        socket.on('my_response', function (msg) {
            $('#log').html('<br>' + $('<div/>').text('Received : ' + msg.data).html());
        });

        // Interval function that tests message latency by sending a "ping"
        // message. The server then responds with a "pong" message and the
        // round trip time is measured.
        var ping_pong_times = [];
        var start_time;
        window.setInterval(function () {
            start_time = (new Date).getTime();
            socket.emit('my_ping');
        }, 1000);

        // Handler for the "pong" message. When the pong is received, the
        // time from the ping is stored, and the average of the last 30
        // samples is average and displayed.
        socket.on('my_pong', function () {
            var latency = (new Date).getTime() - start_time;
            ping_pong_times.push(latency);
            ping_pong_times = ping_pong_times.slice(-30); // keep last 30 samples
            var sum = 0;
            for (var i = 0; i < ping_pong_times.length; i++)
                sum += ping_pong_times[i];
            $('#footer-ping-pong').text(Math.round(10 * sum / ping_pong_times.length) / 10);
            $('#about-ping-pong').text(Math.round(10 * sum / ping_pong_times.length) / 10);
        });

        // Handlers for the different forms in the page.
        // These accept data from the user and send it to the server in a
        // variety of ways

        // When we get a successful message, pop the toast
        socket.on("conn_update_success", function () {
            Materialize.toast('Successfully updated connection settings.', 4000);
        });

        // Update connection settings emit/receive
        document.getElementById("update_connection_settings").addEventListener("click", function () {
            // Check the values are correct - we're relying on HTML5 validation rules here
            var ip_valid = document.getElementById("update_connection_settings_ip").checkValidity();
            var port_valid = document.getElementById("update_connection_settings_port").checkValidity();

            if (ip_valid && port_valid) {
                // Pull out the values from the form
                var ip = document.getElementById("update_connection_settings_ip").value;
                var port = document.getElementById("update_connection_settings_port").value;
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