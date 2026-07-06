"""
Centralized logging configuration.

Keeps log output clean and production-friendly (timestamps + level +
message) instead of bare print() statements scattered across services.
Importing this module and calling setup_logging() once at startup
configures the "formmitra" logger used throughout the backend.
"""

import logging
import sys


def setup_logging():
    logger = logging.getLogger("formmitra")

    if logger.handlers:
        # Already configured (e.g. re-imported during a reload) - avoid
        # duplicate handlers producing duplicate log lines.
        return logger

    logger.setLevel(logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-7s | %(message)s",
        datefmt="%H:%M:%S",
    )
    handler.setFormatter(formatter)

    logger.addHandler(handler)
    logger.propagate = False

    return logger
