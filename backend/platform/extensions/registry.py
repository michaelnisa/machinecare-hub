"""
MachineCare Platform - Extension Registry Architecture
Enables enterprise customer-specific extensions without branching or code forks.
Runtime determination of enabled capabilities per organization.
"""

from typing import Dict, List, Set, Optional, Callable, Any

class ExtensionPackage:
    def __init__(self, key: str, name: str, version: str, description: str):
        self.key = key
        self.name = name
        self.version = version
        self.description = description
        self.capabilities: Set[str] = set()
        self.handlers: Dict[str, Callable] = {}

    def add_capability(self, capability: str) -> "ExtensionPackage":
        self.capabilities.add(capability)
        return self

    def register_handler(self, hook_name: str, handler: Callable) -> "ExtensionPackage":
        self.handlers[hook_name] = handler
        return self

class ExtensionRegistry:
    """
    Central developer-controlled registry for customer and industry extensions.
    """
    def __init__(self):
        self._packages: Dict[str, ExtensionPackage] = {}
        # organization_id -> Set of enabled extension keys
        self._org_extensions: Dict[str, Set[str]] = {}

    def register_package(self, package: ExtensionPackage) -> None:
        self._packages[package.key] = package

    def enable_for_organization(self, organization_id: str, extension_key: str) -> None:
        if extension_key not in self._packages:
            raise ValueError(f"Extension '{extension_key}' is not registered in the system.")
        if organization_id not in self._org_extensions:
            self._org_extensions[organization_id] = set()
        self._org_extensions[organization_id].add(extension_key)

    def disable_for_organization(self, organization_id: str, extension_key: str) -> None:
        if organization_id in self._org_extensions:
            self._org_extensions[organization_id].discard(extension_key)

    def is_enabled(self, organization_id: str, extension_key: str) -> bool:
        """
        Section 18: Checks whether extension is active for this tenant at runtime.
        Never hardcodes customer name or organization ID.
        """
        org_exts = self._org_extensions.get(organization_id, set())
        return extension_key in org_exts

    def execute_hook(self, organization_id: str, extension_key: str, hook_name: str, *args, **kwargs) -> Any:
        if not self.is_enabled(organization_id, extension_key):
            return None
        pkg = self._packages.get(extension_key)
        if pkg and hook_name in pkg.handlers:
            return pkg.handlers[hook_name](*args, **kwargs)
        return None
