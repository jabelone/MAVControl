from pymavlink import mavutil
conn_string = "udp:127.0.0.1:14550"
mc = mavutil.mavlink_connection(conn_string, )
mc.mav.command_long_send(255,0,mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,0,1,0, 0, 0, 0, 0, 0)
