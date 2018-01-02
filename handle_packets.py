import time
from pymavlink import mavutil
import common_state as cs


def heartbeat(packet):
    cs.last_heartbeat = time.localtime()
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


def location(packet):
    cs.gps.lat = packet.lat
    cs.gps.lon = packet.lon
    cs.gps.alt = packet.alt
    cs.gps.relative_alt = packet.relative_alt
    cs.gps.heading = packet.hdg
    cs.gps.vx = packet.vx
    cs.gps.vy = packet.vy
    cs.gps.vz = packet.vz

    cs.socketio.emit('location', {"lat": cs.gps.lat/10000000, "lng": cs.gps.lon/10000000, "heading": packet.hdg/100},
                     namespace=cs.settings.Sockets.namespace)
