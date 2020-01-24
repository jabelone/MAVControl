import time, math
from pymavlink import mavutil
import common_state as cs
import utilities


def switch_current_if_needed(sysid):
   # determine if incoming packet matches the current state we are using( it normally will for single-aircraft ops )  
    if (sysid  and ( cs.current_vehicle != sysid)):  # if requesting a different aircraft to the current one 
        cs.current_vehicle = sysid
        #print("print(current_vehicle)"+str(cs.current_vehicle))
        try: 
            cs.states[cs.current_vehicle].target_system = sysid   
        except KeyError: 
            #print("NEW Vehicle!.."+str(cs.current_vehicle))
            cs.states[cs.current_vehicle] = cs.vehicle()
            cs.states[cs.current_vehicle].location=0
            cs.states[cs.current_vehicle].lat=0
            cs.states[cs.current_vehicle].lng=0
            cs.states[cs.current_vehicle].heading= 0
            cs.states[cs.current_vehicle].airspeed: 0
            cs.states[cs.current_vehicle].altitude_agl=0
            cs.states[cs.current_vehicle].attitude=0
            cs.states[cs.current_vehicle].ap_type="Unknown"
            cs.states[cs.current_vehicle].sysid=sysid
            cs.states[cs.current_vehicle].gps = cs.gps()
            cs.states[cs.current_vehicle].attitude = cs.attitude()


def heartbeat(packet):

    #
    cs.last_heartbeat = time.localtime()

    if packet.autopilot == mavutil.mavlink.MAV_AUTOPILOT_ARDUPILOTMEGA:
        cs.states[cs.current_vehicle].ap_type = "ArduPilot"
    elif packet.autopilot == mavutil.mavlink.MAV_AUTOPILOT_GENERIC:
        cs.states[cs.current_vehicle].ap_type = "Generic"
    elif packet.autopilot == mavutil.mavlink.MAV_AUTOPILOT_OPENPILOT:
        cs.states[cs.current_vehicle].ap_type = "OpenPilot"
    elif packet.autopilot == mavutil.mavlink.MAV_AUTOPILOT_PX4:
        cs.states[cs.current_vehicle].ap_type = "PX4"
    else:
        cs.states[cs.current_vehicle].ap_type = "Unknown"


    if cs.current_vehicle:
        cs.states[cs.current_vehicle].vehicle_type = utilities.get_vehicle_string(cs.current_vehicle)
        cs.states[cs.current_vehicle].last_heartbeat = time.localtime()
        cs.states[cs.current_vehicle].vehicle_type_enum = packet.type
        cs.states[cs.current_vehicle].mode_type_enum = packet.custom_mode
        newmode = utilities.get_mode_string(cs.current_vehicle)
        if (newmode != cs.states[cs.current_vehicle].mode ) :
            print("new mode for vehicle:"+str(cs.current_vehicle)+"->"+str(newmode))
            cs.states[cs.current_vehicle].mode = newmode

            #time.sleep(1)
            #do_change_speed(sysid,speed_type, speed, throttle)
            #cs.socketio.emit('do_change_speed', { 12,'airspeed', 22, 50} , namespace=cs.settings.Sockets.namespace)

        # yes it's weird that we emit a 'mode' socket message after an incoming 'heartbeat' from the mav, but that's where 
        # mode is stored in mavlink, so this is actually right
        cs.socketio.emit('mode', { "sysid": cs.states[cs.current_vehicle].sysid, 
                                    "mode": cs.states[cs.current_vehicle].mode,
                                    "type": cs.states[cs.current_vehicle].vehicle_type } ,
                                    namespace=cs.settings.Sockets.namespace)


def location(packet):

    if cs.current_vehicle:
        cs.states[cs.current_vehicle].gps.lat = packet.lat/10000000
        cs.states[cs.current_vehicle].gps.lon = packet.lon/10000000
        cs.states[cs.current_vehicle].gps.alt = packet.alt
        cs.states[cs.current_vehicle].gps.relative_alt = packet.relative_alt/1000
        cs.states[cs.current_vehicle].gps.heading = packet.hdg/100
        cs.states[cs.current_vehicle].gps.vx = packet.vx
        cs.states[cs.current_vehicle].gps.vy = packet.vy
        cs.states[cs.current_vehicle].gps.vz = packet.vz
        cs.socketio.emit('location', { "sysid": cs.states[cs.current_vehicle].sysid, 
                                    "lat": cs.states[cs.current_vehicle].gps.lat, 
                                    "lng": cs.states[cs.current_vehicle].gps.lon, 
                                    "heading": cs.states[cs.current_vehicle].gps.heading,
                                    "altitude_agl": cs.states[cs.current_vehicle].gps.relative_alt},
                                    namespace=cs.settings.Sockets.namespace)
        # // no idea why _agl was a separate packet, moved it to the above one.
        #cs.socketio.emit('altitude_agl', cs.states[cs.current_vehicle].gps.relative_alt, 
        #                            namespace=cs.settings.Sockets.namespace)


def status_text(packet):

    tmpstr = '\x00'
    message = packet.text.rstrip(tmpstr)
    # if it contains utf8, decode it, otherwise use it as a string.
    try:
        message = message.decode("utf-8")
    except AttributeError:
        pass

    if cs.states[packet.sysid].last_status_text == message:
        return
    if message == "Throttle armed" or message == "Arming motors":
        cs.socketio.emit('armed', True, namespace=cs.settings.Sockets.namespace)
    if message == "Throttle disarmed" or message == "Disarming motors":
        cs.socketio.emit('disarmed', True, namespace=cs.settings.Sockets.namespace)
    #print(message)
    cs.socketio.emit('status_text', { "sysid": packet.sysid,  "text": message}, namespace=cs.settings.Sockets.namespace)
    cs.states[packet.sysid].last_status_text = message

def vfr_hud(packet):

    if cs.current_vehicle:
        cs.states[cs.current_vehicle].airspeed = packet.airspeed
        cs.states[cs.current_vehicle].groundspeed = packet.groundspeed
        cs.states[cs.current_vehicle].heading = packet.heading
        cs.states[cs.current_vehicle].throttle = packet.throttle
        cs.states[cs.current_vehicle].alt = packet.alt
        cs.states[cs.current_vehicle].climb = packet.climb

        # one single packet for all data in HUD packet replaces the many, and is properly labeled with a sysid as well.
        cs.socketio.emit('HUD', { 'sysid': cs.states[cs.current_vehicle].sysid, 
                                    'airspeed': packet.airspeed,
                                    'groundspeed': packet.groundspeed,
                                    'heading': packet.heading, 
                                    'throttle': packet.throttle,
                                    'climb': packet.climb,
                                    'ap_type': cs.states[cs.current_vehicle].ap_type },
                        namespace=cs.settings.Sockets.namespace)

        #cs.socketio.emit('airspeed', packet.airspeed, namespace=cs.settings.Sockets.namespace)
        #cs.socketio.emit('groundspeed', packet.groundspeed, namespace=cs.settings.Sockets.namespace)
        #cs.socketio.emit('heading', packet.heading, namespace=cs.settings.Sockets.namespace)
        #cs.socketio.emit('throttle', packet.throttle, namespace=cs.settings.Sockets.namespace)
        #cs.socketio.emit('climb', packet.climb, namespace=cs.settings.Sockets.namespace)
        #cs.socketio.emit('ap_type', cs.states[cs.current_vehicle].ap_type, namespace=cs.settings.Sockets.namespace)



def attitude(packet):

    if cs.current_vehicle:
        # convert roll pitch yaw degrees-to-radians and limit to 2 decimal places of accuracy
        cs.states[cs.current_vehicle].attitude.pitch = round(packet.pitch*180/math.pi, 2)
        cs.states[cs.current_vehicle].attitude.roll = round(packet.roll*180/math.pi, 2)
        cs.states[cs.current_vehicle].attitude.yaw = round(packet.yaw*180/math.pi, 2)
        cs.states[cs.current_vehicle].attitude.pitchspeed = packet.pitchspeed
        cs.states[cs.current_vehicle].attitude.rollspeed = packet.rollspeed
        cs.states[cs.current_vehicle].attitude.yawspeed = packet.yawspeed

        cs.socketio.emit('attitude', { 'sysid': cs.states[cs.current_vehicle].sysid, 
                                       'pitch': cs.states[cs.current_vehicle].attitude.pitch, 
                                      'roll': cs.states[cs.current_vehicle].attitude.roll, 
                                      'yaw': cs.states[cs.current_vehicle].attitude.yaw},
                                    namespace=cs.settings.Sockets.namespace)

