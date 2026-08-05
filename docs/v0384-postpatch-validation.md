# v0.3.84 post-patch validation

This validation PR runs the complete repository CI suite against the generated v0.3.84 main source after the database/catalog recovery patch was applied.

Required runtime contracts:
- visible version v0.3.84
- database-ready retry before catalog persistence
- 76 public recipes, locked by default, level 1
- item effect descriptions projected to the item page
- ingredient/subskill unlock marks derived from Pokémon level
- existing private player state remains untouched
