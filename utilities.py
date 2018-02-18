import common_state as cs
from pymavlink import mavutil
mavlink = mavutil.mavlink


def get_vehicle_string():
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


def get_mode_string():
    if cs.vehicle_type is not None and cs.mode_type_enum is not None:
        if cs.vehicle_type == "Plane":
            if cs.mode_type_enum == 0:
                return "Manual"
            elif cs.mode_type_enum == 1:
                return "Circle"
            elif cs.mode_type_enum == 2:
                return "Stabilise"
            elif cs.mode_type_enum == 3:
                return "Training"
            elif cs.mode_type_enum == 4:
                return "Acro"
            elif cs.mode_type_enum == 5:
                return "FBWA"
            elif cs.mode_type_enum == 6:
                return "FBWB"
            elif cs.mode_type_enum == 7:
                return "Cruise"
            elif cs.mode_type_enum == 8:
                return "Autotune"
            elif cs.mode_type_enum == 10:
                return "Auto"
            elif cs.mode_type_enum == 11:
                return "RTL"
            elif cs.mode_type_enum == 12:
                return "Loiter"
            elif cs.mode_type_enum == 14:
                return "AvoidADSB"
            elif cs.mode_type_enum == 15:
                return "Guided"
            elif cs.mode_type_enum == 16:
                return "Initializing"
            elif cs.mode_type_enum == 17:
                return "QStabilise"
            elif cs.mode_type_enum == 18:
                return "QHover"
            elif cs.mode_type_enum == 19:
                return "QLoiter"
            elif cs.mode_type_enum == 20:
                return "QLand"
            elif cs.mode_type_enum == 21:
                return "QRTL"

    return "Unknown"
