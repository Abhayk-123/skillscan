from dataclasses import dataclass

@dataclass
class UserDTO:
    id: int
    username: str
    email: str
    plan: str
    free_analyses_used: int
    is_paid: int
