export const PUBLIC_SPECIES_FORM_ROSTER_VERSION='public-species-form-roster-2026-08-14-a';
export const PUBLIC_SPECIES_FORM_ROSTER_STATUS='ACTIVE_GOVERNED_CATALOG_REFERENCE';
export const PUBLIC_SPECIES_FORM_ROSTER_SCOPE_DATE='2026-08-14';
export const PUBLIC_SPECIES_FORM_ROSTER_SOURCE_COMMIT='fc36317b195125c63bf56d3777fa3ed1a9548831';

const BERRY_SOURCE_KEYS=Object.freeze([
  'BUTTERFREE','RATICATE','ARBOK','PIKACHU_HALLOWEEN','RAICHU','CLEFABLE','NINETALES','NINETALES_ALOLAN',
  'PRIMEAPE','DODRIO','ONIX','MAROWAK','MEGANIUM','TYPHLOSION','FERALIGATR','XATU',
  'STEELIX','HOUNDOOM','BLAZIKEN','SWAMPERT','VIGOROTH','SLAKING','ALTARIA','BANETTE',
  'WALREIN','SALAMENCE','EMPOLEON','WEAVILE','MUSHARNA','TYRANTRUM','CATERPIE','METAPOD',
  'RATTATA','EKANS','PIKACHU','CLEFAIRY','VULPIX','VULPIX_ALOLAN','MANKEY','DODUO',
  'CUBONE','EEVEE_HOLIDAY','CHIKORITA','BAYLEEF','CYNDAQUIL','QUILAVA','TOTODILE','CROCONAW',
  'PICHU','CLEFFA','NATU','SNEASEL','HOUNDOUR','TORCHIC','COMBUSKEN','MUDKIP',
  'MARSHTOMP','SLAKOTH','SWABLU','SHUPPET','SPHEAL','SEALEO','BAGON','SHELGON',
  'PIPLUP','PRINPLUP','MUNNA','TYRUNT',
]);
const INGREDIENT_SOURCE_KEYS=Object.freeze([
  'VENUSAUR','CHARIZARD','BLASTOISE','DUGTRIO','VICTREEBEL','GOLEM','FARFETCHD','GENGAR',
  'KANGASKHAN','MR_MIME','PINSIR','DITTO','DRAGONITE','QUAGSIRE','DELIBIRD','BLISSEY',
  'PUPITAR','TYRANITAR','MAWILE','AGGRON','FLYGON','ABSOL','LUXRAY','TOXICROAK',
  'ABOMASNOW','GOURGEIST_SMALL','GOURGEIST_MEDIUM','GOURGEIST_LARGE','GOURGEIST_JUMBO','VIKAVOLT','BEWEAR','COMFEY',
  'CRAMORANT','DRAMPA','FLORAGATO','MEOWSCARADA','CROCALOR','SKELEDIRGE','QUAXWELL','QUAQUAVAL',
  'CETITAN','CLODSIRE','RIBOMBEE','BULBASAUR','IVYSAUR','CHARMANDER','CHARMELEON','SQUIRTLE',
  'WARTORTLE','DIGLETT','BELLSPROUT','WEEPINBELL','GEODUDE','GRAVELER','GASTLY','HAUNTER',
  'CHANSEY','DRATINI','DRAGONAIR','WOOPER','WOOPER_PALDEAN','LARVITAR','ARON','LAIRON',
  'TRAPINCH','VIBRAVA','SHINX','LUXIO','MIME_JR','HAPPINY','SPIRITOMB','CROAGUNK',
  'SNOVER','PUMPKABOO_SMALL','PUMPKABOO_MEDIUM','PUMPKABOO_LARGE','PUMPKABOO_JUMBO','GRUBBIN','CUTIEFLY','CHARJABUG',
  'STUFFUL','SPRIGATITO','FUECOCO','QUAXLY','CETODDLE',
]);
const SKILL_SOURCE_KEYS=Object.freeze([
  'WIGGLYTUFF','PERSIAN','GOLDUCK','ARCANINE','SLOWBRO','EEVEE_HALLOWEEN','VAPOREON','JOLTEON',
  'FLAREON','AMPHAROS','SUDOWOODO','ESPEON','UMBREON','SLOWKING','WOBBUFFET','SHUCKLE',
  'HERACROSS','RAIKOU','ENTEI','SUICUNE','SCEPTILE','TORTERRA','INFERNAPE','GARDEVOIR',
  'SABLEYE','PLUSLE','MINUN','SWALOT','SPHEAL_HOLIDAY','DRIFBLIM','HONCHKROW','LUCARIO',
  'MAGNEZONE','TOGEKISS','LEAFEON','GLACEON','GALLADE','CRESSELIA','LATIAS','LATIOS',
  'CRUSTLE','SANDSLASH','BRAVIARY','SYLVEON','HAWLUCHA','DEDENNE','TOGEDEMARU','MIMIKYU',
  'TOXTRICITY_AMPED','TOXTRICITY_LOW_KEY','PAWMOT','PIKACHU_HOLIDAY','JIGGLYPUFF','MEOWTH','PSYDUCK','GROWLITHE',
  'SLOWPOKE','MAGNEMITE','MAGNETON','EEVEE','IGGLYBUFF','TOGEPI','TOGETIC','MAREEP',
  'FLAAFFY','MURKROW','NOIBAT','NOIVERN','TREECKO','GROVYLE','TURTWIG','GROTLE',
  'CHIMCHAR','MONFERNO','RALTS','KIRLIA','GULPIN','WYNAUT','BONSLY','DRIFLOON',
  'RIOLU','DWEBBLE','RUFFLET','SANDSHREW','TOXEL','PAWMI','PAWMO',
]);
const ALL_SOURCE_KEYS=Object.freeze([
  'MEW','DARKRAI',
]);

export const PUBLIC_SPECIES_FORM_ROSTER_SOURCE_GROUPS=Object.freeze({
  BERRY:Object.freeze({source_path:'common/src/types/pokemon/berry-pokemon.ts',source_keys:BERRY_SOURCE_KEYS}),
  INGREDIENT:Object.freeze({source_path:'common/src/types/pokemon/ingredient-pokemon.ts',source_keys:INGREDIENT_SOURCE_KEYS}),
  SKILL:Object.freeze({source_path:'common/src/types/pokemon/skill-pokemon.ts',source_keys:SKILL_SOURCE_KEYS}),
  ALL:Object.freeze({source_path:'common/src/types/pokemon/all-pokemon.ts',source_keys:ALL_SOURCE_KEYS}),
});

const rows=[];
for(const [specialty_group,group] of Object.entries(PUBLIC_SPECIES_FORM_ROSTER_SOURCE_GROUPS)){
  for(const source_key of group.source_keys){
    rows.push(Object.freeze({
      canonical_species_form_id:`neroli:${source_key.toLowerCase()}`,
      source_key,
      specialty_group,
      source_commit:PUBLIC_SPECIES_FORM_ROSTER_SOURCE_COMMIT,
      source_path:group.source_path,
      roster_scope_date:PUBLIC_SPECIES_FORM_ROSTER_SCOPE_DATE,
      active_in_current_roster:true,
      rate_authority:false,
      player_observation:false,
    }));
  }
}
export const PUBLIC_SPECIES_FORM_ROSTER_ROWS=Object.freeze(rows);

export const PUBLIC_SPECIES_FORM_ROSTER_OFFICIAL_RECENCY_ANCHORS=Object.freeze([
  Object.freeze({appearing_from:'2026-02-09',source_keys:Object.freeze(['CUTIEFLY','RIBOMBEE']),source_ref:'https://www.pokemonsleep.net/zh/news/333630353538333532393737313030383037/'}),
  Object.freeze({appearing_from:'2026-03-23',source_keys:Object.freeze(['NOIBAT','NOIVERN']),source_ref:'https://www.pokemonsleep.net/zh/news/333736343238343936383639363534353239/'}),
  Object.freeze({appearing_from:'2026-04-06',source_keys:Object.freeze(['LATIAS']),source_ref:'https://www.pokemonsleep.net/zh/news/333831353535333734393439343030353833/'}),
  Object.freeze({appearing_from:'2026-04-27',source_keys:Object.freeze(['SANDSHREW','SANDSLASH']),source_ref:'https://www.pokemonsleep.net/zh/news/333838303933323639343738373335383734/'}),
  Object.freeze({appearing_from:'2026-05-11',source_keys:Object.freeze(['TYRUNT','TYRANTRUM']),source_ref:'https://www.pokemonsleep.net/zh/news/333933313533313537393633373130343639/'}),
  Object.freeze({appearing_from:'2026-05-25',source_keys:Object.freeze(['DRAMPA']),source_ref:'https://www.pokemonsleep.net/news/333938393437393038363538393231343735/'}),
  Object.freeze({appearing_from:'2026-06-08',source_keys:Object.freeze(['LATIOS']),source_ref:'https://www.pokemonsleep.net/zh/news/343031343531353932363432393835393839/'}),
  Object.freeze({appearing_from:'2026-07-13',source_keys:Object.freeze(['TURTWIG','GROTLE','TORTERRA','CHIMCHAR','MONFERNO','INFERNAPE','PIPLUP','PRINPLUP','EMPOLEON']),source_ref:'https://www.pokemonsleep.net/news/343138353434383532393736373935363530/'}),
]);

export const PUBLIC_SPECIES_FORM_ROSTER_ANNOUNCED_PENDING=Object.freeze([
  Object.freeze({
    announced_at:'2026-07-20',
    display_names:Object.freeze(["Pikachu wearing a captain’s hat",'Tinkatink','Tinkatuff','Tinkaton']),
    source_ref:'https://www.pokemonsleep.net/en/news/343231343531373437313438343331333833/',
    inclusion_status:'ANNOUNCED_NOT_INCLUDED_WITHOUT_APPEARING_FROM_EVIDENCE',
  }),
]);

export const PUBLIC_SPECIES_FORM_ROSTER_POLICY=Object.freeze({
  catalog_authority_class:'PINNED_OPEN_SOURCE_CATALOG_WITH_OFFICIAL_RECENCY_ANCHORS',
  source_commit_pinned:true,
  source_group_count:4,
  expected_row_count:242,
  unique_canonical_id_required:true,
  unique_source_key_required:true,
  current_scope_date:PUBLIC_SPECIES_FORM_ROSTER_SCOPE_DATE,
  official_recency_anchor_required:true,
  announced_future_or_pending_entries_auto_include:false,
  rate_values_in_scope:false,
  player_roster_in_scope:false,
  runtime_network_fetch:false,
  ai_inferred_missing_rows:false,
});

function duplicateValues(values){
  const seen=new Set(),dupes=new Set();
  for(const value of values){if(seen.has(value))dupes.add(value);else seen.add(value);}
  return [...dupes].sort();
}

export function currentPublicSpeciesFormRoster(){
  const sourceKeys=PUBLIC_SPECIES_FORM_ROSTER_ROWS.map(row=>row.source_key);
  const canonicalIds=PUBLIC_SPECIES_FORM_ROSTER_ROWS.map(row=>row.canonical_species_form_id);
  const sourceKeyDuplicates=duplicateValues(sourceKeys);
  const canonicalIdDuplicates=duplicateValues(canonicalIds);
  const anchorMissing=PUBLIC_SPECIES_FORM_ROSTER_OFFICIAL_RECENCY_ANCHORS.flatMap(anchor=>
    anchor.source_keys.filter(sourceKey=>!sourceKeys.includes(sourceKey)).map(sourceKey=>`${anchor.appearing_from}:${sourceKey}`)
  );
  const rowCount=PUBLIC_SPECIES_FORM_ROSTER_ROWS.length;
  const complete=rowCount===PUBLIC_SPECIES_FORM_ROSTER_POLICY.expected_row_count
    && sourceKeyDuplicates.length===0
    && canonicalIdDuplicates.length===0
    && anchorMissing.length===0;
  return Object.freeze({
    schema:'pokemon-sleep-public-species-form-roster/1.0',
    version:PUBLIC_SPECIES_FORM_ROSTER_VERSION,
    status:PUBLIC_SPECIES_FORM_ROSTER_STATUS,
    scope_date:PUBLIC_SPECIES_FORM_ROSTER_SCOPE_DATE,
    source_commit:PUBLIC_SPECIES_FORM_ROSTER_SOURCE_COMMIT,
    row_count:rowCount,
    specialty_group_counts:Object.freeze(Object.fromEntries(Object.entries(PUBLIC_SPECIES_FORM_ROSTER_SOURCE_GROUPS).map(([key,group])=>[key,group.source_keys.length]))),
    unique_source_key_count:new Set(sourceKeys).size,
    unique_canonical_id_count:new Set(canonicalIds).size,
    duplicate_source_keys:Object.freeze(sourceKeyDuplicates),
    duplicate_canonical_ids:Object.freeze(canonicalIdDuplicates),
    official_recency_anchor_count:PUBLIC_SPECIES_FORM_ROSTER_OFFICIAL_RECENCY_ANCHORS.length,
    official_recency_anchor_species_form_count:PUBLIC_SPECIES_FORM_ROSTER_OFFICIAL_RECENCY_ANCHORS.reduce((sum,row)=>sum+row.source_keys.length,0),
    official_recency_anchor_missing:Object.freeze(anchorMissing),
    announced_pending_count:PUBLIC_SPECIES_FORM_ROSTER_ANNOUNCED_PENDING.reduce((sum,row)=>sum+row.display_names.length,0),
    complete_current_catalog_reference:complete,
    activation_coverage_denominator_ready:complete,
    expected_current_species_form_count:complete?rowCount:null,
    rate_authority:false,
    policy:PUBLIC_SPECIES_FORM_ROSTER_POLICY,
  });
}

export function publicSpeciesFormRosterRow(sourceKey){
  const key=String(sourceKey??'').normalize('NFKC').trim().toUpperCase();
  return PUBLIC_SPECIES_FORM_ROSTER_ROWS.find(row=>row.source_key===key)||null;
}
