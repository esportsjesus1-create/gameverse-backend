from app.database import MemoryDatabase, get_database, Collection


class TestCollection:
    def test_create_item(self):
        collection = Collection()
        item = collection.create({"name": "test"})
        assert "id" in item
        assert "created_at" in item
        assert "updated_at" in item
        assert item["name"] == "test"

    def test_get_item(self):
        collection = Collection()
        created = collection.create({"name": "test"})
        retrieved = collection.get(created["id"])
        assert retrieved is not None
        assert retrieved["name"] == "test"

    def test_get_nonexistent_item(self):
        collection = Collection()
        result = collection.get("nonexistent")
        assert result is None

    def test_get_all_items(self):
        collection = Collection()
        collection.create({"name": "test1", "type": "a"})
        collection.create({"name": "test2", "type": "b"})
        collection.create({"name": "test3", "type": "a"})

        all_items = collection.get_all()
        assert len(all_items) == 3

    def test_get_all_with_filters(self):
        collection = Collection()
        collection.create({"name": "test1", "type": "a"})
        collection.create({"name": "test2", "type": "b"})
        collection.create({"name": "test3", "type": "a"})

        filtered = collection.get_all({"type": "a"})
        assert len(filtered) == 2

    def test_update_item(self):
        collection = Collection()
        created = collection.create({"name": "test"})
        updated = collection.update(created["id"], {"name": "updated"})
        assert updated is not None
        assert updated["name"] == "updated"

    def test_update_nonexistent_item(self):
        collection = Collection()
        result = collection.update("nonexistent", {"name": "test"})
        assert result is None

    def test_delete_item(self):
        collection = Collection()
        created = collection.create({"name": "test"})
        result = collection.delete(created["id"])
        assert result is True
        assert collection.get(created["id"]) is None

    def test_delete_nonexistent_item(self):
        collection = Collection()
        result = collection.delete("nonexistent")
        assert result is False

    def test_count(self):
        collection = Collection()
        collection.create({"name": "test1", "type": "a"})
        collection.create({"name": "test2", "type": "b"})
        assert collection.count() == 2
        assert collection.count({"type": "a"}) == 1

    def test_clear(self):
        collection = Collection()
        collection.create({"name": "test1"})
        collection.create({"name": "test2"})
        collection.clear()
        assert collection.count() == 0


class TestMemoryDatabase:
    def test_singleton(self):
        db1 = MemoryDatabase()
        db2 = MemoryDatabase()
        assert db1 is db2

    def test_get_instance(self):
        db = MemoryDatabase.get_instance()
        assert db is not None
        assert isinstance(db, MemoryDatabase)

    def test_get_database_function(self):
        db = get_database()
        assert db is not None
        assert isinstance(db, MemoryDatabase)

    def test_collections_exist(self):
        db = get_database()
        assert hasattr(db, "resources")
        assert hasattr(db, "resource_usage")
        assert hasattr(db, "budgets")
        assert hasattr(db, "budget_alerts")
        assert hasattr(db, "cost_centers")
        assert hasattr(db, "cost_allocations")
        assert hasattr(db, "anomaly_configs")
        assert hasattr(db, "anomalies")
        assert hasattr(db, "recommendations")
        assert hasattr(db, "forecasts")

    def test_reset(self):
        db = get_database()
        db.resources.create({"name": "test"})
        assert db.resources.count() == 1
        db.reset()
        assert db.resources.count() == 0
