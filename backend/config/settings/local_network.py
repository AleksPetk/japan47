"""Discover private interface addresses for local, same-Wi-Fi development."""

import ipaddress
import re
import shutil
import socket
import subprocess


INTERFACE_IPV4_PATTERN = re.compile(
    r"^\s*inet(?:\s+addr:)?\s+((?:\d{1,3}\.){3}\d{1,3})(?:\s|$)",
    re.MULTILINE,
)


def private_ipv4_addresses(values):
    """Return valid private/link-local IPv4 addresses, excluding loopback."""

    addresses = set()
    for value in values:
        try:
            address = ipaddress.IPv4Address(value)
        except ipaddress.AddressValueError:
            continue
        if not address.is_loopback and (address.is_private or address.is_link_local):
            addresses.add(str(address))
    return sorted(addresses, key=ipaddress.IPv4Address)


def discover_lan_ipv4_addresses():
    """Find active LAN addresses without assuming a fixed interface or subnet."""

    candidates = set()

    # Hostname lookup is portable and succeeds on many Linux installations.
    try:
        candidates.update(
            result[4][0]
            for result in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
        )
    except OSError:
        pass

    # The selected outbound interface is normally the Wi-Fi interface. A UDP
    # connect chooses a route but sends no application data.
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as connection:
            connection.connect(("192.0.2.1", 80))
            candidates.add(connection.getsockname()[0])
    except OSError:
        pass

    # macOS does not always resolve its own .local hostname. Read interface
    # addresses as a fallback, without hardcoding en0 or another device name.
    ifconfig = shutil.which("ifconfig") or "/sbin/ifconfig"
    try:
        result = subprocess.run(
            [ifconfig],
            capture_output=True,
            check=False,
            text=True,
            timeout=2,
        )
        candidates.update(INTERFACE_IPV4_PATTERN.findall(result.stdout))
    except (OSError, subprocess.SubprocessError):
        pass

    return private_ipv4_addresses(candidates)
