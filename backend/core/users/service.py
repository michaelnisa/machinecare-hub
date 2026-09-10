"""
MachineCare Core - User Service
"""

from typing import Dict, Optional
from .models import User

class UserService:
    def __init__(self):
        self._users: Dict[str, User] = {}

    def get_user(self, user_id: str) -> Optional[User]:
        return self._users.get(user_id)

    def save_user(self, user: User) -> User:
        self._users[user.id] = user
        return user
