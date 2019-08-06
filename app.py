#!/usr/bin/env python3

from threading import Lock
from flask import Flask, render_template, session, send_from_directory
from flask_socketio import SocketIO, emit, disconnect
import sys, os, MAVControlSettings
from flask_debugtoolbar import DebugToolbarExtension

# this gets *my* special mavutil with special mavudp as well.
from mypymavlink import mymavutil as mavutil

import time, utilities
import common_state as cs
import handle_packets as handle
import types

cs.settings = MAVControlSettings.Settings()

app = Flask(__name__)
app.config["SECRET_KEY"] = cs.settings.Frontend.password

# flask debug toolbar: https://www.youtube.com/watch?v=ZEHGZnsbXgw
# https://flask-debugtoolbar.readthedocs.io/en/latest/
# pip3 install flask_debugtoolbar
# toolbar needs these:
#app.debug = True
#toolbar = DebugToolbarExtension(app)
#app.config['DEBUG_TB_PROFILER_ENABLED'] = True
#app.config['DEBUG_TB_TEMPLATE_EDITOR_ENABLED'] = True
#app.config['DEBUG_TB_PANELS'] = []

# async_mode='threading' is supposed to be ESSENTIAL WHEN WORKING WITH OTHER REAL THREADS, but as it turns out
# 'gevent' seems to work in this case better as it has proper websockets support and doesn't crash if tested well  :-) 
cs.socketio = SocketIO(app, async_mode='gevent')
print(mavutil.mode_mapping_apm[17])

# These "real" threads are needed to keep everything running smoothly. The "mavlink" thread runs recv_match() very quickly in
# order to process new mavlink packets and initiate the callback. The "heartbeat" thread does all the 1 second timed
# tasks like sending the GCS heartbeat. Both of these must happen regardless of what's going on for stability, so they
# each need their own thread. 

# when sending mavlink messges, any _send ( like self.command_long_send(...) ) calls self.command_long_encode(...) and passes that 
# result to self.send(...)  which essentially does a mavmsg.pack on the message into a buf, then calls self.file.write(buf) with resultant buf
# where self.file is not actually a file-based "filehandle" , but the result of a self.port.fileno() call on the original socket.socket ( self.port ) 

import socket, math, struct, time, os, fnmatch, array, sys, errno
import select

import threading




# https://godoc.org/github.com/whitedevops/colors
class bcolors:
    PURPLE = '\033[95m' #LightMagenta
    OKBLUE = '\033[94m' #LightBlue
    OKGREEN = '\033[92m' #light green
    CYAN    = "\033[96m"
    DARKCYAN         = "\033[36m"
    YELLOW = '\033[93m' 
    RED = '\033[91m'
    ENDC = '\033[0m' # return to white
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'



print(bcolors.ENDC),
mainid = threading.get_ident()
print("MAINTHREADID:"+str(mainid))


# Connect to our MAV using our customised class based on "mavutil", with tweaks.
device = "udp:" + cs.settings.MavConnection.ip + ":" + cs.settings.MavConnection.port
print("Attempting connection to: " + device)
# make a connection kinda like mavutil would, but with a derived class that supports multiple sourcre ip/port 
cs.mavlink_connection= mavutil.mavudp(device[4:], input=True, source_system=255, source_component=0, use_native=False)

def wait_for_heartbeat(mav_connection):
    """Wait for a heartbeat packet so we know the target sysid"""
    print("Waiting for a heartbeat packet")
    mav_connection.wait_heartbeat(blocking=False)
    print("Heartbeat from APM (system %u component %u)" % (mav_connection.target_system, mav_connection.target_component))
    cs.last_heartbeat = time.localtime()

print(bcolors.ENDC),
# before all the threading stuff, be sure we have something valid, sowe don't need to recreate it..? 
wait_for_heartbeat(cs.mavlink_connection)
print(bcolors.ENDC),
# force NO callbacks on startup.
print("Force NO callbacks on startup")
cs.mavlink_connection.mav.set_callback(None)
cs.mavlink_connection.mav.set_pre_send_callback(None)
cs.mavlink_connection.mav.set_send_callback(None)
print("-----------------------------")

def recv_cb(packet, b=None, c=None, d=None):
    
    if packet == None:
        return

    #print("cb1")
    #print(bcolors.OKGREEN),
    #print("cb1---------------------------------------------------"+str(threading.get_ident()))
    #print("cb1:  "+str(threading.get_ident()))
    #print(bcolors.ENDC),
    #return packet

    #print("cb1")


    """This callback runs every time we get a new mavlink packet."""
    # FYI, with set_callback(cb) it's normally called PRIOR to the mymavudp.post_message function, so can't normally access the ip/port data added there.
    # but we've re-arranged the order of the arrival-packet callbacks so cb() happends last. ( see mymavudp() class ) 
    incoming_sysid = packet.get_srcSystem()

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


def send_cb(packet, b=None, c=None, d=None):
    #print("cb2")
    #print(bcolors.OKBLUE),
    #print("cb2---------------------------------------------------"+str(threading.get_ident()))
    #print("cb2:  "+str(threading.get_ident()))
    #print(bcolors.ENDC),
    return packet


def pre_send_cb(packet, b=None, c=None, d=None):
    #print("cb3")
    print(bcolors.YELLOW),
    #print("cb3---------------------------------------------------"+str(threading.get_ident()))


    sysid = packet.target_system

    if sysid == "": 
        print("no sysid selected, sorry") 
        return

     # prepare to send to correct sysid
    cs.mavlink_connection.target_system = int(sysid) 

    # explicitly define the place we send *back* to as being where this sysid came from ( src ip/port ) 
    cs.mavlink_connection.last_address = cs.mavlink_connection.addresslist[int(sysid)] 

    print("cb3:  preparing to send sysid:"+str(sysid)+" to ip:"+str(cs.mavlink_connection.last_address))

    #print("cb3:  "+str(threading.get_ident()))
    print(bcolors.ENDC),
    return packet

def register_callbacks():
    global cs
    ret = False
    #print(bcolors.PURPLE),
    if cs.mavlink_connection.mav.callback == None:
        print("registering NEW callback") 
        ret = True
        cs.mavlink_connection.mav.set_callback(recv_cb)

    if cs.mavlink_connection.mav.pre_send_callback == None:
        print("registering NEW pre_send_callback")
        ret = True
        cs.mavlink_connection.mav.set_pre_send_callback(pre_send_cb)

    if cs.mavlink_connection.mav.send_callback == None:
        print("registering NEW send_callback")
        ret = True
        cs.mavlink_connection.mav.set_send_callback(send_cb)
    #print(bcolors.ENDC),
    return ret

# we need to do this in each thread at least once, this is the main thread where we DONT do it.
#register_callbacks()

def Xdo_change_mode(sysid,mode):

    mode_mapping = cs.mavlink_connection.mode_mapping()
    #print("Tavailable modes:"+str(mode_mapping.keys()))
    mode = mode.upper()
    modenum = mode_mapping[mode]

    print("Xsetting mode: "+str(mode)+"->"+str(modenum)+" for sysid:"+str(sysid))

    cs.mavlink_connection.set_mode(modenum)

print(bcolors.ENDC),
print("mainstart, nocallbacks here ,so no cb1,cb2, or cb3 triggered---------------------------------------------------")
Xdo_change_mode(11,"AUTO")
print("endmain---------------------------------------------------")

def mavlink_thread():
    """Used to process new mavlink messages"""
    print(bcolors.RED),
    if mainid == threading.get_ident():
        print( "subthread error, id matched main thread-mav")

    print("mthread---------------------------------------------------"+str(threading.get_ident()))
    if register_callbacks(): # call it repeatedly incase they have gone away elsewhere..? 
        print("registering callbacks in mavlink_threadID:"+str(threading.get_ident()))
    # we need to do this in each thread at least once, this is the main thread.

    print(bcolors.ENDC),




    while True:
        # listen for incoming packets
        cs.socketio.sleep(0.0000000000001)
        #print(bcolors.RED),
        cs.mavlink_connection.recv_match()

        #print(bcolors.RED),


        if register_callbacks(): # call it repeatedly incase they have gone away elsewhere..? 
            print("registering callbacks AGAIN in mthread")
        #print(bcolors.ENDC),

        #print(bcolors.RED),
        #Xdo_change_mode(11,"LOITER")
        #print(bcolors.ENDC),
        #cs.socketio.sleep(5)

Zmavlink_thread  = threading.Thread(target=mavlink_thread)
Zmavlink_thread.start()

time.sleep(1) # so the thread we started can do registration and etc what its done before we move on.
print("main:---------------------------------------------------"+str(threading.get_ident()))
Zheartbeat_thread = None

# Locks
Zmavlink_lock = Lock()
Zheartbeat_lock = Lock()

#Xdo_change_mode(11,"AUTO")


# this sends a 1hz msg to the web browser with the last-seen time of any MAV heartbeat, and it's simply displayed there.
# this thread should NOT send outbound messages to the mavlink socket without  calling register_callbacks() first
def heartbeat_thread():
    """Sends a 1Hz heartbeat packet, etc."""

    print(bcolors.CYAN),
    if mainid == threading.get_ident():
        print( "subthread error, id matched main thread-heart")

    print("hthread---------------------------------------------------"+str(threading.get_ident()))

    #if register_callbacks(): # call it repeatedly incase they have gone away elsewhere..? 
    #    print("registering callbacks in heartbeat_threadID:"+str(threading.get_ident()))
    ## we need to do this in each thread at least once for mavlink coms in that thread.
   
    print(bcolors.ENDC),
    while True:
        #print(bcolors.ENDC),
        cs.socketio.sleep(1)
        #print(bcolors.CYAN),
        cs.socketio.emit('heartbeat',
                         str(time.strftime('%H:%M:%S', cs.last_heartbeat)),
                         namespace=cs.settings.Sockets.namespace)

        #if register_callbacks(): # call it repeatedly incase they have gone away elsewhere..? 
        #    print("registering callbacks AGAIN in hthread")

        # this simple test sends a mavlink packet from this thread, not recommended atm.
        #print(bcolors.CYAN),
        #Xdo_change_mode(11,"RTL")


Zheartbeat_thread  = threading.Thread(target=heartbeat_thread)
Zheartbeat_thread.start()



@app.route('/')
def index():
    return render_template('index.html', async_mode=cs.socketio.async_mode, 
                        page_name=cs.settings.Frontend.name ,
                        allowControl=cs.settings.Frontend.allowControl,
                           python_version=sys.version)

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'favicon.ico', mimetype='image/vnd.microsoft.icon')

#@app.route('/pitch')
#def pitch_url():
#    
#    cs.socketio.emit('attitude', {'pitch': 10, 'roll': cs.states[cs.current_vehicle].attitude.roll, 'yaw': cs.states[cs.current_vehicle].attitude.yaw},
#                     namespace=cs.settings.Sockets.namespace)
#    return "ok done"


@cs.socketio.on('update_connection_settings', namespace=cs.settings.Sockets.namespace)
def update_connection_settings(ip, port, initial_sysid):
    cs.settings.MavConnection.ip = ip
    cs.settings.MavConnection.port = port    
    cs.settings.MavConnection.initial_sysid = initial_sysid
    cs.settings.save()
    cs.socketio.emit('conn_update_success', namespace=cs.settings.Sockets.namespace)
    cs.socketio.sleep(0.1)
    os.execv(__file__, sys.argv)


#@cs.socketio.on('my_event', namespace=cs.settings.Sockets.namespace)
#def test_message(message):
#    session['receive_count'] = session.get('receive_count', 0) + 1
#    emit('my_response',
#         {'data': message['data'], 'count': session['receive_count']})


# server-client latency checker initiated by browser/client and responded to here.
@cs.socketio.on('my_ping', namespace=cs.settings.Sockets.namespace)
def ping_pong():
    emit('my_pong')


# connect only seems to be used on FIRST socket connect....
@cs.socketio.on('connect', namespace=cs.settings.Sockets.namespace)
def test_connect():
    global Zmavlink_thread
    global Zheartbeat_thread
    global Zmavlink_lock
    global Zheartbeat_lock

    print("Connect")
    

    #with Zmavlink_lock:
        #if Zmavlink_thread is None:
        #    Zmavlink_thread = cs.socketio.start_background_task(target=mavlink_thread)
        #print("STARTING mavlink_thread FRON SOCKETIO")
        #Zmavlink_thread  = threading.Thread(target=mavlink_thread)
        #Zmavlink_thread.start()

    #with Zheartbeat_lock:
        #if Zheartbeat_thread is None:
        #    Zheartbeat_thread = cs.socketio.start_background_task(target=heartbeat_thread)
        #print("STARTING heartbeat_thread FRON SOCKETIO")
        #Zheartbeat_thread  = threading.Thread(target=heartbeat_thread)
        #Zheartbeat_thread.start()

    emit('reconnect', {'data': 'Connected', 'count': 0, 'initial_sysid': cs.settings.MavConnection.initial_sysid})

    # since it's a reconnect, we can also emit other relevant state-updating info here too, such as WP data:
    #get_wp_list(cs.settings.MavConnection.initial_sysid)

@cs.socketio.on('disconnect', namespace=cs.settings.Sockets.namespace)
def disconnect():
    print('Client disconnected')

    #disconnect()  # tears down the current socket explicitly so its not reused, causing a 'connect' event every time.

    #emit('disconnect', {'data': 'DisConnected', 'count': 0, 'initial_sysid': cs.settings.MavConnection.initial_sysid})


@cs.socketio.on('arm', namespace=cs.settings.Sockets.namespace)
def arm_vehicle(sysid):

     # prepare to send to correct sysid
    cs.mavlink_connection.target_system = int(sysid)

    p2 = 0 # we don't support forced arming.
    cs.mavlink_connection.mav.command_long_send(
        int(sysid),  # target_system
        0,  # target_component
        mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM, # command
        0, # confirmation
        1, # param1 (1 to indicate arm)
        p2, # param2  (all other params meaningless)
        0, # param3
        0, # param4
        0, # param5
        0, # param6
        0) # param7


@cs.socketio.on('disarm', namespace=cs.settings.Sockets.namespace)
def disarm_vehicle(sysid):

     # prepare to send to correct sysid
    cs.mavlink_connection.target_system = int(sysid)

    cs.mavlink_connection.mav.command_long_send(
        int(sysid),  # target_system
        0, # target_component
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
        print("no speed selected, sorry")
        return  # cant change speed without a speed.

    if sysid == "":
        print("no sysid selected, sorry")
        return

    print("command_long_sendy")
    print(cs.mavlink_connection.mav.send)

    print('cs.mavlink_connection.mav.pre_send_callback')
    print(cs.mavlink_connection.mav.pre_send_callback)

     # prepare to send to correct sysid
    cs.mavlink_connection.target_system = int(sysid)

    # this change-speed command does NOT appear to work in LOITER, but does in AUTO & RTL
    cs.mavlink_connection.mav.command_long_send(
        int(sysid),  # target_system = the one we are looking at.
        0,
        mavutil.mavlink.MAV_CMD_DO_CHANGE_SPEED,  # command
        0,  # confirmation
        float(speed_type),  # Speed Type (0=Airspeed, 1=Ground Speed)
        float(speed),  # Speed (m/s, -1 indicates no change)
        float(throttle),  # Throttle ( Percent, -1 indicates no change)
        0,  # absolute or relative [0,1]
        0, 0, 0)
    #emit('change_speed', speed)

@cs.socketio.on('do_change_altitude', namespace=cs.settings.Sockets.namespace)
def do_change_altitude(sysid,alt):

    if alt == "":
        return  # cant change alt without a value.

     # prepare to send to correct sysid
    cs.mavlink_connection.target_system = int(sysid)

    cs.mavlink_connection.mav.command_long_send(
        int(sysid),  # target_system = the one we are looking at.
        0,
        mavutil.mavlink.MAV_CMD_DO_CHANGE_ALTITUDE,  # command
        0,  # confirmation

        float(alt),3,0,0,0,0, 0); # 3 = MAV_FRAME_GLOBAL_RELATIVE_ALT, see https://mavlink.io/en/messages/common.html#MAV_FRAME


    #emit('change_altitude', alt)


@cs.socketio.on('do_change_mode', namespace=cs.settings.Sockets.namespace)
def do_change_mode(sysid,mode):

    mode_mapping = cs.mavlink_connection.mode_mapping()
    #print("Tavailable modes:"+str(mode_mapping.keys()))
    mode = mode.upper()
    modenum = mode_mapping[mode]

    print("Tsetting mode: "+str(mode)+"->"+str(modenum)+" for sysid:"+str(sysid))

     # prepare to send to correct sysid
    cs.mavlink_connection.target_system = int(sysid) 

    # actually send
    cs.mavlink_connection.set_mode(modenum)

 
    #emit('change_mode', mode)

@cs.socketio.on('set_wp', namespace=cs.settings.Sockets.namespace)
def set_wp(sysid,wp):

     # prepare to send to correct sysid
    cs.mavlink_connection.target_system = int(sysid)

    # tell teh aircraft to go to that WP
    cs.mavlink_connection.waypoint_set_current_send(int(wp))

@cs.socketio.on('get_wp_list', namespace=cs.settings.Sockets.namespace)
def get_wp_list(sysid):
    # bonus side-effect:   send a list of waypoints to the GUI
    # leave out WP "0", or Home.
    #list = [1,2,3,4,5,6,7,8,9,10]
    list = [{'id':1,'name':1},{'id':2,'name':2},{'id':3,'name':3},{'id':4,'name':4},
            {'id':5,'name':5},{'id':6,'name':6},{'id':7,'name':7},{'id':8,'name':8},{'id':9,'name':9},{'id':10,'name':10}]
    
    emit('waypoints', list) 
    print("sending waypoints list to browser")


#@cs.socketio.on('template', namespace=cs.settings.Sockets.namespace)
#def template(message):
#    cs.mavlink_connection.mav.command_long_send(
#        cs.target_system,  # target_system
#        0,
#        mavutil.mavlink.MAV_CMD_DO_SET_MODE,  # command
#        0,  # confirmation
#        0,  # param 1
#        0,  #
#        0,  #
#        0,  #
#        0, 0, 0)
#    emit('template', message)

# regarding Debug=True https://www.youtube.com/watch?v=xHyvIkkZ7uc


if __name__ == '__main__':
# next two lines needed while in debug mode because of this: https://github.com/miguelgrinberg/Flask-SocketIO/issues/65


    cs.socketio.run(app,  host='0.0.0.0', port=5000, use_reloader=False)
#    while True:
#        pass


