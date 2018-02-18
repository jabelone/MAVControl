#!/usr/bin/env python3
from threading import Lock
from flask import Flask, render_template, session, request, url_for
from flask_socketio import SocketIO, emit
import sys, os, MAVControlSettings
from pymavlink import mavutil
import time, utilities
import common_state as cs
import handle_packets as handle


cs.settings = MAVControlSettings.Settings()

app = Flask(__name__)
app.config["SECRET_KEY"] = cs.settings.Frontend.password
cs.socketio = SocketIO(app, async_mode=cs.settings.Sockets.async_mode)


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


def cb(packet, b=None, c=None, d=None):
    """This callback runs every time we get a new mavlink packet."""
    # This is undocumented so not 100% sure if this is the correct usage.
    #print("cb: " + str(packet)) # Useful for debugging purposes

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


@app.route('/pitch')
def pitch_url():
    cs.socketio.emit('attitude', {'pitch': 10, 'roll': cs.attitude.roll, 'yaw': cs.attitude.yaw},
                     namespace=cs.settings.Sockets.namespace)
    return "ok done"


@cs.socketio.on('update_connection_settings', namespace=cs.settings.Sockets.namespace)
def update_connection_settings(ip, port):
    cs.settings.MavConnection.ip = ip
    cs.settings.MavConnection.port = port
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


@cs.socketio.on('connect', namespace=cs.settings.Sockets.namespace)
def test_connect():
    global threads

    with threads.mavlink_lock:
        if threads.mavlink_thread is None:
            threads.mavlink_thread = cs.socketio.start_background_task(target=mavlink_thread)
    with threads.heartbeat_lock:
        if threads.heartbeat_thread is None:
            threads.heartbeat_thread = cs.socketio.start_background_task(target=heartbeat_thread)

    emit('my_response', {'data': 'Connected', 'count': 0})


@cs.socketio.on('arm', namespace=cs.settings.Sockets.namespace)
def arm_vehicle():
    cs.mav.mav.command_long_send(
        cs.target_system,  # target_system
        0,
        mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,  # command
        0,  # confirmation
        1,  # param1 (1 to indicate arm)
        0, 0, 0, 0, 0, 0)
    print("ARMED ARMED")
    emit('armed')


@cs.socketio.on('disarm', namespace=cs.settings.Sockets.namespace)
def disarm_vehicle():
    cs.mav.mav.command_long_send(
        cs.target_system,  # target_system
        0,
        mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,  # command
        0,  # confirmation
        0,  # param1 (0 to indicate disarm)
        0, 0, 0, 0, 0, 0)

    print("DISARMED DISARMED")
    emit('disarmed')

@cs.socketio.on('do_change_speed', namespace=cs.settings.Sockets.namespace)
def do_change_speed(type, speed, throttle):
    test = cs.mav.mav.command_long_send(
        cs.target_system,  # target_system
        0,
        mavutil.mavlink.MAV_CMD_DO_CHANGE_SPEED,  # command
        0,  # confirmation
        1,  # Speed Type (0=Airspeed, 1=Ground Speed)
        0,  # Speed (m/s, -1 indicates no change)
        0,  # Throttle ( Percent, -1 indicates no change)
        0,  # absolute or relative [0,1]
        0, 0, 0)

    print("change speed return: ")
    print(test)
    emit('do_change_speed')

if __name__ == '__main__':
    cs.socketio.run(app, debug=True)
