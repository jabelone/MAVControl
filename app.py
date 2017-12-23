#!/usr/bin/env python3
# This file was initially based on an example file from the Flask-SocketIO project.
from threading import Lock
from flask import Flask, render_template, session, request, url_for
from flask_socketio import SocketIO, emit
import json, sys
from pymavlink import mavutil
from pymavlink.dialects.v10 import ardupilotmega as mavlink1
from pymavlink.dialects.v20 import ardupilotmega as mavlink2


class Settings:
    page_name = "MAVControl Pre-Alpha"
    password = 'secret'
    connection_string = 'udp:127.0.0.1:14550'
    namespace = "/MAVControl"
    known_packets_file = "known_packets.json"
    
    known_packets = json.load(open(known_packets_file))
    async_mode = None

packet_count = 0

app = Flask(__name__)
app.config['SECRET_KEY'] = Settings.password
socketio = SocketIO(app, async_mode=Settings.async_mode)


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
mav = mavutil.mavlink_connection(Settings.connection_string,)


def wait_for_heartbeat(mav_connection):
    """Wait for a heartbeat packet so we know the target sysid"""
    print("Waiting for a heartbeat packet")
    mav_connection.wait_heartbeat()
    print("Heartbeat from APM (system %u component %u)" % (mav_connection.target_system, mav_connection.target_system))


def cb(a, b=None, c=None, d=None):
    """This callback runs every time we get a new mavlink packet."""
    # This is undocumented so not 100% this is the correct usage.
    # print("cb: " + str(a)) # Useful for debugging purposes
    socketio.emit('my_response', {'data': str(a),}, namespace=Settings.namespace)
    pass


wait_for_heartbeat(mav)
mav.mav.set_callback(cb)


def mavlink_thread():
    """Used to process new mavlink messages"""
    while True:
        socketio.sleep(0.0000000000001)
        mav.recv_match()


def heartbeat_thread():
    """Sends a 1Hz heartbeat packet, etc."""
    # TODO: Sending heartbeat not implemented yet
    count = 0
    while True:
        socketio.sleep(1)
        socketio.emit('my_response',
                      {'data': 'Server generated event', 'count': count},
                      namespace=Settings.namespace)
        count += 1


@app.route('/')
def index():
    return render_template('index.html', async_mode=socketio.async_mode, page_name=Settings.page_name,
                           python_version=sys.version)


@socketio.on('my_event', namespace=Settings.namespace)
def test_message(message):
    session['receive_count'] = session.get('receive_count', 0) + 1
    emit('my_response',
         {'data': message['data'], 'count': session['receive_count']})


@socketio.on('my_ping', namespace=Settings.namespace)
def ping_pong():
    emit('my_pong')


@socketio.on('connect', namespace=Settings.namespace)
def test_connect():
    global threads
    with threads.mavlink_lock:
        if threads.mavlink_thread is None:
            threads.mavlink_thread = socketio.start_background_task(target=mavlink_thread)
    with threads.heartbeat_lock:
        if threads.heartbeat_thread is None:
            threads.heartbeat_thread = socketio.start_background_task(target=heartbeat_thread)

    emit('my_response', {'data': 'Connected', 'count': 0})


@socketio.on('disconnect', namespace=Settings.namespace)
def test_disconnect():
    print('Client disconnected', request.sid)


if __name__ == '__main__':
    socketio.run(app, debug=True)
