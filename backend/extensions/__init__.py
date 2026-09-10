"""
MachineCare Customer & Industry Extensions
Each subdirectory is an isolated package registered via backend.platform.extensions.
"""

from .xyz_mining import xyz_mining_extension

__all__ = ["xyz_mining_extension"]
