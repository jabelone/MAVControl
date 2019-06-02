// ====== Actions Tab Stuff ======

$(document).ready(function () {
    // Do Action
    document.getElementById("do_action").addEventListener('click', function () {
        let action = document.getElementById("actions_select").value;
        // TODO implement sending mavlink packet for action
        Materialize.toast('Did ' + action, 2000);
    }, false);

    // Do Action
    document.getElementById("set_wp").addEventListener('click', function () {
        let wp = document.getElementById("wp_select").value;
        // TODO implement sending mavlink packet for wp
        Materialize.toast('Set WP to ' + wp, 2000);
    }, false);

    // Set Mode
    document.getElementById("set_mode").addEventListener('click', function () {
        let mode = document.getElementById("mode_select").value;
        // TODO implement sending mavlink packet for set mode
    }, false);

    // Auto Mode Button
    document.getElementById("auto_button").addEventListener('click', function () {
        // TODO implement sending mavlink packet for auto mode
    }, false);

    // RTL Mode Button
    document.getElementById("rtl_button").addEventListener('click', function () {
        // TODO implement sending mavlink packet for rtl mode
    }, false);

    // Loiter Mode Button
    document.getElementById("loiter_button").addEventListener('click', function () {
        // TODO implement sending mavlink packet for loiter mode
    }, false);

    // Arm Button
    document.getElementById("arm_button").addEventListener('click', function () {
        socket.emit('arm');
    }, false);

    // Disarm Button
    document.getElementById("disarm_button").addEventListener('click', function () {
        socket.emit('disarm');
    }, false);

    // Set Airspeed
    document.getElementById("change_speed_button").addEventListener('click', function () {
        let speed = document.getElementById("change_speed_value").value;
        let current_sysid = document.getElementById("update_connection_settings_sysid").value; 
        socket.emit('do_change_speed', current_sysid, "airspeed", speed, "-1");
        Materialize.toast("Set target airspeed to " + speed, 3000);
    }, false);

    // Set Altitude
    document.getElementById("change_altitude_button").addEventListener('click', function () {
        let altitude = document.getElementById("change_altitude_value").value;
        let current_sysid = document.getElementById("update_connection_settings_sysid").value; 
        socket.emit('do_change_altitude', current_sysid, altitude);
        Materialize.toast("Set target altitude to " + altitude, 3000);
    }, false);

    // Set Loiter Radius
    document.getElementById("loiter_radius_button").addEventListener('click', function () {
        let radius = document.getElementById("loiter_radius_value").value;
        // TODO implement sending mavlink packet for set loiter radius
        Materialize.toast("Set loiter radius to " + radius, 3000);
    }, false);
});
