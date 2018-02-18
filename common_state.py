socketio = None
settings = None
last_heartbeat = None
ap_type = None
mode_type_enum = None
mode = None
vehicle_type_enum = None
vehicle_type = None
last_status_text = None
mav = None
target_system = 0
target_component = 0


class gps:
    lat = None
    lon = None
    alt = None
    vx = None
    vy = None
    vz = None
    heading = None


class attitude:
    roll = None
    pitch = None
    yaw = None
    rollspeed = None
    pitchspeed = None
    yawspeed = None