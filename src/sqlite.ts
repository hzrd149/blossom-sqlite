import { Database } from "better-sqlite3";

export type BlossomSQLiteOptions = {
  blobTable: string;
  ownerTable: string;
};

export const DEFAULT_OPTIONS: BlossomSQLiteOptions = {
  blobTable: "blobs",
  ownerTable: "owners",
};

export type BlobRow = {
  sha256: string;
  size: number;
  created: number;
  type: string;
};
export type OwnerRow = {
  id: number;
  sha256: string;
  pubkey: string;
};
export type InsertOwner = Omit<OwnerRow, "id">;

export class BlossomSQLite {
  db: Database;
  opts: BlossomSQLiteOptions;

  constructor(db: Database, opts = DEFAULT_OPTIONS) {
    this.db = db;
    this.opts = { ...opts };

    // Create blobs table
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS blobs (
					sha256 TEXT(64) PRIMARY KEY,
					type TEXT,
					size INTEGER NOT NULL,
					created INTEGER NOT NULL
				)`,
      )
      .run();

    this.db
      .prepare("CREATE INDEX IF NOT EXISTS blobs_created ON blobs (created)")
      .run();

    // Create owners table
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS owners (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					blob TEXT(64) REFERENCES blobs(sha256),
					pubkey TEXT(64)
				)`,
      )
      .run();

    this.db
      .prepare("CREATE INDEX IF NOT EXISTS owners_pubkey ON owners (pubkey)")
      .run();
  }

  hasBlob(sha256: string) {
    return !!this.db
      .prepare(`SELECT sha256 FROM blobs where sha256 = ?`)
      .get(sha256);
  }
  getBlob(sha256: string) {
    return this.db
      .prepare(`SELECT * FROM blobs where sha256 = ?`)
      .get(sha256) as BlobRow;
  }
  getAllBlobs(_opts?: { since?: number; until?: number }) {
    return this.db.prepare(`SELECT * FROM blobs`).all();
  }
  addBlob(blob: BlobRow) {
    this.db
      .prepare(
        `INSERT INTO blobs (sha256, size, type, created) VALUES (?, ?, ?, ?)`,
      )
      .run(blob.sha256, blob.size, blob.type, blob.created);
    return blob;
  }
  addManyBlobs(blobs: BlobRow[]) {
    const insert = this.db.prepare(
      `INSERT INTO blobs (sha256, size, type, created) VALUES (?, ?, ?, ?)`,
    );

    const many = this.db.transaction((arr: BlobRow[]) => {
      for (const blob of arr)
        insert.run(blob.sha256, blob.size, blob.type, blob.created);
    });

    many(blobs);
  }
  removeBlob(sha256: string) {
    // remove owners
    this.db.prepare("DELETE FROM owners WHERE blob = ?").run(sha256);
    // remove blobs
    this.db.prepare("DELETE FROM blobs WHERE sha256 = ?").run(sha256);
  }

  hasOwner(sha256: string, pubkey: string) {
    return !!this.db
      .prepare(`SELECT * FROM owners where blob = ? AND pubkey = ?`)
      .get(sha256, pubkey);
  }
  getAllOwners() {
    return this.db.prepare(`SELECT * FROM owners`).all();
  }
  addOwner(sha256: string, pubkey: string) {
    this.db
      .prepare(`INSERT INTO owners (blob, pubkey) VALUES (?, ?)`)
      .run(sha256, pubkey);
  }
  removeOwner(sha256: string, pubkey: string) {
    this.db
      .prepare("DELETE FROM owners WHERE blob = ? AND pubkey = ?")
      .run(sha256, pubkey);
  }

  getOwnerBlobs(pubkey: string, _opts?: { since?: number; until?: number }) {
    return this.db
      .prepare(
        `SELECT blobs.* FROM owners LEFT JOIN blobs ON blobs.sha256 = owners.blob WHERE owners.pubkey = ?`,
      )
      .all(pubkey) as BlobRow[];
  }
}
