from django.apps import AppConfig


class TravelConfig(AppConfig):
    name = 'travel'

    def ready(self):
        from . import signals  # noqa: F401
