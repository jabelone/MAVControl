socketio = None
settings = None
current_vehicle = None
mavlink_connection = None
states = {}

class vehicle:
    last_heartbeat = None
    ap_type = None
    mode = None
    vehicle_type = None
    last_status_text = None
    mav = None
    target_system = 0
    target_component = 0
    sysid = 0
    gps = None
    attitude=None
    vehicle_type_enum=None
    mode_type_enum = None



class gps:
    lat = None
    lon = None
    alt = None
    vx = None
    vy = None
    vz = None
    heading = None
    relative_alt = None


class attitude:
    roll = None
    pitch = None
    yaw = None
    rollspeed = None
    pitchspeed = None
    yawspeed = None
