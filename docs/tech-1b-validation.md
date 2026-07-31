# TECH.1B Validation Matrix

| Case | Expected |
|---|---|
| 土王 complete Lv31 + skeleton Lv30 | merge skeleton into complete record |
| 猛火猴 complete Lv25 + skeleton Lv21 | merge skeleton into complete record |
| two strong candidates for one skeleton | no automatic merge |
| conflicting populated recommendation | no automatic merge |
| active weak skeleton remains | audit failure |
| merge transaction fails | rollback |
| successful merge | loser archived; children/history preserved |
