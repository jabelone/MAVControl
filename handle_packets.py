import time, math
from pymavlink import mavutil
import common_state as cs
import utilities


def heartbeat(packet):
    if packet.autopilot == mavutil.mavlink.MAV_AUTOPILOT_ARDUPILOTMEGA:
        cs.ap_type = "ArduPilot"
    elif packet.autopilot == mavutil.mavlink.MAV_AUTOPILOT_GENERIC:
        cs.ap_type = "Generic"
    elif packet.autopilot == mavutil.mavlink.MAV_AUTOPILOT_OPENPILOT:
        cs.ap_type = "OpenPilot"
    elif packet.autopilot == mavutil.mavlink.MAV_AUTOPILOT_PX4:
        cs.ap_type = "PX4"
    else:
        cs.ap_type = "Unknown"

    cs.vehicle_type = utilities.get_vehicle_string()
    cs.last_heartbeat = time.localtime()
    cs.vehicle_type_enum = packet.type
    cs.mode_type_enum = packet.custom_mode
    cs.mode = utilities.get_mode_string()
    cs.socketio.emit('mode', cs.mode, namespace=cs.settings.Sockets.namespace)


def location(packet):
    cs.gps.lat = packet.lat/10000000
    cs.gps.lon = packet.lon/10000000
    cs.gps.alt = packet.alt
    cs.gps.relative_alt = packet.relative_alt/1000
    cs.gps.heading = packet.hdg/100
    cs.gps.vx = packet.vx
    cs.gps.vy = packet.vy
    cs.gps.vz = packet.vz

    cs.socketio.emit('location', {"lat": cs.gps.lat, "lng": cs.gps.lon, "heading": cs.gps.heading},
                     namespace=cs.settings.Sockets.namespace)
    cs.socketio.emit('altitude_agl', cs.gps.relative_alt, namespace=cs.settings.Sockets.namespace)


def status_text(packet):
    message = packet.text.rstrip('\x00'.encode())
    if cs.last_status_text == message:
        return
    print(message)
    cs.socketio.emit('status_text', {"text": message.decode("utf-8")}, namespace=cs.settings.Sockets.namespace)
    cs.last_status_text = message

def vfr_hud(packet):
    cs.airspeed = packet.airspeed
    cs.groundspeed = packet.groundspeed
    cs.heading = packet.heading
    cs.throttle = packet.throttle
    cs.alt = packet.alt
    cs.climb = packet.climb

    cs.socketio.emit('airspeed', packet.airspeed, namespace=cs.settings.Sockets.namespace)
    cs.socketio.emit('groundspeed', packet.groundspeed, namespace=cs.settings.Sockets.namespace)
    cs.socketio.emit('heading', packet.heading, namespace=cs.settings.Sockets.namespace)
    cs.socketio.emit('throttle', packet.throttle, namespace=cs.settings.Sockets.namespace)
    cs.socketio.emit('climb', packet.climb, namespace=cs.settings.Sockets.namespace)
    cs.socketio.emit('ap_type', cs.ap_type, namespace=cs.settings.Sockets.namespace)

def attitude(packet):
    cs.attitude.pitch = round(packet.pitch*180/math.pi, 2)
    cs.attitude.roll = round(packet.roll*180/math.pi, 2)
    cs.attitude.yaw = round(packet.yaw*180/math.pi, 2)
    cs.attitude.pitchspeed = packet.pitchspeed
    cs.attitude.rollspeed = packet.rollspeed
    cs.attitude.yawspeed = packet.yawspeed

    cs.socketio.emit('attitude', {'pitch': cs.attitude.pitch, 'roll': cs.attitude.roll, 'yaw': cs.attitude.yaw},
                     namespace=cs.settings.Sockets.namespace)
