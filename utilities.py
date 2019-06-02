import common_state as cs
from pymavlink import mavutil
mavlink = mavutil.mavlink


def get_vehicle_string(sysid):
    copter_values = [mavlink.MAV_TYPE_QUADROTOR,
                     mavlink.MAV_TYPE_COAXIAL,
                     mavlink.MAV_TYPE_HELICOPTER,
                     mavlink.MAV_TYPE_HEXAROTOR,
                     mavlink.MAV_TYPE_OCTOROTOR,
                     mavlink.MAV_TYPE_TRICOPTER,
                     mavlink.MAV_TYPE_DODECAROTOR]

    if cs.vehicle_type_enum == mavutil.mavlink.MAV_TYPE_GENERIC:
        return "Generic"
    elif cs.vehicle_type_enum == mavutil.mavlink.MAV_TYPE_FIXED_WING:
        return "Plane"
    elif cs.vehicle_type_enum in copter_values:
        return "Copter"


def get_mode_string(sysid):

    if cs.states[sysid].vehicle_type is not None and cs.mode_type_enum is not None:
        if cs.states[sysid].vehicle_type == "Plane":
            mode = mavutil.mode_mapping_apm[cs.mode_type_enum]
            return mode
        if cs.states[sysid].vehicle_type == "Copter":
            mode = mavutil.mode_mapping_acm[cs.mode_type_enum]
            return mode

    return "Unknown"
