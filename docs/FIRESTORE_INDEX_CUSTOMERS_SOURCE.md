y# Firestore Index for Customer Source Filter

Deploy indexes manually if `firestore:indexes` fails:

```bash
firebase deploy --only firestore:indexes
```

Or add these to `firestore.indexes.json` in the `indexes` array:

1. **org_id + source + createdAt**
```json
{
  "collectionGroup": "customers",
  "queryScope": "COLLECTION",
  "fields": [
    {"fieldPath": "org_id", "order": "ASCENDING"},
    {"fieldPath": "source", "order": "ASCENDING"},
    {"fieldPath": "createdAt", "order": "DESCENDING"}
  ]
}
```

2. **org_id + branch_id + source + createdAt**
```json
{
  "collectionGroup": "customers",
  "queryScope": "COLLECTION",
  "fields": [
    {"fieldPath": "org_id", "order": "ASCENDING"},
    {"fieldPath": "branch_id", "order": "ASCENDING"},
    {"fieldPath": "source", "order": "ASCENDING"},
    {"fieldPath": "createdAt", "order": "DESCENDING"}
  ]
}
```

Required for channel-filtered customer list (LINE, Facebook, Instagram, TikTok).
