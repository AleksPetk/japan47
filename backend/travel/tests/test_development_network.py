from django.conf import settings
from django.test import SimpleTestCase

from config.settings.local_network import INTERFACE_IPV4_PATTERN, private_ipv4_addresses


class DevelopmentNetworkSettingsTests(SimpleTestCase):
    def test_interface_parser_does_not_treat_broadcast_as_a_host_address(self):
        output = (
            "en0: flags=8863<UP> mtu 1500\n"
            "    inet 192.168.1.20 netmask 0xffffff00 broadcast 192.168.1.255\n"
        )
        self.assertEqual(INTERFACE_IPV4_PATTERN.findall(output), ["192.168.1.20"])

    def test_private_address_filter_excludes_public_loopback_and_invalid_values(self):
        self.assertEqual(
            private_ipv4_addresses([
                "192.168.1.20", "10.0.0.8", "127.0.0.1", "8.8.8.8", "invalid",
            ]),
            ["10.0.0.8", "192.168.1.20"],
        )

    def test_development_hosts_and_vite_origins_include_detected_lan_addresses(self):
        self.assertIn("localhost", settings.ALLOWED_HOSTS)
        self.assertIn("127.0.0.1", settings.ALLOWED_HOSTS)
        self.assertIn("http://localhost:5173", settings.CORS_ALLOWED_ORIGINS)
        self.assertIn("http://127.0.0.1:5173", settings.CORS_ALLOWED_ORIGINS)
        self.assertIn("http://localhost:5173", settings.CSRF_TRUSTED_ORIGINS)
        self.assertIn("http://127.0.0.1:5173", settings.CSRF_TRUSTED_ORIGINS)
        for address in settings.LAN_IPV4_ADDRESSES:
            self.assertIn(address, settings.ALLOWED_HOSTS)
            self.assertIn(f"http://{address}:5173", settings.CORS_ALLOWED_ORIGINS)
            self.assertIn(f"http://{address}:5173", settings.CSRF_TRUSTED_ORIGINS)
