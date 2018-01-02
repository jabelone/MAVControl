import json


class Settings:
    def __init__(self):
        self.load()

    def load(self):
        with open('settings.json', 'r') as f:
            raw_settings = json.load(f)

        # MavConnection
        self.MavConnection.ip = raw_settings["MavConnection"]["ip"]
        self.MavConnection.port = raw_settings["MavConnection"]["port"]
        self.MavConnection.mavlink_version = raw_settings["MavConnection"]["mavlink_version"]

        # Sockets
        self.Sockets.namespace = raw_settings["Sockets"]["namespace"]
        self.Sockets.async_mode = raw_settings["Sockets"]["async_mode"]

        # Frontend
        self.Frontend.name = raw_settings["Frontend"]["name"]
        self.Frontend.password = raw_settings["Frontend"]["password"]

        # Backend
        self.Backend.known_mavlink_packets_file = raw_settings["Backend"]["known_mavlink_packets_file"]
        with open(self.Backend.known_mavlink_packets_file, 'r') as f:
            self.Backend.known_mavlink_packets = json.load(f)

    def save(self):
        save_settings = {
            "MavConnection": {
                "ip": self.MavConnection.ip,
                "port": self.MavConnection.port,
                "mavlink_version": self.MavConnection.mavlink_version,
            },
            "Sockets": {
                "namespace": self.Sockets.namespace,
                "async_mode": self.Sockets.async_mode,
            },
            "Frontend": {
                "name": self.Frontend.name,
                "password": self.Frontend.password,
            },
            "Backend": {
                "known_mavlink_packets_file": self.Backend.known_mavlink_packets_file,
            },
        }

        with open('settings.json', 'w') as f:
            json.dump(save_settings, f, indent=4)

    class MavConnection:
        ip = None
        port = None
        mavlink_version = None

    class Sockets:
        namespace = None
        async_mode = None

    class Frontend:
        name = None
        password = None

    class Backend:
        known_mavlink_packets_file = None
        known_mavlink_packets = None
