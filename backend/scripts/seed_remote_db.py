import os
import sys

# Ensure backend root is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import init_db, SessionLocal
from app.controllers.data_controller import DataController

def main():
    print("==================================================")
    print("Corvo Engineering - Remote Database Seeder")
    print("==================================================")
    print("Initializing database tables...")
    init_db()
    
    db = SessionLocal()
    try:
        ctrl = DataController(db)
        print("Importing master data, contracts, and PO history...")
        res = ctrl.import_all()
        print("Import successful! Rows ingested:")
        for k, v in res.items():
            print(f"  • {k}: {v}")
            
        print("\nVerified Database Counts:")
        stats = ctrl.get_stats()
        for k, v in stats.items():
            print(f"  • {k}: {v}")
        print("==================================================")
        print("Database is ready for Corvo Procurement Engine!")
    finally:
        db.close()

if __name__ == "__main__":
    main()
