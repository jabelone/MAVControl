#!/usr/bin/env python3
from threading import Lock
from flask import Flask, render_template, session, send_from_directory
from flask_socketio import SocketIO, emit, disconnect
import sys, os, MAVControlSettings
from pymavlink import mavutil
import time, utilities
import common_state as cs
import handle_packets as handle

cs.settings = MAVControlSettings.Settings()

app = Flask(__name__)
app.config["SECRET_KEY"] = cs.settings.Frontend.password
cs.socketio = SocketIO(app, async_mode=cs.settings.Sockets.async_mode)
print(mavutil.mode_mapping_apm[17])

# These threads are needed to keep everything running smoothly. The "mavlink" thread runs recv_match() very quickly in
# order to process new mavlink packets and initiate the callback. The "heartbeat" thread does all the 1 second timed
# tasks like sending the GCS heartbeat. Both of these must happen regardless of what's going on for stability, so they
# each need their own thread. This class makes it easier to use them.

class Threads:
    # Threads
    mavlink_thread = None
    heartbeat_thread = None

    # Locks
    mavlink_lock = Lock()
    heartbeat_lock = Lock()


# Make an instance of our Threads class
threads = Threads

# Connect to our MAV
conn_string = "udp:" + cs.settings.MavConnection.ip + ":" + cs.settings.MavConnection.port
cs.mav = mavutil.mavlink_connection(conn_string, )
print("Attempting connection to: " + conn_string)


def wait_for_heartbeat(mav_connection):
    """Wait for a heartbeat packet so we know the target sysid"""
    print("Waiting for a heartbeat packet")
    mav_connection.wait_heartbeat(blocking=False)
    print("Heartbeat from APM (system %u component %u)" % (mav_connection.target_system, mav_connection.target_system))
    cs.last_heartbeat = time.localtime()

id_list = []

def cb(packet, b=None, c=None, d=None):
    """This callback runs every time we get a new mavlink packet."""
    global id_list

    #print("cb: " + str(packet)) # Useful for debugging purposes

    # int
    incoming_sysid = packet.get_srcSystem()

    if incoming_sysid not in id_list:
        # This is undocumented so not 100% sure if this is the correct usage.
        print("Found NEW Sysid:" + str(incoming_sysid)) # Useful for debugging purposes
        #print("cb: " + str(packet)) # Useful for debugging purposes
        id_list.append(incoming_sysid)

    handle.switch_current_if_needed(incoming_sysid)

    # store id from header into main packet state for convenience and downstream use
    if ( incoming_sysid != 0 ):
        packet.sysid = incoming_sysid 
    else:
        packet.sysid = None

    if packet.get_type() == "HEARTBEAT":
        handle.heartbeat(packet)

    elif packet.get_type() == "GLOBAL_POSITION_INT":
        handle.location(packet)

    elif packet.get_type() == "VFR_HUD":
        handle.vfr_hud(packet)

    elif packet.get_type() == "ATTITUDE":
        handle.attitude(packet)

    elif packet.get_type() == "STATUSTEXT":
        handle.status_text(packet)


wait_for_heartbeat(cs.mav)
cs.mav.mav.set_callback(cb)


def mavlink_thread():
    """Used to process new mavlink messages"""
    while True:
        cs.socketio.sleep(0.0000000000001)
        cs.mav.recv_match()


def heartbeat_thread():
    """Sends a 1Hz heartbeat packet, etc."""
    # TODO: Sending heartbeat not implemented yet
    while True:
        cs.socketio.sleep(1)
        cs.socketio.emit('heartbeat',
                         str(time.strftime('%H:%M:%S', cs.last_heartbeat)),
                         namespace=cs.settings.Sockets.namespace)


@app.route('/')
def index():
    return render_template('index.html', async_mode=cs.socketio.async_mode, page_name=cs.settings.Frontend.name,
                           python_version=sys.version)

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/pitch')
def pitch_url():
    cs.socketio.emit('attitude', {'pitch': 10, 'roll': cs.states[current_vehicle].attitude.roll, 'yaw': cs.states[current_vehicle].attitude.yaw},
                     namespace=cs.settings.Sockets.namespace)
    return "ok done"


@cs.socketio.on('update_connection_settings', namespace=cs.settings.Sockets.namespace)
def update_connection_settings(ip, port, initial_sysid):
    cs.settings.MavConnection.ip = ip
    cs.settings.MavConnection.port = port    
    cs.settings.MavConnection.initial_sysid = initial_sysid
    cs.settings.save()
    cs.socketio.emit('conn_update_success', namespace=cs.settings.Sockets.namespace)
    cs.socketio.sleep(0.1)
    os.execv(__file__, sys.argv)


@cs.socketio.on('my_event', namespace=cs.settings.Sockets.namespace)
def test_message(message):
    session['receive_count'] = session.get('receive_count', 0) + 1
    emit('my_response',
         {'data': message['data'], 'count': session['receive_count']})


@cs.socketio.on('my_ping', namespace=cs.settings.Sockets.namespace)
def ping_pong():
    emit('my_pong')

# connect only seems to be used on FIRST socket connect....
@cs.socketio.on('connect', namespace=cs.settings.Sockets.namespace)
def test_connect():
    global threads

    with threads.mavlink_lock:
        if threads.mavlink_thread is None:
            threads.mavlink_thread = cs.socketio.start_background_task(target=mavlink_thread)
    with threads.heartbeat_lock:
        if threads.heartbeat_thread is None:
            threads.heartbeat_thread = cs.socketio.start_background_task(target=heartbeat_thread)

    emit('reconnect', {'data': 'Connected', 'count': 0, 'initial_sysid': cs.settings.MavConnection.initial_sysid})


@cs.socketio.on('disconnect', namespace=cs.settings.Sockets.namespace)
def disconnect():
    print('Client disconnected')
    global threads

    #disconnect()  # tears down the current socket explicitly so its not reused, causing a 'connect' event every time.

    #emit('disconnect', {'data': 'DisConnected', 'count': 0, 'initial_sysid': cs.settings.MavConnection.initial_sysid})


@cs.socketio.on('arm', namespace=cs.settings.Sockets.namespace)
def arm_vehicle():
    cs.mav.mav.command_long_send(
        cs.target_system,  # target_system
        0,
        mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,  # command
        0,  # confirmation
        1,  # param1 (1 to indicate arm)
        0, 0, 0, 0, 0, 0)


@cs.socketio.on('disarm', namespace=cs.settings.Sockets.namespace)
def disarm_vehicle():
    cs.mav.mav.command_long_send(
        cs.target_system,  # target_system
        0,
        mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,  # command
        0,  # confirmation
        0,  # param1 (0 to indicate disarm)
        0, 0, 0, 0, 0, 0)


@cs.socketio.on('do_change_speed', namespace=cs.settings.Sockets.namespace)
def do_change_speed(sysid,speed_type, speed, throttle):
    if speed_type == "airspeed":
        speed_type = 0
    elif speed_type == "groundspeed":
        speed_type = 1

    if speed == "" :
         return  # cant change speed without a speed.

    cs.mav.mav.command_long_send(
        sysid,  # target_system = the one we are looking at.
        0,
        mavutil.mavlink.MAV_CMD_DO_CHANGE_SPEED,  # command
        0,  # confirmation
        float(speed_type),  # Speed Type (0=Airspeed, 1=Ground Speed)
        float(speed),  # Speed (m/s, -1 indicates no change)
        float(throttle),  # Throttle ( Percent, -1 indicates no change)
        0,  # absolute or relative [0,1]
        0, 0, 0)
    emit('do_change_speed', speed)

@cs.socketio.on('do_change_altitude', namespace=cs.settings.Sockets.namespace)
def do_change_altitude(sysid,alt):

    if alt == "":
        return  # cant change alt without a value.

    cs.mav.mav.command_long_send(
        sysid,  # target_system = the one we are looking at.
        0,
        mavutil.mavlink.MAV_CMD_DO_CHANGE_ALT,  # command
        0,  # confirmation

        float(alt),3,0,0,0,0, 0); # 3 = MAV_FRAME_GLOBAL_RELATIVE_ALT, see https://mavlink.io/en/messages/common.html#MAV_FRAME

    emit('do_change_altitude', alt)


@cs.socketio.on('change_mode', namespace=cs.settings.Sockets.namespace)
def do_change_speed(mode):
    cs.mav.mav.command_long_send(
        cs.target_system,  # target_system
        0,
        mavutil.mavlink.MAV_CMD_DO_SET_MODE,  # command
        0,  # confirmation
        0,  #
        0,  #
        0,  #
        0,  #
        0, 0, 0)
    emit('change_mode', mode)

@cs.socketio.on('template', namespace=cs.settings.Sockets.namespace)
def template(message):
    cs.mav.mav.command_long_send(
        cs.target_system,  # target_system
        0,
        mavutil.mavlink.MAV_CMD_DO_SET_MODE,  # command
        0,  # confirmation
        0,  # param 1
        0,  #
        0,  #
        0,  #
        0, 0, 0)
    emit('template', message)


if __name__ == '__main__':
    cs.socketio.run(app, debug=True)
