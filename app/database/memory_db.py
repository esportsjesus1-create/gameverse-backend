import uuid
from datetime import datetime
from typing import TypeVar, Generic, Optional
from threading import Lock

T = TypeVar("T")


class Collection(Generic[T]):
    def __init__(self):
        self._data: dict[str, dict] = {}
        self._lock = Lock()

    def create(self, item: dict) -> dict:
        with self._lock:
            item_id = str(uuid.uuid4())
            now = datetime.utcnow()
            item["id"] = item_id
            item["created_at"] = now
            item["updated_at"] = now
            self._data[item_id] = item.copy()
            return self._data[item_id]

    def get(self, item_id: str) -> Optional[dict]:
        return self._data.get(item_id)

    def get_all(self, filters: Optional[dict] = None) -> list[dict]:
        items = list(self._data.values())
        if filters:
            for key, value in filters.items():
                items = [item for item in items if item.get(key) == value]
        return items

    def update(self, item_id: str, updates: dict) -> Optional[dict]:
        with self._lock:
            if item_id not in self._data:
                return None
            updates["updated_at"] = datetime.utcnow()
            self._data[item_id].update(updates)
            return self._data[item_id]

    def delete(self, item_id: str) -> bool:
        with self._lock:
            if item_id in self._data:
                del self._data[item_id]
                return True
            return False

    def count(self, filters: Optional[dict] = None) -> int:
        return len(self.get_all(filters))

    def clear(self):
        with self._lock:
            self._data.clear()


class MemoryDatabase:
    _instance: Optional["MemoryDatabase"] = None
    _lock = Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        self.resources: Collection = Collection()
        self.resource_usage: Collection = Collection()
        self.budgets: Collection = Collection()
        self.budget_alerts: Collection = Collection()
        self.cost_centers: Collection = Collection()
        self.cost_allocations: Collection = Collection()
        self.anomaly_configs: Collection = Collection()
        self.anomalies: Collection = Collection()
        self.recommendations: Collection = Collection()
        self.forecasts: Collection = Collection()

    def reset(self):
        self._initialize()

    @classmethod
    def get_instance(cls) -> "MemoryDatabase":
        return cls()


def get_database() -> MemoryDatabase:
    return MemoryDatabase.get_instance()
